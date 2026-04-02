const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const statusOverlay = document.getElementById('status-overlay');
const heightInput = document.getElementById('userHeight');

let isFrozen = false;
let lastDetectionTime = Date.now();
let currentFacingMode = 'user';
let stream = null;
let currentLandmarks = null;
let currentMeasurements = {};

// Voice Synthesis Setup
function speak(text) {
    const msg = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.cancel(); // Stop current speech
    window.speechSynthesis.speak(msg);
}

const pose = new window.Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
});

pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, selfieMode: false });
pose.onResults(onResults);

async function startCamera() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    const constraints = { video: { facingMode: currentFacingMode, width: 1280, height: 720 } };
    try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = stream;
        const mode = currentFacingMode === 'user' ? 'add' : 'remove';
        videoElement.classList[mode]('mirrored');
        canvasElement.classList[mode]('mirrored');
        requestAnimationFrame(processVideo);
        speak("Camera ready. Please stand back to show your full body.");
    } catch (e) { alert("Camera access denied."); }
}

async function processVideo() {
    if (isFrozen || !stream) return;
    await pose.send({ image: videoElement });
    
    // Check for inactivity
    if (Date.now() - lastDetectionTime > 30000) {
        statusOverlay.innerText = "⚠️ Adjust lighting or step back";
        speak("I am having trouble seeing you. Please adjust the light or step back.");
        lastDetectionTime = Date.now(); // Reset to avoid constant talking
    }
    requestAnimationFrame(processVideo);
}

function onResults(results) {
    if (isFrozen) return;
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks) {
        lastDetectionTime = Date.now();
        currentLandmarks = results.poseLandmarks;
        calculateBodyStats(currentLandmarks);
        statusOverlay.innerText = "✅ Ready to Capture";
        
        window.drawConnectors(canvasCtx, currentLandmarks, window.POSE_CONNECTIONS, {color: '#00FFAA', lineWidth: 2});
        window.drawLandmarks(canvasCtx, currentLandmarks, {color: '#FFFFFF', radius: 1});
    } else {
        statusOverlay.innerText = "❌ Body not fully visible";
    }
    canvasCtx.restore();
}

function calculateBodyStats(lm) {
    const userH = parseFloat(heightInput.value) || 165;
    const ankleY = (lm[27].y + lm[28].y) / 2;
    const pixelHeight = Math.abs(ankleY - lm[0].y);
    const cmPerPx = userH / (pixelHeight * canvasElement.height);
    const girthFactor = 2.32;

    const shoulderPx = Math.hypot(lm[12].x - lm[11].x, lm[12].y - lm[11].y) * canvasElement.width;
    const hipPx = Math.hypot(lm[24].x - lm[23].x, lm[24].y - lm[23].y) * canvasElement.width;

    currentMeasurements = {
        shoulders: (shoulderPx * cmPerPx).toFixed(1),
        bust: (shoulderPx * 0.95 * cmPerPx * girthFactor).toFixed(1),
        waist: (hipPx * 0.82 * cmPerPx * girthFactor).toFixed(1),
        hips: (hipPx * cmPerPx * girthFactor).toFixed(1)
    };

    document.getElementById('out-shoulder').innerText = currentMeasurements.shoulders + " cm";
    document.getElementById('out-bust').innerText = currentMeasurements.bust + " cm";
    document.getElementById('out-waist').innerText = currentMeasurements.waist + " cm";
    document.getElementById('out-hips').innerText = currentMeasurements.hips + " cm";
}

function captureData() {
    if (!currentLandmarks) {
        speak("I can't see a body to capture. Try again.");
        return;
    }
    
    isFrozen = true;
    speak("Measurements captured and copied. Now, please turn 90 degrees to your side if you need a profile scan.");
    
    // Prepare Data for Google Sheets
    // Column 1-5: Date & Main Stats | Column 6+: All 33 Landmark Coords
    let exportData = `${new Date().toLocaleDateString()}\t${currentMeasurements.shoulders}\t${currentMeasurements.bust}\t${currentMeasurements.waist}\t${currentMeasurements.hips}`;
    
    currentLandmarks.forEach((point, i) => {
        exportData += `\tL${i}_X:${point.x.toFixed(4)},Y:${point.y.toFixed(4)},Z:${point.z.toFixed(4)}`;
    });

    navigator.clipboard.writeText(exportData);
    
    document.getElementById('capture-btn').style.display = 'none';
    document.getElementById('resume-btn').style.display = 'block';
    statusOverlay.innerText = "❄️ SCAN FROZEN";
}

function resumeScanning() {
    isFrozen = false;
    document.getElementById('capture-btn').style.display = 'block';
    document.getElementById('resume-btn').style.display = 'none';
    requestAnimationFrame(processVideo);
    speak("Resuming scan.");
}

function toggleCamera() {
    currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
    startCamera();
}

startCamera();
