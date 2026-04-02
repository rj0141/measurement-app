// DOM elements
const video = document.getElementById("videoElement");
const canvas = document.getElementById("outputCanvas");
const ctx = canvas.getContext("2d");
const msg = document.getElementById("messageBox");
const retryBtn = document.getElementById("retryBtn");

// Timeout logic
let lastDetected = Date.now();
const TIMEOUT = 30000; // 30 sec

// Voice instructions
function speak(text) {
  let v = new SpeechSynthesisUtterance(text);
  v.rate = 1.1;
  speechSynthesis.speak(v);
}

// --- POSE SETUP ---
const pose = new Pose.Pose({
  locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}`
});

pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  enableSegmentation: false,
  selfieMode: true
});

// When pose results come in
pose.onResults(onPoseDetected);

// Camera
let cam;
function startCamera() {
  cam = new Camera(video, {
    onFrame: async () => {
      await pose.send({ image: video });
    },
    width: 720,
    height: 1280
  });
  cam.start();
}

startCamera();

// -------------------
// MAIN POSE HANDLER
// -------------------
function onPoseDetected(results) {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!results.poseLandmarks) {
    checkTimeout();
    return;
  }

  lastDetected = Date.now();
  hideError();

  // Draw full or partial landmarks
  drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS,
    { color: "#00FFAA", lineWidth: 4 });

  drawLandmarks(ctx, results.poseLandmarks,
    { color: "#FFDD55", radius: 5 });

  computeMeasurements(results.poseLandmarks);
}

// ---------------------------------------
// MEASUREMENT LOGIC  (partial-friendly)
// ---------------------------------------
function computeMeasurements(lm) {
  const getPx = p => ({
    x: p.x * canvas.width,
    y: p.y * canvas.height
  });

  function dist(a, b) {
    if (!a || !b) return null;
    const pa = getPx(a);
    const pb = getPx(b);
    return Math.hypot(pa.x - pb.x, pa.y - pb.y);
  }

  const shoulders = dist(lm[11], lm[12]);
  const hips = dist(lm[23], lm[24]);
  const fullHeight = lm[0] && lm[28] ? dist(lm[0], lm[28]) : null;

  let measurements = {
    shoulderWidth_px: shoulders,
    hipWidth_px: hips,
    height_px: fullHeight
  };

  console.log("Measurements:", measurements);
}

// ------------------
// TIMEOUT HANDLER
// ------------------
function checkTimeout() {
  if (Date.now() - lastDetected > TIMEOUT) {
    showError("No person detected for 30 seconds.");
    retryBtn.style.display = "block";
    speak("I cannot detect a person. Please adjust the camera and click retry.");
    cam.stop();
  }
}

retryBtn.onclick = () => location.reload();

// UI helpers
function showError(t) {
  msg.style.display = "block";
  msg.innerText = t;
}
function hideError() {
  msg.style.display = "none";
  retryBtn.style.display = "none";
}
