const CDN = '/mediapipe';
const MODEL = '/mediapipe/wasm/face_landmarker.task';

const YAW_DEG = 35;
const PITCH_DEG = 25;
const TURN_CONFIRM_MS = 500;
const PITCH_CONFIRM_MS = 500;
const LAUGH_CONFIRM_MS = 400;
const MULTI_FACE_CONFIRM_MS = 700;
const SMILE_T = 0.35;
const JAW_T = 0.25;

const LABELS = {
  turnLeft: 'HEAD_TURN_LEFT',
  turnRight: 'HEAD_TURN_RIGHT',
  lookDown: 'LOOK_DOWN',
  laugh: 'LAUGHING',
  multiFace: 'MULTI_FACE'
};

let landmarker = null;
let video = null;
let running = false;
let rafId = null;
let lastVideoTime = -1;
let lastDetection = 0;
let pitchBaseline = null;
let onEventCallback = null;
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
  let lm = null;
  try {
    lm = await withTimeout(FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numFaces: 10,
      outputFaceBlendshapes: true,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5
    }), 20000);
  } catch (e) {
    lm = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL, delegate: 'CPU' },
      runningMode: 'VIDEO',
      numFaces: 10,
      outputFaceBlendshapes: true
    });
  }
  return lm;
}

function blend(bs, name) {
  if (!bs || !bs.categories) return 0;
  const c = bs.categories.find(x => x.categoryName === name);
  return c ? c.score : 0;
}

function computePose(lm) {
  const nose = lm[1], eL = lm[33], eR = lm[263], chin = lm[152];
  const eyeW = Math.abs(eR.x - eL.x) || 1;
  const midX = (eL.x + eR.x) / 2;
  const offset = (nose.x - midX) / eyeW;
  const yawDeg = Math.asin(Math.max(-1, Math.min(1, offset * 2))) * 180 / Math.PI;

  const eyeMidY = (eL.y + eR.y) / 2;
  const chinY = chin.y;
  const denom = (chinY - eyeMidY) || 1;
  const ratio = (nose.y - eyeMidY) / denom;
  if (Math.abs(offset) < 0.15 && ratio > 0.15 && ratio < 0.85) {
    if (pitchBaseline === null) pitchBaseline = ratio;
    else pitchBaseline = pitchBaseline * 0.97 + ratio * 0.03;
  }
  const pitchDeg = pitchBaseline === null ? 0 : (ratio - pitchBaseline) * 200;
  return { yawDeg, pitchDeg, offset };
}

function holdTrack(name, active, lowActive, now, confirmMs) {
  const t = trackers[name] || (trackers[name] = { holdStart: null, fired: false });
  if (lowActive) {
    if (active) {
      if (t.holdStart === null) {
        t.holdStart = now;
      } else if (!t.fired && now - t.holdStart >= confirmMs) {
        t.fired = true;
        if (onEventCallback) onEventCallback(LABELS[name], lastDetail[name] || '');
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

  let anyTurnL = false, anyTurnR = false, anyDown = false, anyLaugh = false;
  let anyTurnLLow = false, anyTurnRLow = false, anyDownLow = false;

  for (let i = 0; i < faces.length; i++) {
    const lm = faces[i];
    const pose = computePose(lm);
    const yaw = pose.yawDeg;
    const pitch = pose.pitchDeg;
    const dir = pose.offset > 0.12 ? 'LEFT' : pose.offset < -0.12 ? 'RIGHT' : 'CENTER';

    const bs = res.faceBlendshapes && res.faceBlendshapes[i];
    const smile = (blend(bs, 'mouthSmileLeft') + blend(bs, 'mouthSmileRight')) / 2;
    const jaw = Math.max(blend(bs, 'jawOpen'), blend(bs, 'mouthOpen'));
    const laugh = smile > SMILE_T && jaw > JAW_T;

    if (dir === 'LEFT') anyTurnLLow = true;
    if (dir === 'RIGHT') anyTurnRLow = true;
    if (pitch > PITCH_DEG - 10) anyDownLow = true;

    if (yaw > YAW_DEG && dir === 'LEFT') { anyTurnL = true; lastDetail.turnLeft = yaw.toFixed(0) + '° yaw'; }
    if (yaw < -YAW_DEG && dir === 'RIGHT') { anyTurnR = true; lastDetail.turnRight = (-yaw).toFixed(0) + '° yaw'; }
    if (pitch > PITCH_DEG) { anyDown = true; lastDetail.lookDown = pitch.toFixed(0) + '° pitch'; }
    if (laugh) { anyLaugh = true; lastDetail.laugh = 'smile ' + smile.toFixed(2) + ' jaw ' + jaw.toFixed(2); }
  }

  const extra = faceCount >= 2;
  if (extra) lastDetail.multiFace = faceCount + ' faces on screen';

  holdTrack('turnLeft', anyTurnL, anyTurnLLow, now, TURN_CONFIRM_MS);
  holdTrack('turnRight', anyTurnR, anyTurnRLow, now, TURN_CONFIRM_MS);
  holdTrack('lookDown', anyDown, anyDownLow, now, PITCH_CONFIRM_MS);
  holdTrack('laugh', anyLaugh, anyLaugh, now, LAUGH_CONFIRM_MS);
  holdTrack('multiFace', extra, extra, now, MULTI_FACE_CONFIRM_MS);
}

function detectLoop() {
  if (!running) return;
  const now = performance.now();
  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    if (now - lastDetection >= 33) {
      lastDetection = now;
      let res = null;
      try { res = landmarker.detectForVideo(video, now); } catch (e) {}
      if (res) processFrame(res, now);
    }
  }
  rafId = requestAnimationFrame(detectLoop);
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
  running = true;
  lastVideoTime = -1;
  lastDetection = 0;
  pitchBaseline = null;
  rafId = requestAnimationFrame(detectLoop);
}

export function stopMonitoring() {
  running = false;
  onEventCallback = null;
  if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  for (const k in trackers) { trackers[k].holdStart = null; trackers[k].fired = false; }
}
