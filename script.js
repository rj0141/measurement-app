const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const heightInput = document.getElementById('userHeight');

let userHeightCm = 165;
let currentResults = { shoulder:0, bust:0, waist:0, hips:0 };
let currentFacingMode = 'user'; // 'user' is front, 'environment' is back
let stream = null;

function updateHeight() {
    userHeightCm = parseFloat(heightInput.value) || 165;
}

const CIRCUMFERENCE_FACTOR = 2.32;

const pose = new window.Pose({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
});

pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  selfieMode: false // We handle mirroring manually for better control
});

async function startCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }

    const constraints = {
        video: {
            facingMode: currentFacingMode,
            width: { ideal: 1920 },
            height: { ideal: 1080 }
        }
    };

    try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = stream;
        
        // Apply mirroring only if using front camera
        if (currentFacingMode === 'user') {
            videoElement.classList.add('mirrored');
            canvasElement.classList.add('mirrored');
        } else {
            videoElement.classList.remove('mirrored');
            canvasElement.classList.remove('mirrored');
        }

        // Start processing frames
        requestAnimationFrame(processVideo);
    } catch (err) {
        console.error("Camera Error: ", err);
        alert("Could not access camera. Ensure you are on HTTPS.");
    }
}

async function processVideo() {
    if (videoElement.paused || videoElement.ended) return;
    await pose.send({image: videoElement});
    requestAnimationFrame(processVideo);
}

function toggleCamera() {
    currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
    startCamera();
}

function onResults(results) {
  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;
  
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  if (results.poseLandmarks) {
    const lm = results.poseLandmarks;

    // HEIGHT CALIBRATION
    const ankleY = (lm[27].y + lm[28].y) / 2;
    const pixelHeight = Math.abs(ankleY - lm[0].y);
    const cmPerPixel = userHeightCm / (pixelHeight * canvasElement.height);

    // LANDMARK CALCULATION
    const shoulderPx = Math.hypot(lm[12].x - lm[11].x, lm[12].y - lm[11].y) * canvasElement.width;
    const shoulderCm = shoulderPx * cmPerPixel;

    const hipPx = Math.hypot(lm[24].x - lm[23].x, lm[24].y - lm[23].y) * canvasElement.width;
    const hipCm = hipPx * cmPerPixel;

    // BUST & WAIST INTERPOLATION
    const bustWidthCm = shoulderCm * 0.95; 
    const waistWidthCm = hipCm * 0.85;

    currentResults.shoulder = shoulderCm.toFixed(1);
    currentResults.bust = (bustWidthCm * CIRCUMFERENCE_FACTOR).toFixed(1);
    currentResults.waist = (waistWidthCm * CIRCUMFERENCE_FACTOR).toFixed(1);
    currentResults.hips = (hipCm * CIRCUMFERENCE_FACTOR).toFixed(1);

    // Update UI
    document.getElementById('out-shoulder').innerText = currentResults.shoulder + " cm";
    document.getElementById('out-bust').innerText = currentResults.bust + " cm";
    document.getElementById('out-waist').innerText = currentResults.waist + " cm";
    document.getElementById('out-hips').innerText = currentResults.hips + " cm";

    // Draw Skeleton
    window.drawConnectors(canvasCtx, lm, window.POSE_CONNECTIONS, {color: '#00FFAA', lineWidth: 2});
    window.drawLandmarks(canvasCtx, lm, {color: '#FFFFFF', radius: 2});
  }
  canvasCtx.restore();
}

pose.onResults(onResults);

// Initialize
startCamera();

function copyToClipboard() {
    const data = `${new Date().toLocaleDateString()}\t${currentResults.shoulder}\t${currentResults.bust}\t${currentResults.waist}\t${currentResults.hips}`;
    navigator.clipboard.writeText(data).then(() => {
        alert("Measurements copied!");
    });
}
