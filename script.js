const video = document.getElementById('input_video');
const canvas = document.getElementById('output_canvas');
const ctx = canvas.getContext('2d');
const statusText = document.getElementById('status-overlay');
const heightInp = document.getElementById('userHeight');
const overlay = document.getElementById('start-overlay');

let isFrozen = false;
let currentFacing = 'environment'; // Default to BACK camera
let stream = null;
let currentUnit = 'inch';
let pose = null;

function speak(txt) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(txt);
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
}

async function initApp() {
    overlay.style.display = 'none';
    statusText.innerText = "LOADING AI MODELS...";
    
    pose = new Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });

    pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    pose.onResults(onResults);
    startCamera();
}

async function startCamera() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: currentFacing, width: {ideal: 1280}, height: {ideal: 720} }
        });
        video.srcObject = stream;
        
        video.onloadedmetadata = () => {
            const isFront = currentFacing === 'user';
            video.classList[isFront ? 'add' : 'remove']('mirrored');
            canvas.classList[isFront ? 'add' : 'remove']('mirrored');
            
            statusText.innerText = "AI ONLINE";
            speak("Ready. Stand roughly seven feet back.");
            requestAnimationFrame(renderLoop);
        };
    } catch (e) {
        statusText.innerText = "❌ CAMERA ERROR";
        alert("Camera access is required for scanning.");
    }
}

async function renderLoop() {
    if (isFrozen || !pose) return;
    try {
        await pose.send({ image: video });
    } catch (err) {
        console.log("Processing skip");
    }
    requestAnimationFrame(renderLoop);
}

function onResults(results) {
    if (isFrozen) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.poseLandmarks) {
        statusText.innerText = "✅ BODY DETECTED";
        const lm = results.poseLandmarks;
        
        // 1. Logic
        updateNumbers(lm);

        // 2. Drawing
        drawConnectors(ctx, lm, POSE_CONNECTIONS, {color: '#00FFAA', lineWidth: 3});
        drawLandmarks(ctx, lm, {color: '#FFFFFF', radius: 2});
    } else {
        statusText.innerText = "⚠️ STAND BACK FURTHER";
    }
    ctx.restore();
}

function updateNumbers(lm) {
    const userH = parseFloat(heightInp.value) || 65;
    const heightCm = currentUnit === 'inch' ? userH * 2.54 : userH;
    
    // Scale: Nose to Ankles
    const ankleY = (lm[27].y + lm[28].y) / 2;
    const pxH = Math.abs(ankleY - lm[0].y);
    const cmPerPx = heightCm / (pxH * canvas.height);
    const factor = 2.32; 

    const sPx = Math.hypot(lm[12].x - lm[11].x, lm[12].y - lm[11].y) * canvas.width;
    const hPx = Math.hypot(lm[24].x - lm[23].x, lm[24].y - lm[23].y) * canvas.width;

    const div = currentUnit === 'inch' ? 2.54 : 1;
    
    document.getElementById('out-sh').innerText = ((sPx * cmPerPx) / div).toFixed(1);
    document.getElementById('out-bu').innerText = ((sPx * 0.95 * cmPerPx * factor) / div).toFixed(1);
    document.getElementById('out-wa').innerText = ((hPx * 0.82 * cmPerPx * factor) / div).toFixed(1);
    document.getElementById('out-hi').innerText = ((hPx * cmPerPx * factor) / div).toFixed(1);
}

function takeSnapshot() {
    isFrozen = true;
    speak("Snapshot captured. Copied to clipboard.");
    
    const sh = document.getElementById('out-sh').innerText;
    const bu = document.getElementById('out-bu').innerText;
    const wa = document.getElementById('out-wa').innerText;
    const hi = document.getElementById('out-hi').innerText;
    
    const data = `Date: ${new Date().toLocaleDateString()}\tUnit: ${currentUnit}\tSH: ${sh}\tBU: ${bu}\tWA: ${wa}\tHI: ${hi}`;
    navigator.clipboard.writeText(data);
    
    document.getElementById('capture-btn').style.display = 'none';
    document.getElementById('resume-btn').style.display = 'block';
}

function resumeScan() {
    isFrozen = false;
    document.getElementById('capture-btn').style.display = 'flex';
    document.getElementById('resume-btn').style.display = 'none';
    requestAnimationFrame(renderLoop);
}

function toggleUnits() {
    const val = parseFloat(heightInp.value);
    if (currentUnit === 'inch') {
        currentUnit = 'cm';
        heightInp.value = Math.round(val * 2.54);
    } else {
        currentUnit = 'inch';
        heightInp.value = (val / 2.54).toFixed(1);
    }
    document.getElementById('unit-btn').innerText = currentUnit.toUpperCase();
    document.querySelectorAll('.unit-txt').forEach(t => t.innerText = currentUnit);
}

function toggleCamera() {
    currentFacing = (currentFacing === 'user') ? 'environment' : 'user';
    startCamera();
}
