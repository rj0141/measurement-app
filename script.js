const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const statusOverlay = document.getElementById('status-overlay');
const heightInput = document.getElementById('userHeight');
const startOverlay = document.getElementById('start-overlay');

let isFrozen = false;
let currentFacingMode = 'user';
let stream = null;
let currentLandmarks = null;
let currentUnit = 'cm';
let poseEngine = null;

// Fix: Voice Instructions
function speak(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(text);
    msg.rate = 0.9; // Slightly slower for clarity
    window.speechSynthesis.speak(msg);
}

// Master Initialization on User Click
async function initApp() {
    startOverlay.style.display = 'none';
    statusOverlay.innerText = "INITIALIZING AI...";
    
    poseEngine = new Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });

    poseEngine.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    poseEngine.onResults(onResults);
    
    // Start Camera ONLY after Pose engine is defined
    startCamera();
}

async function startCamera() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: currentFacingMode, width: 1280, height: 720 }
        });
        videoElement.srcObject = stream;
        
        videoElement.onloadedmetadata = () => {
            const isFront = currentFacingMode === 'user';
            videoElement.classList[isFront ? 'add' : 'remove']('mirrored');
            canvasElement.classList[isFront ? 'add' : 'remove']('mirrored');
            
            statusOverlay.innerText = "AI READY";
            speak("Welcome. Please stand back so I can see your whole body.");
            requestAnimationFrame(processFrame);
        };
    } catch (e) {
        statusOverlay.innerText = "❌ CAMERA ERROR";
        alert("Please enable camera access in settings.");
    }
}

async function processFrame() {
    if (isFrozen || !poseEngine) return;
    try {
        await poseEngine.send({ image: videoElement });
    } catch (err) {
        console.error("Frame skip");
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
        statusOverlay.innerText = "✅ SCANNING...";
        
        updateStats();

        // Visual Overlay
        drawConnectors(canvasCtx, currentLandmarks, POSE_CONNECTIONS, {color: '#00FFAA', lineWidth: 2});
        drawLandmarks(canvasCtx, currentLandmarks, {color: '#FFFFFF', radius: 1});
    } else {
        statusOverlay.innerText = "⚠️ STEP BACK";
    }
    canvasCtx.restore();
}

function updateStats() {
    const lm = currentLandmarks;
    const userH = parseFloat(heightInput.value) || 165;
    const heightInCm = currentUnit === 'inch' ? userH * 2.54 : userH;
    
    // Dist from nose (0) to avg ankle (27,28)
    const ankleY = (lm[27].y + lm[28].y) / 2;
    const pixelHeight = Math.abs(ankleY - lm[0].y);
    const cmPerPx = heightInCm / (pixelHeight * canvasElement.height);
    const factor = 2.32; 

    const sPx = Math.hypot(lm[12].x - lm[11].x, lm[12].y - lm[11].y) * canvasElement.width;
    const hPx = Math.hypot(lm[24].x - lm[23].x, lm[24].y - lm[23].y) * canvasElement.width;

    const div = currentUnit === 'inch' ? 2.54 : 1;
    
    document.getElementById('out-shoulder').innerText = ((sPx * cmPerPx) / div).toFixed(1);
    document.getElementById('out-bust').innerText = ((sPx * 0.95 * cmPerPx * factor) / div).toFixed(1);
    document.getElementById('out-waist').innerText = ((hPx * 0.82 * cmPerPx * factor) / div).toFixed(1);
    document.getElementById('out-hips').innerText = ((hPx * cmPerPx * factor) / div).toFixed(1);
}

function captureData() {
    if (!currentLandmarks) {
        speak("I cannot see you clearly enough to capture.");
        return;
    }
    isFrozen = true;
    speak("Measurements captured. Ready to copy.");
    
    const s = document.getElementById('out-shoulder').innerText;
    const b = document.getElementById('out-bust').innerText;
    const w = document.getElementById('out-waist').innerText;
    const h = document.getElementById('out-hips').innerText;
    
    let data = `${new Date().toLocaleDateString()}\t${currentUnit}\t${s}\t${b}\t${w}\t${h}`;
    currentLandmarks.forEach((p, i) => { data += `\tL${i}:${p.x.toFixed(3)},${p.y.toFixed(3)}`; });
    
    navigator.clipboard.writeText(data).then(() => {
        statusOverlay.innerText = "📋 COPIED TO CLIPBOARD";
    });
    
    document.getElementById('capture-btn').style.display = 'none';
    document.getElementById('resume-btn').style.display = 'block';
}

function resumeScanning() {
    isFrozen = false;
    document.getElementById('capture-btn').style.display = 'flex';
    document.getElementById('resume-btn').style.display = 'none';
    speak("Resuming scanner.");
    requestAnimationFrame(processFrame);
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
}

function toggleCamera() {
    currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
    startCamera();
}
