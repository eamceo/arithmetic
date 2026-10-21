const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const elements = {
  setup: document.querySelector('#setupPanel'),
  training: document.querySelector('#trainingPanel'),
  start: document.querySelector('#startButton'),
  stop: document.querySelector('#stopButton'),
  reset: document.querySelector('#resetSettings'),
  sound: document.querySelector('#soundToggle'),
  voiceMode: document.querySelector('#voiceMode'),
  voiceSupport: document.querySelector('#voiceSupportText'),
  problem: document.querySelector('#trainingTitle'),
  problemKicker: document.querySelector('#problemKicker'),
  spokenAnswer: document.querySelector('#spokenAnswer'),
  answerForm: document.querySelector('#answerForm'),
  answerInput: document.querySelector('#answerInput'),
  mic: document.querySelector('#micButton'),
  repeat: document.querySelector('#repeatButton'),
  feedback: document.querySelector('#feedback'),
  correct: document.querySelector('#correctCount'),
  streak: document.querySelector('#streakCount'),
  accuracy: document.querySelector('#accuracyCount'),
  mode: document.querySelector('#sessionMode'),
};

const state = {
  active: false,
  muted: false,
  listening: false,
  awaitingAnswer: false,
  question: null,
  answered: 0,
  correct: 0,
  streak: 0,
  recognition: null,
  wakeLock: null,
  nextTimer: null,
  speechTimer: null,
};

const ranges = {
  easy: { add: 20, multiply: 5, decimal: 10 },
  medium: { add: 100, multiply: 12, decimal: 50 },
  hard: { add: 1000, multiply: 25, decimal: 100 },
};

const operationNames = {
  add: 'сложение', subtract: 'вычитание', multiply: 'умножение',
  divide: 'деление', decimal: 'дроби', percent: 'проценты',
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(items) { return items[randomInt(0, items.length - 1)]; }
function normalize(value) { return Math.round(Number(value) * 100) / 100; }
function displayNumber(value) { return String(normalize(value)).replace('.', ','); }

function currentSettings() {
  const operations = [...document.querySelectorAll('input[name="operation"]:checked')].map((input) => input.value);
  const difficulty = document.querySelector('input[name="difficulty"]:checked').value;
  return { operations, difficulty, voice: elements.voiceMode.checked };
}

function generateQuestion() {
  const { operations, difficulty } = currentSettings();
  const operation = pick(operations);
  const limit = ranges[difficulty].add;
  let a; let b; let answer; let visual; let spoken;

  if (operation === 'add') {
    a = randomInt(2, limit); b = randomInt(2, limit);
    answer = a + b; visual = `${a} + ${b}`; spoken = `${a} плюс ${b}`;
  } else if (operation === 'subtract') {
    a = randomInt(3, limit); b = randomInt(2, a);
    answer = a - b; visual = `${a} − ${b}`; spoken = `${a} минус ${b}`;
  } else if (operation === 'multiply') {
    const multiplier = ranges[difficulty].multiply;
    a = randomInt(2, multiplier); b = randomInt(2, multiplier);
    answer = a * b; visual = `${a} × ${b}`; spoken = `${a} умножить на ${b}`;
  } else if (operation === 'divide') {
    const multiplier = ranges[difficulty].multiply;
    b = randomInt(2, multiplier); answer = randomInt(2, multiplier); a = b * answer;
    visual = `${a} ÷ ${b}`; spoken = `${a} разделить на ${b}`;
  } else if (operation === 'decimal') {
    const decimalLimit = ranges[difficulty].decimal;
    a = randomInt(2, decimalLimit * 10) / 10; b = randomInt(1, decimalLimit * 10) / 10;
    answer = normalize(a + b); visual = `${displayNumber(a)} + ${displayNumber(b)}`;
    spoken = `${displayNumber(a)} плюс ${displayNumber(b)}`;
  } else {
    const percentages = difficulty === 'easy' ? [10, 50] : difficulty === 'medium' ? [5, 10, 20, 25, 50] : [2, 5, 10, 12.5, 15, 20, 25, 30, 40, 50, 75];
    const percent = pick(percentages);
    const baseStep = percent === 12.5 ? 8 : (100 / Math.round(percent));
    b = randomInt(2, difficulty === 'hard' ? 40 : 20) * baseStep;
    answer = normalize((percent / 100) * b);
    visual = `${displayNumber(percent)}% от ${displayNumber(b)}`;
    spoken = `${displayNumber(percent)} процентов от ${displayNumber(b)}`;
  }
  return { operation, answer: normalize(answer), visual, spoken };
}

function speak(text, after) {
  if (state.muted || !('speechSynthesis' in window)) { after?.(); return; }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ru-RU'; utterance.rate = 0.94; utterance.pitch = 1;
  utterance.onend = () => after?.();
  utterance.onerror = () => after?.();
  window.speechSynthesis.speak(utterance);
}

function playTone(correct) {
  if (state.muted) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = correct ? 'sine' : 'triangle';
  oscillator.frequency.setValueAtTime(correct ? 660 : 180, context.currentTime);
  if (correct) oscillator.frequency.exponentialRampToValueAtTime(900, context.currentTime + .12);
  gain.gain.setValueAtTime(.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(.16, context.currentTime + .015);
  gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .2);
  oscillator.connect(gain); gain.connect(context.destination);
  oscillator.start(); oscillator.stop(context.currentTime + .22);
  oscillator.onended = () => context.close();
}

function askNextQuestion() {
  if (!state.active) return;
  stopListening();
  state.question = generateQuestion();
  state.awaitingAnswer = true;
  elements.problem.textContent = state.question.visual;
  elements.problemKicker.textContent = operationNames[state.question.operation];
  elements.answerInput.value = '';
  elements.feedback.textContent = '';
  elements.feedback.className = 'feedback';
  elements.spokenAnswer.textContent = currentSettings().voice ? 'Слушайте вопрос…' : 'Введите ответ ниже';
  speak(state.question.spoken, () => {
    if (state.active && currentSettings().voice) startListening();
    else elements.answerInput.focus();
  });
}

function retryCurrentQuestion(announcement = '') {
  if (!state.active || !state.question) return;
  elements.answerInput.value = '';
  elements.feedback.textContent = '';
  elements.feedback.className = 'feedback';
  elements.spokenAnswer.textContent = currentSettings().voice ? 'Слушайте тот же вопрос…' : 'Попробуйте ещё раз';
  const prompt = announcement ? `${announcement}. ${state.question.spoken}` : state.question.spoken;
  speak(prompt, () => {
    state.awaitingAnswer = true;
    if (state.active && currentSettings().voice) startListening();
    else elements.answerInput.focus();
  });
}

function clearSpeechTimer() {
  clearTimeout(state.speechTimer);
  state.speechTimer = null;
}

function startSpeechTimer() {
  if (state.speechTimer) return;
  state.speechTimer = setTimeout(() => {
    if (!state.active || !state.awaitingAnswer) return;
    state.awaitingAnswer = false;
    stopListening();
    elements.spokenAnswer.textContent = 'Не успели закончить. Ещё раз…';
    clearTimeout(state.nextTimer);
    state.nextTimer = setTimeout(() => retryCurrentQuestion('Ещё раз'), 350);
  }, 4000);
}

function wordsToNumber(raw) {
  let value = raw.toLowerCase().trim().replace(/ё/g, 'е').replace(/,/g, '.');
  const numeric = value.match(/-?\d+(?:\.\d+)?/);
  if (numeric) return Number(numeric[0]);

  const units = { ноль: 0, один: 1, одна: 1, одно: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9, десять: 10, одиннадцать: 11, двенадцать: 12, тринадцать: 13, четырнадцать: 14, пятнадцать: 15, шестнадцать: 16, семнадцать: 17, восемнадцать: 18, девятнадцать: 19 };
  const tens = { двадцать: 20, тридцать: 30, сорок: 40, пятьдесят: 50, шестьдесят: 60, семьдесят: 70, восемьдесят: 80, девяносто: 90 };
  const hundreds = { сто: 100, двести: 200, триста: 300, четыреста: 400, пятьсот: 500, шестьсот: 600, семьсот: 700, восемьсот: 800, девятьсот: 900 };
  let sign = 1;
  if (value.startsWith('минус ')) { sign = -1; value = value.slice(6); }
  const decimalParts = value.split(/\s+(?:целых|целая|целое|точка|запятая)\s+/);
  const parseInteger = (part) => {
    let total = 0;
    part.split(/\s+/).forEach((word) => {
      if (word in units) total += units[word];
      else if (word in tens) total += tens[word];
      else if (word in hundreds) total += hundreds[word];
      else if (word.startsWith('тысяч')) total *= 1000;
    });
    return total;
  };
  let result = parseInteger(decimalParts[0]);
  if (decimalParts[1]) {
    const decimal = parseInteger(decimalParts[1]);
    const digits = decimalParts[1].split(/\s+/).length === 1 ? String(decimal).length : decimalParts[1].split(/\s+/).length;
    result += decimal / (10 ** digits);
  }
  return sign * result;
}

function checkAnswer(rawAnswer) {
  if (!state.active || !state.awaitingAnswer || !state.question || !String(rawAnswer).trim()) return;
  clearSpeechTimer();
  state.awaitingAnswer = false;
  stopListening();
  const parsed = wordsToNumber(String(rawAnswer));
  const isCorrect = Number.isFinite(parsed) && Math.abs(parsed - state.question.answer) < .001;
  state.answered += 1;
  if (isCorrect) { state.correct += 1; state.streak += 1; }
  else state.streak = 0;
  elements.correct.textContent = state.correct;
  elements.streak.textContent = state.streak;
  elements.accuracy.textContent = `${Math.round((state.correct / state.answered) * 100)}%`;
  elements.feedback.className = `feedback ${isCorrect ? 'correct' : 'wrong'}`;
  elements.feedback.textContent = isCorrect ? 'Верно!' : 'Неверно. Попробуйте ещё раз.';
  elements.spokenAnswer.textContent = `Ваш ответ: ${String(rawAnswer).trim()}`;
  playTone(isCorrect);
  clearTimeout(state.nextTimer);
  state.nextTimer = setTimeout(isCorrect ? askNextQuestion : retryCurrentQuestion, isCorrect ? 900 : 1400);
}

function setupRecognition() {
  if (!SpeechRecognition) return;
  state.recognition = new SpeechRecognition();
  state.recognition.lang = 'ru-RU';
  state.recognition.interimResults = true;
  state.recognition.continuous = false;
  state.recognition.onstart = () => {
    state.listening = true; elements.mic.classList.add('is-listening'); elements.spokenAnswer.textContent = 'Слушаю ваш ответ…';
  };
  state.recognition.onresult = (event) => {
    if (!state.awaitingAnswer) return;
    startSpeechTimer();
    let transcript = '';
    let isFinal = false;
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      transcript += event.results[index][0].transcript;
      if (event.results[index].isFinal) isFinal = true;
    }
    elements.answerInput.value = transcript.trim();
    elements.spokenAnswer.textContent = `Говорите… ${transcript.trim()}`;
    if (isFinal) checkAnswer(transcript);
  };
  state.recognition.onerror = (event) => {
    if (event.error !== 'aborted') elements.spokenAnswer.textContent = 'Не расслышал. Нажмите микрофон или введите ответ.';
  };
  state.recognition.onend = () => {
    state.listening = false;
    elements.mic.classList.remove('is-listening');
    if (state.active && state.awaitingAnswer && currentSettings().voice) {
      setTimeout(startListening, 300);
    }
  };
}

function startListening() {
  if (!state.recognition || state.listening || !state.active) return;
  try { state.recognition.start(); } catch { /* Браузер ещё завершает предыдущую сессию. */ }
}

function stopListening() {
  clearSpeechTimer();
  if (!state.recognition || !state.listening) return;
  try { state.recognition.abort(); } catch { /* Сессия уже закрыта. */ }
  state.listening = false; elements.mic.classList.remove('is-listening');
}

async function requestWakeLock() {
  if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try { state.wakeLock = await navigator.wakeLock.request('screen'); } catch { /* Устройство может не поддерживать блокировку сна. */ }
}

function startSession() {
  const settings = currentSettings();
  if (!settings.operations.length) {
    elements.start.textContent = 'Выберите хотя бы одно действие';
    setTimeout(() => { elements.start.innerHTML = '<span>Начать тренировку</span><span aria-hidden="true">→</span>'; }, 1800);
    return;
  }
  state.active = true; state.answered = 0; state.correct = 0; state.streak = 0;
  requestWakeLock();
  elements.correct.textContent = '0'; elements.streak.textContent = '0'; elements.accuracy.textContent = '—';
  elements.setup.classList.add('is-hidden'); elements.training.classList.remove('is-hidden');
  elements.mode.textContent = settings.voice && SpeechRecognition ? 'Голосовой режим' : 'Режим с экраном';
  elements.training.scrollIntoView({ behavior: 'smooth', block: 'start' });
  askNextQuestion();
}

function stopSession() {
  state.active = false; state.awaitingAnswer = false; clearTimeout(state.nextTimer); clearSpeechTimer(); stopListening(); window.speechSynthesis?.cancel();
  state.wakeLock?.release(); state.wakeLock = null;
  elements.training.classList.add('is-hidden'); elements.setup.classList.remove('is-hidden');
  elements.setup.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

elements.start.addEventListener('click', startSession);
elements.stop.addEventListener('click', stopSession);
elements.answerForm.addEventListener('submit', (event) => { event.preventDefault(); checkAnswer(elements.answerInput.value); });
elements.mic.addEventListener('click', () => state.listening ? stopListening() : startListening());
elements.repeat.addEventListener('click', () => {
  if (!state.question) return;
  state.awaitingAnswer = false;
  stopListening();
  speak(state.question.spoken, () => {
    state.awaitingAnswer = true;
    if (currentSettings().voice) startListening();
  });
});
elements.sound.addEventListener('click', () => {
  state.muted = !state.muted; elements.sound.innerHTML = `<span aria-hidden="true">${state.muted ? '×)' : '◖))'}</span>`;
  elements.sound.setAttribute('aria-label', state.muted ? 'Включить звук' : 'Выключить звук');
  if (state.muted) window.speechSynthesis?.cancel();
});
elements.reset.addEventListener('click', () => {
  document.querySelectorAll('input[name="operation"]').forEach((input) => { input.checked = ['add', 'subtract'].includes(input.value); });
  document.querySelector('input[name="difficulty"][value="easy"]').checked = true;
  elements.voiceMode.checked = true;
});
document.addEventListener('visibilitychange', () => { if (state.active && document.visibilityState === 'visible') requestWakeLock(); });

if (!SpeechRecognition) {
  elements.voiceSupport.textContent = 'Голосовой ответ не поддерживается — доступен ввод с экрана';
  elements.voiceMode.checked = false; elements.voiceMode.disabled = true; elements.mic.disabled = true;
}

setupRecognition();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js');
