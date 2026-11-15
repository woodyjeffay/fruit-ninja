// Webcam + MediaPipe pose tracking. One model gives us both the wrist/hand
// landmarks and a person segmentation mask.
import { FilesetResolver, PoseLandmarker } from '../vendor/mediapipe/vision_bundle.mjs';

const VENDOR = new URL('../vendor/mediapipe/', import.meta.url).href;

// Pose landmark indices
const WRIST = { left: 15, right: 16 };
const INDEX = { left: 19, right: 20 };
const MIN_VISIBILITY = 0.5;

export class Vision {
  constructor(video) {
    this.video = video;
    this.landmarker = null;
    this.lastVideoTime = -1;
    this.maskCanvas = document.createElement('canvas');
    this.maskCtx = this.maskCanvas.getContext('2d');
    this.maskImage = null;
    this.personCanvas = document.createElement('canvas');
    this.personCtx = this.personCanvas.getContext('2d');
    this.hasPerson = false;
    this.lastSeen = 0;
    /** Latest hand samples in normalised, un-mirrored video coordinates. */
    this.hands = { left: null, right: null };
  }

  async startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
    });
    this.video.srcObject = stream;
    await this.video.play();
  }

  async loadModel() {
    const fileset = await FilesetResolver.forVisionTasks(VENDOR);
    const options = (delegate) => ({
      baseOptions: { modelAssetPath: VENDOR + 'pose_landmarker_lite.task', delegate },
      runningMode: 'VIDEO',
      numPoses: 1,
      outputSegmentationMasks: true,
    });
    this.createCpu = () => PoseLandmarker.createFromOptions(fileset, options('CPU'));
    if (new URLSearchParams(location.search).has('cpu')) {
      this.landmarker = await this.createCpu();
      return;
    }
    try {
      this.landmarker = await PoseLandmarker.createFromOptions(fileset, options('GPU'));
      this.onGpu = true;
    } catch (err) {
      console.warn('GPU delegate unavailable, using CPU', err);
      this.landmarker = await this.createCpu();
    }
  }

  // Some GPUs can't read the mask back (it arrives blank). Swap to CPU once.
  async #fallbackToCpu() {
    this.onGpu = false;
    const old = this.landmarker;
    this.landmarker = null;
    console.warn('Segmentation mask unreadable on GPU, switching to CPU');
    try {
      const cpu = await this.createCpu();
      old.close();
      this.landmarker = cpu;
    } catch (err) {
      console.error(err);
      this.landmarker = old;
    }
  }

  /** Runs detection if a new video frame is available. Returns true if it did. */
  update(now) {
    const v = this.video;
    if (!this.landmarker || v.readyState < 2 || v.currentTime === this.lastVideoTime) return false;
    this.lastVideoTime = v.currentTime;

    this.landmarker.detectForVideo(v, now, (result) => {
      const lm = result.landmarks && result.landmarks[0];
      const mask = result.segmentationMasks && result.segmentationMasks[0];
      this.hasPerson = !!lm;
      if (lm) this.lastSeen = now;
      for (const side of ['left', 'right']) {
        this.hands[side] = lm ? handPoint(lm, side) : null;
      }
      if (lm && mask) this.#composePerson(mask);
      if (mask) mask.close();
    });
    return true;
  }

  // Cut the person out of the current video frame using the mask.
  #composePerson(mask) {
    const { width: mw, height: mh } = mask;
    if (this.maskCanvas.width !== mw || this.maskCanvas.height !== mh) {
      this.maskCanvas.width = mw;
      this.maskCanvas.height = mh;
      this.maskImage = this.maskCtx.createImageData(mw, mh);
    }
    const conf = mask.getAsFloat32Array();
    const px = this.maskImage.data;
    let solid = 0;
    for (let i = 0, j = 3; i < conf.length; i++, j += 4) {
      // Soft threshold: <0.3 transparent, >0.6 opaque
      const a = (conf[i] - 0.3) * 3.34;
      px[j] = a <= 0 ? 0 : a >= 1 ? (solid++, 255) : a * 255;
    }
    if (this.onGpu) {
      this.blankMasks = solid ? 0 : (this.blankMasks || 0) + 1;
      if (this.blankMasks >= 8) queueMicrotask(() => this.#fallbackToCpu());
    }
    this.maskCtx.putImageData(this.maskImage, 0, 0);

    const vw = this.video.videoWidth, vh = this.video.videoHeight;
    const pc = this.personCanvas, ctx = this.personCtx;
    if (pc.width !== vw || pc.height !== vh) { pc.width = vw; pc.height = vh; }
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, vw, vh);
    ctx.filter = 'blur(3px)'; // feather the edge (ignored where unsupported)
    ctx.drawImage(this.maskCanvas, 0, 0, vw, vh);
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-in';
    ctx.drawImage(this.video, 0, 0, vw, vh);
  }
}

// Project a little past the wrist toward the index knuckle so the blade
// sits at the fingertips rather than the wrist.
function handPoint(lm, side) {
  const w = lm[WRIST[side]];
  const f = lm[INDEX[side]];
  if (!w || (w.visibility ?? 1) < MIN_VISIBILITY) return null;
  return { x: w.x + (f.x - w.x) * 1.4, y: w.y + (f.y - w.y) * 1.4 };
}
