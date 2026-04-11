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
        });
    });

    const cpFields = {
        cpBg: 'bg', cpLineColor: 'lineColor', cpMarginColor: 'marginColor',
        cpDivider: 'dividerColor', cpInk: 'inkColor', cpLabel: 'labelColor'
    };
    Object.entries(cpFields).forEach(([id, key]) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => { customPaper[key] = el.value; });
    });
    const cpPattern = document.getElementById('cpPattern');
    if (cpPattern) cpPattern.addEventListener('change', () => { customPaper.pattern = cpPattern.value; });
    const cpTexture = document.getElementById('cpTexture');
    if (cpTexture) cpTexture.addEventListener('change', () => { customPaper.texture = cpTexture.value; });
    const cpLineSpacing = document.getElementById('cpLineSpacing');
    if (cpLineSpacing) cpLineSpacing.addEventListener('input', () => { customPaper.lineSpacing = parseInt(cpLineSpacing.value); });
    const cpGridSize = document.getElementById('cpGridSize');
    if (cpGridSize) cpGridSize.addEventListener('input', () => { customPaper.gridSize = parseInt(cpGridSize.value); });
    const cpDotSize = document.getElementById('cpDotSize');
    if (cpDotSize) cpDotSize.addEventListener('input', () => { customPaper.dotSize = parseFloat(cpDotSize.value); });
    const cpLineWidth = document.getElementById('cpLineWidth');
    if (cpLineWidth) cpLineWidth.addEventListener('input', () => { customPaper.lineWidth = parseFloat(cpLineWidth.value); });
    const cpMargin = document.getElementById('cpMargin');
    if (cpMargin) cpMargin.addEventListener('change', () => { customPaper.margin = cpMargin.checked; });

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

function goToTraining() {
    heroSection.classList.remove('active');
    inputSection.classList.remove('active');
    trainingSection.classList.add('active');
    updateStepIndicators(1);
}

function goToInput() {
    trainingSection.classList.remove('active');
    heroSection.classList.remove('active');
    inputSection.classList.add('active');
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

function setupBookmarklet() {
    const code = `(function(){
var S=[];
var seen=new Set();
function add(t){t=t.trim();if(t&&t.length>1&&!seen.has(t)){seen.add(t);S.push(t)}}
function walk(n){
if(!n)return;
if(n.nodeType===3){add(n.textContent);return}
if(n.nodeType!==1)return;
var tag=n.tagName;
if(/^(SCRIPT|STYLE|NOSCRIPT|SVG|LINK|META|HEAD|IFRAME)$/.test(tag))return;
var def=n.getAttribute('data-definition');if(def)add('('+def+')');
if(tag==='INPUT'&&n.type!=='hidden'){var v=n.value.trim();if(v.length>3)add(v)}
if(tag==='TEXTAREA'){var v2=n.value.trim();if(v2)add(v2)}
if(n.shadowRoot)walk(n.shadowRoot);
var ch=n.childNodes;
for(var i=0;i<ch.length;i++)walk(ch[i]);
}
walk(document.body);
try{document.querySelectorAll('iframe').forEach(function(f){
try{walk(f.contentDocument.body)}catch(e){}});}catch(e){}
var txt=S.join(' ');
txt=txt.replace(/<[^>]+>/g,' ');
txt=txt.replace(/\\b(xmlns|class|data-\\w+|id|style)\\s*=\\s*"[^"]*"/g,' ');
txt=txt.replace(/\\{[^}]{0,500}\\}/g,' ');
txt=txt.replace(/[<>]/g,' ');
txt=txt.replace(/\\s+/g,' ').trim();
if(!txt||txt.length<20){alert('No usable text found on this page.');return}
var w=txt.split(/\\s+/).length;
navigator.clipboard.writeText(txt).then(function(){
alert('Copied '+w+' words! Paste in Cornell Notes.');
}).catch(function(){
var ta=document.createElement('textarea');
ta.value=txt;ta.style.cssText='position:fixed;top:0;left:0;width:100%;height:40%;z-index:999999;font:14px system-ui;padding:12px;background:#fff;border:3px solid #2563eb;';
document.body.appendChild(ta);ta.focus();ta.select();
alert('Text is in the box at top. Ctrl+A then Ctrl+C to copy.');
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
    for (let i = 0; i < Math.min(5, Math.max(3, sentences.length)); i++) {
        const s = sentences[i] ? sentences[i].trim() : '';
        if (s) {
            ideas.push(s.split(' ').slice(0, 5).join(' '));
            notes.push(s);
        }
    }
    if (ideas.length === 0) {
        ideas.push('Key concept');
        notes.push(content.slice(0, 200));
    }
    return {
        topic: topic,
        mainIdeas: ideas,
        notes: notes,
        summary: sentences.slice(0, 2).join('. ').slice(0, 200) || content.slice(0, 200)
    };
}

function displayNotes(notes) {
    inputSection.classList.remove('active');
    notesSection.classList.add('active');
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
    
    writeText('topicArea', notes.topic || 'Notes');
    writeText('nameArea', '');
    writeText('dateArea', new Date().toLocaleDateString());
    const mainIdeasDiv = document.getElementById('mainIdeasContent');
    const notesDiv = document.getElementById('notesContent');
    mainIdeasDiv.innerHTML = '';
    notesDiv.innerHTML = '';
    const ideas = Array.isArray(notes.mainIdeas) ? notes.mainIdeas : [];
    const noteTexts = Array.isArray(notes.notes) ? notes.notes : [];
    ideas.forEach((idea, i) => {
        const ideaDiv = document.createElement('div');
        ideaDiv.className = 'main-idea-item';
        mainIdeasDiv.appendChild(ideaDiv);
        writeTextToElement(ideaDiv, idea || '', 280);
        const noteDiv = document.createElement('div');
        noteDiv.className = 'note-item';
        notesDiv.appendChild(noteDiv);
        writeTextToElement(noteDiv, noteTexts[i] || '', 750);
    });
    const summaryDiv = document.getElementById('summaryContent');
    summaryDiv.innerHTML = '';
    writeTextToElement(summaryDiv, notes.summary, 1050);
    requestAnimationFrame(() => drawPaper());
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
    
    const dividerColor = selectedPaper === 'custom' ? customPaper.dividerColor :
                         isDark ? 'rgba(255,255,255,0.3)' :
                         selectedPaper === 'kraft' ? '#8b6914' : '#333';
    ctx.strokeStyle = dividerColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(dividerXPos, layoutTop);
    for (let y = layoutTop; y < summaryY; y += 25) {
        ctx.lineTo(dividerXPos + (Math.random() - 0.5) * 2, y);
    }
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(40, summaryY);
    for (let x = 40; x < canvas.width - 30; x += 25) {
        ctx.lineTo(x, summaryY + (Math.random() - 0.5) * 2);
    }
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(40, headerLineY);
    for (let x = 40; x < canvas.width - 30; x += 25) {
        ctx.lineTo(x, headerLineY + (Math.random() - 0.5) * 1.5);
    }
    ctx.stroke();
}

function writeText(elementId, text) {
    const element = document.getElementById(elementId);
    writeTextToElement(element, text, element.offsetWidth || 400);
}

function writeTextToElement(element, text, maxWidth) {
    element.innerHTML = '';
    if (!text) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const preset = HANDWRITING_PRESETS[selectedStyle] || HANDWRITING_PRESETS.neat;
    const lsRaw = selectedPaper === 'custom' ? customPaper.lineSpacing : paperLineSpacing;
    const lineHeight = Math.max(28, lsRaw);
    const fontSize = Math.max(16, Math.round(lineHeight * 0.7));
    ctx.font = `${fontSize}px ${preset.font}`;
    
    const words = text.split(' ');
    const lines = [];
    let line = '';
    
    words.forEach(word => {
        const testLine = line + (line ? ' ' : '') + word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth - 20 && line) {
            lines.push(line);
            line = word;
        } else {
            line = testLine;
        }
    });
    if (line) lines.push(line);
    
    canvas.width = maxWidth;
    canvas.height = lines.length * lineHeight + 20;
    
    let y = lineHeight;
    lines.forEach(lineText => {
        let x = 8;
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
    document.getElementById('contentInput').value = '';
    updateStepIndicators(1);
    Object.keys(trainedLetters).forEach(k => delete trainedLetters[k]);
}
