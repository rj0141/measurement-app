const video = document.getElementById("videoElement");
const canvas = document.getElementById("outputCanvas");
const ctx = canvas.getContext("2d");
const errorBox = document.getElementById("errorBox");

let poseLandmarker;
let running = false;

// timeout logic
let lastDetectedTime = Date.now();
const TIMEOUT_MS = 30000; // 30 seconds

async function initPose() {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );

  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task",
    },
    runningMode: "VIDEO",
    numPoses: 1,
  });

  startCamera();
}

async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user" },
  });
  video.srcObject = stream;

  video.onloadedmetadata = () => {
    video.play();
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    running = true;
    detectPose();
  };
}

async function detectPose() {
  if (!running) return;

  const nowTs = performance.now();
  const result = await poseLandmarker.detectForVideo(video, nowTs);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // No landmarks detected?
  if (!result.landmarks || result.landmarks.length === 0) {
    checkTimeout();
    requestAnimationFrame(detectPose);
    return;
  }

  // Reset timeout timer when pose detected
  lastDetectedTime = Date.now();
  hideError();

  // Use first pose
  const lm = result.landmarks[0];

  drawPartialLandmarks(lm);
  calculatePartialMeasurements(lm);

  requestAnimationFrame(detectPose);
}

function drawPartialLandmarks(landmarks) {
  ctx.fillStyle = "#00FF00";

  landmarks.forEach((lm) => {
    ctx.beginPath();
    ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 5, 0, 2 * Math.PI);
    ctx.fill();
  });
}

function calculatePartialMeasurements(lm) {
  // Sample partial measurement: shoulder width
  if (lm[11] && lm[12]) {
    const shoulderDist = Math.hypot(
      (lm[11].x - lm[12].x) * canvas.width,
      (lm[11].y - lm[12].y) * canvas.height
    );
    console.log("Shoulder Width (px):", shoulderDist);
  }

  // Add more body parts as needed
}

// Check timeout if no human detected
function checkTimeout() {
  const now = Date.now();

  if (now - lastDetectedTime > TIMEOUT_MS) {
    showError("No person detected for 30 seconds. Please adjust camera and retry.");
    running = false;
  }
}

function showError(msg) {
  errorBox.style.display = "block";
  errorBox.innerText = msg;
}

function hideError() {
  errorBox.style.display = "none";
}

initPose();
