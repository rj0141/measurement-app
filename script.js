const video = document.getElementById("videoElement");
const canvas = document.getElementById("outputCanvas");
const ctx = canvas.getContext("2d");

// Ask user for height to calibrate the scale
const USER_HEIGHT_CM = parseFloat(prompt("Please enter your height in cm (e.g. 165):", "165")) || 165;

let currentMeasurements = { shoulders: 0, chest: 0, waist: 0, hips: 0 };

const pose = new window.Pose({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
});

pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, selfieMode: true });
pose.onResults(onResults);

function getDistance(p1, p2) {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

function onResults(results) {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!results.poseLandmarks) return;

  const landmarks = results.poseLandmarks;

  // 1. CALIBRATE SCALE
  // Ratio = User Height / (Distance from Head to Ankle in pixels)
  const pixelHeight = getDistance(landmarks[0], landmarks[28]); // Nose to Ankle
  const cmPerPixel = USER_HEIGHT_CM / (pixelHeight * canvas.height); 

  // 2. CALCULATE MEASUREMENTS (Widths)
  // Note: These are flat widths. For circumferences, a rough estimate is width * 2.2
  const shoulderPx = getDistance(landmarks[11], landmarks[12]);
  const hipPx = getDistance(landmarks[23], landmarks[24]);
  
  // Waist is roughly halfway between shoulders and hips
  const waistY = (landmarks[11].y + landmarks[23].y) / 2;
  const chestY = (landmarks[11].y * 0.7 + landmarks[23].y * 0.3);

  currentMeasurements.shoulders = (shoulderPx * canvas.width * cmPerPixel).toFixed(1);
  currentMeasurements.hips = (hipPx * canvas.width * cmPerPixel).toFixed(1);
  currentMeasurements.waist = (currentMeasurements.hips * 0.85).toFixed(1); // Rough estimate for waist
  currentMeasurements.chest = (currentMeasurements.shoulders * 0.95).toFixed(1);

  // 3. UPDATE UI
  document.getElementById('val-shoulders').innerText = currentMeasurements.shoulders;
  document.getElementById('val-chest').innerText = currentMeasurements.chest;
  document.getElementById('val-waist').innerText = currentMeasurements.waist;
  document.getElementById('val-hips').innerText = currentMeasurements.hips;

  // 4. DRAW
  window.drawConnectors(ctx, landmarks, window.POSE_CONNECTIONS, {color: '#00FFAA'});
  window.drawLandmarks(ctx, landmarks, {color: '#FFDD55', radius: 4});
}

const camera = new window.Camera(video, {
  onFrame: async () => { await pose.send({image: video}); },
  width: 1280, height: 720
});
camera.start();

function copyToClipboard() {
  const date = new Date().toLocaleDateString();
  // Tab-separated format for Google Sheets
  const text = `${date}\t${currentMeasurements.shoulders}\t${currentMeasurements.chest}\t${currentMeasurements.waist}\t${currentMeasurements.hips}`;
  
  navigator.clipboard.writeText(text).then(() => {
    alert("Copied! Paste this directly into a Google Sheet row.");
  });
}
