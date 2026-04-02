const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const mBox = document.getElementById("measurements");
const copyBtn = document.getElementById("copyBtn");

// Start camera
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: 720, height: 1280 }
    });
    video.srcObject = stream;
  } catch (err) {
    mBox.innerHTML = "Camera blocked or unavailable.";
  }
}

startCamera();

// Stable Mediapipe version
const pose = new pose.Pose({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${file}`,
});

pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  minDetectionConfidence: 0.6,
  minTrackingConfidence: 0.6,
});

pose.onResults(onPoseResults);

// Camera
const camera = new Camera.Camera(video, {
  onFrame: async () => {
    await pose.send({ image: video });
  },
  width: 720,
  height: 1280,
});
camera.start();

// Main function
function onPoseResults(results) {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Mirror video
  ctx.save();
  ctx.scale(-1, 1);
  ctx.translate(-canvas.width, 0);
  ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  if (!results.poseLandmarks) {
    mBox.innerHTML = "Loading...";
    return;
  }

  const L = results.poseLandmarks;

  function dist(a, b) {
    return Math.sqrt(
      (a.x - b.x) * (a.x - b.x) +
      (a.y - b.y) * (a.y - b.y) +
      (a.z - b.z) * (a.z - b.z)
    );
  }

  const measurements = {
    "Shoulder Width": dist(L[11], L[12]).toFixed(3),
    "Hip Width": dist(L[23], L[24]).toFixed(3),
    "Torso Length": dist(L[11], L[23]).toFixed(3),
    "Arm Length": dist(L[11], L[15]).toFixed(3),
    "Leg Length": dist(L[23], L[31]).toFixed(3),
  };

  mBox.innerHTML = Object.entries(measurements)
    .map(([k, v]) => `<b>${k}:</b> ${v}`)
    .join("<br>");

  copyBtn.onclick = () => {
    navigator.clipboard.writeText(
      Object.entries(measurements)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n")
    );
    alert("Copied!");
  };
}
