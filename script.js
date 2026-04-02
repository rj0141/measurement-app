const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const statusOverlay = document.getElementById('status-overlay');
const heightInput = document.getElementById('userHeight');
const captureBtn = document.getElementById('capture-btn');
const resumeBtn = document.getElementById('resume-btn');

let isFrozen = false;
let currentFacingMode = 'user';
let stream = null;
let currentLandmarks = null;
let currentMeasurements = { sh: 0, bu: 0, wa: 0, hi: 0 };
let currentUnit = 'cm'; // 'cm' or 'inch'

function speak(text) {
    const msg = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(msg);
}

// Unit Conversion Logic
function toggleUnits() {
    const val = parseFloat(heightInput.value);
    if (currentUnit === 'cm') {
        currentUnit = 'inch';
        heightInput.value = (val / 2.54).toFixed(1);
    } else {
        currentUnit = 'cm';
        heightInput.value = (val * 2.54).toFixed(0);
    }
    document.getElementById('unit-toggle-btn').innerText = `UNIT: ${currentUnit.toUpperCase()}`;
    document.getElementById('height-unit-text').innerText = currentUnit.toUpperCase();
    document.querySelectorAll('.unit-text').forEach(el => el.innerText = currentUnit);
    
    if (currentLandmarks) calculateBodyStats(currentLandmarks);
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
        speak("Ready. Stand back.");
    } catch (e) { alert("Camera Access Error"); }
}

async function processVideo() {
    if (isFrozen || !stream) return;
    await pose.send({ image: videoElement });
    requestAnimationFrame(processVideo);
}

function onResults(results) {
    if (isFrozen) return;
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks) {
        currentLandmarks = results.poseLandmarks;
        calculateBodyStats(currentLandmarks);
        statusOverlay.innerText = "✅ READY";
        window.drawConnectors(canvasCtx, currentLandmarks, window.POSE_CONNECTIONS, {color: '#00FFAA', lineWidth: 2});
        window.drawLandmarks(canvasCtx, currentLandmarks, {color: '#FFFFFF', radius: 1});
    } else {
        statusOverlay.innerText = "❌ BODY NOT FULLY VISIBLE";
    }
    canvasCtx.restore();
}

function calculateBodyStats(lm) {
    const rawHeight = parseFloat(heightInput.value) || 165;
    // Always convert to CM for internal scaling math
    const heightInCm = currentUnit === 'inch' ? rawHeight * 2.54 : rawHeight;
    
    const ankleY = (lm[27].y + lm[28].y) / 2;
    const pixelHeight = Math.abs(ankleY - lm[0].y);
    const cmPerPx = heightInCm / (pixelHeight * canvasElement.height);
    const factor = 2.32;

    const sPx = Math.hypot(lm[12].x - lm[11].x, lm[12].y - lm[11].y) * canvasElement.width;
    const hPx = Math.hypot(lm[24].x - lm[23].x, lm[24].y - lm[23].y) * canvasElement.width;

    // Calculate in CM first
    let sh = sPx * cmPerPx;
    let bu = sPx * 0.95 * cmPerPx * factor;
    let wa = hPx * 0.82 * cmPerPx * factor;
    let hi = hPx * cmPerPx * factor;

    // Convert display values if needed
    const div = currentUnit === 'inch' ? 2.54 : 1;
    currentMeasurements = {
        sh: (sh / div).toFixed(1),
        bu: (bu / div).toFixed(1),
        wa: (wa / div).toFixed(1),
        hi: (hi / div).toFixed(1)
    };

    document.getElementById('out-shoulder').innerText = currentMeasurements.sh;
    document.getElementById('out-bust').innerText = currentMeasurements.bu;
    document.getElementById('out-waist').innerText = currentMeasurements.wa;
    document.getElementById('out-hips').innerText = currentMeasurements.hi;
}

function captureData() {
    if (!currentLandmarks) return;
    isFrozen = true;
    speak("Measurements captured.");
    
    let data = `${new Date().toLocaleDateString()}\tUnit: ${currentUnit}\t${currentMeasurements.sh}\t${currentMeasurements.bu}\t${currentMeasurements.wa}\t${currentMeasurements.hi}`;
    currentLandmarks.forEach((p, i) => { data += `\tL${i}_X:${p.x.toFixed(4)},Y:${p.y.toFixed(4)}`; });
    navigator.clipboard.writeText(data);
    
    captureBtn.style.display = 'none';
    resumeBtn.style.display = 'block';
    statusOverlay.innerText = "❄️ CAPTURED";
}

function resumeScanning() {
    isFrozen = false;
    captureBtn.style.display = 'flex';
    resumeBtn.style.display = 'none';
    requestAnimationFrame(processVideo);
}

function toggleCamera() {
    currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
    startCamera();
}

startCamera();
