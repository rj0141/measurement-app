// --- GLOBAL ELEMENTS ---
const setupHeight = document.getElementById('setupHeight');
const activateBtn = document.getElementById('activate-btn');
const overlay = document.getElementById('start-overlay');
const userHeightInput = document.getElementById('userHeight');
const video = document.getElementById('input_video');
const canvas = document.getElementById('output_canvas');
const ctx = canvas.getContext('2d');
const statusText = document.getElementById('status-overlay');

// --- APP STATE ---
let isFrozen = false;
let currentFacing = 'environment'; 
let stream = null;
let currentUnit = 'inch';
let pose = null;

// NEW: Scanning State
let scanPhase = "FRONT"; // FRONT -> SIDE -> DONE
let frontWidths = { sh: 0, bu: 0, wa: 0, hi: 0 };
let sideWidths = { sh: 0, bu: 0, wa: 0, hi: 0 };
let pixelScaleFactor = 0; // Inches per Pixel

// --- 1. MANDATORY HEIGHT VALIDATION ---
function validateHeight() {
    const val = parseFloat(setupHeight.value);
    if (!isNaN(val) && val > 0) {
        activateBtn.disabled = false;
        activateBtn.style.background = "#00FFAA";
        activateBtn.style.color = "black";
    } else {
        activateBtn.disabled = true;
        activateBtn.style.background = "#333";
        activateBtn.style.color = "#666";
    }
}
// Force check every 500ms to catch mobile keyboard entries
setInterval(validateHeight, 500);

// --- 2. INITIALIZATION ---
async function initApp() {
    const val = parseFloat(setupHeight.value);
    if (isNaN(val) || val <= 0) return;

    userHeightInput.value = val;
    overlay.style.display = 'none';
    statusText.innerText = "LOADING AI...";
    
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
            statusText.innerText = "FRONT SCAN READY";
            speak("Ready for front scan. Please stand straight facing the camera.");
            requestAnimationFrame(renderLoop);
        };
    } catch (e) {
        statusText.innerText = "❌ CAMERA ERROR";
    }
}

// --- 3. CORE LOGIC & MATH ---
async function renderLoop() {
    if (isFrozen || !pose) return;
    try { await pose.send({ image: video }); } catch (err) {}
    requestAnimationFrame(renderLoop);
}

function onResults(results) {
    if (isFrozen) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.poseLandmarks) {
        const lm = results.poseLandmarks;
        processMeasurements(lm);
        drawConnectors(ctx, lm, POSE_CONNECTIONS, {color: '#00FFAA', lineWidth: 3});
        drawLandmarks(ctx, lm, {color: '#FFFFFF', radius: 2});
    } else {
        statusText.innerText = "⚠️ STEP BACK";
    }
    ctx.restore();
}

function processMeasurements(lm) {
    const canvasW = canvas.width;
    const canvasH = canvas.height;

    // SCALE: Use height only (Nose to Ankle)
    const ankleY = (lm[27].y + lm[28].y) / 2;
    const pxHeight = Math.abs(ankleY - lm[0].y) * canvasH;
    const userH = parseFloat(userHeightInput.value) || 65;
    pixelScaleFactor = userH / pxHeight;

    // Calculate RAW pixel widths (Distance between Landmark Pairs)
    const currentW = {
        sh: Math.hypot(lm[12].x - lm[11].x, lm[12].y - lm[11].y) * canvasW,
        bu: Math.hypot(lm[12].x - lm[11].x, lm[12].y - lm[11].y) * canvasW * 1.05, // Bust width reference
        wa: Math.hypot(lm[24].x - lm[23].x, lm[24].y - lm[23].y) * canvasW * 0.9,  // Waist width reference
        hi: Math.hypot(lm[24].x - lm[23].x, lm[24].y - lm[23].y) * canvasW
    };

    if (scanPhase === "FRONT") {
        statusText.innerText = "✅ CAPTURE FRONT";
        updateUI(currentW, true); // True = show raw front width
    } else if (scanPhase === "SIDE") {
        statusText.innerText = "✅ CAPTURE SIDE";
    }
}

function updateUI(widths, isLive) {
    const div = currentUnit === 'inch' ? 1 : 1; // Scaling already handled by pixelScaleFactor
    
    document.getElementById('out-sh').innerText = (widths.sh * pixelScaleFactor).toFixed(1);
    document.getElementById('out-bu').innerText = (widths.bu * pixelScaleFactor).toFixed(1);
    document.getElementById('out-wa').innerText = (widths.wa * pixelScaleFactor).toFixed(1);
    document.getElementById('out-hi').innerText = (widths.hi * pixelScaleFactor).toFixed(1);
}

// --- 4. PHASE NAVIGATION ---
function takeSnapshot() {
    const lm = lastLandmarks; // We would need a global 'lastLandmarks' but let's calculate on click
    
    if (scanPhase === "FRONT") {
        // LOCK FRONT WIDTHS
        frontWidths = getWidthsFromCurrentFrame(); 
        scanPhase = "SIDE";
        speak("Front captured. Now turn 90 degrees to your side and tap the button again.");
        statusText.innerText = "READY FOR SIDE SCAN";
    } else if (scanPhase === "SIDE") {
        // LOCK SIDE DEPTHS
        sideWidths = getWidthsFromCurrentFrame();
        calculateFinalGirths();
        scanPhase = "DONE";
        isFrozen = true;
        speak("Measurements complete.");
    }
}

function getWidthsFromCurrentFrame() {
    // Logic to pull the current pixel width values at the moment of the click
    return {
        sh: parseFloat(document.getElementById('out-sh').innerText) / pixelScaleFactor,
        bu: parseFloat(document.getElementById('out-bu').innerText) / pixelScaleFactor,
        wa: parseFloat(document.getElementById('out-wa').innerText) / pixelScaleFactor,
        hi: parseFloat(document.getElementById('out-hi').innerText) / pixelScaleFactor
    };
}

function calculateFinalGirths() {
    // Ellipse perimeter formula: π * sqrt(2 * (a^2 + b^2)) where a and b are semi-axes
    // Here a = FrontWidth/2 and b = SideWidth/2
    ["sh", "bu", "wa", "hi"].forEach(key => {
        const wf = frontWidths[key] * pixelScaleFactor;
        const ws = sideWidths[key] * pixelScaleFactor;
        
        // Approximation: PI * (1.5(a+b) - sqrt(ab))
        const a = wf / 2;
        const b = ws
