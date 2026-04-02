const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const heightInput = document.getElementById('userHeight');

let userHeightCm = 165;
let currentResults = { shoulder:0, bust:0, waist:0, hips:0 };

function updateHeight() {
    userHeightCm = parseFloat(heightInput.value) || 165;
}

// Multiplier to estimate circumference from front-view width
// Industry average for standard body types is 2.3 - 2.4
const CIRCUMFERENCE_FACTOR = 2.35;

const pose = new Pose({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
});

pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  enableSegmentation: false,
  selfieMode: true
});

function onResults(results) {
  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  if (results.poseLandmarks) {
    const lm = results.poseLandmarks;

    // 1. DYNAMIC CALIBRATION
    // Measure from Nose (0) to Ankle (28) as a height reference
    const pixelHeight = Math.abs(lm[28].y - lm[0].y);
    const cmPerPixel = userHeightCm / (pixelHeight * canvasElement.height);

    // 2. FEATURE IDENTIFICATION
    // Shoulder Width (Points 11 & 12)
    const shoulderPx = Math.hypot(lm[12].x - lm[11].x, lm[12].y - lm[11].y) * canvasElement.width;
    const shoulderCm = shoulderPx * cmPerPixel;

    // Hip Width (Points 23 & 24)
    const hipPx = Math.hypot(lm[24].x - lm[23].x, lm[24].y - lm[23].y) * canvasElement.width;
    const hipCm = hipPx * cmPerPixel;

    // Bust and Waist Estimation based on Torso Proportions
    // Chest/Bust is usually ~30% down the torso (Shoulder to Hip)
    // Waist is usually ~65% down the torso
    const chestWidthPx = shoulderPx * 0.92; // Refined assumption for female bust width vs shoulders
    const waistWidthPx = hipPx * 0.82;     // Refined assumption for natural waist taper

    // 3. CALCULATE GIRTH
    currentResults.shoulder = shoulderCm.toFixed(1);
    currentResults.bust = (chestWidthPx * cmPerPixel * CIRCUMFERENCE_FACTOR).toFixed(1);
    currentResults.waist = (waistWidthPx * cmPerPixel * CIRCUMFERENCE_FACTOR).toFixed(1);
    currentResults.hips = (hipCm * CIRCUMFERENCE_FACTOR).toFixed(1);

    // Update UI
    document.getElementById('out-shoulder').innerText = currentResults.shoulder;
    document.getElementById('out-bust').innerText = currentResults.bust;
    document.getElementById('out-waist').innerText = currentResults.waist;
    document.getElementById('out-hips').innerText = currentResults.hips;

    // Draw Visuals
    drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#00FFAA', lineWidth: 2});
    drawLandmarks(canvasCtx, results.poseLandmarks, {color: '#FFDD55', radius: 3});
  }
  canvasCtx.restore();
}

pose.onResults(onResults);

const camera = new Camera(videoElement, {
  onFrame: async () => { await pose.send({image: videoElement}); },
  width: 1280, height: 720
});
camera.start();

function copyToClipboard() {
    const data = `${new Date().toLocaleDateString()}\t${currentResults.shoulder}\t${currentResults.bust}\t${currentResults.waist}\t${currentResults.hips}`;
    navigator.clipboard.writeText(data).then(() => {
        alert("Copied to clipboard! Ready to paste into Google Sheets.");
    });
}
