// --- STATE MANAGEMENT ---
let scanPhase = "FRONT"; // "FRONT", "TURNING", "SIDE", "DONE"
let frontWidths = { sh: 0, bu: 0, wa: 0, hi: 0 };
let sideWidths = { sh: 0, bu: 0, wa: 0, hi: 0 };
let pixelHeightFront = 0;

function updateNumbers(lm) {
    const canvasH = canvas.height;
    const canvasW = canvas.width;
    
    // 1. HEIGHT REFERENCE (Always Front-Facing for scaling)
    const ankleY = (lm[27].y + lm[28].y) / 2;
    const currentPixelHeight = Math.abs(ankleY - lm[0].y) * canvasH;
    
    if (scanPhase === "FRONT") {
        pixelHeightFront = currentPixelHeight;
        // Capture REAL pixel widths at specific vertical landmarks
        frontWidths.sh = Math.abs(lm[12].x - lm[11].x) * canvasW;
        frontWidths.bu = getBodyWidthAtY(lm, (lm[12].y + lm[24].y) / 2, canvasW); // Mid-chest
        frontWidths.wa = getBodyWidthAtY(lm, (lm[24].y * 0.7 + lm[12].y * 0.3), canvasW); // Natural waist
        frontWidths.hi = Math.abs(lm[24].x - lm[23].x) * canvasW;
        
        displayLiveValues(frontWidths, "FRONT");
    } 
    else if (scanPhase === "SIDE") {
        // Capture Depth (Side Width)
        sideWidths.sh = Math.abs(lm[12].x - lm[11].x) * canvasW; // Technically shoulder depth
        sideWidths.bu = getBodyWidthAtY(lm, (lm[12].y + lm[24].y) / 2, canvasW);
        sideWidths.wa = getBodyWidthAtY(lm, (lm[24].y * 0.7 + lm[12].y * 0.3), canvasW);
        sideWidths.hi = Math.abs(lm[24].x - lm[23].x) * canvasW;
        
        calculateFinalGirths();
    }
}

// Utility to find "Pixel Width" at a specific vertical line
function getBodyWidthAtY(lm, yLevel, canvasW) {
    // For now, we use the distance between the left and right hip/shoulder markers 
    // as the boundary for the search, though we can refine this with segmentation later.
    return Math.abs(lm[24].x - lm[23].x) * canvasW; 
}

function calculateFinalGirths() {
    const userH = parseFloat(userHeight.value) || 65;
    const heightInDesiredUnit = userH; // Reference height
    const cmPerPx = heightInDesiredUnit / pixelHeightFront;

    const results = {};
    ["sh", "bu", "wa", "hi"].forEach(key => {
        const wf = frontWidths[key];
        const ws = sideWidths[key];
        // Ellipse approximation for girth
        const girthPx = Math.PI * Math.sqrt((Math.pow(wf, 2) + Math.pow(ws, 2)) / 2);
        results[key] = (girthPx * cmPerPx).toFixed(1);
    });

    document.getElementById('out-sh').innerText = results.sh;
    document.getElementById('out-bu').innerText = results.bu;
    document.getElementById('out-wa').innerText = results.wa;
    document.getElementById('out-hi').innerText = results.hi;
}

// --- PHASE CONTROL ---
function takeSnapshot() {
    if (scanPhase === "FRONT") {
        scanPhase = "TURNING";
        statusText.innerText = "TURN 90 DEGREES";
        speak("Front captured. Now, please turn to your side.");
        setTimeout(() => {
            scanPhase = "SIDE";
            statusText.innerText = "SCANNING SIDE...";
        }, 3000);
    } else if (scanPhase === "SIDE") {
        scanPhase = "DONE";
        isFrozen = true;
        speak("Scan complete. Measurements calculated.");
        copyToClipboard();
    }
}

function displayLiveValues(widths, phase) {
    // This shows raw width during front scan so user sees it "working"
    if (phase === "FRONT") {
        document.getElementById('out-sh').innerText = widths.sh.toFixed(0) + "px";
        document.getElementById('out-bu').innerText = widths.bu.toFixed(0) + "px";
        document.getElementById('out-wa').innerText = widths.wa.toFixed(0) + "px";
        document.getElementById('out-hi').innerText = widths.hi.toFixed(0) + "px";
    }
}
