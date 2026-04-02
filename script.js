// Global State
let scanPhase = "FRONT"; 
let frontWidths = { sh: 0, bu: 0, wa: 0, hi: 0 };
let sideWidths = { sh: 0, bu: 0, wa: 0, hi: 0 };
let isFrozen = false;
let currentFacing = 'environment';
let stream = null;
let pose = null;

// 1. THE RELIABLE VALIDATOR
function validateHeight() {
    const setupHeight = document.getElementById('setupHeight');
    const activateBtn = document.getElementById('activate-btn');
    
    if (!setupHeight || !activateBtn) return;

    const val = parseFloat(setupHeight.value);
    
    if (!isNaN(val) && val > 0) {
        // Force the button to turn on
        activateBtn.disabled = false;
        activateBtn.style.backgroundColor = "#00FFAA";
        activateBtn.style.color = "#000000";
        activateBtn.style.opacity = "1";
    } else {
        activateBtn.disabled = true;
        activateBtn.style.backgroundColor = "#333333";
        activateBtn.style.color = "#666666";
    }
}

// 2. WAIT FOR WINDOW LOAD
window.onload = () => {
    const setupHeight = document.getElementById('setupHeight');
    
    // Attach listeners for every possible interaction
    if (setupHeight) {
        ['input', 'change', 'keyup', 'blur', 'focus'].forEach(ev => {
            setupHeight.addEventListener(ev, validateHeight);
        });
    }

    // Secondary backup: Check every half second
    setInterval(validateHeight, 500);
    
    console.log("Scanner initialized and waiting for height...");
};

// 3. START APP
async function initApp() {
    const setupHeight = document.getElementById('setupHeight');
    const userHeightDisplay = document.getElementById('userHeight');
    const overlay = document.getElementById('start-overlay');
    const statusText = document.getElementById('status-overlay');

    if (!setupHeight.value || setupHeight.value <= 0) return;

    // Sync values
    userHeightDisplay.value = setupHeight.value;
    overlay.style.display = 'none';
    statusText.innerText = "INITIALIZING CAMERA...";

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
    const video = document.getElementById('input_video');
    const statusText = document.getElementById('status-overlay');

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
        alert("Camera failed to start. Please check permissions.");
    }
}

// 4. MEASUREMENT LOGIC (PIXEL-WIDTH BASED)
async function renderLoop() {
    if (isFrozen || !pose) return;
    const video = document.getElementById('input_video');
    try { await pose.send({ image: video }); } catch (err) {}
    requestAnimationFrame(renderLoop);
}

function onResults(results) {
    if (isFrozen) return;
    const video = document.getElementById('input_video');
    const canvas = document.getElementById('output_canvas');
    const ctx = canvas.getContext('2d');
    const statusText = document.getElementById('status-overlay');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.poseLandmarks) {
        const lm = results.poseLandmarks;
        calculatePixelWidths(lm);
        drawConnectors(ctx, lm, POSE_CONNECTIONS, {color: '#00FFAA', lineWidth: 3});
        drawLandmarks(ctx, lm, {color: '#FFFFFF', radius: 2});
    } else {
        statusText.innerText = "⚠️ STEP BACK - SHOW FULL BODY";
    }
    ctx.restore();
}

function calculatePixelWidths(lm) {
    const canvasW = document.getElementById('output_canvas').width;
    const canvasH = document.getElementById('output_canvas').height;
    const userHVal = parseFloat(document.getElementById('userHeight').value) || 65;

    // SCALE: Pixel height from Nose to Ankle
    const ankleY = (lm[27].y + lm[28].y) / 2;
    const pxHeight = Math.abs(ankleY - lm[0].y) * canvasH;
    const pxScale = userHVal / pxHeight; 

    // Measures distance between left and right markers directly (The "Actual" Pixel Width)
    const currentW = {
        sh: Math.abs(lm[12].x - lm[11].x) * canvasW,
        bu: Math.abs(lm[12].x - lm[11].x) * canvasW * 1.1, // Adjusted for chest volume
        wa: Math.abs(lm[24].x - lm[23].x) * canvasW * 0.95,
        hi: Math.abs(lm[24].x - lm[23].x) * canvasW
    };

    if (scanPhase === "FRONT") {
        updateMeasurementUI(currentW, pxScale);
    }
}

function updateMeasurementUI(widths, scale) {
    document.getElementById('out-sh').innerText = (widths.sh * scale).toFixed(1);
    document.getElementById('out-bu').innerText = (widths.bu * scale).toFixed(1);
    document.getElementById('out-wa').innerText = (widths.wa * scale).toFixed(1);
    document.getElementById('out-hi').innerText = (widths.hi * scale).toFixed(1);
}

function speak(txt) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(txt));
}

// 5. PHASE NAVIGATION (CAPTURE BUTTON CLICK)
function takeSnapshot() {
    if (scanPhase === "FRONT") {
        // Capture front widths in pixels
        const scale = parseFloat(document.getElementById('userHeight').value) / (/* calc height here if needed */ 1000); 
        frontWidths = {
            sh: parseFloat(document.getElementById('out-sh').innerText),
            bu: parseFloat(document.getElementById('out-bu').innerText),
            wa: parseFloat(document.getElementById('out-wa').innerText),
            hi: parseFloat(document.getElementById('out-hi').innerText)
        };
        
        scanPhase = "SIDE";
        speak("Front captured. Now please turn ninety degrees to your side and tap again.");
        document.getElementById('status-overlay').innerText = "TURN FOR SIDE SCAN";
    } else if (scanPhase === "SIDE") {
        sideWidths = {
            sh: parseFloat(document.getElementById('out-sh').innerText),
            bu: parseFloat(document.getElementById('out-bu').innerText),
            wa: parseFloat(document.getElementById('out-wa').innerText),
            hi: parseFloat(document.getElementById('out-hi').innerText)
        };

        // FINAL GIRTH CALCULATION (Perimeter of an Ellipse)
        ["sh", "bu", "wa", "hi"].forEach(k => {
            const a = frontWidths[k] / 2; // Semi-major
            const b = sideWidths[k] / 2; // Semi-minor
            // Ramanujan Approximation for Girth
            const girth = Math.PI * (3*(a + b) - Math.sqrt((3*a + b) * (a + 3*b)));
            document.getElementById('out-' + k).innerText = girth.toFixed(1);
        });

        scanPhase = "DONE";
        isFrozen = true;
        speak("Final measurements calculated. Ready to copy.");
    }
}
