const messages = document.querySelector('#messages');
const form = document.querySelector('#composer');
const input = document.querySelector('#message');
const status = document.querySelector('#status');
const mic = document.querySelector('#mic');
const send = document.querySelector('#send');
const orb = document.querySelector('#orb');
const mute = document.querySelector('#mute');
const coreStatus = document.querySelector('#core-status');
const conversationState = document.querySelector('#conversation-state');
let socket;
let recognition;
let speechEnabled = true;
let audioContext;
let nextAudioTime = 0;
const activeAudio = new Set();

function add(text, kind) {
  const item = document.createElement('article');
  item.className = `message ${kind}`;
  const label = document.createElement('b');
  label.textContent = kind === 'user' ? 'YOU' : kind === 'error' ? 'SYSTEM' : 'JARVIS';
  item.append(label, document.createTextNode(text));
  messages.append(item);
  messages.scrollTop = messages.scrollHeight;
}

function setStatus(text, online = false) {
  status.textContent = text;
  document.querySelector('.dot').classList.toggle('online', online);
  conversationState.textContent = online ? '● ONLINE' : '● OFFLINE';
  coreStatus.textContent = `● ${text}`;
}

function connect() {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  socket = new WebSocket(`${protocol}://${location.host}/ws`);
  socket.onopen = () => setStatus('Hazır', true);
  socket.onclose = () => { setStatus('Bağlantı kesildi'); setTimeout(connect, 1500); };
  socket.onerror = () => setStatus('Bağlantı hatası');
  socket.onmessage = ({ data }) => {
    const event = JSON.parse(data);
    if (event.type === 'status') setStatus(event.message, true);
    if (event.type === 'error') { add(event.message, 'error'); setStatus('Hazır', true); }
    if (event.type === 'audio') playPcm(event.data, event.sample_rate || 24000);
    if (event.type === 'interrupt') stopAudio();
    if (event.type === 'turn_complete') setStatus('Hazır', true);
    if (event.type === 'reply') add(event.message, 'assistant');
  };
}

function submit(text) {
  const clean = text.trim();
  if (!clean || socket?.readyState !== WebSocket.OPEN) return;
  add(clean, 'user');
  socket.send(JSON.stringify({ message: clean }));
  input.value = '';
}

form.addEventListener('submit', (event) => { event.preventDefault(); submit(input.value); });

function stopAudio() {
  for (const source of activeAudio) source.stop();
  activeAudio.clear();
  nextAudioTime = 0;
}

function playPcm(encoded, sampleRate) {
  if (!speechEnabled) return;
  const raw = atob(encoded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  const samples = new Int16Array(bytes.buffer);
  audioContext ||= new AudioContext();
  const buffer = audioContext.createBuffer(1, samples.length, sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i += 1) channel[i] = samples[i] / 32768;
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(audioContext.destination);
  const startAt = Math.max(audioContext.currentTime + 0.035, nextAudioTime);
  source.start(startAt);
  nextAudioTime = startAt + buffer.duration;
  activeAudio.add(source);
  source.onended = () => activeAudio.delete(source);
}

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!Recognition) {
  mic.disabled = true;
  mic.title = 'Tarayıcın sesli girişi desteklemiyor.';
} else {
  recognition = new Recognition();
  recognition.lang = 'tr-TR';
  recognition.interimResults = false;
  recognition.onstart = () => { mic.classList.add('listening'); orb.classList.add('listening'); document.querySelector('#audio-state').textContent = 'LISTENING'; setStatus('Listening', true); };
  recognition.onend = () => { mic.classList.remove('listening'); orb.classList.remove('listening'); document.querySelector('#audio-state').textContent = 'STANDBY'; if (socket?.readyState === WebSocket.OPEN) setStatus('Hazır', true); };
  recognition.onerror = () => { mic.classList.remove('listening'); orb.classList.remove('listening'); document.querySelector('#audio-state').textContent = 'ERROR'; setStatus('Mikrofon kullanılamadı', true); };
  recognition.onresult = (event) => submit(event.results[0][0].transcript);
  const startListening = () => { stopAudio(); recognition.start(); };
  mic.addEventListener('click', startListening);
  orb.addEventListener('click', startListening);
}

mute.addEventListener('click', () => {
  speechEnabled = !speechEnabled;
  if (!speechEnabled) stopAudio();
  mute.textContent = `SPEECH: ${speechEnabled ? 'ON' : 'OFF'}`;
});

function updateClock() {
  const now = new Date();
  document.querySelector('#clock').textContent = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  document.querySelector('#seconds').textContent = `:${String(now.getSeconds()).padStart(2, '0')}`;
  document.querySelector('#date').textContent = now.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase();
  document.querySelector('#day').textContent = now.toLocaleDateString('tr-TR', { weekday: 'long' }).toUpperCase();
}
updateClock();
setInterval(updateClock, 1000);
connect();
