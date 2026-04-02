const video = document.getElementById("videoElement");
const canvas = document.getElementById("outputCanvas");
const ctx = canvas.getContext("2d");
const errorBox = document.getElementById("errorBox");

let lastDetected = Date.now();
const TIMEOUT = 30000; // 30 seconds

// Initialize Mediapipe Pose
// Using window.Pose to ensure it pulls from the CDN global scope correctly
const pose = new window.Pose({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
  }
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
  // Set canvas dimensions to match video stream
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  
  ctx.save();
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

  // Draw connectors & landmarks using the global DrawingUtils functions
  window.drawConnectors(ctx, results.poseLandmarks, window.POSE_CONNECTIONS,
    { color: "#00FFAA", lineWidth: 4 });

  window.drawLandmarks(ctx, results.poseLandmarks,
    { color: "#FFDD55", radius: 5 });

  ctx.restore();
}

// ================================
// Camera setup
// ================================
const camera = new window.Camera(video, {
  onFrame: async () => {
    await pose.send({ image: video });
  },
  width: 1280,
  height: 720,
});

// Start the camera
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
