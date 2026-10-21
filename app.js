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
  battlePreviewTitle: document.querySelector('#battlePreviewTitle'),
  battlePreviewDetails: document.querySelector('#battlePreviewDetails'),
  battlePreviewTotal: document.querySelector('#battlePreviewTotal'),
  battleStage: document.querySelector('.battle-stage'),
  playerCombatant: document.querySelector('.player-combatant'),
  playerHearts: document.querySelector('#playerHearts'),
  encounterLabel: document.querySelector('#encounterLabel'),
  enemyName: document.querySelector('#enemyName'),
  enemyAvatar: document.querySelector('#enemyAvatar'),
  enemyHealthBar: document.querySelector('#enemyHealthBar'),
  enemyHealthText: document.querySelector('#enemyHealthText'),
  battleHint: document.querySelector('#battleHint'),
  battleResult: document.querySelector('#battleResult'),
  battleResultIcon: document.querySelector('#battleResultIcon'),
  battleResultKicker: document.querySelector('#battleResultKicker'),
  battleResultTitle: document.querySelector('#battleResultTitle'),
  battleResultText: document.querySelector('#battleResultText'),
  resultCorrect: document.querySelector('#resultCorrect'),
  resultAccuracy: document.querySelector('#resultAccuracy'),
  rematch: document.querySelector('#rematchButton'),
  resultExit: document.querySelector('#resultExitButton'),
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
  battleConfig: null,
  playerHp: 0,
  playerMaxHp: 0,
  enemyIndex: 0,
  enemyHp: 0,
  enemyMaxHp: 0,
  questionStartedAt: 0,
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

const battleConfigs = {
  easy: { title: 'Лёгкий поход', playerHp: 5, enemyHp: 4, bossHp: 8 },
  medium: { title: 'Испытание героя', playerHp: 4, enemyHp: 6, bossHp: 12 },
  hard: { title: 'Последний рубеж', playerHp: 3, enemyHp: 8, bossHp: 16 },
};

const enemies = [
  { name: 'Счётный слизень', icon: '◆' },
  { name: 'Дробный разбойник', icon: '◈' },
  { name: 'Страж процентов', icon: '⬢' },
  { name: 'Повелитель чисел', icon: '♛', boss: true },
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(items) { return items[randomInt(0, items.length - 1)]; }
function normalize(value) { return Math.round(Number(value) * 100) / 100; }
function displayNumber(value) { return String(normalize(value)).replace('.', ','); }
function displayFixed(value, places) { return Number(value).toFixed(places).replace('.', ','); }

function currentSettings() {
  const operations = [...document.querySelectorAll('input[name="operation"]:checked')].map((input) => input.value);
  const difficulty = document.querySelector('input[name="difficulty"]:checked').value;
  const decimalPrecision = document.querySelector('input[name="decimalPrecision"]:checked').value;
  const recognitionLanguage = document.querySelector('input[name="recognitionLanguage"]:checked').value;
  return { operations, difficulty, decimalPrecision, recognitionLanguage, voice: elements.voiceMode.checked };
}

function generateQuestion(difficultyOverride = null) {
  const settings = currentSettings();
  const { operations, decimalPrecision } = settings;
  const difficulty = difficultyOverride || settings.difficulty;
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
    const decimalStep = decimalPrecision === 'tenths' ? 0.1 : decimalPrecision === 'hundredths' ? 0.01 : 0.05;
    const decimalPlaces = decimalPrecision === 'tenths' ? 1 : 2;
    const maxUnits = Math.round(decimalLimit / decimalStep);
    a = randomInt(2, maxUnits) * decimalStep; b = randomInt(1, maxUnits) * decimalStep;
    answer = normalize(a + b);
    visual = `${displayFixed(a, decimalPlaces)} + ${displayFixed(b, decimalPlaces)}`;
    spoken = `${displayFixed(a, decimalPlaces)} плюс ${displayFixed(b, decimalPlaces)}`;
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

function playBattleCue(type) {
  if (state.muted) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const frequencies = type === 'victory' ? [440, 660, 880] : type === 'defeat' ? [260, 210, 150] : [420, 560];
  frequencies.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + (index * .13);
    oscillator.type = type === 'defeat' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(.12, start + .02);
    gain.gain.exponentialRampToValueAtTime(.0001, start + .19);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(start); oscillator.stop(start + .2);
  });
  setTimeout(() => context.close(), 750);
}

function battleDifficulty() {
  const selected = currentSettings().difficulty;
  if (!enemies[state.enemyIndex]?.boss) return selected;
  if (selected === 'easy') return 'medium';
  return 'hard';
}

function updateBattlePreview() {
  const difficulty = document.querySelector('input[name="difficulty"]:checked').value;
  const config = battleConfigs[difficulty];
  const total = (config.enemyHp * 3) + config.bossHp;
  elements.battlePreviewTitle.textContent = config.title;
  elements.battlePreviewDetails.textContent = `${config.playerHp} жизней · враги: ${config.enemyHp} HP · босс: ${config.bossHp} HP`;
  elements.battlePreviewTotal.textContent = `Без бонусов ${total} правильных ответов до победы`;
}

function updateBattleHud() {
  const enemy = enemies[state.enemyIndex];
  const fullHearts = '♥ '.repeat(Math.max(0, state.playerHp));
  const emptyHearts = '♡ '.repeat(Math.max(0, state.playerMaxHp - state.playerHp));
  elements.playerHearts.textContent = `${fullHearts}${emptyHearts}`.trim();
  elements.playerHearts.setAttribute('aria-label', `Жизни игрока: ${state.playerHp} из ${state.playerMaxHp}`);
  elements.encounterLabel.textContent = enemy.boss ? 'Босс · финальный бой' : `Враг ${state.enemyIndex + 1} из ${enemies.length}`;
  elements.enemyName.textContent = enemy.name;
  elements.enemyAvatar.textContent = enemy.icon;
  elements.enemyHealthText.textContent = `${Math.max(0, state.enemyHp)} / ${state.enemyMaxHp} HP`;
  elements.enemyHealthBar.style.width = `${Math.max(0, (state.enemyHp / state.enemyMaxHp) * 100)}%`;
  elements.battleHint.textContent = `Без бонусов: ${state.enemyMaxHp} правильных · серия ×3 усиливает удар`;
  elements.battleStage.classList.toggle('is-boss', Boolean(enemy.boss));
}

function animateHit(target, className) {
  target.classList.remove(className);
  void target.offsetWidth;
  target.classList.add(className);
  setTimeout(() => target.classList.remove(className), 450);
}

function askNextQuestion() {
  if (!state.active) return;
  stopListening();
  state.question = generateQuestion(battleDifficulty());
  state.awaitingAnswer = true;
  elements.problem.textContent = state.question.visual;
  elements.problemKicker.textContent = operationNames[state.question.operation];
  elements.answerInput.value = '';
  elements.feedback.textContent = '';
  elements.feedback.className = 'feedback';
  elements.spokenAnswer.textContent = currentSettings().voice ? 'Слушайте вопрос…' : 'Введите ответ ниже';
  speak(state.question.spoken, () => {
    state.questionStartedAt = Date.now();
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
    state.questionStartedAt = Date.now();
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
  let value = raw.toLowerCase().trim().replace(/ё/g, 'е').replace(/,/g, '.').replace(/-/g, ' ');
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);

  const units = {
    ноль: 0, один: 1, одна: 1, одно: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9,
    десять: 10, одиннадцать: 11, двенадцать: 12, тринадцать: 13, четырнадцать: 14, пятнадцать: 15, шестнадцать: 16, семнадцать: 17, восемнадцать: 18, девятнадцать: 19,
    zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
    ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  };
  const tens = {
    двадцать: 20, тридцать: 30, сорок: 40, пятьдесят: 50, шестьдесят: 60, семьдесят: 70, восемьдесят: 80, девяносто: 90,
    twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  };
  const hundreds = { сто: 100, двести: 200, триста: 300, четыреста: 400, пятьсот: 500, шестьсот: 600, семьсот: 700, восемьсот: 800, девятьсот: 900 };
  const digitWords = { ноль: 0, один: 1, одна: 1, одно: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9, zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };
  let sign = 1;
  if (/^(?:минус|minus|negative)\s+/.test(value)) { sign = -1; value = value.replace(/^(?:минус|minus|negative)\s+/, ''); }

  let decimalParts = value.split(/\s+(?:целая|целое|целых|целую|точка|запятая|point|dot|decimal|comma|period|whole|wholes)\s+/);
  if (decimalParts.length === 1) {
    const fractionalAnd = value.match(/^(.*?)\s+(?:и|and)\s+(.+(?:десят\S*|сот\S*|тысяч\S*|tenths?|hundredths?|thousandths?))$/);
    if (fractionalAnd) decimalParts = [fractionalAnd[1], fractionalAnd[2]];
  }

  const parseInteger = (part) => {
    let total = 0; let current = 0;
    part.split(/\s+/).filter(Boolean).forEach((word) => {
      if (/^\d+$/.test(word)) current += Number(word);
      else if (word in units) current += units[word];
      else if (word in tens) current += tens[word];
      else if (word in hundreds) current += hundreds[word];
      else if (word === 'hundred') current = (current || 1) * 100;
      else if (/^тысяч/.test(word) || word === 'thousand') { total += (current || 1) * 1000; current = 0; }
    });
    return total + current;
  };
  let result = parseInteger(decimalParts[0]);
  if (decimalParts[1]) {
    const decimalText = decimalParts[1];
    const decimalTokens = decimalText.split(/\s+/).filter((word) => word && !/^(?:и|and|десятая|десятые|десятых|сотая|сотые|сотых|тысячная|тысячные|тысячных|tenth|tenths|hundredth|hundredths|thousandth|thousandths)$/.test(word));
    const digitSequence = decimalTokens.length > 0 && decimalTokens.every((word) => word in digitWords || /^\d$/.test(word));
    const decimal = digitSequence
      ? Number(decimalTokens.map((word) => (/^\d$/.test(word) ? word : digitWords[word])).join(''))
      : parseInteger(decimalText);
    let denominator;
    if (/десят|tenths?/.test(decimalText)) denominator = 10;
    else if (/сот|hundredths?/.test(decimalText)) denominator = 100;
    else if (/тысяч|thousandths?/.test(decimalText)) denominator = 1000;
    else denominator = 10 ** (digitSequence ? decimalTokens.length : Math.max(1, String(decimal).length));
    result += decimal / denominator;
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
  elements.spokenAnswer.textContent = `Ваш ответ: ${String(rawAnswer).trim()}`;
  playTone(isCorrect);
  clearTimeout(state.nextTimer);

  if (isCorrect) {
    const quick = Date.now() - state.questionStartedAt <= 8000;
    const combo = state.streak % 3 === 0;
    const damage = 1 + (quick ? 1 : 0) + (combo ? 1 : 0);
    state.enemyHp = Math.max(0, state.enemyHp - damage);
    updateBattleHud();
    animateHit(elements.enemyAvatar, 'enemy-hit');
    const bonuses = [quick ? 'быстро' : '', combo ? 'серия ×3' : ''].filter(Boolean).join(' + ');
    elements.feedback.className = 'feedback correct';
    elements.feedback.textContent = `Верно! Урон: ${damage}${bonuses ? ` · ${bonuses}` : ''}`;
    if (state.enemyHp <= 0) {
      state.awaitingAnswer = false;
      state.nextTimer = setTimeout(handleEnemyDefeated, 900);
    } else {
      state.nextTimer = setTimeout(askNextQuestion, 900);
    }
    return;
  }

  state.playerHp = Math.max(0, state.playerHp - 1);
  updateBattleHud();
  animateHit(elements.playerCombatant, 'player-hit');
  elements.feedback.className = 'feedback wrong';
  elements.feedback.textContent = `Неверно. Противник атакует — осталось жизней: ${state.playerHp}`;
  if (state.playerHp <= 0) {
    state.nextTimer = setTimeout(() => endBattle(false), 900);
  } else {
    state.nextTimer = setTimeout(() => retryCurrentQuestion('Ещё раз'), 1400);
  }
}

function handleEnemyDefeated() {
  if (!state.active) return;
  const defeated = enemies[state.enemyIndex];
  if (defeated.boss) {
    endBattle(true);
    return;
  }
  playBattleCue('enemy');
  elements.feedback.className = 'feedback correct';
  elements.feedback.textContent = `${defeated.name} повержен!`;
  state.enemyIndex += 1;
  state.enemyMaxHp = enemies[state.enemyIndex].boss ? state.battleConfig.bossHp : state.battleConfig.enemyHp;
  state.enemyHp = state.enemyMaxHp;
  updateBattleHud();
  const nextEnemy = enemies[state.enemyIndex];
  state.nextTimer = setTimeout(() => {
    speak(`${nextEnemy.boss ? 'Внимание, босс' : 'Новый противник'}: ${nextEnemy.name}`, askNextQuestion);
  }, 850);
}

function endBattle(victory) {
  state.active = false;
  state.awaitingAnswer = false;
  clearTimeout(state.nextTimer);
  clearSpeechTimer();
  stopListening();
  window.speechSynthesis?.cancel();
  state.wakeLock?.release(); state.wakeLock = null;
  playBattleCue(victory ? 'victory' : 'defeat');
  const accuracy = state.answered ? `${Math.round((state.correct / state.answered) * 100)}%` : '—';
  elements.resultCorrect.textContent = state.correct;
  elements.resultAccuracy.textContent = accuracy;
  elements.battleResult.classList.toggle('defeat', !victory);
  elements.battleResultIcon.textContent = victory ? '★' : '×';
  elements.battleResultKicker.textContent = victory ? 'Маршрут пройден' : 'Забег завершён';
  elements.battleResultTitle.textContent = victory ? 'Победа!' : 'Поражение';
  elements.battleResultText.textContent = victory
    ? 'Повелитель чисел побеждён. Герой выдержал все четыре сражения.'
    : `${enemies[state.enemyIndex].name} оказался сильнее. Попробуйте ещё раз или измените сложность.`;
  elements.battleResult.classList.remove('is-hidden');
  speak(victory ? 'Победа! Повелитель чисел побежден.' : 'Поражение. Попробуйте еще раз.');
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
  try {
    state.recognition.lang = currentSettings().recognitionLanguage;
    state.recognition.start();
  } catch { /* Браузер ещё завершает предыдущую сессию. */ }
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
  state.battleConfig = battleConfigs[settings.difficulty];
  state.playerMaxHp = state.battleConfig.playerHp; state.playerHp = state.playerMaxHp;
  state.enemyIndex = 0; state.enemyMaxHp = state.battleConfig.enemyHp; state.enemyHp = state.enemyMaxHp;
  requestWakeLock();
  elements.correct.textContent = '0'; elements.streak.textContent = '0'; elements.accuracy.textContent = '—';
  elements.setup.classList.add('is-hidden'); elements.training.classList.remove('is-hidden');
  elements.battleResult.classList.add('is-hidden');
  elements.battleResult.classList.remove('defeat');
  updateBattleHud();
  elements.mode.textContent = settings.voice && SpeechRecognition ? 'Бой · голосовой режим' : 'Бой · режим с экраном';
  elements.training.scrollIntoView({ behavior: 'smooth', block: 'start' });
  askNextQuestion();
}

function stopSession() {
  state.active = false; state.awaitingAnswer = false; clearTimeout(state.nextTimer); clearSpeechTimer(); stopListening(); window.speechSynthesis?.cancel();
  state.wakeLock?.release(); state.wakeLock = null;
  elements.battleResult.classList.add('is-hidden');
  elements.training.classList.add('is-hidden'); elements.setup.classList.remove('is-hidden');
  elements.setup.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

elements.start.addEventListener('click', startSession);
elements.stop.addEventListener('click', stopSession);
elements.rematch.addEventListener('click', startSession);
elements.resultExit.addEventListener('click', stopSession);
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
  document.querySelector('input[name="decimalPrecision"][value="tenths"]').checked = true;
  document.querySelector('input[name="recognitionLanguage"][value="ru-RU"]').checked = true;
  elements.voiceMode.checked = true;
  updateBattlePreview();
});
document.querySelectorAll('input[name="difficulty"]').forEach((input) => input.addEventListener('change', updateBattlePreview));
document.addEventListener('visibilitychange', () => { if (state.active && document.visibilityState === 'visible') requestWakeLock(); });

if (!SpeechRecognition) {
  elements.voiceSupport.textContent = 'Голосовой ответ не поддерживается — доступен ввод с экрана';
  elements.voiceMode.checked = false; elements.voiceMode.disabled = true; elements.mic.disabled = true;
}

setupRecognition();
updateBattlePreview();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js');
