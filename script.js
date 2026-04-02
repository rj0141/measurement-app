const video = document.getElementById("videoElement");
const canvas = document.getElementById("outputCanvas");
const ctx = canvas.getContext("2d");

let lastDetected = Date.now();
const TIMEOUT = 30000;

const pose = new Pose.Pose({
  locateFile: file =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
});

pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  selfieMode: true
});

pose.onResults(onPoseDetected);

function onPoseDetected(results) {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!results.poseLandmarks) {
    if (Date.now() - lastDetected > TIMEOUT) {
      alert("No person detected for 30 seconds.");
    }
    return;
  }

  lastDetected = Date.now();

  drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS,
    { color: "#00FFAA", lineWidth: 4 });

  drawLandmarks(ctx, results.poseLandmarks,
    { color: "#FFDD55", radius: 5 });
}

const camera = new Camera(video, {
  onFrame: async () => {
    await pose.send({ image: video });
  },
  width: 720,
  height: 1280
});
camera.start();
