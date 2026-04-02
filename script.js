const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const mBox = document.getElementById("measurements");
const copyBtn = document.getElementById("copyBtn");

// Ask for camera permission and start video
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
  } catch (err) {
    mBox.innerHTML = "Camera blocked or unavailable.";
  }
}

startCamera();

// Initialize Mediapipe Pose
const pose = new Pose.Pose({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.4.1646424915/${file}`,
});

pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  enableSegmentation: false,
  minDetectionConfidence: 0.6,
  minTrackingConfidence: 0.6,
});

pose.onResults(onPoseResults);

// Use CameraUtils
const camera = new Camera.Camera(video, {
  onFrame: async () => {
    await pose.send({ image: video });
  },
  width: 350,
  height: 450,
});
camera.start();

// MAIN FUNCTION: process pose results
function onPoseResults(results) {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

  if (!results.poseLandmarks) {
    mBox.innerHTML = "Detecting body...";
    return;
  }

  // Extract key landmark points
  const L = results.poseLandmarks;

  function dist(a, b) {
    return Math.sqrt(
      (a.x - b.x) ** 2 +
      (a.y - b.y) ** 2 +
      (a.z - b.z) ** 2
    );
  }

  // Example measurements (relative body ratios)
  const shoulderWidth = dist(L[11], L[12]);
  const hipWidth = dist(L[23], L[24]);
  const torsoLength = dist(L[11], L[23]);
  const armLength = dist(L[11], L[15]);
  const legLength = dist(L[23], L[31]);

  const measurements = {
    "Shoulder Width": shoulderWidth.toFixed(3),
    "Hip Width": hipWidth.toFixed(3),
    "Torso Length": torsoLength.toFixed(3),
    "Arm Length": armLength.toFixed(3),
    "Leg Length": legLength.toFixed(3),
  };

  // Update UI
  mBox.innerHTML = Object.entries(measurements)
    .map(([k, v]) => `<b>${k}:</b> ${v}`)
    .join("<br>");

  // Copy to clipboard
  copyBtn.onclick = () => {
    const txt = Object.entries(measurements)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    navigator.clipboard.writeText(txt);
    alert("Copied to clipboard!");
  };
}
