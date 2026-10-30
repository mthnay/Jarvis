// Web port of the desktop HUD (ui.py). Drawing code follows ui.py's
// _draw / _draw_orb / _draw_left_panel step by step so both look the same.

// ── Palette (ui.py) ─────────────────────────────────────────────────────────
const C_BG = '#020c0c';
const C_PRI = '#00d4c0';
const C_ORG = '#ff6600';
const C_ORG2 = '#ff9900';
const C_MID = '#006a62';
const C_DIM = '#0a2a28';
const C_DIMMER = '#061414';
const C_TEXT = '#7dfff6';
const C_GREEN = '#00ff88';
const C_RED = '#ff3344';
const C_BLUE = '#4488ff';
const C_GOLD = '#ffcc00';

const ORB_COLORS = {
  LISTENING: [0, 255, 136],
  SPEAKING: [68, 136, 255],
  THINKING: [255, 204, 0],
  MUTED: [200, 30, 80],
  PAUSED: [30, 60, 55],
  ERROR: [255, 51, 68],
  INITIALISING: [255, 51, 68],
};
const STATE_HEX_COLORS = { LISTENING: C_GREEN, SPEAKING: C_BLUE, THINKING: C_GOLD, INITIALISING: C_RED, ERROR: C_RED };

const SYSTEM_NAME = 'J.A.R.V.I.S';
const MODEL_BADGE = 'VOICE CORE · WEB';
const LEFT_W_T = 360;
const RIGHT_W_T = 410;
const HDR_H = 72;
const FOOTER_H = 26;
const INPUT_H = 34;
const CONTROL_H = 146;
const TICK_MS = 33;
const STOP_WORDS = ['sus', 'dur', 'stop', 'sessiz', 'kes'];
const VOICES = ['Charon', 'Puck', 'Aoede', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Zephyr'];

const fontBody = (size) => `${size}px Grift, "Avenir Next", sans-serif`;
const fontBodyBold = (size) => `bold ${size}px Grift, "Avenir Next", sans-serif`;
const fontDisplay = (size) => `${size}px "Grift Extra Bold", Grift, "Avenir Next", sans-serif`;

const $ = (selector) => document.querySelector(selector);
const canvas = $('#hud');
const ctx = canvas.getContext('2d');
const logEl = $('#log');
const form = $('#composer');
const input = $('#message');
const muteBtn = $('#mute');
const pauseBtn = $('#pause');
const shutdownBtn = $('#shutdown');
const settingsBtn = $('#settings-btn');
const settingsPanel = $('#settings-panel');
const debugBody = $('#debug-body');
const voiceSelect = $('#voice');
const sfxBtn = $('#sfx-btn');
const fxLevel = $('#fx-level');
const fxLabel = $('#fx-label');

const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function storageGet(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* private mode */ }
}

// ── Layout (ui.py _set_layout_metrics) ──────────────────────────────────────
const L = {};
function setLayoutMetrics() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  L.W = W;
  L.H = H;
  // Below this width the three desktop columns no longer fit, so the orb sits
  // above the conversation panel and the left cards are hidden.
  L.compact = W < 900;
  document.body.classList.toggle('compact', L.compact);
  if (!L.compact) {
    L.LEFT_W = Math.min(LEFT_W_T, Math.floor(W * 0.23));
    L.RIGHT_W = Math.min(RIGHT_W_T, Math.floor(W * 0.25));
    const centerW = W - L.LEFT_W - L.RIGHT_W;
    const orbAreaH = H - HDR_H - CONTROL_H - FOOTER_H - 24;
    L.FCX = L.LEFT_W + Math.floor(centerW / 2);
    L.FCY = HDR_H + Math.floor(orbAreaH / 2) + 6;
    L.FACE = Math.min(Math.floor(orbAreaH * 0.90), Math.floor(centerW * 0.86), 860);
    L.CTRL_Y = HDR_H + orbAreaH + 2;
    L.CHAT_PANEL_X = W - L.RIGHT_W + 8;
    L.CHAT_PANEL_Y = HDR_H + 8;
    L.CHAT_PANEL_W = L.RIGHT_W - 14;
    L.CHAT_PANEL_H = H - HDR_H - FOOTER_H - 16;
  } else {
    L.LEFT_W = 0;
    L.RIGHT_W = 0;
    const orbAreaH = clamp(Math.round((H - HDR_H - FOOTER_H) * 0.40), 180, 380);
    L.FCX = Math.floor(W / 2);
    L.FCY = HDR_H + Math.floor(orbAreaH / 2) + 6;
    L.FACE = Math.min(Math.floor(orbAreaH * 0.90), Math.floor(W * 0.86), 860);
    L.CTRL_Y = HDR_H + orbAreaH + 2;
    L.CHAT_PANEL_X = 8;
    L.CHAT_PANEL_Y = L.CTRL_Y + 66;
    L.CHAT_PANEL_W = W - 16;
    L.CHAT_PANEL_H = Math.max(160, H - FOOTER_H - 8 - L.CHAT_PANEL_Y);
  }
  L.CHAT_X = L.CHAT_PANEL_X + 10;
  L.CHAT_Y = L.CHAT_PANEL_Y + 34;
  L.CHAT_W = L.CHAT_PANEL_W - 20;
  L.CHAT_H = L.CHAT_PANEL_H - 90;
  L.CHAT_INPUT_Y = L.CHAT_PANEL_Y + L.CHAT_PANEL_H - INPUT_H - 10;
}

function place(el, x, y, w, h) {
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  if (w != null) el.style.width = `${w}px`;
  if (h != null) el.style.height = `${h}px`;
}

// ui.py _place_layout_widgets
function placeWidgets() {
  place(logEl, L.CHAT_X, L.CHAT_Y, L.CHAT_W, L.CHAT_H);
  place(form, L.CHAT_X, L.CHAT_INPUT_Y, L.CHAT_W, INPUT_H);
  const scale = Math.min(1, (L.W - 32) / 416);
  const gap = Math.round(12 * scale);
  const muteW = Math.floor(126 * scale);
  const pauseW = Math.floor(126 * scale);
  const shutdownW = Math.floor(140 * scale);
  const total = muteW + pauseW + shutdownW + gap * 2;
  const startX = L.FCX - Math.floor(total / 2);
  const row1Y = L.CTRL_Y + 20;
  place(muteBtn, startX, row1Y, muteW);
  place(pauseBtn, startX + muteW + gap, row1Y, pauseW);
  place(shutdownBtn, startX + muteW + pauseW + gap * 2, row1Y, shutdownW);
  place($('#social'), 14, L.H - FOOTER_H - 52);
  $('#social').hidden = L.compact;
  settingsPanel.style.width = `${Math.min(320, L.W - 28)}px`;
}

function resize() {
  setLayoutMetrics();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(L.W * dpr);
  canvas.height = Math.round(L.H * dpr);
  canvas.style.width = `${L.W}px`;
  canvas.style.height = `${L.H}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (const p of particles) {
    p.x %= L.W;
    p.y %= L.H;
  }
  placeWidgets();
}

// ── State ───────────────────────────────────────────────────────────────────
const S = {
  jarvisState: 'INITIALISING',
  speaking: false,
  userSpeaking: false,
  userSpeakingUntil: 0,
  muted: false,
  paused: false,
  stopped: false,
  scale: 1.0,
  targetScale: 1.0,
  haloA: 55.0,
  targetHalo: 55.0,
  lastT: performance.now() / 1000,
  tick: 0,
  ringsSpin: [0.0, 45.0, 90.0, 200.0],
  pulseR: [],
  statusBlink: true,
  errorHoldUntil: 0,
  awaitingReply: false,
  startedAt: Date.now(),
  panelFocus: '',
  panelFocusUntil: 0,
  weatherCard: { city: 'Istanbul', primary: '--', details: ['Hava durumu yükleniyor...'] },
  healthCardLines: ['Apple Sağlık verisi yalnızca', 'macOS sürümünde görünür.'],
  stats: { cpu: 0, ram: 0, disk: 0, battery: 100, net_up: 0, net_down: 0 },
  voice: VOICES.includes(storageGet('jarvis.voice', '')) ? storageGet('jarvis.voice', '') : 'Charon',
};

const particles = Array.from({ length: 24 }, () => ({
  x: rand(0, window.innerWidth), y: rand(0, window.innerHeight),
  vx: rand(-0.15, 0.15), vy: rand(-0.15, 0.15),
  r: rand(0.5, 1.8), a: randInt(15, 70),
}));
const orbParticles = Array.from({ length: 160 }, () => ({
  angle: rand(0, Math.PI * 2), orbit: rand(0.06, 0.98), speed: rand(-0.030, 0.030),
  size: rand(0.8, 2.8), phase: rand(0, Math.PI * 2), wobble: rand(0.010, 0.040), depth: rand(0.30, 1.00),
}));
const orbShellParticles = Array.from({ length: 84 }, () => ({
  angle: rand(0, Math.PI * 2), speed: rand(-0.020, 0.020), size: rand(1.4, 3.8),
  phase: rand(0, Math.PI * 2), glow: rand(0.4, 1.0),
}));

function effectiveState() {
  return S.paused ? 'PAUSED' : S.jarvisState;
}

function setState(state) {
  const previous = S.jarvisState;
  S.jarvisState = state;
  S.speaking = state === 'SPEAKING';
  if (state === 'THINKING') sound.startThinking();
  else if (previous === 'THINKING') sound.stopThinking();
  if (state === 'ERROR' && previous !== 'ERROR') sound.playError();
}

function markUserActivity(active = true) {
  S.userSpeaking = active;
  S.userSpeakingUntil = performance.now() / 1000 + (active ? 0.9 : 0);
}

function focusPanel(section, durationMs = 4200) {
  S.panelFocus = section;
  S.panelFocusUntil = performance.now() / 1000 + Math.max(0.8, durationMs / 1000);
}

function stateColor(state) {
  const effective = state || S.jarvisState;
  if (effective === 'PAUSED') return C_MID;
  return STATE_HEX_COLORS[effective] || C_PRI;
}

function stateBadgeText(state) {
  if (S.stopped) return 'OFFLINE';
  if (state === 'INITIALISING') return 'CONNECTING';
  if (state === 'ERROR') return 'ERROR';
  return 'ONLINE';
}

// ── Sound effects (ui.py SoundManager) ──────────────────────────────────────
const sound = (() => {
  const make = (file, loop = false) => {
    const audio = new Audio(`/sfx/${file}`);
    audio.loop = loop;
    audio.preload = 'auto';
    return audio;
  };
  const hud = make('HUD.mp3', true);
  const think = make('Think.mp3', true);
  const done = make('Done.mp3');
  const error = make('Error.mp3');
  let enabled = storageGet('jarvis.sfx', 'on') !== 'off';
  let volume = clamp(Number(storageGet('jarvis.fx', '20')) / 100, 0, 1);
  let foreground = null;

  // Browsers block audio until the first user gesture; failures are expected.
  const play = (audio, factor) => {
    audio.volume = clamp(volume * factor, 0, 1);
    audio.play().catch(() => {});
  };
  const syncAmbient = () => {
    if (enabled && !foreground && !S.stopped && !S.paused) play(hud, 1);
    else hud.pause();
  };
  const playForeground = (audio, factor) => {
    if (!enabled) return;
    if (foreground && foreground !== audio) foreground.pause();
    foreground = audio;
    audio.currentTime = 0;
    hud.pause();
    play(audio, factor);
    if (!audio.loop) {
      audio.onended = () => {
        if (foreground === audio) foreground = null;
        syncAmbient();
      };
    }
  };
  return {
    get enabled() { return enabled; },
    get volume() { return volume; },
    startThinking() { if (foreground !== think) playForeground(think, 0.82); },
    stopThinking() {
      think.pause();
      if (foreground === think) foreground = null;
      syncAmbient();
    },
    playSuccess() { playForeground(done, 0.68); },
    playError() { playForeground(error, 0.95); },
    setEnabled(value) {
      enabled = value;
      storageSet('jarvis.sfx', value ? 'on' : 'off');
      if (!value) {
        for (const a of [hud, think, done, error]) a.pause();
        foreground = null;
      }
      syncAmbient();
    },
    setVolume(value) {
      volume = clamp(value, 0, 1);
      storageSet('jarvis.fx', String(Math.round(volume * 100)));
      for (const a of [hud, think, done, error]) a.volume = volume;
    },
    sync: syncAmbient,
    stopAll() {
      for (const a of [hud, think, done, error]) a.pause();
      foreground = null;
    },
  };
})();

// ── Log (ui.py write_log / typing effect) ───────────────────────────────────
const typingQueue = [];
let isTyping = false;
const debugEntries = [];

function writeDebug(text, level = 'INFO') {
  const clean = String(text || '').split(/\s+/).join(' ').trim();
  if (!clean) return;
  const stamp = new Date().toTimeString().slice(0, 8);
  const lvl = level.toUpperCase();
  debugEntries.push([lvl, `[${stamp}] ${lvl}: ${clean}`]);
  if (debugEntries.length > 160) debugEntries.shift();
  renderDebugLogs();
}

function renderDebugLogs() {
  debugBody.textContent = '';
  if (!debugEntries.length) {
    const line = document.createElement('div');
    line.className = 'info';
    line.textContent = 'Henüz not edilebilir hata yok.';
    debugBody.append(line);
    return;
  }
  for (const [level, text] of debugEntries) {
    const line = document.createElement('div');
    line.className = level === 'ERROR' ? 'err' : level === 'WARN' ? 'warn' : 'info';
    line.textContent = text;
    debugBody.append(line);
  }
  debugBody.scrollTop = debugBody.scrollHeight;
}

function writeLog(text) {
  typingQueue.push(text);
  const tl = text.toLowerCase();
  if (tl.startsWith('siz:') || tl.startsWith('you:')) {
    markUserActivity(true);
    setState('THINKING');
  } else if (tl.startsWith('err:') || tl.includes('error')) {
    S.errorHoldUntil = performance.now() / 1000 + 8.0;
    setState('ERROR');
    writeDebug(text, 'ERROR');
  }
  if (!isTyping) startTyping();
}

function startTyping() {
  if (!typingQueue.length) {
    isTyping = false;
    if (S.jarvisState === 'ERROR' && performance.now() / 1000 < S.errorHoldUntil) return;
    if (S.awaitingReply) setState('THINKING');
    else if (!S.speaking && S.jarvisState !== 'INITIALISING') setState('LISTENING');
    return;
  }
  isTyping = true;
  const text = typingQueue.shift();
  const tl = text.toLowerCase();
  let tag = 'sys';
  if (tl.startsWith('siz:') || tl.startsWith('you:')) tag = 'you';
  else if (tl.startsWith('jarvis:') || tl.startsWith('ai:')) tag = 'ai';
  else if (tl.startsWith('err:') || tl.includes('error')) tag = 'err';
  const line = document.createElement('span');
  line.className = tag;
  logEl.append(line, document.createTextNode('\n'));
  typeChar(line, text, 0);
}

function typeChar(line, text, i) {
  if (i < text.length) {
    // ui.py types one char per 7 ms; a few per frame keeps that speed in a browser.
    line.textContent += text.slice(i, i + 2);
    logEl.scrollTop = logEl.scrollHeight;
    setTimeout(typeChar, 14, line, text, i + 2);
  } else {
    setTimeout(startTyping, 20);
  }
}

// ── Audio playback (Gemini 24 kHz PCM) ──────────────────────────────────────
let audioContext;
let nextAudioTime = 0;
const activeAudio = new Set();
// Live PCM arrives in short WebSocket packets.  Keep a small lead over the
// audio clock so normal network jitter does not become an audible gap.
const PLAYBACK_LOOKAHEAD_SECONDS = 0.12;

function stopAudio() {
  for (const source of activeAudio) source.stop();
  activeAudio.clear();
  nextAudioTime = 0;
}

function audioPlaying() {
  return audioContext?.state === 'running' && activeAudio.size > 0 && nextAudioTime > audioContext.currentTime;
}

function playPcm(encoded, sampleRate) {
  if (S.paused) return;
  const raw = atob(encoded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  // 16-bit PCM must be aligned on sample boundaries. Ignore a malformed or
  // empty frame instead of letting it corrupt the rest of playback.
  if (bytes.byteLength < 2 || bytes.byteLength % 2 !== 0) return;
  const samples = new Int16Array(bytes.buffer);
  audioContext ||= new AudioContext();
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  const buffer = audioContext.createBuffer(1, samples.length, sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i += 1) channel[i] = samples[i] / 32768;
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(audioContext.destination);
  // A 35 ms lead was shorter than common WebSocket scheduling jitter, causing
  // every late packet to sound like a click or a dropped syllable.  Starting
  // new/recovered streams 120 ms ahead preserves a continuous audio timeline.
  const startAt = Math.max(audioContext.currentTime + PLAYBACK_LOOKAHEAD_SECONDS, nextAudioTime);
  source.start(startAt);
  nextAudioTime = startAt + buffer.duration;
  activeAudio.add(source);
  source.onended = () => activeAudio.delete(source);
  if (S.jarvisState !== 'SPEAKING') setState('SPEAKING');
}

// ── Microphone (16 kHz PCM to the server) ───────────────────────────────────
let microphoneStream;
let captureContext;
let captureNode;
let captureSource;
let microphoneActive = false;

function toBase64(bytes) {
  let binary = '';
  const step = 8192;
  for (let offset = 0; offset < bytes.length; offset += step) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + step));
  }
  return btoa(binary);
}

function downsample(samples, inputRate) {
  if (inputRate === 16000) return samples;
  const ratio = inputRate / 16000;
  const output = new Float32Array(Math.round(samples.length / ratio));
  for (let i = 0; i < output.length; i += 1) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), samples.length);
    let total = 0;
    for (let j = start; j < end; j += 1) total += samples[j];
    output[i] = total / Math.max(1, end - start);
  }
  return output;
}

function sendMicrophoneFrame(floatSamples, sampleRate) {
  if (!microphoneActive || S.muted || S.paused || socket?.readyState !== WebSocket.OPEN) return;
  const samples = downsample(floatSamples, sampleRate);
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    pcm[i] = sample < 0 ? sample * 32768 : sample * 32767;
  }
  socket.send(JSON.stringify({ type: 'audio', data: toBase64(new Uint8Array(pcm.buffer)) }));
}

async function startMicrophone() {
  if (microphoneActive) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    writeLog('SYS: Bu tarayıcı mikrofonu desteklemiyor. Yazarak komut verebilirsin.');
    return;
  }
  try {
    microphoneStream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    captureContext = new AudioContext();
    captureSource = captureContext.createMediaStreamSource(microphoneStream);
    captureNode = captureContext.createScriptProcessor(2048, 1, 1);
    const silentOutput = captureContext.createGain();
    silentOutput.gain.value = 0;
    captureNode.onaudioprocess = (event) => sendMicrophoneFrame(event.inputBuffer.getChannelData(0), captureContext.sampleRate);
    captureSource.connect(captureNode);
    captureNode.connect(silentOutput);
    silentOutput.connect(captureContext.destination);
    microphoneActive = true;
  } catch {
    writeLog('SYS: Mikrofon izni gerekli. Yazarak da komut verebilirsin.');
    writeDebug('Mikrofon izni reddedildi veya mikrofon bulunamadı.', 'WARN');
  }
}

function stopMicrophone() {
  if (!microphoneActive) return;
  microphoneActive = false;
  microphoneStream?.getTracks().forEach((track) => track.stop());
  captureNode?.disconnect();
  captureSource?.disconnect();
  captureContext?.close();
}

// ── Connection ──────────────────────────────────────────────────────────────
let socket;
let reconnectTimer;

function connect() {
  clearTimeout(reconnectTimer);
  if (S.stopped || S.paused) return;
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${protocol}://${location.host}/ws?voice=${encodeURIComponent(S.voice)}`);
  socket = ws;
  setState('INITIALISING');
  ws.onopen = () => {
    setState('LISTENING');
    writeLog('SYS: JARVIS hazır. Dinliyorum...');
    startMicrophone();
  };
  ws.onclose = () => {
    if (socket !== ws) return;
    socket = undefined;
    if (S.stopped || S.paused) return;
    setState('INITIALISING');
    writeDebug('Sunucu bağlantısı kapandı, yeniden bağlanılıyor.', 'WARN');
    reconnectTimer = setTimeout(connect, 1500);
  };
  ws.onmessage = ({ data }) => {
    const event = JSON.parse(data);
    if (event.type === 'status') {
      if (event.message === 'Thinking') setState('THINKING');
      else {
        setState('INITIALISING');
        writeDebug(event.message, 'WARN');
      }
    }
    if (['error', 'audio', 'reply', 'turn_complete'].includes(event.type)) S.awaitingReply = false;
    if (event.type === 'error') writeLog(`ERR: ${event.message}`);
    if (event.type === 'audio') playPcm(event.data, event.sample_rate || 24000);
    if (event.type === 'interrupt') stopAudio();
    if (event.type === 'hearing') markUserActivity(true);
    if (event.type === 'user_transcript') writeLog(`Siz: ${event.message}`);
    if (event.type === 'reply') writeLog(`JARVIS: ${event.message}`);
    if (event.type === 'tool') {
      writeDebug(`Araç: ${event.name}`);
      if (event.name === 'get_weather') focusPanel('weather');
      sound.playSuccess();
    }
    if (event.type === 'turn_complete' && S.jarvisState === 'THINKING' && !isTyping) setState('LISTENING');
  };
}

function disconnect() {
  clearTimeout(reconnectTimer);
  S.awaitingReply = false;
  const ws = socket;
  socket = undefined;
  ws?.close();
  stopAudio();
}

// ── Controls ────────────────────────────────────────────────────────────────
function drawMuteButton() {
  muteBtn.classList.toggle('muted', S.muted);
  muteBtn.textContent = S.muted ? '🔇 MUTED' : '🎙 LIVE';
}

function toggleMute() {
  if (S.stopped) return;
  S.muted = !S.muted;
  drawMuteButton();
  if (S.muted) socket?.readyState === WebSocket.OPEN && socket.send(JSON.stringify({ type: 'audio_end' }));
  writeLog(S.muted ? 'SYS: Mikrofon kapatıldı.' : 'SYS: Mikrofon açık.');
}

function drawPauseButton() {
  pauseBtn.classList.toggle('paused', S.paused);
  pauseBtn.textContent = S.paused ? '▶ RESUME' : '⏸ PAUSE';
}

function togglePause() {
  if (S.stopped) return;
  S.paused = !S.paused;
  drawPauseButton();
  if (S.paused) {
    disconnect();
    setState('PAUSED');
    writeLog('SYS: JARVIS duraklatıldı.');
  } else {
    setState('THINKING');
    writeLog('SYS: JARVIS devam ediyor...');
    connect();
  }
  sound.sync();
}

function toggleShutdown() {
  S.stopped = !S.stopped;
  if (S.stopped) {
    writeLog('SYS: JARVIS kapatılıyor...');
    disconnect();
    stopMicrophone();
    sound.stopAll();
    shutdownBtn.textContent = '⏻  START';
  } else {
    shutdownBtn.textContent = '⏻  SHUTDOWN';
    if (S.paused) togglePause();
    else connect();
    sound.sync();
  }
}

muteBtn.addEventListener('click', toggleMute);
pauseBtn.addEventListener('click', togglePause);
shutdownBtn.addEventListener('click', toggleShutdown);

canvas.addEventListener('click', (event) => {
  const dx = event.clientX - L.FCX;
  const dy = event.clientY - L.FCY;
  if (dx * dx + dy * dy <= (L.FACE * 0.40) ** 2) togglePause();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'F4') { event.preventDefault(); toggleMute(); }
  if (event.key === 'F5') { event.preventDefault(); togglePause(); }
});

// Audio needs a user gesture before it may start.
document.addEventListener('pointerdown', () => {
  sound.sync();
  if (audioContext?.state === 'suspended') audioContext.resume().catch(() => {});
}, { once: true });

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  if (S.paused) {
    writeLog("SYS: JARVIS duraklatılmış durumda. Devam etmek için pause'u kapat.");
    return;
  }
  input.value = '';
  if (STOP_WORDS.includes(text.toLowerCase())) {
    stopAudio();
    writeLog('SYS: ⏹ Ses kesildi.');
    return;
  }
  if (socket?.readyState !== WebSocket.OPEN) {
    writeLog('ERR: JARVIS henüz bağlı değil, birazdan tekrar dene.');
    return;
  }
  writeLog(`Siz: ${text}`);
  S.awaitingReply = true;
  socket.send(JSON.stringify({ message: text }));
});

// Settings panel
let settingsOpen = false;
function toggleSettingsPanel() {
  settingsOpen = !settingsOpen;
  settingsPanel.hidden = !settingsOpen;
  settingsBtn.setAttribute('aria-expanded', String(settingsOpen));
  settingsBtn.querySelector('.settings-arrow').textContent = settingsOpen ? '▾' : '▸';
}
settingsBtn.addEventListener('click', toggleSettingsPanel);

function setSettingsTab(tab) {
  const debug = tab === 'debug';
  $('#tab-settings').classList.toggle('active', !debug);
  $('#tab-debug').classList.toggle('active', debug);
  $('#tab-settings').setAttribute('aria-selected', String(!debug));
  $('#tab-debug').setAttribute('aria-selected', String(debug));
  $('#settings-body').hidden = debug;
  debugBody.hidden = !debug;
  if (debug) renderDebugLogs();
}
$('#tab-settings').addEventListener('click', () => setSettingsTab('settings'));
$('#tab-debug').addEventListener('click', () => setSettingsTab('debug'));

$('#api-btn').addEventListener('click', () => {
  writeLog('SYS: Web sürümünde API anahtarları Render → Environment bölümünden yönetilir.');
});

function drawSfxButton() {
  sfxBtn.classList.toggle('off', !sound.enabled);
  sfxBtn.textContent = sound.enabled ? '♪ SFX ON' : '♪ SFX OFF';
}
sfxBtn.addEventListener('click', () => { sound.setEnabled(!sound.enabled); drawSfxButton(); });

fxLevel.value = String(Math.round(sound.volume * 100));
fxLabel.textContent = `FX LEVEL  ${fxLevel.value}%`;
fxLevel.addEventListener('input', () => {
  fxLabel.textContent = `FX LEVEL  ${fxLevel.value}%`;
  sound.setVolume(Number(fxLevel.value) / 100);
});

for (const voice of VOICES) voiceSelect.add(new Option(voice, voice, false, voice === S.voice));
voiceSelect.addEventListener('change', () => {
  S.voice = voiceSelect.value;
  storageSet('jarvis.voice', S.voice);
  writeLog(`SYS: Ses ${S.voice} olarak değiştirildi.`);
  // The voice is fixed per Gemini session, so start a new one.
  if (!S.stopped && !S.paused) {
    disconnect();
    connect();
  }
});

// ── Left-card data ──────────────────────────────────────────────────────────
function parseWeatherCard(text) {
  const lower = (text || '').toLowerCase();
  if (!text || lower.includes('alınamadı') || lower.includes('alınamadi')) {
    return { city: 'Istanbul', primary: '--', details: ['Hava durumu alınamadı.'] };
  }
  const idx = text.indexOf(':');
  const prefix = idx >= 0 ? text.slice(0, idx) : text;
  const body = idx >= 0 ? text.slice(idx + 1) : '';
  let city = 'Istanbul';
  if (prefix.includes(' için')) {
    city = prefix.split(' için')[0].trim().toLocaleLowerCase('tr-TR').replace(/(^|\s)\S/g, (c) => c.toLocaleUpperCase('tr-TR'));
  }
  const details = body.split(',').map((part) => part.trim().replace(/^[ .]+|[ .]+$/g, '')).filter(Boolean);
  const primary = details.length ? details[0].replace(' derece', '°C') : '--';
  return { city, primary, details: details.slice(1, 4).length ? details.slice(1, 4) : ['Anlık veri hazır.'] };
}

async function refreshBrief() {
  try {
    const response = await fetch('/api/brief', { cache: 'no-store' });
    if (!response.ok) return;
    const brief = await response.json();
    S.weatherCard = parseWeatherCard(brief.weather);
    Object.assign(S.stats, brief.stats || {});
    const primary = [
      brief.gemini ? 'Gemini hazir' : 'Gemini API eksik',
      brief.youtube && brief.youtube_handle ? 'YouTube hazir' : 'YouTube ayari eksik',
    ];
    $('#status-primary').textContent = primary.join('  ·  ');
    $('#status-secondary').textContent = `Kanal: ${brief.youtube_handle || '@handle girilmedi'}`;
  } catch {
    // Keep the last values; the next poll retries.
  }
}

// ── Canvas helpers (ui.py _ac / _bar / _bracket ...) ────────────────────────
// Tk has no alpha, so ui.py fades colors toward black; do the same.
function ac(r, g, b, a) {
  const f = clamp(Math.trunc(a), 0, 255) / 255;
  const hex = (v) => Math.trunc(v * f).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function line(points, color, width = 1) {
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function rect(x0, y0, x1, y1, fill, outline, width = 1) {
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }
  if (outline) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = width;
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1);
  }
}

function circle(cx, cy, r, { fill, outline, width = 1 } = {}) {
  if (r <= 0) return;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (outline) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

// Tk arcs: degrees counter-clockwise from 3 o'clock.
function arc(cx, cy, r, start, extent, color, width) {
  const d = Math.PI / 180;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -(start + extent) * d, -start * d);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function text(x, y, value, fill, font, anchor = 'center') {
  ctx.font = font;
  ctx.fillStyle = fill;
  ctx.textBaseline = 'middle';
  ctx.textAlign = anchor === 'w' ? 'left' : anchor === 'e' ? 'right' : 'center';
  ctx.fillText(value, x, y);
}

function bar(x, y, w, h, pct, color) {
  rect(x, y, x + w, y + h, '#061212', C_DIM, 1);
  const fw = Math.max(1, Math.trunc((w * pct) / 100));
  rect(x + 1, y + 1, x + fw, y + h - 1, color);
}

function bracket(x0, y0, pw, ph, col = C_PRI, bl = 12) {
  for (const [bx, by, sx, sy] of [[x0, y0, 1, 1], [x0 + pw, y0, -1, 1], [x0, y0 + ph, 1, -1], [x0 + pw, y0 + ph, -1, -1]]) {
    line([bx, by, bx + sx * bl, by], col, 2);
    line([bx, by, bx, by + sy * bl], col, 2);
  }
}

function focusBoostFor(section) {
  if (S.panelFocus !== section) return 0;
  const remaining = S.panelFocusUntil - performance.now() / 1000;
  if (remaining <= 0) return 0;
  const pulse = 0.65 + 0.35 * Math.sin(S.tick * 0.12);
  return Math.min(1, remaining / 4) * pulse;
}

function drawInfoCard(x0, y0, pw, ph, title, accent, focus, dimmed) {
  const glow = Math.trunc(55 + 120 * focus);
  const border = focus > 0.08 ? accent : (dimmed ? '#35504d' : ac(0, 120, 112, 190));
  rect(x0, y0, x0 + pw, y0 + ph, dimmed ? '#071111' : '#030d0d');
  if (focus > 0.08) {
    for (let inset = 0; inset < 3; inset += 1) {
      rect(x0 - inset, y0 - inset, x0 + pw + inset, y0 + ph + inset, null, ac(...ORB_COLORS.LISTENING, Math.max(12, glow - inset * 28)), 1);
    }
  }
  bracket(x0, y0, pw, ph, border, 10);
  text(x0 + 14, y0 + 14, title, dimmed ? '#6f7d7b' : accent, fontDisplay(10), 'w');
  line([x0 + 12, y0 + 28, x0 + pw - 12, y0 + 28], dimmed ? '#173130' : C_DIM);
}

const pad2 = (n) => String(n).padStart(2, '0');

// ── Left panel (ui.py _draw_left_panel) ─────────────────────────────────────
function drawLeftPanel() {
  const x0 = 10;
  const y0 = HDR_H + 10;
  const pw = L.LEFT_W - 18;
  const gap = 14;
  const totalH = L.H - HDR_H - FOOTER_H - 20;
  const cardAreaH = totalH - gap * 3;
  const pad = 14;
  const cards = [
    ['time', 0.22, 'TIME', C_GOLD],
    ['weather', 0.20, 'WEATHER · ISTANBUL', C_BLUE],
    ['system', 0.28, 'SYSTEM STATUS', C_PRI],
    ['health', 0.30, 'HEALTH SUMMARY', C_GREEN],
  ];
  const anyFocusActive = Boolean(S.panelFocus) && S.panelFocusUntil > performance.now() / 1000;
  const weights = cards.map(([section, weight]) => weight + (focusBoostFor(section) > 0.08 ? 0.12 : 0));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const heights = weights.map((w) => Math.trunc(cardAreaH * (w / totalWeight)));
  heights[heights.length - 1] += cardAreaH - heights.reduce((a, b) => a + b, 0);

  const now = new Date();
  let currentY = y0;
  cards.forEach(([section, , title, accent], index) => {
    const ph = heights[index];
    const focus = focusBoostFor(section);
    const dimmed = anyFocusActive && focus <= 0.08;
    const sx = x0 + Math.trunc(14 * focus);
    const spw = pw + Math.trunc(22 * focus);
    const spad = pad + Math.trunc(2 * focus);
    const sbw = spw - 2 * spad;
    const mutedLabel = dimmed ? '#647270' : C_MID;
    const mutedText = dimmed ? '#7e8a88' : C_TEXT;
    const mutedPrimary = dimmed ? '#8ea19d' : C_PRI;
    const mutedGreen = dimmed ? '#85a393' : C_GREEN;
    const mutedGold = dimmed ? '#a1997e' : C_GOLD;
    const mutedWarn = dimmed ? '#8d7f77' : C_ORG2;
    const mutedRed = dimmed ? '#8a7779' : C_RED;
    drawInfoCard(sx, currentY, spw, ph, title, dimmed ? '#72807f' : accent, focus, dimmed);

    if (section === 'time') {
      text(sx + spad, currentY + 64, `${pad2(now.getHours())}:${pad2(now.getMinutes())}`, mutedPrimary, fontDisplay(focus > 0.08 ? 36 : 34), 'w');
      text(sx + spad, currentY + 92, `:${pad2(now.getSeconds())}`, mutedLabel, fontBodyBold(13), 'w');
      const date = `${pad2(now.getDate())} ${now.toLocaleDateString('en-US', { month: 'long' })} ${now.getFullYear()}`.toUpperCase();
      text(sx + spad, currentY + 118, date, mutedGold, fontBodyBold(11), 'w');
      text(sx + spad, currentY + 138, now.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase(), mutedText, fontBody(10), 'w');
    } else if (section === 'weather') {
      text(sx + spad, currentY + 58, S.weatherCard.primary, mutedPrimary, fontDisplay(focus > 0.08 ? 30 : 28), 'w');
      text(sx + spad, currentY + 84, S.weatherCard.city.toUpperCase(), mutedLabel, fontBodyBold(10), 'w');
      let wy = currentY + 108;
      for (const detail of S.weatherCard.details.slice(0, 3)) {
        text(sx + spad, wy, `• ${detail}`, mutedText, fontBody(10), 'w');
        wy += 17;
      }
    } else if (section === 'system') {
      let cy = currentY + 44;
      const uptime = Math.trunc((Date.now() - S.startedAt) / 1000);
      const upHr = Math.trunc(uptime / 3600);
      const upMin = Math.trunc((uptime % 3600) / 60);
      text(sx + spad, cy, `UPTIME  ${pad2(upHr)}:${pad2(upMin)}:${pad2(uptime % 60)}`, mutedLabel, fontBodyBold(9), 'w');
      cy += 22;
      for (const [label, key] of [['CPU', 'cpu'], ['RAM', 'ram'], ['DISK', 'disk'], ['BATTERY', 'battery']]) {
        const val = Number(S.stats[key]) || 0;
        let col;
        if (key === 'battery') col = val < 20 ? C_RED : C_GREEN;
        else col = val > 80 ? C_RED : val > 55 ? C_ORG : C_PRI;
        if (dimmed) col = col === C_RED ? mutedRed : col === C_ORG ? mutedWarn : col === C_GREEN ? mutedGreen : mutedPrimary;
        text(sx + spad, cy, label, mutedLabel, fontBody(10), 'w');
        text(sx + spw - spad, cy, `${Math.round(val)}%`, col, fontBodyBold(10), 'e');
        cy += 14;
        bar(sx + spad, cy, sbw, 7, val, col);
        cy += 16;
      }
      const fmt = (v) => (v < 1000 ? `${v.toFixed(1)} KB/s` : `${(v / 1024).toFixed(1)} MB/s`);
      line([sx + spad, cy - 4, sx + spw - spad, cy - 4], dimmed ? '#173130' : C_DIM);
      text(sx + spad, cy + 10, `▲ ${fmt(S.stats.net_up)}`, mutedWarn, fontBody(10), 'w');
      text(sx + spw - spad, cy + 10, `▼ ${fmt(S.stats.net_down)}`, mutedGreen, fontBody(10), 'e');
    } else if (section === 'health') {
      let hy = currentY + 48;
      for (const healthLine of S.healthCardLines.slice(0, 5)) {
        text(sx + spad, hy, `• ${healthLine}`, mutedText, fontBody(10), 'w');
        hy += 21;
      }
    }
    currentY += ph + gap;
  });
}

// ── Right panel (ui.py _draw_right_panel) ───────────────────────────────────
function drawRightPanel() {
  const x0 = L.CHAT_PANEL_X;
  const y0 = L.CHAT_PANEL_Y;
  const pw = L.CHAT_PANEL_W;
  const ph = L.CHAT_PANEL_H;
  const pad = 10;
  rect(x0, y0, x0 + pw, y0 + ph, '#030d0d');
  bracket(x0, y0, pw, ph, C_MID);
  const st = effectiveState();
  text(x0 + 14, y0 + 16, 'CONVERSATION', C_PRI, fontDisplay(11), 'w');
  text(x0 + pw - pad, y0 + 16, st, stateColor(st), fontBodyBold(10), 'e');
  line([x0 + pad, y0 + 28, x0 + pw - pad, y0 + 28], C_DIM);
}

// ── Orb (ui.py _draw_orb) ───────────────────────────────────────────────────
function drawOrb() {
  const state = effectiveState();
  const t = S.tick;
  const { speaking, userSpeaking, paused } = { speaking: S.speaking, userSpeaking: S.userSpeaking, paused: S.paused };
  const thinking = state === 'THINKING' || state === 'INITIALISING';
  let speakPulse;
  if (speaking) speakPulse = 1.0 + 0.12 * Math.sin(t * 0.23) + 0.05 * Math.sin(t * 0.11 + 1.2);
  else if (userSpeaking) speakPulse = 1.0 + 0.06 * Math.sin(t * 0.18 + 0.7);
  else if (thinking) speakPulse = 1.0 + 0.03 * Math.sin(t * 0.10);
  else speakPulse = 1.0 + 0.01 * Math.sin(t * 0.07);

  let moveX = 0;
  let moveY = 0;
  if (userSpeaking) {
    moveX = Math.trunc(6 * Math.sin(t * 0.06));
    moveY = Math.trunc(4 * Math.cos(t * 0.09 + 0.5));
  } else if (thinking) {
    moveX = Math.trunc(3 * Math.sin(t * 0.045));
    moveY = Math.trunc(2 * Math.cos(t * 0.05 + 0.4));
  }

  const FCX = L.FCX + moveX;
  const FCY = L.FCY + moveY;
  const FW = Math.trunc(L.FACE * S.scale * speakPulse);
  const [R, G, B] = ORB_COLORS[state] || ORB_COLORS.LISTENING;
  const ha = S.haloA;
  const fieldR = Math.trunc(FW * 0.49);
  const innerR = Math.trunc(FW * 0.34);
  const activity = paused ? 0.10 : speaking ? 1.00 : userSpeaking ? 0.78 : thinking ? 0.62 : 0.26;
  let accentRgb;
  if (thinking) accentRgb = [255, 210, 72];
  else if (speaking) accentRgb = [170, 220, 255];
  else if (userSpeaking) accentRgb = [118, 200, 255];
  else accentRgb = [120, 255, 185];

  // Pulse rings
  for (const pr of S.pulseR) {
    const alpha = Math.max(0, Math.trunc(160 * (1.0 - pr / (FW * 0.70))));
    circle(FCX, FCY, Math.trunc(pr + fieldR * 0.96), { outline: ac(R, G, B, alpha) });
  }

  // Large outer glow
  if (!paused) {
    for (let i = 10; i > 0; i -= 1) {
      const frac = i / 10;
      const rr = Math.trunc(fieldR * (1.02 + 0.045 * frac));
      const alpha = Math.trunc(ha * 0.10 * frac);
      const ox = speaking ? 0 : Math.trunc(3 * Math.sin(t * 0.010 + i));
      const oy = speaking ? 0 : Math.trunc(3 * Math.cos(t * 0.009 + i * 1.3));
      circle(FCX + ox, FCY + oy, rr, { outline: ac(R, G, B, alpha), width: 3 });
    }
  }

  // Structural circles
  for (const [frac, width, alphaMult] of [[1.00, 2, 0.34], [0.90, 2, 0.24], [0.76, 1, 0.18], [0.62, 1, 0.12]]) {
    circle(FCX, FCY, Math.trunc(fieldR * frac), { outline: ac(R, G, B, Math.trunc(ha * alphaMult * (paused ? 0.4 : 1.0))), width });
  }

  // Orb shell particles
  const shellPush = speaking ? 1.16 : userSpeaking ? 1.07 : 1.0;
  const shellR = fieldR * 0.93 * shellPush;
  orbShellParticles.forEach((sp, idx) => {
    const angle = sp.angle + t * sp.speed * (speaking ? 2.8 : userSpeaking ? 1.6 : 1.1);
    const wobble = 1.0 + (speaking ? 0.07 : 0.035) * Math.sin(t * 0.08 + sp.phase);
    const x = FCX + Math.cos(angle) * shellR * wobble;
    const y = FCY + Math.sin(angle) * shellR * wobble;
    const alpha = Math.trunc((70 + 120 * sp.glow) * (paused ? 0.26 : 0.52 + activity * 0.45));
    const col = idx % 9 === 0 && !paused ? ac(...accentRgb, Math.min(255, alpha + 30)) : ac(R, G, B, alpha);
    circle(x, y, sp.size * (1.0 + 0.24 * Math.sin(t * 0.05 + sp.phase)), { fill: col });
  });

  // Rotating segmented arcs
  const arcR1 = Math.trunc(fieldR * 0.96);
  const arcR2 = Math.trunc(fieldR * 0.78);
  for (const [start, extent, width, accent] of [
    [S.ringsSpin[0], speaking ? 52 : 34, 3, false],
    [(S.ringsSpin[0] + 148) % 360, 26, 2, true],
    [(S.ringsSpin[2] + 28) % 360, userSpeaking ? 64 : 40, 3, false],
    [(S.ringsSpin[2] + 212) % 360, 18, 2, true],
  ]) {
    const rr = width === 3 ? arcR1 : arcR2;
    const col = accent && !paused
      ? ac(...accentRgb, Math.trunc(120 + 80 * activity))
      : ac(R, G, B, Math.trunc(ha * (width === 3 ? 1.2 : 0.7)));
    arc(FCX, FCY, rr, start, extent, col, width);
  }

  // Particle orb field
  const fieldLimit = innerR * (paused ? 0.82 : speaking ? 1.36 : userSpeaking ? 1.16 : 1.0);
  const speedMult = paused ? 0.10 : speaking ? 3.10 : userSpeaking ? 2.00 : 1.10;
  orbParticles.forEach((p, idx) => {
    const angle = p.angle + t * p.speed * speedMult;
    const wobble = 1.0 + (speaking ? 0.30 : 0.18) * Math.sin(t * p.wobble + p.phase);
    const orbit = fieldLimit * p.orbit * wobble;
    const depth = 0.5 + 0.5 * Math.sin(angle * 2.0 + t * 0.013 + p.phase);
    const ySquash = 0.62 + depth * 0.38;
    const drift = (speaking ? 8.0 : userSpeaking ? 5.0 : 4.0) * p.depth;
    const x = FCX + Math.cos(angle) * orbit + Math.sin(t * 0.011 + p.phase) * drift;
    const y = FCY + Math.sin(angle) * orbit * ySquash + Math.cos(t * 0.010 + p.phase) * drift;
    let baseAlpha = Math.trunc((18 + 155 * p.depth) * (0.24 + activity * 0.86) * (0.45 + depth * 0.75));
    if (paused) baseAlpha = Math.trunc(baseAlpha * 0.40);
    let col;
    if (idx % 11 === 0 && !paused) col = ac(...accentRgb, Math.min(255, baseAlpha + 25));
    else if (userSpeaking && idx % 7 === 0) col = ac(120, 205, 255, Math.min(255, baseAlpha + 20));
    else col = ac(R, G, B, baseAlpha);
    const pr = p.size * (paused ? 0.70 : 0.90 + depth * 0.65 + 0.30 * activity * p.depth);
    circle(x, y, pr, { fill: col });
    if (idx % 18 === 0 && !paused) {
      line([FCX + (x - FCX) * 0.18, FCY + (y - FCY) * 0.18, x, y], ac(R, G, B, Math.trunc(18 + 35 * p.depth * activity)));
    }
  });

  // Center void keeps the orb airy instead of lens-like.
  circle(FCX, FCY, Math.trunc(innerR * (paused ? 0.18 : 0.12)), { fill: C_BG });
}

// ── Frame (ui.py _draw) ─────────────────────────────────────────────────────
function draw() {
  const { W, H } = L;
  const t = S.tick;
  ctx.fillStyle = C_BG;
  ctx.fillRect(0, 0, W, H);

  // Dot grid
  ctx.fillStyle = C_DIMMER;
  for (let x = 0; x < W; x += 48) {
    for (let y = 0; y < H; y += 48) ctx.fillRect(x, y, 1, 1);
  }

  // Slow scan lines
  const scanY = ((t * 0.7) % (H + 60)) - 30;
  for (let i = 0; i < 2; i += 1) {
    const ly = (((scanY + i * 20) % H) + H) % H;
    line([0, ly, W, ly + 35], '#081818');
  }

  // Background particles
  const [R, G, B] = ORB_COLORS[effectiveState()] || ORB_COLORS.LISTENING;
  for (const p of particles) {
    circle(p.x, p.y, p.r, { fill: S.speaking ? ac(255, 110, 0, p.a) : ac(R, G, B, p.a) });
  }

  if (!L.compact) {
    line([L.LEFT_W, HDR_H, L.LEFT_W, H - FOOTER_H], C_DIM);
    line([W - L.RIGHT_W, HDR_H, W - L.RIGHT_W, H - FOOTER_H], C_DIM);
    drawLeftPanel();
  }
  drawRightPanel();
  drawOrb();

  const stateLabel = effectiveState();
  text(L.FCX, L.CTRL_Y - 34, SYSTEM_NAME, C_TEXT, fontDisplay(18));
  const title = stateLabel.charAt(0) + stateLabel.slice(1).toLowerCase();
  text(L.FCX, L.CTRL_Y - 12, `● ${S.stopped ? 'Offline' : title}`, S.stopped ? C_MID : stateColor(stateLabel), fontBodyBold(11));

  // Header
  rect(0, 0, W, HDR_H, '#010a0a');
  line([0, HDR_H, W, HDR_H], C_MID);
  for (let i = 0; i < 3; i += 1) line([0, HDR_H - 1 - i, W, HDR_H - 1 - i], ac(0, 180, 165, 60 - i * 18));
  text(W / 2, 24, SYSTEM_NAME, C_PRI, fontDisplay(L.compact ? 22 : 26));
  text(W / 2, 52, 'Just A Rather Very Intelligent System', C_MID, fontBody(L.compact ? 10 : 11));
  if (!L.compact) text(22, 36, MODEL_BADGE, C_DIM, fontBody(10), 'w');
  const indicator = stateBadgeText(stateLabel);
  const indColor = S.stopped ? C_MID : stateColor(stateLabel);
  text(W - 22, 36, `${S.statusBlink ? '●' : '○'}  ${indicator}`, indColor, fontBodyBold(11), 'e');

  // Footer
  rect(0, H - FOOTER_H, W, H, '#010a0a');
  line([0, H - FOOTER_H, W, H - FOOTER_H], C_DIM);
  text(W / 2, H - 13, 'JARVIS · Web Edition · Realtime Voice Core', C_DIM, fontBody(9));
  if (!L.compact) text(W - 18, H - 13, '[F4] MUTE  [F5] PAUSE', C_DIM, fontBody(9), 'e');
}

// ── Animation loop (ui.py _animate) ─────────────────────────────────────────
function step() {
  S.tick += 1;
  const t = S.tick;
  const now = performance.now() / 1000;

  if (S.userSpeaking && now > S.userSpeakingUntil) S.userSpeaking = false;
  if (S.jarvisState === 'SPEAKING' && !audioPlaying()) setState('LISTENING');
  if (S.jarvisState === 'ERROR' && now > S.errorHoldUntil && !isTyping) setState(socket ? 'LISTENING' : 'INITIALISING');

  if (now - S.lastT > (S.speaking ? 0.12 : 0.50)) {
    const thinking = S.jarvisState === 'THINKING' || S.jarvisState === 'INITIALISING';
    if (S.paused) { S.targetScale = rand(0.58, 0.64); S.targetHalo = rand(5, 10); }
    else if (S.speaking) { S.targetScale = rand(0.98, 1.10); S.targetHalo = rand(180, 250); }
    else if (S.userSpeaking) { S.targetScale = rand(0.88, 0.98); S.targetHalo = rand(120, 175); }
    else if (thinking) { S.targetScale = rand(0.80, 0.88); S.targetHalo = rand(95, 145); }
    else { S.targetScale = rand(0.72, 0.80); S.targetHalo = rand(34, 58); }
    S.lastT = now;
  }

  const sp = S.speaking ? 0.34 : 0.18;
  S.scale += (S.targetScale - S.scale) * sp;
  S.haloA += (S.targetHalo - S.haloA) * sp;

  const spds = S.paused ? [0, 0, 0, 0] : S.speaking ? [1.6, -1.1, 2.4, -0.7] : [0.55, -0.35, 0.90, -0.28];
  spds.forEach((spd, i) => { S.ringsSpin[i] = (((S.ringsSpin[i] + spd) % 360) + 360) % 360; });

  const pspd = S.speaking ? 4.2 : 1.8;
  const limit = L.FACE * 0.68;
  S.pulseR = S.pulseR.map((r) => r + pspd).filter((r) => r < limit);
  if (S.pulseR.length < 3 && Math.random() < (S.speaking ? 0.07 : 0.02)) S.pulseR.push(0);

  for (const p of particles) {
    p.x = (((p.x + p.vx) % L.W) + L.W) % L.W;
    p.y = (((p.y + p.vy) % L.H) + L.H) % L.H;
  }
  if (t % 38 === 0) S.statusBlink = !S.statusBlink;
}

let lastFrame = performance.now();
let backlog = 0;
function frame(now) {
  backlog = Math.min(backlog + (now - lastFrame), TICK_MS * 4);
  lastFrame = now;
  if (backlog >= TICK_MS) {
    while (backlog >= TICK_MS) {
      step();
      backlog -= TICK_MS;
    }
    draw();
  }
  requestAnimationFrame(frame);
}

window.addEventListener('resize', resize);
resize();
renderDebugLogs();
drawSfxButton();
refreshBrief();
setInterval(refreshBrief, 3000);
requestAnimationFrame(frame);
connect();
