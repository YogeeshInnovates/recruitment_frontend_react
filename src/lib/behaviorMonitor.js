const CDN = '/mediapipe';
const MODEL = '/mediapipe/wasm/face_landmarker.task';

// Pose thresholds (degrees)
const YAW_FIRE = 32;
const YAW_RELEASE = 24;
const PITCH_FIRE = 25;
const PITCH_RELEASE = 18;
const TURN_CONFIRM_MS = 500;
const PITCH_CONFIRM_MS = 500;
const LAUGH_CONFIRM_MS = 400;
const MULTI_FACE_CONFIRM_MS = 700;

// Gaze
const GAZE_FIRE = 0.28;
const GAZE_RELEASE = 0.2;
const GAZE_CONFIRM_MS = 1200;

// Robustness
const CALIB_MS = 2500;
const FACE_LOST_MS = 2500;
const NO_BLINK_MS = 30000;
const FROZEN_MS = 4000;
const FROZEN_DIFF = 1.5;

// Input sizes
const DETECT_W = 320;
const DETECT_H = 240;
const FROZEN_W = 16;
const FROZEN_H = 16;

const SMILE_T = 0.35;
const JAW_T = 0.25;

const LABELS = {
  turnLeft: 'HEAD_TURN_LEFT',
  turnRight: 'HEAD_TURN_RIGHT',
  lookDown: 'LOOK_DOWN',
  laugh: 'LAUGHING',
  multiFace: 'MULTI_FACE',
  faceLost: 'FACE_LOST',
  noBlink: 'NO_BLINK',
  cameraFrozen: 'CAMERA_FROZEN',
  gazeOff: 'GAZE_OFF',
};

let landmarker = null;
let supportsMatrix = true;
let video = null;
let running = false;
let rafId = null;
let lastVideoTime = -1;
let lastDetection = 0;
let onEventCallback = null;

// Detection robustness
let detectCanvas = null;
let detectCtx = null;
let useCanvas = true;
let frameCount = 0;
let frameStride = 1;
const recentDur = [];

// Frozen-frame detection
let frozenCanvas = null;
let frozenCtx = null;
let prevFrozenPixels = null;
let frozenLowSince = 0;
let frozenFired = false;

// Face/blink state
let lastFaceAt = 0;
let faceLostFired = false;
let lastBlinkAt = 0;
let noBlinkFired = false;

// Calibration
let calibStart = 0;
let calibrationDone = false;
let baselineYaw = null;
let baselinePitch = null;
let baselineRatio = null;

// Smoothed magnitudes
let yawMagS = 0;
let pitchMagS = 0;

const trackers = {};
const lastDetail = {};

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('GPU delegate timed out')), ms);
    promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

async function loadVision() {
  const vision = await import(CDN + '/vision_bundle.mjs');
  const { FilesetResolver, FaceLandmarker } = vision;
  const fileset = await FilesetResolver.forVisionTasks(CDN + '/wasm');
  const base = {
    modelAssetPath: MODEL,
    runningMode: 'VIDEO',
    numFaces: 2,
    outputFaceBlendshapes: true,
    minFaceDetectionConfidence: 0.4,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  };

  const tryCreate = async (delegate, withMatrix) => {
    const opts = {
      baseOptions: { modelAssetPath: MODEL, delegate },
      ...base,
      ...(withMatrix ? { outputFaceTransformationMatrixes: true } : {}),
    };
    return FaceLandmarker.createFromOptions(fileset, opts);
  };

  let lm = null;
  try {
    lm = await withTimeout(tryCreate('GPU', true), 20000);
    supportsMatrix = true;
  } catch (e) {
    try {
      lm = await withTimeout(tryCreate('GPU', false), 20000);
      supportsMatrix = false;
    } catch (e2) {
      try {
        lm = await tryCreate('CPU', supportsMatrix);
      } catch (e3) {
        lm = await tryCreate('CPU', false);
        supportsMatrix = false;
      }
    }
  }
  return lm;
}

function blend(bs, name) {
  if (!bs || !bs.categories) return 0;
  const c = bs.categories.find(x => x.categoryName === name);
  return c ? c.score : 0;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Extract yaw/pitch from the face transformation matrix (magnitude signal).
// Direction (left/right/down) comes from landmark offsets, so exact sign here is irrelevant.
function matrixYawPitch(matrix) {
  if (!matrix) return null;
  let d;
  if (matrix.data) d = matrix.data;
  else if (matrix.rotation) {
    const R = matrix.rotation;
    d = [R[0][0], R[1][0], R[2][0], 0, R[0][1], R[1][1], R[2][1], 0, R[0][2], R[1][2], R[2][2], 0, 0, 0, 0, 1];
  } else return null;
  if (!d || d.length < 9) return null;
  const yaw = Math.atan2(d[1], d[0]) * 180 / Math.PI;
  const pitch = Math.asin(clamp(-d[2], -1, 1)) * 180 / Math.PI;
  return { yaw, pitch };
}

function computeLandmarks(lm) {
  const nose = lm[1], eL = lm[33], eR = lm[263], chin = lm[152];
  if (!nose || !eL || !eR || !chin) return null;
  const eyeW = Math.abs(eR.x - eL.x) || 1;
  const midX = (eL.x + eR.x) / 2;
  const offset = (nose.x - midX) / eyeW;
  const eyeMidY = (eL.y + eR.y) / 2;
  const denom = (chin.y - eyeMidY) || 1;
  const ratio = (nose.y - eyeMidY) / denom;
  return { offset, ratio };
}

function computeGazeDev(lm) {
  const iL = lm[468], iR = lm[473];
  const lOuter = lm[33], lInner = lm[133];
  const rOuter = lm[263], rInner = lm[362];
  if (!iL || !iR || !lOuter || !lInner || !rOuter || !rInner) return null;
  const denomL = (lInner.x - lOuter.x) || 1e-6;
  const denomR = (rInner.x - rOuter.x) || 1e-6;
  const gl = (iL.x - lOuter.x) / denomL;
  const gr = (iR.x - rOuter.x) / denomR;
  return (gl + gr) / 2 - 0.5;
}

function fire(type, detail) {
  if (onEventCallback) onEventCallback(type, detail || lastDetail[type] || '');
}

function holdTrack(name, active, lowActive, now, confirmMs) {
  const t = trackers[name] || (trackers[name] = { holdStart: null, fired: false });
  if (lowActive) {
    if (active) {
      if (t.holdStart === null) t.holdStart = now;
      else if (!t.fired && now - t.holdStart >= confirmMs) {
        t.fired = true;
        fire(LABELS[name], lastDetail[name] || '');
      }
    } else if (t.holdStart !== null) {
      t.holdStart = now;
    }
  } else {
    t.holdStart = null;
    t.fired = false;
  }
}

function processFrame(res, now) {
  const faces = res.faceLandmarks || [];
  const faceCount = faces.length;

  // Face-lost detection
  if (faceCount > 0) {
    lastFaceAt = now;
    faceLostFired = false;
    if (lastBlinkAt === 0) lastBlinkAt = now;
  } else {
    if (lastFaceAt !== 0 && !faceLostFired && now - lastFaceAt > FACE_LOST_MS) {
      faceLostFired = true;
      fire('FACE_LOST', 'No face detected for ' + Math.round((now - lastFaceAt) / 1000) + 's — camera covered or left frame');
    }
    if (faces.length === 0) return;
  }

  let anyTurnL = false, anyTurnR = false, anyDown = false, anyLaugh = false, anyGaze = false;
  let blinkMax = 0;
  let maxYawMag = 0, maxPitchMag = 0;

  for (let i = 0; i < faces.length; i++) {
    const lm = faces[i];
    const info = computeLandmarks(lm);
    if (!info) continue;
    const { offset, ratio } = info;

    const pose = matrixYawPitch(res.faceTransformationMatrixes && res.faceTransformationMatrixes[i]);
    const hasPose = supportsMatrix && pose;

    let yawMag = 0, pitchMag = 0;

    if (calibrationDone) {
      if (hasPose) {
        yawMag = Math.abs(pose.yaw - baselineYaw);
        pitchMag = Math.abs(pose.pitch - baselinePitch);
      } else {
        yawMag = Math.abs(Math.asin(clamp(offset * 2, -1, 1))) * 180 / Math.PI;
        pitchMag = baselineRatio !== null ? Math.abs((ratio - baselineRatio) * 200) : 0;
      }
    } else {
      // Calibrating: record neutral pose
      const rawYaw = hasPose ? pose.yaw : Math.asin(clamp(offset * 2, -1, 1)) * 180 / Math.PI;
      const rawPitch = hasPose ? pose.pitch : ratio * 200;
      if (calibStart === 0) calibStart = now;
      if (baselineYaw === null) {
        baselineYaw = rawYaw;
        baselinePitch = rawPitch;
        baselineRatio = ratio;
      } else {
        baselineYaw = baselineYaw * 0.95 + rawYaw * 0.05;
        baselinePitch = baselinePitch * 0.95 + rawPitch * 0.05;
        baselineRatio = baselineRatio * 0.9 + ratio * 0.1;
      }
      if (now - calibStart >= CALIB_MS) calibrationDone = true;
      continue;
    }

    maxYawMag = Math.max(maxYawMag, yawMag);
    maxPitchMag = Math.max(maxPitchMag, pitchMag);

    // Direction hints from landmarks (robust sign)
    const dir = offset > 0.08 ? 'LEFT' : offset < -0.08 ? 'RIGHT' : 'CENTER';
    const downHint = baselineRatio !== null && ratio - baselineRatio > 0.015;
    const upHint = baselineRatio !== null && baselineRatio - ratio > 0.015;

    if (dir === 'LEFT') anyTurnL = anyTurnL || yawMag > YAW_FIRE;
    if (dir === 'RIGHT') anyTurnR = anyTurnR || yawMag > YAW_FIRE;
    if (downHint) anyDown = anyDown || pitchMag > PITCH_FIRE;

    if (upHint && pitchMag > PITCH_FIRE) {
      lastDetail.lookUp = pitchMag.toFixed(0) + '° pitch';
      // looking up is not a violation; ignore
    }

    const bs = res.faceBlendshapes && res.faceBlendshapes[i];
    const smile = (blend(bs, 'mouthSmileLeft') + blend(bs, 'mouthSmileRight')) / 2;
    const jaw = Math.max(blend(bs, 'jawOpen'), blend(bs, 'mouthOpen'));
    if (smile > SMILE_T && jaw > JAW_T) {
      anyLaugh = true;
      lastDetail.laugh = 'smile ' + smile.toFixed(2) + ' jaw ' + jaw.toFixed(2);
    }

    blinkMax = Math.max(blinkMax, blend(bs, 'eyeBlinkLeft'), blend(bs, 'eyeBlinkRight'));

    // Gaze only meaningful when head is neutral
    if (hasPose && yawMag < 14 && pitchMag < 12) {
      const gDev = computeGazeDev(lm);
      if (gDev !== null) {
        const gDevS = Math.abs(gDev);
        if (gDevS > GAZE_FIRE) {
          anyGaze = true;
          lastDetail.gazeOff = 'gaze ' + gDev.toFixed(2) + ' from center';
        }
      }
    }

    lastDetail.turnLeft = yawMag.toFixed(0) + '° yaw';
    lastDetail.turnRight = yawMag.toFixed(0) + '° yaw';
    lastDetail.lookDown = pitchMag.toFixed(0) + '° pitch';
  }

  if (calibrationDone) {
    // EMA smoothing on magnitudes (kills frame-to-frame noise)
    yawMagS = yawMagS * 0.7 + maxYawMag * 0.3;
    pitchMagS = pitchMagS * 0.7 + maxPitchMag * 0.3;

    // Slow baseline adaptation when near neutral
    if (yawMagS < 12 && supportsMatrix && baselineYaw !== null) {
      const p = matrixYawPitch(res.faceTransformationMatrixes && res.faceTransformationMatrixes[0]);
      if (p) baselineYaw = baselineYaw * 0.995 + p.yaw * 0.005;
    }
    if (pitchMagS < 10 && supportsMatrix && baselinePitch !== null) {
      const p = matrixYawPitch(res.faceTransformationMatrixes && res.faceTransformationMatrixes[0]);
      if (p) baselinePitch = baselinePitch * 0.995 + p.pitch * 0.005;
    }

    const turnLActive = anyTurnL && yawMagS > YAW_FIRE;
    const turnRActive = anyTurnR && yawMagS > YAW_FIRE;
    const downActive = anyDown && pitchMagS > PITCH_FIRE;

    holdTrack('turnLeft', turnLActive, yawMagS > YAW_RELEASE, now, TURN_CONFIRM_MS);
    holdTrack('turnRight', turnRActive, yawMagS > YAW_RELEASE, now, TURN_CONFIRM_MS);
    holdTrack('lookDown', downActive, pitchMagS > PITCH_RELEASE, now, PITCH_CONFIRM_MS);
    holdTrack('gazeOff', anyGaze, anyGaze, now, GAZE_CONFIRM_MS);
  }

  if (faces.length >= 2) lastDetail.multiFace = faces.length + ' faces on screen';
  holdTrack('multiFace', faces.length >= 2, faces.length >= 2, now, MULTI_FACE_CONFIRM_MS);
  holdTrack('laugh', anyLaugh, anyLaugh, now, LAUGH_CONFIRM_MS);

  // No-blink (static photo) detection
  if (blinkMax > 0.5) {
    lastBlinkAt = now;
    noBlinkFired = false;
  } else if (!noBlinkFired && lastBlinkAt !== 0 && now - lastBlinkAt > NO_BLINK_MS) {
    noBlinkFired = true;
    fire('NO_BLINK', 'No blinking for 30s — possible static photo in front of camera');
  }
}

function updateFrozenFingerprint(now) {
  try {
    if (!frozenCanvas || !frozenCtx) return;
    frozenCtx.drawImage(video, 0, 0, FROZEN_W, FROZEN_H);
    const data = frozenCtx.getImageData(0, 0, FROZEN_W, FROZEN_H).data;
    const cur = new Float32Array(FROZEN_W * FROZEN_H);
    for (let i = 0; i < data.length; i += 4) {
      cur[i >> 2] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    if (prevFrozenPixels) {
      let sum = 0;
      for (let i = 0; i < cur.length; i++) sum += Math.abs(cur[i] - prevFrozenPixels[i]);
      const diff = sum / cur.length;
      if (diff < FROZEN_DIFF) {
        if (frozenLowSince === 0) frozenLowSince = now;
        else if (!frozenFired && now - frozenLowSince > FROZEN_MS) {
          frozenFired = true;
          fire('CAMERA_FROZEN', 'Static camera frame for ' + Math.round(FROZEN_MS / 1000) + 's — photo or screen in front of camera');
        }
      } else {
        frozenLowSince = 0;
        frozenFired = false;
      }
    }
    prevFrozenPixels = cur;
  } catch (e) { /* ignore */ }
}

function adaptStride(dur) {
  recentDur.push(dur);
  if (recentDur.length > 20) recentDur.shift();
  const avg = recentDur.reduce((a, b) => a + b, 0) / recentDur.length;
  if (avg > 60) frameStride = 3;
  else if (avg > 40) frameStride = 2;
  else frameStride = 1;
}

function detectLoop() {
  if (!running) return;
  const now = performance.now();
  frameCount += 1;
  const shouldDetect = frameStride <= 1 || frameCount % frameStride === 0;

  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    updateFrozenFingerprint(now);
    if (shouldDetect && now - lastDetection >= 33) {
      lastDetection = now;
      let res = null;
      const t0 = performance.now();
      try {
        if (useCanvas && detectCanvas && detectCtx) {
          detectCtx.drawImage(video, 0, 0, DETECT_W, DETECT_H);
          res = landmarker.detectForVideo(detectCanvas, now);
        } else {
          res = landmarker.detectForVideo(video, now);
        }
      } catch (e) {
        if (useCanvas) {
          useCanvas = false;
          try { res = landmarker.detectForVideo(video, now); } catch (e2) { /* ignore */ }
        }
      }
      if (res) processFrame(res, now);
      adaptStride(performance.now() - t0);
    }
  }
  rafId = requestAnimationFrame(detectLoop);
}

function resetState() {
  lastVideoTime = -1;
  lastDetection = 0;
  frameCount = 0;
  frameStride = 1;
  recentDur.length = 0;
  prevFrozenPixels = null;
  frozenLowSince = 0;
  frozenFired = false;
  lastFaceAt = 0;
  faceLostFired = false;
  lastBlinkAt = 0;
  noBlinkFired = false;
  calibStart = 0;
  calibrationDone = false;
  baselineYaw = null;
  baselinePitch = null;
  baselineRatio = null;
  yawMagS = 0;
  pitchMagS = 0;
  useCanvas = true;
  for (const k in trackers) { trackers[k].holdStart = null; trackers[k].fired = false; }
}

export async function warmUpModel() {
  if (landmarker) return;
  landmarker = await loadVision();
}

export async function startMonitoring(videoEl, onEvent) {
  if (running) return;
  if (!videoEl) return;
  if (!landmarker) landmarker = await loadVision();
  if (videoEl.readyState < 2) {
    await Promise.race([
      new Promise(resolve => videoEl.addEventListener('loadeddata', resolve, { once: true })),
      new Promise(resolve => setTimeout(resolve, 3000))
    ]);
  }
  video = videoEl;
  onEventCallback = onEvent;
  resetState();

  if (!detectCanvas) {
    detectCanvas = document.createElement('canvas');
    detectCanvas.width = DETECT_W;
    detectCanvas.height = DETECT_H;
    detectCtx = detectCanvas.getContext('2d');
  }
  if (!frozenCanvas) {
    frozenCanvas = document.createElement('canvas');
    frozenCanvas.width = FROZEN_W;
    frozenCanvas.height = FROZEN_H;
    frozenCtx = frozenCanvas.getContext('2d');
  }

  running = true;
  rafId = requestAnimationFrame(detectLoop);
}

export function stopMonitoring() {
  running = false;
  onEventCallback = null;
  if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  for (const k in trackers) { trackers[k].holdStart = null; trackers[k].fired = false; }
}
