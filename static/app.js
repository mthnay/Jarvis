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
    if (event.type === 'reply') { add(event.message, 'assistant'); speak(event.message); setStatus('Hazır', true); }
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

function speak(text) {
  if (!speechEnabled || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'tr-TR';
  speechSynthesis.speak(utterance);
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
  const startListening = () => { speechSynthesis.cancel(); recognition.start(); };
  mic.addEventListener('click', startListening);
  orb.addEventListener('click', startListening);
}

mute.addEventListener('click', () => {
  speechEnabled = !speechEnabled;
  if (!speechEnabled && 'speechSynthesis' in window) speechSynthesis.cancel();
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
