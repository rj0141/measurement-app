const video = document.getElementById("videoElement");
const canvas = document.getElementById("outputCanvas");
const ctx = canvas.getContext("2d");
const errorBox = document.getElementById("errorBox");

let lastDetected = Date.now();
const TIMEOUT = 30000; // 30 seconds timeout

// Initialize Mediapipe Pose (CDN version)
const pose = new Pose.pose({
  locateFile: file =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
});

pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  enableSegmentation: false,
  selfieMode: true,
});

pose.onResults(onPoseDetected);

// ================================
// Pose detection callback
// ================================
function onPoseDetected(results) {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // If no person detected
  if (!results.poseLandmarks) {
    if (Date.now() - lastDetected > TIMEOUT) {
      showError("No person detected for 30 seconds. Adjust camera.");
    }
    return;
  }

  hideError();
  lastDetected = Date.now();

  // Draw connectors & landmarks
  drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS,
    { color: "#00FFAA", lineWidth: 4 });

  drawLandmarks(ctx, results.poseLandmarks,
    { color: "#FFDD55", radius: 5 });

  // Future: Your measurement logic goes here
}

// ================================
// Camera setup
// ================================
const camera = new Camera(video, {
  onFrame: async () => {
    await pose.send({ image: video });
  },
  width: 720,
  height: 1280,
});
camera.start();

// ================================
// Error handling
// ================================
function showError(msg) {
  errorBox.style.display = "block";
  errorBox.textContent = msg;
}

function hideError() {
  errorBox.style.display = "none";
}
