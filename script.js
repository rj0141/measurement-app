const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const statusOverlay = document.getElementById('status-overlay');
const heightInput = document.getElementById('userHeight');

let isFrozen = false;
let currentFacingMode = 'user';
let stream = null;
let currentLandmarks = null;
let currentUnit = 'cm';
let poseInitialized = false;

function speak(text) {
    if (!window.speechSynthesis) return;
    const msg = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(msg);
}

const pose = new Pose({
    locateFile: (file) => {
        // Explicitly pointing to the jsdelivr cloud assets
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
    }
});

pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    smoothSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

pose.onResults(onResults);

async function startCamera() {
    statusOverlay.innerText = "STARTING CAMERA...";
    if (stream) stream.getTracks().forEach(t => t.stop());
    
    const constraints = {
        video: {
            facingMode: currentFacingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 }
        }
    };

    try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = stream;
        
        videoElement.onloadedmetadata = () => {
            const mode = currentFacingMode === 'user' ? 'add' : 'remove';
            videoElement.classList[mode]('mirrored');
            canvasElement.classList[mode]('mirrored');
            poseInitialized = true;
            statusOverlay.innerText = "AI LOADING...";
            requestAnimationFrame(processFrame);
        };
    } catch (e) {
        statusOverlay.innerText = "❌ CAMERA ERROR";
        console.error(e);
    }
}

async function processFrame() {
    if (isFrozen || !poseInitialized) return;
    try {
        await pose.send({ image: videoElement });
    } catch (err) {
        console.warn("Pose processing error, retrying...");
    }
    requestAnimationFrame(processFrame);
}

function onResults(results) {
    if (isFrozen) return;
    
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks) {
        currentLandmarks = results.poseLandmarks;
        statusOverlay.innerText = "✅ AI ACTIVE";
        
        // Calculation logic
        updateStatsUI();

        // Draw visuals
        drawConnectors(canvasCtx, currentLandmarks, POSE_CONNECTIONS, {color: '#00FFAA', lineWidth: 2});
        drawLandmarks(canvasCtx, currentLandmarks, {color: '#FFFFFF', radius: 1});
    } else {
        statusOverlay.innerText = "⚠️ BODY NOT FOUND";
    }
    canvasCtx.restore();
}

function updateStatsUI() {
    if (!currentLandmarks) return;
    const lm = currentLandmarks;
    const userH = parseFloat(heightInput.value) || 165;
    const heightInCm = currentUnit === 'inch' ? userH * 2.54 : userH;
    
    const ankleY = (lm[27].y + lm[28].y) / 2;
    const pixelHeight = Math.abs(ankleY - lm[0].y);
    const cmPerPx = heightInCm / (pixelHeight * canvasElement.height);
    const factor = 2.32; // Girth approximation multiplier

    const sPx = Math.hypot(lm[12].x - lm[11].x, lm[12].y - lm[11].y) * canvasElement.width;
    const hPx = Math.hypot(lm[24].x - lm[23].x, lm[24].y - lm[23].y) * canvasElement.width;

    const div = currentUnit === 'inch' ? 2.54 : 1;
    
    document.getElementById('out-shoulder').innerText = ((sPx * cmPerPx) / div).toFixed(1);
    document.getElementById('out-bust').innerText = ((sPx * 0.95 * cmPerPx * factor) / div).toFixed(1);
    document.getElementById('out-waist').innerText = ((hPx * 0.82 * cmPerPx * factor) / div).toFixed(1);
    document.getElementById('out-hips').innerText = ((hPx * cmPerPx * factor) / div).toFixed(1);
}

function toggleUnits() {
    const val = parseFloat(heightInput.value);
    if (currentUnit === 'cm') {
        currentUnit = 'inch';
        heightInput.value = (val / 2.54).toFixed(1);
    } else {
        currentUnit = 'cm';
        heightInput.value = (val * 2.54).toFixed(0);
    }
    document.getElementById('height-unit-text').innerText = currentUnit.toUpperCase();
    document.querySelectorAll('.unit-text').forEach(el => el.innerText = currentUnit);
    if (currentLandmarks) updateStatsUI();
}

function captureData() {
    if (!currentLandmarks) return;
    isFrozen = true;
    speak("Captured.");
    
    // Copy logic
    const s = document.getElementById('out-shoulder').innerText;
    const b = document.getElementById('out-bust').innerText;
    const w = document.getElementById('out-waist').innerText;
    const h = document.getElementById('out-hips').innerText;
    
    let dataString = `${new Date().toLocaleDateString()}\t${currentUnit}\t${s}\t${b}\t${w}\t${h}`;
    currentLandmarks.forEach((p, i) => { dataString += `\tL${i}:${p.x.toFixed(3)},${p.y.toFixed(3)}`; });
    
    navigator.clipboard.writeText(dataString);
    
    document.getElementById('capture-btn').style.display = 'none';
    document.getElementById('resume-btn').style.display = 'block';
    statusOverlay.innerText = "❄️ FROZEN";
}

function resumeScanning() {
    isFrozen = false;
    document.getElementById('capture-btn').style.display = 'flex';
    document.getElementById('resume-btn').style.display = 'none';
    requestAnimationFrame(processFrame);
}

function toggleCamera() {
    currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
    startCamera();
}

// Kickoff
startCamera();
