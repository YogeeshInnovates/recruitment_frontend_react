const CDN = '/mediapipe';
const MODEL = '/mediapipe/wasm/face_landmarker.task';

// ============ Smart 3D monitoring configuration (zone model) ============
// Head pose (degrees, from face transformation matrix — true 3D)
const HEAD_SAFE_YAW = 20;         // safe up to ±20°
const HEAD_ALERT_YAW = 35;        // suspicious beyond ±35°
const HEAD_SAFE_PITCH_DOWN = 15;  // safe pitch down up to 15°
const HEAD_ALERT_PITCH_DOWN = 25; // suspicious pitch down beyond 25°
const HEAD_SAFE_PITCH_UP = 12;    // safe pitch up up to 12°
const HEAD_ALERT_PITCH_UP = 20;   // suspicious pitch up beyond 20°

// Eyes
const EYE_GAZE_TH = 0.30;         // iris offset beyond this => caution
const EYE_ON_SCREEN = 0.60;       // iris offset beyond this => looking off-screen
const EAR_CLOSED = 0.20;          // eye aspect ratio below => closed

// Sustain before an event/capture fires (only SUSTAINED suspicious counts)
const HEAD_SUSTAIN_MS = 4000;     // head turn / head down > 4s
const GAZE_SUSTAIN_MS = 3000;     // eyes off-screen > 3s
const CLOSED_SUSTAIN_MS = 6000;   // eyes closed > 5s (strict — not 2s)
const FACE_LOST_MS = 5000;        // no face > 5s
const MULTI_FACE_CONFIRM_MS = 700;
const LAUGH_CONFIRM_MS = 400;

// Robustness
const CALIB_MS = 2500;
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

// Face state
let lastFaceAt = 0;
let faceLostFired = false;

// Warm-up / drift calibration (baseline normalizes the person's natural sitting angle)
let calibStart = 0;
let calibrationDone = false;
let baselineYaw = null;
let baselinePitch = null;
let baselineRatio = null;

// Smoothed magnitudes
let yawMagS = 0;
let pitchMagS = 0;

// Attention score 0-100
let attention = 100;

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

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Extract signed 3D yaw/pitch from the face transformation matrix.
// Negative yaw = turned left, negative pitch = looking down.
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

// Normalized iris gaze offset, centered at 0 (x < 0 = left, y > 0 = down)
function computeGaze(lm) {
  const iL = lm[468], iR = lm[473];
  const lOuter = lm[33], lInner = lm[133], lTop = lm[159], lBottom = lm[145];
  const rOuter = lm[263], rInner = lm[362], rTop = lm[386], rBottom = lm[374];
  if (!iL || !iR || !lOuter || !lInner || !lTop || !lBottom || !rOuter || !rInner || !rTop || !rBottom) return null;
  const wL = (lOuter.x - lInner.x) || 1e-6;
  const wR = (rOuter.x - rInner.x) || 1e-6;
  const hL = (lBottom.y - lTop.y) || 1e-6;
  const hR = (rBottom.y - rTop.y) || 1e-6;
  const nxL = (iL.x - lInner.x) / wL;
  const nxR = (iR.x - rInner.x) / wR;
  const nyL = (iL.y - lTop.y) / hL;
  const nyR = (iR.y - rTop.y) / hR;
  const x = ((nxL + nxR) / 2 - 0.5) * 2;
  const y = ((nyL + nyR) / 2 - 0.5) * 2;
  return { x, y };
}

// Eye aspect ratio (EAR) — < EAR_CLOSED means eye closed
function eyeAspectRatio(lm, side) {
  let p1, p2, p3, p4, p5, p6;
  if (side === 'left') {
    p1 = lm[33]; p2 = lm[160]; p3 = lm[158]; p4 = lm[133]; p5 = lm[153]; p6 = lm[144];
  } else {
    p1 = lm[362]; p2 = lm[385]; p3 = lm[387]; p4 = lm[263]; p5 = lm[373]; p6 = lm[380];
  }
  if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) return null;
  const v = (dist(p2, p6) + dist(p3, p5)) / (2 * dist(p1, p4) || 1e-6);
  return v;
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

function withAttention(d) {
  return d + ` · attention ${Math.round(attention)}%`;
}

function updateAttention(anySus, anyCaution) {
  if (anySus) attention = Math.max(0, attention - 1.2);
  else if (anyCaution) attention = Math.max(0, attention - 0.5);
  else attention = Math.min(100, attention + 0.3);
}

function processFrame(res, now) {
  const faces = res.faceLandmarks || [];
  const faceCount = faces.length;

  // Face-lost detection
  if (faceCount > 0) {
    lastFaceAt = now;
    faceLostFired = false;
  } else {
    if (lastFaceAt !== 0 && !faceLostFired && now - lastFaceAt > FACE_LOST_MS) {
      faceLostFired = true;
      fire('FACE_LOST', 'No face detected for ' + Math.round((now - lastFaceAt) / 1000) + 's — camera covered or left frame');
    }
    if (faces.length === 0) return;
  }

  let anyTurnL = false, anyTurnR = false, anyDown = false, anyGaze = false, anyClosed = false;
  let anyCaution = false, anyLaugh = false;
  let maxYawMag = 0, maxPitchMag = 0;
  let turnDetail = '', downDetail = '', gazeDetail = '', closedDetail = '';

  for (let i = 0; i < faces.length; i++) {
    const lm = faces[i];
    const info = computeLandmarks(lm);
    if (!info) continue;
    const { offset, ratio } = info;

    const pose = matrixYawPitch(res.faceTransformationMatrixes && res.faceTransformationMatrixes[i]);
    const hasPose = supportsMatrix && pose;

    let yaw = 0, pitch = 0;
    if (calibrationDone) {
      if (hasPose) {
        yaw = pose.yaw - baselineYaw;
        pitch = pose.pitch - baselinePitch;
      } else {
        yaw = -Math.asin(clamp(offset * 2, -1, 1)) * 180 / Math.PI;
        pitch = baselineRatio !== null ? -(ratio - baselineRatio) * 200 : 0;
      }
    } else {
      // Warm-up: capture neutral baseline
      const rawYaw = hasPose ? pose.yaw : 0;
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

    const yawMag = Math.abs(yaw);
    const pitchMag = Math.abs(pitch);
    maxYawMag = Math.max(maxYawMag, yawMag);
    maxPitchMag = Math.max(maxPitchMag, pitchMag);

    // 3D head-zone classification (signed)
    if (yaw < -HEAD_ALERT_YAW) {
      anyTurnL = true;
      turnDetail = `3D pose yaw ${yaw.toFixed(1)}° (alert ±${HEAD_ALERT_YAW}°)`;
    } else if (yaw > HEAD_ALERT_YAW) {
      anyTurnR = true;
      turnDetail = `3D pose yaw +${yaw.toFixed(1)}° (alert ±${HEAD_ALERT_YAW}°)`;
    }
    if (pitch < -HEAD_ALERT_PITCH_DOWN) {
      anyDown = true;
      downDetail = `3D pose pitch ${pitch.toFixed(1)}° (alert −${HEAD_ALERT_PITCH_DOWN}°)`;
    }
    if ((yawMag > HEAD_SAFE_YAW && yawMag <= HEAD_ALERT_YAW) ||
        (pitchMag > HEAD_SAFE_PITCH_DOWN && pitchMag <= HEAD_ALERT_PITCH_DOWN) ||
        (pitchMag > HEAD_SAFE_PITCH_UP && pitchMag <= HEAD_ALERT_PITCH_UP)) {
      anyCaution = true;
    }

    // Eye openness (EAR) — closed only when both eyes are closed
    const earL = eyeAspectRatio(lm, 'left');
    const earR = eyeAspectRatio(lm, 'right');
    const closedL = earL !== null && earL < EAR_CLOSED;
    const closedR = earR !== null && earR < EAR_CLOSED;
    if (closedL && closedR) {
      anyClosed = true;
      closedDetail = `eyes closed (EAR L ${earL.toFixed(2)} R ${earR.toFixed(2)})`;
    }

    // Laugh / smile
    const bs = res.faceBlendshapes && res.faceBlendshapes[i];
    const smile = (blend(bs, 'mouthSmileLeft') + blend(bs, 'mouthSmileRight')) / 2;
    const jaw = Math.max(blend(bs, 'jawOpen'), blend(bs, 'mouthOpen'));
    if (smile > SMILE_T && jaw > JAW_T) {
      anyLaugh = true;
      lastDetail.laugh = 'smile ' + smile.toFixed(2) + ' jaw ' + jaw.toFixed(2);
    }

    // Iris gaze only meaningful when head is SAFE and eyes open
    if (yawMag < HEAD_SAFE_YAW && pitchMag < HEAD_SAFE_PITCH_DOWN && !closedL && !closedR) {
      const g = computeGaze(lm);
      if (g) {
        if (Math.abs(g.x) > EYE_ON_SCREEN || g.y > EYE_ON_SCREEN) {
          anyGaze = true;
          gazeDetail = `iris gaze x ${g.x.toFixed(2)} y ${g.y.toFixed(2)} (off-screen ±${EYE_ON_SCREEN})`;
        } else if (Math.abs(g.x) > EYE_GAZE_TH || g.y > EYE_GAZE_TH) {
          anyCaution = true;
        }
      }
    }
  }

  if (calibrationDone) {
    // EMA smoothing on magnitudes
    yawMagS = yawMagS * 0.7 + maxYawMag * 0.3;
    pitchMagS = pitchMagS * 0.7 + maxPitchMag * 0.3;

    // Slow baseline drift adaptation when near neutral
    if (yawMagS < HEAD_SAFE_YAW * 0.5 && supportsMatrix && baselineYaw !== null) {
      const p = matrixYawPitch(res.faceTransformationMatrixes && res.faceTransformationMatrixes[0]);
      if (p) baselineYaw = baselineYaw * 0.995 + p.yaw * 0.005;
    }
    if (pitchMagS < HEAD_SAFE_PITCH_DOWN * 0.5 && supportsMatrix && baselinePitch !== null) {
      const p = matrixYawPitch(res.faceTransformationMatrixes && res.faceTransformationMatrixes[0]);
      if (p) baselinePitch = baselinePitch * 0.995 + p.pitch * 0.005;
    }

    const anySus = anyTurnL || anyTurnR || anyDown || anyGaze || anyClosed;
    updateAttention(anySus, anyCaution);

    // Only SUSTAINED suspicious behavior fires — quick shakes/turns produce nothing
    lastDetail.turnLeft = withAttention(turnDetail || 'sustained left turn');
    lastDetail.turnRight = withAttention(turnDetail || 'sustained right turn');
    lastDetail.lookDown = withAttention(downDetail || `pitch ${pitchMagS.toFixed(1)}°`);
    lastDetail.gazeOff = withAttention(gazeDetail || 'iris off-screen');
    lastDetail.noBlink = withAttention(closedDetail || 'eyes closed');
    lastDetail.faceLost = withAttention(lastDetail.faceLost || 'face lost');

    holdTrack('turnLeft', anyTurnL, yawMagS > HEAD_SAFE_YAW, now, HEAD_SUSTAIN_MS);
    holdTrack('turnRight', anyTurnR, yawMagS > HEAD_SAFE_YAW, now, HEAD_SUSTAIN_MS);
    holdTrack('lookDown', anyDown, pitchMagS > HEAD_SAFE_PITCH_DOWN, now, HEAD_SUSTAIN_MS);
    holdTrack('gazeOff', anyGaze, anyGaze, now, GAZE_SUSTAIN_MS);
    holdTrack('noBlink', anyClosed, anyClosed, now, CLOSED_SUSTAIN_MS);
  }

  if (faces.length >= 2) lastDetail.multiFace = faces.length + ' faces on screen';
  holdTrack('multiFace', faces.length >= 2, faces.length >= 2, now, MULTI_FACE_CONFIRM_MS);
  holdTrack('laugh', anyLaugh, anyLaugh, now, LAUGH_CONFIRM_MS);
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
  calibStart = 0;
  calibrationDone = false;
  baselineYaw = null;
  baselinePitch = null;
  baselineRatio = null;
  yawMagS = 0;
  pitchMagS = 0;
  attention = 100;
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
