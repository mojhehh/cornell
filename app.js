const WORKER_URL = 'https://cornell-notes-ai.modmojheh.workers.dev';
const CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.split('');

const trainedLetters = {};
let currentTrainingLetter = null;
let selectedPaper = 'lined';
let selectedStyle = 'neat';
let paperLineSpacing = 26;
let paperMarginWidth = 75;
let paperTint = 'white';
let customTintColor = '#fefefe';
let customPaper = {
    bg: '#fefefe',
    pattern: 'lined',
    lineColor: '#a8d4ff',
    lineSpacing: 26,
    margin: true,
    marginColor: '#ffb8b8',
    dividerColor: '#333333',
    inkColor: '#1a1a2e',
    labelColor: '#888888',
    gridSize: 20,
    dotSize: 2,
    lineWidth: 1,
    texture: 'none'
};
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let traceCtx = null;
let guideCtx = null;
let penThickness = 4;
let strokePaths = [];
let currentPath = [];
let selectedNoteType = 'cornell';

const HANDWRITING_PRESETS = {
    messy: {
        rotation: 0.08,
        scaleVar: 0.08,
        offsetVar: 3,
        letterSpacingVar: 1.5,
        baselineVar: 3,
        slant: -0.03,
        font: 'Indie Flower, cursive',
        thickness: 1,
        sizeVar: 0.06
    },
    casual: {
        rotation: 0.06,
        scaleVar: 0.06,
        offsetVar: 2,
        letterSpacingVar: 1,
        baselineVar: 2,
        slant: 0.02,
        font: 'Covered By Your Grace, cursive',
        thickness: 1,
        sizeVar: 0.05,
        letterSpacing: 0.42,
        wordSpacing: 0.3
    },
    neat: {
        rotation: 0.05,
        scaleVar: 0.04,
        offsetVar: 2,
        letterSpacingVar: 1,
        baselineVar: 1.5,
        slant: 0.03,
        font: 'Patrick Hand, cursive',
        thickness: 1,
        sizeVar: 0.03,
        letterSpacing: 0.4,
        wordSpacing: 0.3
    },
    perfect: {
        rotation: 0.02,
        scaleVar: 0.02,
        offsetVar: 1,
        letterSpacingVar: 0.5,
        baselineVar: 0.5,
        slant: 0.02,
        font: 'Architects Daughter, cursive',
        thickness: 1,
        sizeVar: 0.01,
        letterSpacing: 0.38,
        wordSpacing: 0.28
    },
    cursive: {
        rotation: 0.06,
        scaleVar: 0.05,
        offsetVar: 2,
        letterSpacingVar: 0,
        baselineVar: 2,
        slant: 0.12,
        font: 'Caveat, cursive',
        thickness: 1,
        sizeVar: 0.04,
        letterSpacing: 0.35,
        wordSpacing: 0.25
    }
};

const heroSection = document.getElementById('heroSection');
const trainingSection = document.getElementById('trainingSection');
const inputSection = document.getElementById('inputSection');
const notesSection = document.getElementById('notesSection');
const letterGrid = document.getElementById('letterGrid');
const traceModal = document.getElementById('traceModal');
const traceCanvas = document.getElementById('traceCanvas');
const guideCanvas = document.getElementById('guideCanvas');
const progressText = document.getElementById('progressText');
const progressFill = document.getElementById('progressFill');
const continueBtn = document.getElementById('continueBtn');
const paperCanvas = document.getElementById('paperCanvas');
const stepDots = document.querySelectorAll('.step-dot');

document.addEventListener('DOMContentLoaded', init);

function init() {
    setupLetterGrid();
    setupTraceCanvas();
    setupEventListeners();
    setupParallax();
}

function setupParallax() {
    window.addEventListener('scroll', () => {
        const bg = document.querySelector('.parallax-bg');
        if (bg) {
            bg.style.transform = `translateY(${window.scrollY * 0.3}px)`;
        }
    });
}

function setupLetterGrid() {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const lowercase = 'abcdefghijklmnopqrstuvwxyz'.split('');
    const numbers = '0123456789'.split('');
    
    function addSection(label, chars) {
        const sectionLabel = document.createElement('div');
        sectionLabel.className = 'grid-section-label';
        sectionLabel.textContent = label;
        letterGrid.appendChild(sectionLabel);
        
        chars.forEach(char => {
            const box = document.createElement('div');
            box.className = 'letter-box';
            box.textContent = char;
            box.dataset.char = char;
            box.addEventListener('click', () => openTraceModal(char));
            letterGrid.appendChild(box);
        });
    }
    
    addSection('Uppercase', uppercase);
    addSection('Lowercase', lowercase);
    addSection('Numbers', numbers);
}

function setupTraceCanvas() {
    traceCanvas.width = 200;
    traceCanvas.height = 200;
    guideCanvas.width = 200;
    guideCanvas.height = 200;
    traceCtx = traceCanvas.getContext('2d');
    guideCtx = guideCanvas.getContext('2d');
    traceCanvas.addEventListener('mousedown', startDraw);
    traceCanvas.addEventListener('mousemove', draw);
    traceCanvas.addEventListener('mouseup', endDraw);
    traceCanvas.addEventListener('mouseout', endDraw);
    traceCanvas.addEventListener('touchstart', handleTouch);
    traceCanvas.addEventListener('touchmove', handleTouchMove);
    traceCanvas.addEventListener('touchend', endDraw);
}

function setupEventListeners() {
    continueBtn.addEventListener('click', goToInput);
    document.getElementById('clearLetterBtn').addEventListener('click', clearTrace);
    document.getElementById('saveLetterBtn').addEventListener('click', saveLetter);
    document.getElementById('generateBtn').addEventListener('click', generateNotes);
    document.getElementById('printBtn').addEventListener('click', () => window.print());
    document.getElementById('restartBtn').addEventListener('click', restart);
    document.getElementById('closeModalBtn').addEventListener('click', closeTraceModal);
    document.getElementById('backToTrainingBtn').addEventListener('click', backToStyle);
    document.getElementById('getStartedBtn').addEventListener('click', handleStyleContinue);
    document.getElementById('backToStyleBtn').addEventListener('click', backToHero);
    document.querySelector('.modal-backdrop').addEventListener('click', closeTraceModal);

    document.getElementById('fetchUrlBtn').addEventListener('click', fetchUrl);
    document.getElementById('fileUpload').addEventListener('change', handleFileUpload);
    setupBookmarklet();

    document.querySelectorAll('.style-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.style-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedStyle = opt.dataset.style;
        });
    });

    document.querySelectorAll('.paper-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.paper-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedPaper = btn.dataset.paper;
            const builder = document.getElementById('customPaperBuilder');
            if (builder) builder.classList.toggle('hidden', selectedPaper !== 'custom');
            if (selectedPaper === 'custom') openEditor();
        });
    });

    setupPaperEditor();

    document.querySelectorAll('.note-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.note-type-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedNoteType = btn.dataset.type;
            const placeholders = {
                cornell: 'Paste text from a textbook, article, or lecture notes...',
                vocab: 'Paste text containing vocabulary words, definitions, or key terms...',
                timeline: 'Paste text with dates, events, or historical content...',
                character: 'Paste text from a story, novel, or play with characters...',
                all: 'Paste any text and the AI will figure out the best format...'
            };
            document.getElementById('contentInput').placeholder = placeholders[selectedNoteType] || placeholders.cornell;
        });
    });

    const lineSpacingSlider = document.getElementById('lineSpacingSlider');
    if (lineSpacingSlider) {
        lineSpacingSlider.addEventListener('input', () => {
            paperLineSpacing = parseInt(lineSpacingSlider.value);
        });
    }

    const marginSlider = document.getElementById('marginSlider');
    if (marginSlider) {
        marginSlider.addEventListener('input', () => {
            paperMarginWidth = parseInt(marginSlider.value);
        });
    }

    document.querySelectorAll('.tint-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tint-btn').forEach(b => b.classList.remove('selected'));
            const picker = document.getElementById('customTintPicker');
            if (picker) picker.classList.remove('active');
            btn.classList.add('selected');
            paperTint = btn.dataset.tint;
        });
    });

    const customTintPicker = document.getElementById('customTintPicker');
    if (customTintPicker) {
        customTintPicker.addEventListener('input', () => {
            document.querySelectorAll('.tint-btn').forEach(b => b.classList.remove('selected'));
            customTintPicker.classList.add('active');
            customTintColor = customTintPicker.value;
            paperTint = 'custom';
        });
    }

    const thicknessSlider = document.getElementById('thicknessSlider');
    const thicknessValue = document.getElementById('thicknessValue');
    if (thicknessSlider) {
        thicknessSlider.addEventListener('input', () => {
            penThickness = parseFloat(thicknessSlider.value);
            thicknessValue.textContent = penThickness;
            redrawAllStrokes();
        });
    }
}

function handleStyleContinue() {
    if (selectedStyle === 'custom') {
        goToTraining();
    } else {
        goToInput();
    }
}

function generatePresetLetters(style) {
    const preset = HANDWRITING_PRESETS[style];
    const allChars = CHARACTERS.concat('.,!?\'"\\-:;()'.split(''));
    
    allChars.forEach(char => {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');
        
        ctx.save();
        ctx.translate(100, 105);
        
        const rotation = (Math.random() - 0.5) * preset.rotation;
        const scaleX = 1 + (Math.random() - 0.5) * preset.scaleVar;
        const scaleY = 1 + (Math.random() - 0.5) * preset.scaleVar;
        const offsetX = (Math.random() - 0.5) * preset.offsetVar;
        const offsetY = (Math.random() - 0.5) * preset.offsetVar;
        
        ctx.rotate(rotation + preset.slant);
        ctx.scale(scaleX, scaleY);
        ctx.translate(offsetX, offsetY);
        
        const baseSize = style === 'cursive' ? 130 : 120;
        const fontSize = baseSize * (1 + (Math.random() - 0.5) * (preset.sizeVar || 0));
        ctx.font = `${fontSize}px ${preset.font}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#1a1a2e';
        ctx.fillText(char, 0, 0);
        
        ctx.restore();
        trainedLetters[char] = canvas.toDataURL();
    });
}

function backToHero() {
    trainingSection.classList.remove('active');
    heroSection.classList.add('active');
    hideStepIndicators();
}

function backToStyle() {
    inputSection.classList.remove('active');
    if (selectedStyle === 'custom') {
        trainingSection.classList.add('active');
    } else {
        heroSection.classList.add('active');
    }
}

function updateStepIndicators(step) {
    stepDots.forEach((dot, i) => {
        dot.classList.remove('active', 'done');
        if (i + 1 < step) dot.classList.add('done');
        if (i + 1 === step) dot.classList.add('active');
    });
}

function openTraceModal(char) {
    currentTrainingLetter = char;
    document.getElementById('currentLetter').textContent = char;
    traceModal.classList.remove('hidden');
    guideCtx.clearRect(0, 0, 200, 200);
    guideCtx.font = 'bold 150px Georgia, serif';
    guideCtx.textAlign = 'center';
    guideCtx.textBaseline = 'middle';
    guideCtx.fillStyle = '#333';
    guideCtx.fillText(char, 100, 105);
    clearTrace();
}

function closeTraceModal() {
    traceModal.classList.add('hidden');
    currentTrainingLetter = null;
}

function startDraw(e) {
    isDrawing = true;
    const rect = traceCanvas.getBoundingClientRect();
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;
    currentPath = [{x: lastX, y: lastY}];
}

function draw(e) {
    if (!isDrawing) return;
    const rect = traceCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    currentPath.push({x, y});
    traceCtx.beginPath();
    traceCtx.moveTo(lastX, lastY);
    traceCtx.lineTo(x, y);
    traceCtx.strokeStyle = '#1a1a2e';
    traceCtx.lineWidth = penThickness;
    traceCtx.lineCap = 'round';
    traceCtx.lineJoin = 'round';
    traceCtx.stroke();
    lastX = x;
    lastY = y;
}

function redrawAllStrokes() {
    traceCtx.clearRect(0, 0, 200, 200);
    traceCtx.strokeStyle = '#1a1a2e';
    traceCtx.lineWidth = penThickness;
    traceCtx.lineCap = 'round';
    traceCtx.lineJoin = 'round';
    strokePaths.forEach(path => {
        if (path.length < 2) return;
        traceCtx.beginPath();
        traceCtx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) {
            traceCtx.lineTo(path[i].x, path[i].y);
        }
        traceCtx.stroke();
    });
}

function endDraw() {
    if (isDrawing && currentPath.length > 0) {
        strokePaths.push([...currentPath]);
    }
    isDrawing = false;
    currentPath = [];
}

function handleTouch(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = traceCanvas.getBoundingClientRect();
    isDrawing = true;
    lastX = touch.clientX - rect.left;
    lastY = touch.clientY - rect.top;
    currentPath = [{x: lastX, y: lastY}];
}

function handleTouchMove(e) {
    e.preventDefault();
    if (!isDrawing) return;
    const touch = e.touches[0];
    const rect = traceCanvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    currentPath.push({x, y});
    traceCtx.beginPath();
    traceCtx.moveTo(lastX, lastY);
    traceCtx.lineTo(x, y);
    traceCtx.strokeStyle = '#1a1a2e';
    traceCtx.lineWidth = penThickness;
    traceCtx.lineCap = 'round';
    traceCtx.lineJoin = 'round';
    traceCtx.stroke();
    lastX = x;
    lastY = y;
}

function clearTrace() {
    traceCtx.clearRect(0, 0, 200, 200);
    strokePaths = [];
    currentPath = [];
}

function saveLetter() {
    trainedLetters[currentTrainingLetter] = traceCanvas.toDataURL();
    const box = document.querySelector(`.letter-box[data-char="${currentTrainingLetter}"]`);
    box.classList.add('trained');
    updateProgress();
    closeTraceModal();
}

function updateProgress() {
    const trained = Object.keys(trainedLetters).length;
    const total = CHARACTERS.length;
    progressText.textContent = `${trained} of ${total}`;
    progressFill.style.width = `${(trained / total) * 100}%`;
    if (trained >= 10) continueBtn.disabled = false;
}

function showStepIndicators() {
    const si = document.querySelector('.step-indicators');
    if (si) si.classList.remove('hidden');
}

function hideStepIndicators() {
    const si = document.querySelector('.step-indicators');
    if (si) si.classList.add('hidden');
}

function goToTraining() {
    heroSection.classList.remove('active');
    inputSection.classList.remove('active');
    trainingSection.classList.add('active');
    showStepIndicators();
    updateStepIndicators(1);
}

function goToInput() {
    trainingSection.classList.remove('active');
    heroSection.classList.remove('active');
    inputSection.classList.add('active');
    showStepIndicators();
    updateStepIndicators(2);
}

async function generateNotes() {
    const content = document.getElementById('contentInput').value.trim();
    if (!content) return;
    const words = content.split(/\s+/).filter(w => w.length > 3);
    if (content.length < 100 || words.length < 15) {
        alert('Please paste real study content — at least a full paragraph from a textbook, article, or lecture notes.');
        return;
    }
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('generateBtn').disabled = true;
    try {
        await document.fonts.ready;
        const notes = await callAI(content);
        displayNotes(notes);
    } catch (error) {
        console.error(error);
        const notes = generateFallback(content);
        displayNotes(notes);
    }
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('generateBtn').disabled = false;
}

async function callAI(content) {
    const res = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, noteType: selectedNoteType })
    });
    if (!res.ok) {
        const errText = await res.text().catch(() => 'Unknown error');
        throw new Error(`API error ${res.status}: ${errText}`);
    }
    const data = await res.json();
    if (!data || !Array.isArray(data.mainIdeas) || !Array.isArray(data.notes)) {
        throw new Error('Invalid response format');
    }
    return data;
}

let customBlocks = [];
let editorBgImageData = null;
let editorDrawHistory = [];
let editorTool = 'select';
let editorPaperW = 816;
let editorPaperH = 1056;

const BLOCK_TYPES = {
    'main-ideas': { icon: '💡', label: 'Main Ideas', desc: 'AI places main idea statements here', defaultLabel: 'Main Ideas' },
    'questions': { icon: '❓', label: 'Questions', desc: 'AI places key questions here', defaultLabel: 'Key Questions' },
    'notes': { icon: '📝', label: 'Notes / Answers', desc: 'AI places detailed answers here', defaultLabel: 'Notes' },
    'summary': { icon: '📋', label: 'Summary', desc: 'AI places the summary here', defaultLabel: 'Summary' },
    'vocab': { icon: '📖', label: 'Vocabulary', desc: 'AI places key terms + definitions', defaultLabel: 'Vocabulary' },
    'timeline': { icon: '📅', label: 'Timeline', desc: 'AI places dates and events', defaultLabel: 'Timeline' },
    'free': { icon: '✏️', label: 'Free Text', desc: 'Custom label — you write the text', defaultLabel: '' },
    'divider': { icon: '➖', label: 'Divider', desc: 'A horizontal line', defaultLabel: '' }
};

const PAGE_SIZES = {
    letter: { w: 816, h: 1056 },
    legal: { w: 816, h: 1344 },
    a4: { w: 794, h: 1123 }
};

function openEditor() {
    const ov = document.getElementById('editorOverlay');
    ov.classList.remove('hidden');
    requestAnimationFrame(() => {
        resizeEditorCanvas();
        redrawEditorCanvas();
        renderEditorBlocks();
    });
}

function closeEditor() {
    document.getElementById('editorOverlay').classList.add('hidden');
}

function resizeEditorCanvas() {
    const paper = document.getElementById('editorPaper');
    const dc = document.getElementById('editorDrawCanvas');
    if (!paper || !dc) return;
    paper.style.width = editorPaperW + 'px';
    paper.style.height = editorPaperH + 'px';
    dc.width = editorPaperW;
    dc.height = editorPaperH;
}

function redrawEditorCanvas() {
    const dc = document.getElementById('editorDrawCanvas');
    if (!dc) return;
    const ctx = dc.getContext('2d');
    ctx.clearRect(0, 0, dc.width, dc.height);
    // BG color
    ctx.fillStyle = customPaper.bg;
    ctx.fillRect(0, 0, dc.width, dc.height);
    // BG image
    if (editorBgImageData) {
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, 0, 0, dc.width, dc.height);
            drawEditorPattern(ctx, dc.width, dc.height);
            replayDrawStrokes(ctx);
        };
        img.src = editorBgImageData;
        return;
    }
    drawEditorPattern(ctx, dc.width, dc.height);
    replayDrawStrokes(ctx);
}

function drawEditorPattern(ctx, w, h) {
    const sp = customPaper.lineSpacing;
    const lc = customPaper.lineColor;
    if (customPaper.pattern === 'lined') {
        ctx.strokeStyle = lc; ctx.lineWidth = 1;
        for (let y = sp; y < h; y += sp) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }
    } else if (customPaper.pattern === 'graph') {
        ctx.strokeStyle = lc; ctx.lineWidth = 0.5;
        for (let x = sp; x < w; x += sp) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }
        for (let y = sp; y < h; y += sp) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }
    } else if (customPaper.pattern === 'dotted') {
        ctx.fillStyle = lc;
        for (let x = sp; x < w; x += sp) {
            for (let y = sp; y < h; y += sp) {
                ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
            }
        }
    }
}

function replayDrawStrokes(ctx) {
    editorDrawHistory.forEach(stroke => {
        if (stroke.type === 'free' && stroke.pts.length > 1) {
            ctx.strokeStyle = stroke.color;
            ctx.lineWidth = stroke.size;
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(stroke.pts[0].x, stroke.pts[0].y);
            for (let i = 1; i < stroke.pts.length; i++) {
                ctx.lineTo(stroke.pts[i].x, stroke.pts[i].y);
            }
            ctx.stroke();
        } else if (stroke.type === 'line') {
            ctx.strokeStyle = stroke.color;
            ctx.lineWidth = stroke.size;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(stroke.pts[0].x, stroke.pts[0].y);
            ctx.lineTo(stroke.pts[1].x, stroke.pts[1].y);
            ctx.stroke();
        } else if (stroke.type === 'eraser' && stroke.pts.length > 1) {
            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            ctx.strokeStyle = 'rgba(0,0,0,1)';
            ctx.lineWidth = stroke.size * 6;
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(stroke.pts[0].x, stroke.pts[0].y);
            for (let i = 1; i < stroke.pts.length; i++) {
                ctx.lineTo(stroke.pts[i].x, stroke.pts[i].y);
            }
            ctx.stroke();
            ctx.restore();
        }
    });
}

function renderEditorBlocks() {
    const layer = document.getElementById('editorBlockLayer');
    if (!layer) return;
    layer.innerHTML = '';
    customBlocks.forEach((block, i) => {
        const bt = BLOCK_TYPES[block.type] || BLOCK_TYPES.free;
        const el = document.createElement('div');
        el.className = 'paper-block';
        el.dataset.idx = i;
        el.style.left = (block.x || 20) + 'px';
        el.style.top = (block.y || 20 + i * 80) + 'px';
        el.style.width = (block.w || 250) + 'px';
        el.style.height = (block.h || 60) + 'px';
        const isDiv = block.type === 'divider';
        el.innerHTML = `
            <div class="pb-header">
                <span class="pb-icon">${bt.icon}</span>
                <input class="pb-label" value="${(block.customLabel || bt.defaultLabel).replace(/"/g, '&quot;')}" data-idx="${i}" ${isDiv ? 'disabled' : ''}>
                <button class="pb-delete" data-idx="${i}">&times;</button>
            </div>
            ${!isDiv ? `<div class="pb-body">${bt.desc}</div>` : ''}
            <div class="pb-resize"></div>
        `;
        setupBlockDrag(el, block, i);
        setupBlockResize(el, block);
        layer.appendChild(el);
    });
    layer.querySelectorAll('.pb-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            customBlocks.splice(parseInt(btn.dataset.idx), 1);
            renderEditorBlocks();
        });
    });
    layer.querySelectorAll('.pb-label').forEach(inp => {
        inp.addEventListener('input', () => {
            const idx = parseInt(inp.dataset.idx);
            customBlocks[idx].customLabel = inp.value;
        });
        inp.addEventListener('mousedown', (e) => e.stopPropagation());
    });
}

function setupBlockDrag(el, block, idx) {
    const header = el.querySelector('.pb-header');
    let startX, startY, origX, origY;
    function onDown(e) {
        if (e.target.closest('.pb-delete') || e.target.closest('.pb-label')) return;
        if (editorTool !== 'select') return;
        e.preventDefault();
        const t = e.touches ? e.touches[0] : e;
        startX = t.clientX; startY = t.clientY;
        origX = block.x || 20; origY = block.y || 20 + idx * 80;
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onUp);
        el.classList.add('selected');
    }
    function onMove(e) {
        e.preventDefault();
        const t = e.touches ? e.touches[0] : e;
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        block.x = Math.max(0, origX + dx);
        block.y = Math.max(0, origY + dy);
        el.style.left = block.x + 'px';
        el.style.top = block.y + 'px';
    }
    function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onUp);
        el.classList.remove('selected');
    }
    header.addEventListener('mousedown', onDown);
    header.addEventListener('touchstart', onDown, { passive: false });
}

function setupBlockResize(el, block) {
    const handle = el.querySelector('.pb-resize');
    let startX, startY, origW, origH;
    function onDown(e) {
        e.preventDefault(); e.stopPropagation();
        const t = e.touches ? e.touches[0] : e;
        startX = t.clientX; startY = t.clientY;
        origW = block.w || 250; origH = block.h || 60;
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onUp);
    }
    function onMove(e) {
        e.preventDefault();
        const t = e.touches ? e.touches[0] : e;
        block.w = Math.max(80, origW + t.clientX - startX);
        block.h = Math.max(40, origH + t.clientY - startY);
        el.style.width = block.w + 'px';
        el.style.height = block.h + 'px';
    }
    function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onUp);
    }
    handle.addEventListener('mousedown', onDown);
    handle.addEventListener('touchstart', onDown, { passive: false });
}

function setupPaperEditor() {
    const dc = document.getElementById('editorDrawCanvas');
    if (!dc) return;
    const ctx = dc.getContext('2d');
    let drawing = false;
    let currentStroke = null;
    let lineStart = null;
    let snapshot = null;

    function getPos(e) {
        const rect = dc.getBoundingClientRect();
        const sx = dc.width / rect.width;
        const sy = dc.height / rect.height;
        const t = e.touches ? e.touches[0] : e;
        return { x: (t.clientX - rect.left) * sx, y: (t.clientY - rect.top) * sy };
    }

    dc.addEventListener('mousedown', onDown);
    dc.addEventListener('mousemove', onMove);
    dc.addEventListener('mouseup', onUp);
    dc.addEventListener('mouseleave', onUp);
    dc.addEventListener('touchstart', onDown, { passive: false });
    dc.addEventListener('touchmove', onMove, { passive: false });
    dc.addEventListener('touchend', onUp);

    function onDown(e) {
        if (editorTool === 'select') return;
        e.preventDefault();
        const pos = getPos(e);
        const color = document.getElementById('editorDrawColor').value;
        const size = parseFloat(document.getElementById('editorDrawSize').value);
        drawing = true;
        if (editorTool === 'draw') {
            currentStroke = { type: 'free', color, size, pts: [pos] };
            ctx.strokeStyle = color; ctx.lineWidth = size;
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
        } else if (editorTool === 'eraser') {
            currentStroke = { type: 'eraser', color: '', size, pts: [pos] };
            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            ctx.strokeStyle = 'rgba(0,0,0,1)';
            ctx.lineWidth = size * 6;
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
        } else if (editorTool === 'line') {
            lineStart = pos;
            snapshot = ctx.getImageData(0, 0, dc.width, dc.height);
            currentStroke = { type: 'line', color, size, pts: [pos] };
        }
    }

    function onMove(e) {
        if (!drawing) return;
        e.preventDefault();
        const pos = getPos(e);
        if (editorTool === 'draw') {
            const prev = currentStroke.pts[currentStroke.pts.length - 1];
            currentStroke.pts.push(pos);
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(pos.x, pos.y); ctx.stroke();
        } else if (editorTool === 'eraser') {
            const prev = currentStroke.pts[currentStroke.pts.length - 1];
            currentStroke.pts.push(pos);
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(pos.x, pos.y); ctx.stroke();
        } else if (editorTool === 'line' && lineStart) {
            ctx.putImageData(snapshot, 0, 0);
            const color = document.getElementById('editorDrawColor').value;
            const size = parseFloat(document.getElementById('editorDrawSize').value);
            ctx.strokeStyle = color; ctx.lineWidth = size; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(lineStart.x, lineStart.y);
            ctx.lineTo(pos.x, pos.y); ctx.stroke();
        }
    }

    function onUp(e) {
        if (!drawing) return;
        drawing = false;
        if (currentStroke && currentStroke.type === 'eraser') ctx.restore();
        if (editorTool === 'line' && lineStart) {
            const pos = e.changedTouches ? { x: 0, y: 0 } : getPos(e);
            if (e.changedTouches) {
                const rect = dc.getBoundingClientRect();
                const sx = dc.width / rect.width;
                const sy = dc.height / rect.height;
                const t = e.changedTouches[0];
                pos.x = (t.clientX - rect.left) * sx;
                pos.y = (t.clientY - rect.top) * sy;
            }
            currentStroke.pts.push(pos);
        }
        if (currentStroke && currentStroke.pts.length > 0) {
            editorDrawHistory.push(currentStroke);
        }
        currentStroke = null; lineStart = null; snapshot = null;
    }

    // Tool buttons
    const blockLayer = document.getElementById('editorBlockLayer');
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            editorTool = btn.dataset.tool;
            dc.style.cursor = editorTool === 'select' ? 'default' :
                              editorTool === 'eraser' ? 'cell' : 'crosshair';
            // When drawing, blocks shouldn't intercept; when selecting, canvas shouldn't intercept
            if (editorTool === 'select') {
                dc.style.pointerEvents = 'none';
                blockLayer.style.pointerEvents = 'none'; // blocks have pointer-events:all individually
            } else {
                dc.style.pointerEvents = 'auto';
                blockLayer.style.pointerEvents = 'none';
            }
        });
    });
    // Default: select tool, canvas behind blocks
    dc.style.pointerEvents = 'none';

    // Page size
    const pageSizeSelect = document.getElementById('editorPageSize');
    const wInput = document.getElementById('editorW');
    const hInput = document.getElementById('editorH');
    const wxh = document.getElementById('editorWxH');
    if (pageSizeSelect) pageSizeSelect.addEventListener('change', () => {
        const v = pageSizeSelect.value;
        if (v === 'custom') {
            wInput.classList.remove('hidden'); hInput.classList.remove('hidden'); wxh.classList.remove('hidden');
        } else {
            wInput.classList.add('hidden'); hInput.classList.add('hidden'); wxh.classList.add('hidden');
            const s = PAGE_SIZES[v];
            editorPaperW = s.w; editorPaperH = s.h;
            resizeEditorCanvas(); redrawEditorCanvas();
        }
    });
    if (wInput) wInput.addEventListener('change', () => {
        editorPaperW = Math.max(200, Math.min(2000, parseInt(wInput.value) || 816));
        wInput.value = editorPaperW;
        resizeEditorCanvas(); redrawEditorCanvas();
    });
    if (hInput) hInput.addEventListener('change', () => {
        editorPaperH = Math.max(200, Math.min(3000, parseInt(hInput.value) || 1056));
        hInput.value = editorPaperH;
        resizeEditorCanvas(); redrawEditorCanvas();
    });

    // BG image
    document.getElementById('editorBgImage').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            editorBgImageData = ev.target.result;
            redrawEditorCanvas();
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    });
    document.getElementById('editorClearBg').addEventListener('click', () => {
        editorBgImageData = null;
        redrawEditorCanvas();
    });

    // Undo / Clear drawing
    document.getElementById('editorUndo').addEventListener('click', () => {
        editorDrawHistory.pop();
        redrawEditorCanvas();
    });
    document.getElementById('editorClearDraw').addEventListener('click', () => {
        editorDrawHistory = [];
        redrawEditorCanvas();
    });

    // Add blocks
    document.querySelectorAll('.block-add-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.block;
            const bt = BLOCK_TYPES[type] || BLOCK_TYPES.free;
            const yOff = 20 + customBlocks.length * 80;
            customBlocks.push({
                type,
                customLabel: bt.defaultLabel,
                x: 30,
                y: Math.min(yOff, editorPaperH - 80),
                w: type === 'divider' ? editorPaperW - 60 : 300,
                h: type === 'divider' ? 10 : 80
            });
            renderEditorBlocks();
        });
    });

    // Open / Done
    const openBtn = document.getElementById('openEditorBtn');
    if (openBtn) openBtn.addEventListener('click', openEditor);
    document.getElementById('editorDoneBtn').addEventListener('click', closeEditor);

    // Sidebar color/pattern bindings
    const bgInput = document.getElementById('editorBg');
    if (bgInput) bgInput.addEventListener('input', () => { customPaper.bg = bgInput.value; redrawEditorCanvas(); });
    const lineColorInput = document.getElementById('editorLineColor');
    if (lineColorInput) lineColorInput.addEventListener('input', () => { customPaper.lineColor = lineColorInput.value; redrawEditorCanvas(); });
    const inkInput = document.getElementById('editorInk');
    if (inkInput) inkInput.addEventListener('input', () => { customPaper.inkColor = inkInput.value; });
    const labelInput = document.getElementById('editorLabelColor');
    if (labelInput) labelInput.addEventListener('input', () => { customPaper.labelColor = labelInput.value; });
    const patternSelect = document.getElementById('editorPattern');
    if (patternSelect) patternSelect.addEventListener('change', () => { customPaper.pattern = patternSelect.value; redrawEditorCanvas(); });
    const spacingInput = document.getElementById('editorSpacing');
    if (spacingInput) spacingInput.addEventListener('input', () => {
        customPaper.lineSpacing = parseInt(spacingInput.value);
        redrawEditorCanvas();
    });
}

function setupBookmarklet() {
    const code = `(function(){
/* Phase 1: Nuke all copy-protection & highlight overlay systems */
function unlock(doc){
try{
var s=doc.createElement('style');
s.textContent='*{-webkit-user-select:text!important;-moz-user-select:text!important;-ms-user-select:text!important;user-select:text!important;-webkit-touch-callout:default!important}[class*=highlight],[class*=Highlight],[data-highlight-color],[data-highlight],[class*=annotation],[class*=markup],[class*=overlay]:not(video):not(audio):not([class*=content]):not([class*=reader]){pointer-events:none!important;opacity:0!important}';
doc.head.appendChild(s);
doc.querySelectorAll('[data-highlight-color],[class*=highlight-],[class*=annotation]').forEach(function(el){el.style.pointerEvents='none';el.style.opacity='0'});
doc.querySelectorAll('*').forEach(function(el){
el.style.userSelect='';el.style.webkitUserSelect='';
el.oncopy=null;el.oncut=null;el.onpaste=null;el.oncontextmenu=null;el.onselectstart=null;el.ondragstart=null;el.onmousedown=null;
el.removeAttribute('oncopy');el.removeAttribute('oncut');el.removeAttribute('onpaste');el.removeAttribute('oncontextmenu');el.removeAttribute('onselectstart');el.removeAttribute('ondragstart');el.removeAttribute('unselectable');
});
['copy','cut','selectstart','contextmenu','mousedown','mouseup','keydown','keyup','beforecopy'].forEach(function(evt){
doc.addEventListener(evt,function(e){e.stopPropagation()},true);
});
}catch(e){}
}
unlock(document);
/* Phase 2: Handle cross-origin iframes — open them in new tabs */
var crossFrames=[];
document.querySelectorAll('iframe').forEach(function(f){
try{unlock(f.contentDocument)}catch(e){
if(f.src&&f.src.startsWith('http'))crossFrames.push(f.src);
}
});
/* Phase 3: Check for existing selection first */
var sel=window.getSelection();
if(sel&&sel.toString().trim().length>30){
var txt=sel.toString().trim();
var w=txt.split(/\\s+/).length;
navigator.clipboard.writeText(txt).then(function(){
alert('Copied '+w+' words!');
}).catch(function(){prompt('Copy this:',txt)});
return;
}
/* Phase 4: Auto-find best content block */
var txt='';
var best='';
document.querySelectorAll('.ep-read,.content.ep-read,[class*=read],[class*=chapter],[class*=lesson],[class*=textbook],[class*=page-content],[class*=book-content],[class*=viewer],[class*=reader],article,main,[role=main],[role=document]').forEach(function(el){
var t=(el.innerText||'').trim();
if(t.length>best.length)best=t;
});
if(best.length<200){
best=(document.body.innerText||'').trim();
}
document.querySelectorAll('iframe').forEach(function(f){
try{
var t=(f.contentDocument.body.innerText||'').trim();
if(t.length>best.length)best=t;
}catch(e){}
});
txt=best.replace(/\\n{3,}/g,'\\n\\n').trim();
if(!txt||txt.length<50){
if(crossFrames.length>0){
var msg='The reading content is inside a protected frame that this page cannot access.\\n\\n';
msg+='Opening the frame in a new tab — run this bookmarklet again there!\\n\\n';
msg+='URL: '+crossFrames[0].substring(0,80)+'...';
window.open(crossFrames[0],'_blank');
alert(msg);
}else{
alert('Protection removed! You can now select and copy text.\\nSelect what you want, then click this bookmarklet again.');
}
return;
}
var w=txt.split(/\\s+/).length;
navigator.clipboard.writeText(txt).then(function(){
alert('Copied '+w+' words! Paste in Cornell Notes.');
}).catch(function(){
var ta=document.createElement('textarea');
ta.value=txt;ta.style.cssText='position:fixed;top:0;left:0;width:100%;height:40%;z-index:999999;font:14px system-ui;padding:12px;background:#fff;border:3px solid #2563eb;';
document.body.appendChild(ta);ta.focus();ta.select();
alert('Text is in the box. Ctrl+A then Ctrl+C.');
});
})()`;
    const el = document.getElementById('bookmarkletLink');
    if (el) {
        el.href = 'javascript:' + encodeURIComponent(code);
        el.addEventListener('click', function(e) {
            e.preventDefault();
            alert("Don't click \u2014 drag this button to your bookmarks bar! Then click it on any page to grab all the text.");
        });
    }
}

const GARBAGE_PATTERNS = [
    /javascript is disabled/i,
    /enable javascript/i,
    /please enable cookies/i,
    /access denied/i,
    /403 forbidden/i,
    /log\s*in to continue/i,
    /sign\s*in to/i,
    /signing in/i,
    /captcha/i,
    /checking your browser/i,
    /just a moment/i,
    /cloudflare/i,
    /attention required/i,
    /one more step/i,
    /robot/i,
    /verify you are human/i,
    /DDoS protection/i,
    /browser check/i,
    /404 not found/i,
    /page not found/i,
    /unauthorized/i,
    /session expired/i,
    /refresh this page/i,
    /okta/i,
    /sso/i,
    /single sign.on/i,
    /authentication required/i,
    /loading\.{3}/i,
    /please wait/i,
    /redirecting/i,
    /incapsula/i,
    /sucuri/i,
    /blocked/i,
    /try again later/i,
    /too many requests/i,
    /rate limit/i
];

function isGarbageScrape(text) {
    if (!text || text.length < 150) return true;
    const words = text.split(/\s+/).filter(w => w.length > 2);
    if (words.length < 20) return true;
    const hits = GARBAGE_PATTERNS.filter(p => p.test(text));
    if (hits.length >= 1) return true;
    const unique = new Set(words.map(w => w.toLowerCase()));
    if (unique.size < 15) return true;
    const ratio = unique.size / words.length;
    if (ratio < 0.1 && words.length > 50) return true;
    return false;
}

function showUploadStatus(msg, isError) {
    const el = document.getElementById('uploadStatus');
    el.textContent = msg;
    el.classList.remove('hidden', 'error');
    if (isError) el.classList.add('error');
}

function hideUploadStatus() {
    document.getElementById('uploadStatus').classList.add('hidden');
}

async function fetchUrl() {
    const urlInput = document.getElementById('urlInput');
    const btn = document.getElementById('fetchUrlBtn');
    const url = urlInput.value.trim();
    if (!url) return;
    try { new URL(url); } catch {
        showUploadStatus('Please enter a valid URL (e.g. https://example.com/article)', true);
        return;
    }
    btn.disabled = true;
    btn.textContent = 'Fetching...';
    hideUploadStatus();
    try {
        const res = await fetch(WORKER_URL + '/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        if (!res.ok) {
            console.log('Scrape failed with status', res.status);
            showUploadStatus(
                'Could not grab text from that site. Try the bookmarklet, upload a file, or paste text directly.',
                true
            );
            btn.disabled = false;
            btn.textContent = 'Fetch';
            return;
        }
        const data = await res.json();
        if (data.text && !isGarbageScrape(data.text)) {
            document.getElementById('contentInput').value = data.text.slice(0, 15000);
            showUploadStatus('Scraped ' + data.text.split(/\s+/).length + ' words from URL', false);
        } else {
            console.log('First scrape was garbage, got:', (data.text || '').slice(0, 200));
            showUploadStatus(
                'That site needs JavaScript or login to load. Use the bookmarklet, upload a file, or paste text.',
                true
            );
        }
    } catch (err) {
        console.log('Scrape error:', err.message);
        showUploadStatus(
            'Could not reach that URL. Try the bookmarklet, upload a file, or paste text directly.',
            true
        );
    }
    btn.disabled = false;
    btn.textContent = 'Fetch';
}

async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const label = document.getElementById('uploadLabel');
    label.classList.add('active');
    hideUploadStatus();
    
    const name = file.name.toLowerCase();
    let text = '';
    
    try {
        if (name.endsWith('.txt') || name.endsWith('.rtf')) {
            text = await file.text();
            if (name.endsWith('.rtf')) {
                text = text.replace(/\{\\[^{}]*\}/g, '').replace(/\\[a-z]+\d*\s?/g, '').replace(/[{}]/g, '');
            }
        } else if (name.endsWith('.pdf')) {
            text = await extractPdfText(file);
        } else if (name.endsWith('.docx') || name.endsWith('.doc')) {
            text = await extractDocxText(file);
        } else {
            showUploadStatus('Unsupported file type. Use PDF, TXT, or DOCX.', true);
            label.classList.remove('active');
            return;
        }
        
        text = text.replace(/\s+/g, ' ').trim();
        if (text.length < 50) {
            showUploadStatus('Could not extract enough text from that file. Try a different format or copy-paste.', true);
            label.classList.remove('active');
            return;
        }
        
        document.getElementById('contentInput').value = text.slice(0, 15000);
        showUploadStatus('Loaded ' + text.split(/\s+/).length + ' words from ' + file.name, false);
    } catch (err) {
        showUploadStatus('Error reading file: ' + err.message, true);
        label.classList.remove('active');
    }
    e.target.value = '';
}

async function extractPdfText(file) {
    const arrayBuffer = await file.arrayBuffer();
    pdfjsLib.GlobalWorkerOptions.workerSrc = 
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map(item => item.str).join(' ');
        pages.push(pageText);
    }
    return pages.join('\n');
}

async function extractDocxText(file) {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await loadZip(arrayBuffer);
    const docXml = zip['word/document.xml'];
    if (!docXml) throw new Error('Not a valid DOCX file');
    const text = new TextDecoder().decode(docXml);
    return text
        .replace(/<w:p[^>]*>/g, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

async function loadZip(buffer) {
    const view = new DataView(buffer);
    const files = {};
    let offset = 0;
    while (offset < view.byteLength - 4) {
        const sig = view.getUint32(offset, true);
        if (sig !== 0x04034b50) break;
        const compressed = view.getUint16(offset + 8, true);
        const compSize = view.getUint32(offset + 18, true);
        const uncompSize = view.getUint32(offset + 22, true);
        const nameLen = view.getUint16(offset + 26, true);
        const extraLen = view.getUint16(offset + 28, true);
        const name = new TextDecoder().decode(
            new Uint8Array(buffer, offset + 30, nameLen)
        );
        const dataStart = offset + 30 + nameLen + extraLen;
        const raw = new Uint8Array(buffer, dataStart, compSize);
        if (compressed === 0) {
            files[name] = raw;
        } else if (compressed === 8) {
            const ds = new DecompressionStream('deflate-raw');
            const writer = ds.writable.getWriter();
            writer.write(raw);
            writer.close();
            const reader = ds.readable.getReader();
            const chunks = [];
            let done = false;
            while (!done) {
                const r = await reader.read();
                if (r.value) chunks.push(r.value);
                done = r.done;
            }
            const total = chunks.reduce((s, c) => s + c.length, 0);
            const result = new Uint8Array(total);
            let pos = 0;
            for (const c of chunks) { result.set(c, pos); pos += c.length; }
            files[name] = result;
        }
        offset = dataStart + compSize;
    }
    return files;
}

function generateFallback(content) {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const topic = content.split('\n')[0].slice(0, 60).trim() || 'Notes';
    const ideas = [];
    const notes = [];
    const mainIdeaStatements = [];
    const miMatch = content.match(/main\s*idea[:\s]+([^\n.]+)/i);
    const mainIdeaText = miMatch ? miMatch[1].trim() : '';
    for (let i = 0; i < Math.min(5, Math.max(3, sentences.length)); i++) {
        const s = sentences[i] ? sentences[i].trim() : '';
        if (s) {
            ideas.push(s.split(' ').slice(0, 5).join(' '));
            notes.push(s);
            mainIdeaStatements.push(i === 0 ? (mainIdeaText || topic) : '');
        }
    }
    if (ideas.length === 0) {
        ideas.push('Key concept');
        notes.push(content.slice(0, 200));
        mainIdeaStatements.push(mainIdeaText || topic);
    }
    return {
        topic: topic,
        mainIdeas: ideas,
        notes: notes,
        mainIdeaStatements: mainIdeaStatements,
        summary: sentences.slice(0, 2).join('. ').slice(0, 200) || content.slice(0, 200)
    };
}

function displayNotes(notes) {
    inputSection.classList.remove('active');
    notesSection.classList.add('active');
    showStepIndicators();
    updateStepIndicators(3);
    
    const overlay = document.getElementById('notesOverlay');
    const isDarkPaper = selectedPaper === 'dark' || 
                        (selectedPaper === 'custom' && isColorDark(customPaper.bg));
    if (overlay) {
        overlay.classList.toggle('dark-paper', isDarkPaper);
        if (selectedPaper === 'custom') {
            overlay.style.setProperty('--custom-label-color', customPaper.labelColor);
        }
    }
    
    const preset = HANDWRITING_PRESETS[selectedStyle] || HANDWRITING_PRESETS.neat;
    document.querySelectorAll('.col-label').forEach(l => {
        l.style.fontFamily = preset.font;
        l.style.fontSize = '14px';
        l.style.textTransform = 'none';
        l.style.letterSpacing = 'normal';
    });
    
    document.getElementById('leftColLabel').textContent = 'Main Ideas';
    document.getElementById('rightColLabel').textContent = 'Notes';
    document.getElementById('summaryLabel').textContent = 'Summary';
    
    const mainIdeasDiv = document.getElementById('mainIdeasContent');
    const notesDiv = document.getElementById('notesContent');
    mainIdeasDiv.innerHTML = '';
    notesDiv.innerHTML = '';

    requestAnimationFrame(() => {
        writeText('topicArea', notes.topic || 'Notes');
        writeText('nameArea', '');
        writeText('dateArea', new Date().toLocaleDateString());

        const ideas = Array.isArray(notes.mainIdeas) ? notes.mainIdeas : [];
        const noteTexts = Array.isArray(notes.notes) ? notes.notes : [];
        const mainIdeaStatements = Array.isArray(notes.mainIdeaStatements) ? notes.mainIdeaStatements : [];

        const cornellLayout = document.querySelector('.cornell-layout');
        const summarySection = document.querySelector('.summary-section');
        let blockContainer = document.getElementById('customBlockContent');

        if (selectedPaper === 'custom' && customBlocks.length > 0) {
            // Custom block layout: stacked sections
            cornellLayout.style.display = 'none';
            summarySection.style.display = 'none';
            if (!blockContainer) {
                blockContainer = document.createElement('div');
                blockContainer.id = 'customBlockContent';
                cornellLayout.parentElement.insertBefore(blockContainer, cornellLayout);
            }
            blockContainer.innerHTML = '';
            blockContainer.style.display = 'block';

            customBlocks.forEach(block => {
                const bt = BLOCK_TYPES[block.type] || BLOCK_TYPES.free;
                if (block.type === 'divider') {
                    const hr = document.createElement('hr');
                    hr.style.cssText = 'border:none;border-top:1px solid #ccc;margin:18px 0';
                    blockContainer.appendChild(hr);
                    return;
                }
                const section = document.createElement('div');
                section.style.marginBottom = '24px';
                const label = document.createElement('div');
                label.className = 'col-label';
                label.style.fontFamily = preset.font;
                label.textContent = block.customLabel || bt.defaultLabel;
                section.appendChild(label);
                const content = document.createElement('div');
                section.appendChild(content);
                blockContainer.appendChild(section);

                if (block.type === 'main-ideas') {
                    mainIdeaStatements.forEach(mi => {
                        if (mi) {
                            const d = document.createElement('div');
                            d.className = 'main-idea-item';
                            content.appendChild(d);
                            writeTextToElement(d, mi);
                        }
                    });
                } else if (block.type === 'questions') {
                    ideas.forEach(idea => {
                        const d = document.createElement('div');
                        d.className = 'main-idea-item';
                        content.appendChild(d);
                        writeTextToElement(d, idea);
                    });
                } else if (block.type === 'notes') {
                    noteTexts.forEach(note => {
                        const d = document.createElement('div');
                        d.className = 'note-item';
                        content.appendChild(d);
                        writeTextToElement(d, note);
                    });
                } else if (block.type === 'summary') {
                    writeTextToElement(content, notes.summary || '');
                } else if (block.type === 'vocab' || block.type === 'timeline') {
                    const sep = block.type === 'timeline' ? ' \u2014 ' : ': ';
                    ideas.forEach((term, i) => {
                        const d = document.createElement('div');
                        d.className = 'note-item';
                        content.appendChild(d);
                        writeTextToElement(d, term + sep + (noteTexts[i] || ''));
                    });
                } else if (block.type === 'free') {
                    if (block.customLabel) {
                        writeTextToElement(content, block.customLabel);
                    }
                }
            });
        } else {
            // Default cornell 2-column layout
            cornellLayout.style.display = '';
            summarySection.style.display = '';
            if (blockContainer) blockContainer.style.display = 'none';

            let currentMainIdea = '';
            ideas.forEach((idea, i) => {
                const mi = mainIdeaStatements[i] || '';
                if (mi && mi !== currentMainIdea) {
                    currentMainIdea = mi;
                    const labelDiv = document.createElement('div');
                    labelDiv.className = 'main-idea-label';
                    mainIdeasDiv.appendChild(labelDiv);
                    writeTextToElement(labelDiv, 'Main Idea: ' + mi);
                    const spacerDiv = document.createElement('div');
                    spacerDiv.className = 'main-idea-label';
                    notesDiv.appendChild(spacerDiv);
                    writeTextToElement(spacerDiv, '');
                }
                const ideaDiv = document.createElement('div');
                ideaDiv.className = 'main-idea-item';
                mainIdeasDiv.appendChild(ideaDiv);
                writeTextToElement(ideaDiv, idea || '');
                const noteDiv = document.createElement('div');
                noteDiv.className = 'note-item';
                notesDiv.appendChild(noteDiv);
                writeTextToElement(noteDiv, noteTexts[i] || '');
            });
            const summaryDiv = document.getElementById('summaryContent');
            summaryDiv.innerHTML = '';
            writeTextToElement(summaryDiv, notes.summary);
        }
        requestAnimationFrame(() => drawPaper());
    });
}

function isColorDark(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

function drawPaper() {
    const canvas = paperCanvas;
    const paperEl = canvas.parentElement;
    const rect = paperEl.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = Math.max(1300, paperEl.scrollHeight || rect.height);
    const ctx = canvas.getContext('2d');
    
    const cornellLayout = document.querySelector('.cornell-layout');
    const summarySection = document.querySelector('.summary-section');
    const colMainIdeas = document.querySelector('.col-main-ideas');
    const headerTopic = document.querySelector('.header-topic');
    const paperRect = paperEl.getBoundingClientRect();
    const headerLineY = headerTopic ? 
        headerTopic.getBoundingClientRect().bottom - paperRect.top + 8 : 110;
    const dividerXPos = colMainIdeas ? 
        colMainIdeas.getBoundingClientRect().right - paperRect.left : canvas.width * 0.3;
    const layoutTop = cornellLayout ? 
        cornellLayout.getBoundingClientRect().top - paperRect.top : 120;
    const summaryY = summarySection ? 
        summarySection.getBoundingClientRect().top - paperRect.top : canvas.height - 180;
    
    const tintColors = {
        white: '#fefefe',
        cream: '#fffef5',
        blue: '#f0f5ff',
        green: '#f0fff5',
        pink: '#fff5f5',
        lavender: '#f5f0ff',
        peach: '#fff5eb',
        mint: '#edfff8',
        sky: '#e8f4fd',
        lemon: '#fffde6',
        rose: '#fce4ec',
        gray: '#f0f0f0',
        custom: paperTint === 'custom' ? customTintColor : '#fefefe'
    };
    let bgColor = selectedPaper === 'yellow' ? '#ffffc8' : 
                  selectedPaper === 'kraft' ? '#d4a574' : 
                  selectedPaper === 'dark' ? '#2a2a3e' :
                  selectedPaper === 'aged' ? '#f4e4c1' :
                  selectedPaper === 'engineering' ? '#f5f8d0' :
                  selectedPaper === 'custom' ? customPaper.bg :
                  tintColors[paperTint] || '#fefefe';
    
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const texture = selectedPaper === 'custom' ? customPaper.texture : 
                    selectedPaper === 'aged' ? 'aged' : 'none';
    if (texture === 'aged') {
        ctx.fillStyle = 'rgba(180, 150, 100, 0.05)';
        for (let i = 0; i < 200; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const r = Math.random() * 30 + 5;
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
    } else if (texture === 'grain') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.015)';
        for (let i = 0; i < 800; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            ctx.fillRect(x, y, Math.random() * 2 + 1, Math.random() * 2 + 1);
        }
    } else if (texture === 'canvas') {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.03)';
        ctx.lineWidth = 0.5;
        for (let y = 0; y < canvas.height; y += 4) {
            ctx.beginPath(); ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y + (Math.random() - 0.5) * 2);
            ctx.stroke();
        }
        for (let x = 0; x < canvas.width; x += 4) {
            ctx.beginPath(); ctx.moveTo(x, 0);
            ctx.lineTo(x + (Math.random() - 0.5) * 2, canvas.height);
            ctx.stroke();
        }
    }
    
    const lineSpacing = selectedPaper === 'custom' ? customPaper.lineSpacing : paperLineSpacing;
    const isDark = selectedPaper === 'dark' || 
                   (selectedPaper === 'custom' && isColorDark(customPaper.bg));
    const lineColor = selectedPaper === 'yellow' ? '#c9c98a' : 
                      selectedPaper === 'kraft' ? '#b8916a' : 
                      selectedPaper === 'dark' ? 'rgba(255,255,255,0.12)' :
                      selectedPaper === 'aged' ? '#d4c49a' :
                      selectedPaper === 'engineering' ? '#c8d48a' :
                      selectedPaper === 'custom' ? customPaper.lineColor :
                      '#a8d4ff';
    
    if (selectedPaper === 'custom') {
        const cp = customPaper;
        if (cp.pattern === 'graph') {
            ctx.strokeStyle = cp.lineColor;
            ctx.lineWidth = cp.lineWidth;
            for (let x = 40; x < canvas.width - 30; x += cp.gridSize) {
                ctx.beginPath(); ctx.moveTo(x, 80); ctx.lineTo(x, canvas.height - 50); ctx.stroke();
            }
            for (let y = 80; y < canvas.height - 50; y += cp.gridSize) {
                ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(canvas.width - 30, y); ctx.stroke();
            }
        } else if (cp.pattern === 'dotted') {
            ctx.fillStyle = cp.lineColor;
            for (let x = 50; x < canvas.width - 30; x += cp.gridSize) {
                for (let y = 90; y < canvas.height - 50; y += cp.gridSize) {
                    ctx.beginPath();
                    ctx.arc(x + (Math.random() - 0.5), y + (Math.random() - 0.5), cp.dotSize, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        } else if (cp.pattern === 'lined') {
            ctx.strokeStyle = cp.lineColor;
            ctx.lineWidth = cp.lineWidth;
            for (let y = 80; y < canvas.height - 50; y += cp.lineSpacing) {
                ctx.beginPath(); ctx.moveTo(40, y);
                for (let x = 40; x < canvas.width - 30; x += 20) {
                    ctx.lineTo(x, y + (Math.random() - 0.5) * 1.5);
                }
                ctx.stroke();
            }
        }
        if (cp.margin) {
            ctx.strokeStyle = cp.marginColor;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            const marginX = paperMarginWidth;
            ctx.moveTo(marginX, 30);
            for (let y = 30; y < canvas.height - 30; y += 30) {
                ctx.lineTo(marginX + (Math.random() - 0.5) * 1.5, y);
            }
            ctx.stroke();
        }
    } else if (selectedPaper === 'graph' || selectedPaper === 'engineering') {
        ctx.strokeStyle = selectedPaper === 'engineering' ? '#c8d48a' : '#ddd';
        ctx.lineWidth = 0.5;
        const gridSize = 20;
        for (let x = 40; x < canvas.width - 30; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 80);
            ctx.lineTo(x, canvas.height - 50);
            ctx.stroke();
        }
        for (let y = 80; y < canvas.height - 50; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(40, y);
            ctx.lineTo(canvas.width - 30, y);
            ctx.stroke();
        }
    } else if (selectedPaper === 'dotted') {
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.2)' : '#bbb';
        const dotSpacing = 20;
        for (let x = 50; x < canvas.width - 30; x += dotSpacing) {
            for (let y = 90; y < canvas.height - 50; y += dotSpacing) {
                ctx.beginPath();
                ctx.arc(x + (Math.random() - 0.5) * 1, y + (Math.random() - 0.5) * 1, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    } else if (selectedPaper === 'dark') {
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        for (let y = 80; y < canvas.height - 50; y += lineSpacing) {
            ctx.beginPath();
            ctx.moveTo(40, y);
            ctx.lineTo(canvas.width - 30, y);
            ctx.stroke();
        }
    } else if (selectedPaper !== 'plain' && selectedPaper !== 'kraft') {
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1;
        for (let y = 80; y < canvas.height - 50; y += lineSpacing) {
            ctx.beginPath();
            ctx.moveTo(40, y);
            for (let x = 40; x < canvas.width - 30; x += 20) {
                const wobble = (Math.random() - 0.5) * 1.5;
                ctx.lineTo(x, y + wobble);
            }
            ctx.stroke();
        }
        
        if (selectedPaper === 'lined' && paperMarginWidth > 0) {
            ctx.strokeStyle = '#ffb8b8';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            const marginX = paperMarginWidth;
            ctx.moveTo(marginX, 30);
            for (let y = 30; y < canvas.height - 30; y += 30) {
                const wobble = (Math.random() - 0.5) * 1.5;
                ctx.lineTo(marginX + wobble, y);
            }
            ctx.stroke();
        }
        
        if (selectedPaper === 'steno') {
            ctx.strokeStyle = '#8bc48b';
            ctx.lineWidth = 1.5;
            const centerX = canvas.width / 2;
            ctx.beginPath();
            ctx.moveTo(centerX, 80);
            for (let y = 80; y < canvas.height - 50; y += 25) {
                ctx.lineTo(centerX + (Math.random() - 0.5) * 1.5, y);
            }
            ctx.stroke();
        }
    }
    
    const usingBlockLayout = selectedPaper === 'custom' && customBlocks.length > 0;

    const dividerColor = selectedPaper === 'custom' ? customPaper.dividerColor :
                         isDark ? 'rgba(255,255,255,0.3)' :
                         selectedPaper === 'kraft' ? '#8b6914' : '#333';
    ctx.strokeStyle = dividerColor;
    ctx.lineWidth = 1.5;

    // Vertical divider between main ideas and notes columns (skip in block layout)
    if (!usingBlockLayout) {
        ctx.beginPath();
        ctx.moveTo(dividerXPos, layoutTop);
        for (let y = layoutTop; y < summaryY; y += 25) {
            ctx.lineTo(dividerXPos + (Math.random() - 0.5) * 2, y);
        }
        ctx.stroke();

        // Horizontal summary divider
        ctx.beginPath();
        ctx.moveTo(40, summaryY);
        for (let x = 40; x < canvas.width - 30; x += 25) {
            ctx.lineTo(x, summaryY + (Math.random() - 0.5) * 2);
        }
        ctx.stroke();
    }
    
    // Header line
    ctx.beginPath();
    ctx.moveTo(40, headerLineY);
    for (let x = 40; x < canvas.width - 30; x += 25) {
        ctx.lineTo(x, headerLineY + (Math.random() - 0.5) * 1.5);
    }
    ctx.stroke();
}

function writeText(elementId, text) {
    const element = document.getElementById(elementId);
    writeTextToElement(element, text);
}

function writeTextToElement(element, text) {
    element.innerHTML = '';
    if (!text) return;
    // Walk up DOM to find a parent with a real width
    let maxWidth = 0;
    let node = element;
    while (node && node !== document.body) {
        const w = node.getBoundingClientRect().width;
        if (w > 50) { maxWidth = Math.floor(w); break; }
        node = node.parentElement;
    }
    if (!maxWidth || maxWidth < 50) maxWidth = 300;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const preset = HANDWRITING_PRESETS[selectedStyle] || HANDWRITING_PRESETS.neat;
    const lsRaw = selectedPaper === 'custom' ? customPaper.lineSpacing : paperLineSpacing;
    const lineHeight = Math.max(28, lsRaw);
    const fontSize = Math.max(16, Math.round(lineHeight * 0.7));
    ctx.font = `${fontSize}px ${preset.font}`;
    
    // Measure line width the same way we render: per-char width + 2px spacing
    function renderedWidth(str) {
        let w = 0;
        for (const ch of str) {
            if (ch === ' ') { w += fontSize * 0.5; }
            else { w += ctx.measureText(ch).width + 2; }
        }
        return w;
    }
    
    const words = text.split(' ');
    const lines = [];
    let line = '';
    const padLeft = 8;
    const padRight = 12;
    const wrapWidth = maxWidth - padLeft - padRight;
    
    words.forEach(word => {
        const testLine = line + (line ? ' ' : '') + word;
        if (renderedWidth(testLine) > wrapWidth && line) {
            lines.push(line);
            line = word;
        } else {
            line = testLine;
        }
    });
    if (line) lines.push(line);
    
    canvas.width = maxWidth;
    canvas.height = lines.length * lineHeight + 24;
    
    let y = lineHeight;
    lines.forEach(lineText => {
        let x = padLeft;
        for (const char of lineText) {
            if (char === ' ') {
                x += fontSize * 0.5;
                continue;
            }
            
            ctx.font = `${fontSize}px ${preset.font}`;
            const charWidth = ctx.measureText(char).width;
            
            ctx.save();
            const rotation = (Math.random() - 0.5) * preset.rotation + preset.slant;
            const offsetY = (Math.random() - 0.5) * preset.baselineVar;
            
            ctx.translate(x, y + offsetY);
            ctx.rotate(rotation);
            ctx.font = `${fontSize}px ${preset.font}`;
            const inkColor = selectedPaper === 'custom' ? customPaper.inkColor :
                             selectedPaper === 'dark' ? '#e8e8f0' : '#1a1a2e';
            ctx.fillStyle = inkColor;
            ctx.fillText(char, 0, 0);
            ctx.restore();
            
            x += charWidth + 2;
        }
        y += lineHeight;
    });
    
    const img = document.createElement('img');
    img.src = canvas.toDataURL();
    element.appendChild(img);
}

function restart() {
    notesSection.classList.remove('active');
    heroSection.classList.add('active');
    hideStepIndicators();
    document.getElementById('contentInput').value = '';
    updateStepIndicators(1);
    Object.keys(trainedLetters).forEach(k => delete trainedLetters[k]);
}
