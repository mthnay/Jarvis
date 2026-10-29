const messages = document.querySelector('#messages');
const form = document.querySelector('#composer');
const input = document.querySelector('#message');
const status = document.querySelector('#status');
const mic = document.querySelector('#mic');
const send = document.querySelector('#send');
let socket;
let recognition;

function add(text, kind) {
  const item = document.createElement('article');
  item.className = `message ${kind}`;
  item.textContent = text;
  messages.append(item);
  messages.scrollTop = messages.scrollHeight;
}

function setStatus(text, online = false) {
  status.textContent = text;
  document.querySelector('.dot').classList.toggle('online', online);
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
  if (!('speechSynthesis' in window)) return;
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
  recognition.onstart = () => { mic.classList.add('listening'); setStatus('Dinliyorum...', true); };
  recognition.onend = () => { mic.classList.remove('listening'); if (socket?.readyState === WebSocket.OPEN) setStatus('Hazır', true); };
  recognition.onerror = () => { mic.classList.remove('listening'); setStatus('Mikrofon kullanılamadı', true); };
  recognition.onresult = (event) => submit(event.results[0][0].transcript);
  mic.addEventListener('click', () => { speechSynthesis.cancel(); recognition.start(); });
}
connect();
