const $ = (selector) => document.querySelector(selector);
const toast = $('#toast');
const profileName = $('#profileName');
const contrastBtn = $('#contrastBtn');
let toastTimer;

// One-time clean start for the final hand-off. New choices and pathways still save normally afterwards.
try {
  const resetKey = 'unDekhaFinalReset20260823';
  if (localStorage.getItem(resetKey) !== 'complete') {
    ['unDekhaLibrary', 'unDekhaLibraryV2', 'unDekhaLibraryFinal', 'unDekhaStudentName', 'unDekhaTheme', 'unDekhaVoice'].forEach((key) => localStorage.removeItem(key));
    localStorage.setItem(resetKey, 'complete');
  }
} catch (_) { /* Storage is optional. */ }

function notify(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function initialsFor(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'ST';
}

function applyStudentName(name) {
  const safeName = name.trim() || 'Student';
  document.querySelectorAll('.student-name').forEach((element) => { element.textContent = safeName; });
  $('#profileInitials').textContent = initialsFor(safeName);
  profileName.value = safeName === 'Student' ? '' : safeName;
  try { localStorage.setItem('unDekhaStudentName', safeName); } catch (_) { /* Optional browser-only convenience. */ }
}

try { applyStudentName(localStorage.getItem('unDekhaStudentName') || 'Student'); } catch (_) { applyStudentName('Student'); }

function applyTheme(theme) {
  const darkMode = theme === 'dark';
  document.body.classList.toggle('dark-mode', darkMode);
  contrastBtn.setAttribute('aria-pressed', String(darkMode));
  contrastBtn.setAttribute('aria-label', darkMode ? 'Disable dark mode' : 'Enable dark mode');
  contrastBtn.querySelector('span').textContent = darkMode ? '☀' : '☾';
  try { localStorage.setItem('unDekhaTheme', darkMode ? 'dark' : 'light'); } catch (_) { /* Theme still works for this visit. */ }
}

try { applyTheme(localStorage.getItem('unDekhaTheme') || 'light'); } catch (_) { applyTheme('light'); }

const conversionDialog = $('#conversionDialog');
const textDialog = $('#textDialog');
const profileDialog = $('#profileDialog');
const pathwayDialog = $('#pathwayDialog');
const learningFormatDialog = $('#learningFormatDialog');
const entryStep = $('#entryStep');
const processingStep = $('#processingStep');
const resultStep = $('#resultStep');
const libraryGrid = $('#libraryGrid');
const libraryStatus = $('#libraryStatus');
const startConversionButton = $('#startConversion');
const libraryStorageKey = 'unDekhaLibraryFinal';
let currentResource = 'your material';
let selectedUpload = null;
let activeLibraryEntry = null;
let isConverting = false;
let activeLearningFormat = null;
let audioUtterance = null;
let captionTimer = null;
let audioCaptionTimer = null;
let conversionTimer = null;
let conversionLabelTimer = null;

try {
  localStorage.removeItem('unDekhaLibrary');
  localStorage.removeItem('unDekhaLibraryV2');
} catch (_) { /* Storage is optional. */ }

function cancelConversion() {
  if (conversionTimer) window.clearTimeout(conversionTimer);
  if (conversionLabelTimer) window.clearInterval(conversionLabelTimer);
  conversionTimer = null;
  conversionLabelTimer = null;
  isConverting = false;
  startConversionButton.disabled = false;
}

function showDialog(dialog) {
  if (typeof dialog.showModal === 'function') {
    if (!dialog.open) dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
}

function hideDialog(dialog) {
  if (typeof dialog.close === 'function' && dialog.open) {
    dialog.close();
  } else {
    dialog.removeAttribute('open');
  }
}

function resetConversion(resourceName = 'your material') {
  cancelConversion();
  currentResource = resourceName;
  $('#resourceName').textContent = resourceName;
  entryStep.classList.remove('hidden');
  processingStep.classList.add('hidden');
  resultStep.classList.add('hidden');
  $('#dialogCopy').textContent = resourceName === 'your material'
    ? 'Choose the formats you’d like UN-देखा to create. You can adjust these anytime.'
    : `We found “${resourceName}”. Choose the formats you’d like UN-देखा to create.`;
}

function openConversion(resourceName) {
  resetConversion(resourceName);
  showDialog(conversionDialog);
}

const fileInput = $('#fileInput');
const dropZone = $('#dropZone');
const browseFiles = $('#browseFiles');
const uploadTitle = $('#uploadTitle');
const uploadStatus = $('#uploadStatus');
const supportedExtensions = new Set(['pdf', 'doc', 'docx', 'ppt', 'pptx', 'txt', 'mp3', 'mp4']);

function getFileExtension(file) {
  const name = file.name || '';
  return name.includes('.') ? name.split('.').pop().toLowerCase() : '';
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function updateUploadStatus(file, errorMessage = '') {
  dropZone.classList.toggle('has-file', Boolean(file) && !errorMessage);
  dropZone.classList.toggle('upload-error', Boolean(errorMessage));
  uploadStatus.classList.toggle('visible', Boolean(file) || Boolean(errorMessage));

  if (errorMessage) {
    uploadTitle.textContent = 'Choose a supported study resource';
    uploadStatus.textContent = errorMessage;
    return;
  }

  uploadTitle.textContent = `Ready to convert: ${file.name}`;
  uploadStatus.textContent = `${getFileExtension(file).toUpperCase()} file received${formatBytes(file.size) ? ` · ${formatBytes(file.size)}` : ''}. Opening your format choices…`;
}

function handleSelectedFile(file) {
  if (!file) return;
  const extension = getFileExtension(file);
  if (!supportedExtensions.has(extension)) {
    const message = 'Please choose a PDF, PPT/PPTX, DOCX, text, audio, or video file.';
    updateUploadStatus(null, message);
    notify(message);
    return;
  }

  selectedUpload = {
    source: extension.toUpperCase(),
    size: formatBytes(file.size),
    originalName: file.name
  };
  updateUploadStatus(file);
  window.setTimeout(() => openConversion(file.name.replace(/\.[^.]+$/, '') || 'your study resource'), 220);
}

function loadLibraryEntries() {
  try {
    const entries = JSON.parse(localStorage.getItem(libraryStorageKey) || '[]');
    return Array.isArray(entries) ? entries.filter((entry) => entry && entry.id && entry.title) : [];
  } catch (_) {
    return [];
  }
}

function saveLibraryEntry(entry) {
  const entries = loadLibraryEntries();
  entries.push(entry);
  try { localStorage.setItem(libraryStorageKey, JSON.stringify(entries.slice(-20))); } catch (_) { /* The current session still works. */ }
}

function resetLibrary() {
  try { localStorage.removeItem(libraryStorageKey); } catch (_) { /* The current session still works. */ }
  activeLibraryEntry = null;
  libraryGrid.replaceChildren();
  $('#conceptMapPanel').classList.add('hidden');
  $('#emptyLibrary').hidden = false;
  updateLibraryStatus();
  notify('Your library has been reset and is ready for new resources.');
}

function deriveTopics(title, sourceText = '') {
  const ignored = new Set(['about', 'after', 'again', 'also', 'another', 'been', 'before', 'between', 'chapter', 'course', 'document', 'from', 'guide', 'into', 'lesson', 'material', 'notes', 'overview', 'pdf', 'ppt', 'presentation', 'resource', 'study', 'that', 'their', 'there', 'these', 'this', 'topic', 'using', 'with', 'your']);
  const words = `${title} ${sourceText}`.toLowerCase().match(/[a-z]{3,}/g) || [];
  const counts = new Map();
  words.filter((word) => !ignored.has(word)).forEach((word) => counts.set(word, (counts.get(word) || 0) + 1));
  const topics = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([word]) => word);
  return (topics.length ? topics : ['core idea', 'key relationship', 'application']).slice(0, 4);
}

function titleCase(topic) {
  return topic.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildLearningProfile(title, sourceText = '') {
  const topics = deriveTopics(title, sourceText);
  const main = titleCase(topics[0]);
  const support = titleCase(topics[1] || 'Key Relationships');
  const application = titleCase(topics[2] || 'Practical Application');
  const sourceSummary = sourceText.trim().replace(/\s+/g, ' ').slice(0, 220);
  return {
    topics,
    summary: sourceSummary || `${title} is organized here as a clear learning pathway. Start with ${main}, connect it to ${support}, then use ${application} to check how the ideas work together.`,
    essential: [`Identify the central idea: ${main}.`, `Explain how ${main} relates to ${support}.`, `Use ${application} to apply or review the material.`],
    flow: [
      { label: 'Input', detail: `Start with the resource and identify its central topic: ${main}.` },
      { label: 'Key idea', detail: `Focus on the meaning of ${main} before moving to supporting details.` },
      { label: 'Connection', detail: `Link ${main} with ${support}; this is the relationship to remember.` },
      { label: 'Outcome', detail: `Use ${application} to test understanding and revisit any unclear point.` }
    ]
  };
}

function selectedFormats() {
  return Array.from(document.querySelectorAll('.format-options input:checked'))
    .map((input) => input.closest('label').querySelector('strong').textContent);
}

function formatIcon(format) {
  if (format === 'Audio lesson') return '◖';
  if (format === 'Simple notes') return 'Aa';
  if (format === 'Captions') return '≋';
  return '◈';
}

function updateLibraryStatus() {
  const count = loadLibraryEntries().length;
  $('#emptyLibrary').hidden = count > 0;
  libraryStatus.textContent = count
    ? `${count} saved learning pathway${count === 1 ? '' : 's'} · Open a pathway or explore the concept map below.`
    : 'Your library is ready for your first resource.';
  renderConceptMap();
}

function connectionTopics(entries) {
  const topicCount = new Map();
  entries.forEach((entry) => {
    const topics = (entry.profile?.topics || deriveTopics(entry.title)).slice(0, 4);
    new Set(topics).forEach((topic) => topicCount.set(topic, (topicCount.get(topic) || 0) + 1));
  });
  return [...topicCount.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([topic]) => topic)
    .slice(0, 3);
}

function renderConceptMap() {
  const entries = loadLibraryEntries();
  const panel = $('#conceptMapPanel');
  const canvas = $('#conceptMapCanvas');
  const intro = $('#conceptMapIntro');
  const detail = $('#conceptMapDetail');
  if (!entries.length) {
    panel.classList.add('hidden');
    canvas.replaceChildren();
    return;
  }
  panel.classList.remove('hidden');
  const shared = connectionTopics(entries);
  const connectionText = shared.length ? shared.map(titleCase).join(' · ') : 'resource themes and review sequence';
  intro.textContent = entries.length === 1
    ? 'Add another resource to reveal cross-resource connections. This first node is ready to grow.'
    : `${entries.length} resources connected through ${connectionText}. Select a resource to inspect its role in the map.`;
  canvas.replaceChildren(...entries.map((entry) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'concept-resource';
    button.dataset.conceptEntryId = entry.id;
    button.setAttribute('role', 'listitem');
    button.setAttribute('aria-pressed', String(entry.id === activeLibraryEntry?.id));
    const topics = entry.profile?.topics || deriveTopics(entry.title);
    button.append(learningElement('strong', '', entry.title), learningElement('small', '', topics.slice(0, 2).map(titleCase).join(' · ')));
    return button;
  }));
  detail.textContent = entries.length === 1
    ? `Current map: ${entries[0].title} is organized around ${(entries[0].profile?.topics || deriveTopics(entries[0].title)).slice(0, 3).map(titleCase).join(', ')}.`
    : `Map insight: the pathway helps you compare resources around ${connectionText}.`;
}

function selectConceptEntry(entryId) {
  const entry = loadLibraryEntries().find((item) => item.id === entryId);
  if (!entry) return;
  activeLibraryEntry = entry;
  const topics = entry.profile?.topics || deriveTopics(entry.title);
  document.querySelectorAll('[data-concept-entry-id]').forEach((node) => node.setAttribute('aria-pressed', String(node.dataset.conceptEntryId === entry.id)));
  $('#conceptMapDetail').textContent = `${entry.title}: key themes are ${topics.slice(0, 3).map(titleCase).join(', ')}. Open the pathway to explore its audio, notes, captions, and flowchart.`;
}

function createLibraryCard(entry, isNew = false) {
  const card = document.createElement('article');
  card.className = `continue-card generated-card${isNew ? ' new-pathway' : ''}`;

  const top = document.createElement('div');
  top.className = 'resource-top';
  const icon = document.createElement('span');
  icon.className = 'doc-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '▤';
  const tag = document.createElement('span');
  tag.className = 'tag purple';
  tag.textContent = 'PATHWAY READY';
  top.append(icon, tag);

  const title = document.createElement('h3');
  title.textContent = entry.title;
  const details = document.createElement('p');
  details.textContent = `${entry.source || 'STUDY'} · Created ${entry.createdLabel || 'just now'}`;
  const summary = document.createElement('span');
  summary.className = 'library-format-summary';
  summary.textContent = entry.outputs.join(' · ');

  const footer = document.createElement('div');
  footer.className = 'continue-footer';
  const size = document.createElement('span');
  size.className = 'library-format-summary';
  size.textContent = entry.size ? `${entry.size} resource` : 'Accessible formats ready';
  const open = document.createElement('button');
  open.className = 'play-button';
  open.type = 'button';
  open.dataset.libraryId = entry.id;
  open.innerHTML = '<span aria-hidden="true">▶</span> Open';
  footer.append(size, open);

  card.append(top, title, details, summary, footer);
  libraryGrid.prepend(card);
}

function createPathwayEntry() {
  const outputs = selectedFormats();
  if (!outputs.length) return null;
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: currentResource,
    source: selectedUpload?.source || 'TEXT',
    size: selectedUpload?.size || '',
    outputs,
    createdLabel: 'just now',
    profile: buildLearningProfile(currentResource, selectedUpload?.text || '')
  };
  saveLibraryEntry(entry);
  activeLibraryEntry = entry;
  createLibraryCard(entry, true);
  updateLibraryStatus();
  $('#resultSummary').textContent = `UN-देखा created ${outputs.length} accessible format${outputs.length === 1 ? '' : 's'} for ${entry.title}. Your pathway is saved in My library.`;
  const chips = $('#resultChips');
  chips.replaceChildren(...outputs.map((format) => {
    const chip = document.createElement('span');
    chip.textContent = `${formatIcon(format)} ${format}`;
    return chip;
  }));
  return entry;
}

function showLibrary() {
  const library = $('#library');
  library.classList.add('is-visible');
  library.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.setTimeout(() => library.focus({ preventScroll: true }), 450);
}

function showPathway(entry) {
  if (!entry) return;
  activeLibraryEntry = entry;
  $('#pathwayTitle').textContent = entry.title;
  $('#pathwayMeta').textContent = `${entry.source || 'STUDY'} resource · ${entry.outputs.length} accessible formats ready.`;
  const outputList = $('#pathwayOutputs');
  outputList.replaceChildren(...entry.outputs.map((format) => {
    const option = document.createElement('button');
    option.className = 'pathway-output';
    option.type = 'button';
    option.dataset.pathwayFormat = format;
    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = formatIcon(format);
    const copy = document.createElement('span');
    const heading = document.createElement('strong');
    heading.textContent = format;
    const detail = document.createElement('small');
    detail.textContent = 'Open this accessible format';
    copy.append(heading, detail);
    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '→';
    option.append(icon, copy, arrow);
    return option;
  }));
  $('#pathwayStart').textContent = `Start with ${entry.outputs[0]} →`;
  showDialog(pathwayDialog);
}

function learningScript(entry) {
  const profile = entry.profile || buildLearningProfile(entry.title);
  return `Welcome to ${entry.title}. ${profile.summary} First, ${profile.essential[0]} Next, ${profile.essential[1]} Finally, ${profile.essential[2]} Use the notes, captions, and interactive flowchart to review the same ideas in the way that works best for you.`;
}

function stopLearningMedia() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  audioUtterance = null;
  if (captionTimer) window.clearInterval(captionTimer);
  if (audioCaptionTimer) window.clearInterval(audioCaptionTimer);
  captionTimer = null;
  audioCaptionTimer = null;
}

function learningElement(tag, className = '', text = '') {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function actionButton(label, action, secondary = false) {
  const button = learningElement('button', `format-action${secondary ? ' secondary' : ''}`, label);
  button.type = 'button';
  button.dataset.learningAction = action;
  return button;
}

function renderAudioLesson(entry) {
  const panel = learningElement('div', 'learning-panel audio-panel');
  const wave = learningElement('div', 'audio-wave paused');
  for (let index = 0; index < 11; index += 1) wave.append(document.createElement('i'));
  const controls = learningElement('div', 'audio-controls');
  controls.append(actionButton('Play lesson', 'audio-play'), actionButton('Stop', 'audio-stop', true));
  const rate = learningElement('label', 'audio-rate', 'Speed');
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0.75';
  slider.max = '1.5';
  slider.step = '0.05';
  slider.value = '1';
  slider.dataset.audioRate = 'true';
  rate.append(slider);
  controls.append(rate);
  const voice = learningElement('label', 'audio-voice', 'Voice');
  const voicePicker = document.createElement('select');
  voicePicker.dataset.audioVoice = 'true';
  voice.append(voicePicker);
  controls.append(voice);
  const status = learningElement('p', 'format-status', 'Press play to hear this accessible overview.');
  status.dataset.audioStatus = 'true';
  const captionLabel = learningElement('p', 'format-status', 'Synced captions will highlight as the voice speaks.');
  const captionReader = learningElement('div', 'caption-reader audio-caption-reader');
  captionSentences(entry).forEach((line, index) => {
    const caption = learningElement('div', 'caption-line');
    caption.dataset.audioCaptionLine = String(index);
    const time = document.createElement('time');
    time.textContent = `00:${String(index * 8).padStart(2, '0')}`;
    caption.append(time, learningElement('span', '', line));
    captionReader.append(caption);
  });
  panel.append(wave, controls, status, captionLabel, captionReader);
  $('#learningFormatContent').replaceChildren(panel);
  populateVoicePicker();
  $('#learningFormatLead').textContent = `A natural-voice overview of ${entry.title}. Change the pace whenever you need.`;
}

function renderCaptions(entry) {
  const panel = learningElement('div', 'learning-panel');
  const controls = learningElement('div', 'audio-controls');
  controls.append(actionButton('Play with voice', 'captions-audio'), actionButton('Read captions', 'captions-play', true), actionButton('Restart', 'captions-restart', true));
  panel.append(controls, learningElement('p', 'format-status caption-play', 'Captions will progress through the lesson one line at a time.'));
  const reader = learningElement('div', 'caption-reader');
  captionSentences(entry).forEach((line, index) => {
    const caption = learningElement('div', 'caption-line');
    caption.dataset.captionLine = String(index);
    const time = document.createElement('time');
    time.textContent = `00:${String(index * 8).padStart(2, '0')}`;
    caption.append(time, learningElement('span', '', line.trim()));
    reader.append(caption);
  });
  panel.append(reader);
  $('#learningFormatContent').replaceChildren(panel);
  $('#learningFormatLead').textContent = `Follow a clear, paced transcript for ${entry.title}.`;
}

function renderSimpleNotes(entry) {
  const panel = learningElement('div', 'learning-panel');
  const profile = entry.profile || buildLearningProfile(entry.title);
  const stack = learningElement('div', 'summary-stack');
  const summary = learningElement('section', 'summary-card');
  summary.append(learningElement('h3', '', 'In one clear sentence'), learningElement('p', '', profile.summary));
  const essential = learningElement('section', 'summary-card');
  essential.append(learningElement('h3', '', 'What you need to understand'));
  const list = learningElement('ul', 'note-list');
  profile.essential.forEach((note) => list.append(learningElement('li', '', note)));
  essential.append(list);
  const steps = learningElement('section', 'summary-card');
  steps.append(learningElement('h3', '', 'A simple way to study this'));
  const understanding = learningElement('div', 'understanding-steps');
  [
    ['1', 'See the main idea', `Say ${titleCase(profile.topics[0])} in your own words.`],
    ['2', 'Make the connection', `Explain how it links to ${titleCase(profile.topics[1] || 'the next key idea')}.`],
    ['3', 'Check your understanding', 'Use the flowchart, captions, or audio to review and fill any gaps.']
  ].forEach(([number, heading, copy]) => {
    const step = learningElement('div', 'understanding-step');
    const numberBadge = learningElement('span', '', number);
    step.append(numberBadge, learningElement('strong', '', heading), document.createTextNode(copy));
    understanding.append(step);
  });
  steps.append(understanding);
  stack.append(summary, essential, steps);
  panel.append(stack);
  $('#learningFormatContent').replaceChildren(panel);
  $('#learningFormatLead').textContent = `A plain-language summary of ${entry.title}, with the core idea, relationships, and review steps.`;
}

function renderImageGuide(entry) {
  const panel = learningElement('div', 'learning-panel visual-description');
  const profile = entry.profile || buildLearningProfile(entry.title);
  const chart = learningElement('div', 'flowchart');
  profile.flow.forEach((step, index) => {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'flow-step';
    node.dataset.flowDescription = step.detail;
    node.setAttribute('aria-pressed', 'false');
    const indexBadge = learningElement('span', '', String(index + 1));
    const copy = document.createElement('span');
    copy.append(learningElement('strong', '', step.label), learningElement('small', '', step.detail));
    node.append(indexBadge, copy);
    chart.append(node);
  });
  const status = learningElement('p', 'flowchart-status', 'Select a flowchart step to read its role and hear the description aloud.');
  status.dataset.flowchartStatus = 'true';
  const note = learningElement('p', '', `This flowchart makes the information crux visible: start with the input, identify the key idea, connect supporting concepts, then check the outcome.`);
  panel.append(chart, status, note);
  $('#learningFormatContent').replaceChildren(panel);
  $('#learningFormatLead').textContent = `An interactive, step-by-step flowchart for ${entry.title}.`;
}

function showLearningFormat(entry, format) {
  if (!entry) return;
  stopLearningMedia();
  activeLibraryEntry = entry;
  activeLearningFormat = format;
  $('#learningFormatEyebrow').textContent = `${entry.source || 'STUDY'} · ACCESSIBLE FORMAT`;
  $('#learningFormatTitle').textContent = format;
  if (format === 'Audio lesson') renderAudioLesson(entry);
  else if (format === 'Captions') renderCaptions(entry);
  else if (format === 'Simple notes') renderSimpleNotes(entry);
  else renderImageGuide(entry);
  hideDialog(pathwayDialog);
  showDialog(learningFormatDialog);
}

function captionSentences(entry) {
  const sentences = learningScript(entry).match(/[^.!?]+[.!?]+/g) || [learningScript(entry)];
  return sentences.map((sentence) => sentence.trim()).filter(Boolean);
}

function syncCaptionLine(index) {
  const lines = Array.from(document.querySelectorAll('[data-caption-line], [data-audio-caption-line]'));
  lines.forEach((line, lineIndex) => line.classList.toggle('active', lineIndex === index));
  lines[index]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function startAudioCaptionFallback(totalLines) {
  if (audioCaptionTimer) window.clearInterval(audioCaptionTimer);
  let index = 0;
  syncCaptionLine(index);
  audioCaptionTimer = window.setInterval(() => {
    index += 1;
    if (index >= totalLines) {
      window.clearInterval(audioCaptionTimer);
      audioCaptionTimer = null;
      return;
    }
    syncCaptionLine(index);
  }, 3100);
}

function playAudioLesson() {
  const status = $('#learningFormatContent [data-audio-status]') || $('#learningFormatContent .caption-play');
  const wave = $('#learningFormatContent .audio-wave');
  const rate = Number($('#learningFormatContent [data-audio-rate]')?.value || 1);
  const preferredVoice = $('#learningFormatContent [data-audio-voice]')?.value || (() => {
    try { return localStorage.getItem('unDekhaVoice') || ''; } catch (_) { return ''; }
  })();
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined' || !activeLibraryEntry) {
    if (status) status.textContent = 'Audio playback is unavailable in this browser.';
    return;
  }
  window.speechSynthesis.cancel();
  audioUtterance = new SpeechSynthesisUtterance(learningScript(activeLibraryEntry));
  audioUtterance.rate = rate;
  const matchedVoice = window.speechSynthesis.getVoices().find((voice) => voice.name === preferredVoice);
  if (matchedVoice) audioUtterance.voice = matchedVoice;
  const lines = captionSentences(activeLibraryEntry);
  audioUtterance.onstart = () => {
    if (status) status.textContent = `Playing at ${rate.toFixed(2)}× speed.`;
    if (wave) wave.classList.remove('paused');
    startAudioCaptionFallback(lines.length);
  };
  audioUtterance.onboundary = (event) => {
    if (!Number.isFinite(event.charIndex)) return;
    if (audioCaptionTimer) window.clearInterval(audioCaptionTimer);
    audioCaptionTimer = null;
    let startIndex = 0;
    const lineIndex = lines.findIndex((line) => {
      const endIndex = startIndex + line.length;
      const match = event.charIndex <= endIndex;
      startIndex = endIndex + 1;
      return match;
    });
    syncCaptionLine(Math.max(0, lineIndex));
  };
  audioUtterance.onend = () => {
    if (status) status.textContent = 'Lesson complete. You can play it again whenever you like.';
    if (wave) wave.classList.add('paused');
    if (audioCaptionTimer) window.clearInterval(audioCaptionTimer);
    audioCaptionTimer = null;
  };
  audioUtterance.onerror = () => {
    if (status) status.textContent = 'Audio could not start. Try the captions or notes format instead.';
    if (wave) wave.classList.add('paused');
  };
  window.speechSynthesis.speak(audioUtterance);
}

function voiceScore(voice) {
  const name = `${voice.name} ${voice.lang}`.toLowerCase();
  let score = 0;
  if (/natural|neural|online|enhanced/.test(name)) score += 100;
  if (/microsoft|google|apple/.test(name)) score += 35;
  if (/en-in|en-us|en-gb/.test(name)) score += 15;
  if (voice.default) score += 8;
  return score;
}

function populateVoicePicker() {
  const picker = $('#learningFormatContent [data-audio-voice]');
  if (!picker || !('speechSynthesis' in window)) return;
  const previousVoice = picker.value || (() => {
    try { return localStorage.getItem('unDekhaVoice') || ''; } catch (_) { return ''; }
  })();
  const voices = window.speechSynthesis.getVoices().slice().sort((a, b) => voiceScore(b) - voiceScore(a));
  picker.replaceChildren();
  if (!voices.length) {
    const option = new Option('Loading natural system voice…', '');
    picker.append(option);
    return;
  }
  voices.slice(0, 12).forEach((voice) => {
    const label = `${friendlyVoiceName(voice)}${/natural|neural|online|enhanced/i.test(voice.name) ? ' · Natural' : ''}`;
    picker.append(new Option(label, voice.name, false, voice.name === previousVoice));
  });
  if (!picker.value) picker.selectedIndex = 0;
}

function friendlyVoiceName(voice) {
  return voice.name
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*[-–]\s*(english|hindi|spanish|french|german|italian|japanese|korean|chinese|arabic|portuguese).*$/i, '')
    .trim() || 'Natural system voice';
}

function startCaptions() {
  if (captionTimer) window.clearInterval(captionTimer);
  const lines = Array.from(document.querySelectorAll('[data-caption-line]'));
  if (!lines.length) return;
  let index = 0;
  const setActiveLine = () => {
    syncCaptionLine(index);
    index += 1;
    if (index >= lines.length) {
      window.clearInterval(captionTimer);
      captionTimer = null;
    }
  };
  setActiveLine();
  captionTimer = window.setInterval(setActiveLine, 1800);
  const status = $('#learningFormatContent .caption-play');
  if (status) status.textContent = 'Captions are playing. Follow the highlighted line.';
}

function restartCaptions() {
  stopLearningMedia();
  document.querySelectorAll('[data-caption-line]').forEach((line) => line.classList.remove('active'));
  const status = $('#learningFormatContent .caption-play');
  if (status) status.textContent = 'Captions restarted. Press Play captions to begin again.';
}

function speakAccessibleDescription(description) {
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(description);
  const selectedVoice = (() => {
    try { return localStorage.getItem('unDekhaVoice') || ''; } catch (_) { return ''; }
  })();
  const voice = window.speechSynthesis.getVoices().find((item) => item.name === selectedVoice);
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

loadLibraryEntries().slice().reverse().forEach((entry) => createLibraryCard(entry));
updateLibraryStatus();

browseFiles.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('click', (event) => {
  if (!event.target.closest('button')) fileInput.click();
});
dropZone.addEventListener('keydown', (event) => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target === dropZone) {
    event.preventDefault();
    fileInput.click();
  }
});
fileInput.addEventListener('change', (event) => {
  handleSelectedFile(event.target.files && event.target.files[0]);
  event.target.value = '';
});

['dragenter', 'dragover'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
  event.preventDefault();
  dropZone.classList.add('dragging');
}));
['dragleave', 'drop'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
  event.preventDefault();
  dropZone.classList.remove('dragging');
}));
dropZone.addEventListener('drop', (event) => {
  handleSelectedFile(event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]);
});

$('#pasteBtn').addEventListener('click', () => showDialog(textDialog));
$('#closeDialog').addEventListener('click', () => hideDialog(conversionDialog));
$('#closeTextDialog').addEventListener('click', () => hideDialog(textDialog));
$('.profile-card').addEventListener('click', () => showDialog(profileDialog));
$('#closeProfileDialog').addEventListener('click', () => hideDialog(profileDialog));
$('#saveProfile').addEventListener('click', () => {
  const name = profileName.value.trim();
  if (!name) {
    notify('Add your name so UN-देखा can personalize your profile.');
    profileName.focus();
    return;
  }
  applyStudentName(name);
  hideDialog(profileDialog);
  notify(`Profile saved for ${name}.`);
});

$('#convertText').addEventListener('click', () => {
  const text = $('#studyText').value.trim();
  if (!text) {
    notify('Paste a little study material first — even a heading works.');
    $('#studyText').focus();
    return;
  }
  hideDialog(textDialog);
  const title = text.split(/\n|[.!?]/)[0].trim().slice(0, 48) || 'Your study notes';
  selectedUpload = { source: 'TEXT', size: '', originalName: title, text };
  openConversion(title);
});

startConversionButton.addEventListener('click', () => {
  const formats = selectedFormats();
  if (!formats.length) {
    notify('Choose at least one accessible format to create your pathway.');
    return;
  }
  if (isConverting) return;
  isConverting = true;
  startConversionButton.disabled = true;
  entryStep.classList.add('hidden');
  processingStep.classList.remove('hidden');
  const labels = [
    'Reading your resource for the ideas that matter.',
    'Creating clear language and key concept cards.',
    'Writing image descriptions and building your audio lesson.'
  ];
  let index = 0;
  conversionLabelTimer = window.setInterval(() => {
    index += 1;
    if (index < labels.length) $('#processLabel').textContent = labels[index];
  }, 950);
  conversionTimer = window.setTimeout(() => {
    window.clearInterval(conversionLabelTimer);
    conversionLabelTimer = null;
    conversionTimer = null;
    createPathwayEntry();
    processingStep.classList.add('hidden');
    resultStep.classList.remove('hidden');
    isConverting = false;
    startConversionButton.disabled = false;
  }, 3000);
});

$('#openPathway').addEventListener('click', () => {
  hideDialog(conversionDialog);
  showLibrary();
  if (activeLibraryEntry) {
    window.setTimeout(() => showPathway(activeLibraryEntry), 430);
  }
});

$('#closePathwayDialog').addEventListener('click', () => hideDialog(pathwayDialog));
$('#pathwayStart').addEventListener('click', () => {
  showLearningFormat(activeLibraryEntry, activeLibraryEntry?.outputs?.[0] || 'Simple notes');
});
$('#pathwayOutputs').addEventListener('click', (event) => {
  const option = event.target.closest('[data-pathway-format]');
  if (option) showLearningFormat(activeLibraryEntry, option.dataset.pathwayFormat);
});
$('#closeLearningFormatDialog').addEventListener('click', () => {
  stopLearningMedia();
  hideDialog(learningFormatDialog);
});
function chooseAnotherResource() {
  cancelConversion();
  stopLearningMedia();
  hideDialog(conversionDialog);
  hideDialog(pathwayDialog);
  hideDialog(learningFormatDialog);
  $('#studio').scrollIntoView({ behavior: 'smooth', block: 'center' });
  window.setTimeout(() => dropZone.focus({ preventScroll: true }), 320);
  fileInput.click();
}

$('#convertAnother').addEventListener('click', chooseAnotherResource);
$('#pathwayConvertAnother').addEventListener('click', chooseAnotherResource);
$('#learningFormatContent').addEventListener('change', (event) => {
  if (!event.target.matches('[data-audio-voice]')) return;
  try { localStorage.setItem('unDekhaVoice', event.target.value); } catch (_) { /* Choice lasts for this session. */ }
});
$('#learningFormatContent').addEventListener('click', (event) => {
  const action = event.target.closest('[data-learning-action]')?.dataset.learningAction;
  if (action === 'audio-play') playAudioLesson();
  if (action === 'audio-stop') {
    stopLearningMedia();
    const status = $('#learningFormatContent [data-audio-status]');
    const wave = $('#learningFormatContent .audio-wave');
    if (status) status.textContent = 'Audio stopped. Press play whenever you are ready.';
    if (wave) wave.classList.add('paused');
  }
  if (action === 'captions-play') startCaptions();
  if (action === 'captions-audio') playAudioLesson();
  if (action === 'captions-restart') restartCaptions();
  const flowStep = event.target.closest('[data-flow-description]');
  if (flowStep) {
    document.querySelectorAll('[data-flow-description]').forEach((node) => node.setAttribute('aria-pressed', 'false'));
    flowStep.setAttribute('aria-pressed', 'true');
    const status = $('#learningFormatContent [data-flowchart-status]');
    if (status) status.textContent = flowStep.dataset.flowDescription;
    speakAccessibleDescription(flowStep.dataset.flowDescription);
  }
});
learningFormatDialog.addEventListener('close', stopLearningMedia);
if ('speechSynthesis' in window && typeof window.speechSynthesis.addEventListener === 'function') {
  window.speechSynthesis.addEventListener('voiceschanged', populateVoicePicker);
}
libraryGrid.addEventListener('click', (event) => {
  const openButton = event.target.closest('[data-library-id]');
  if (!openButton) return;
  const entry = loadLibraryEntries().find((item) => item.id === openButton.dataset.libraryId);
  if (entry) showPathway(entry);
});
$('#conceptMapCanvas').addEventListener('click', (event) => {
  const node = event.target.closest('[data-concept-entry-id]');
  if (node) selectConceptEntry(node.dataset.conceptEntryId);
});

document.querySelectorAll('.preference').forEach((button) => {
  button.addEventListener('click', () => {
    button.classList.toggle('active');
    const state = button.classList.contains('active') ? 'added' : 'removed';
    notify(`${button.dataset.preference} ${state} from your learning defaults.`);
  });
});

$('#customizeBtn').addEventListener('click', () => {
  document.querySelector('.quick-settings').scrollIntoView({ behavior: 'smooth', block: 'center' });
  notify('Tap a preference card to make it part of every conversion.');
});

contrastBtn.addEventListener('click', () => {
  const darkMode = !document.body.classList.contains('dark-mode');
  applyTheme(darkMode ? 'dark' : 'light');
  notify(`Dark mode ${darkMode ? 'enabled' : 'disabled'}.`);
});

$('#resetLibraryBtn').addEventListener('click', resetLibrary);
$('#emptyLibraryUpload').addEventListener('click', chooseAnotherResource);
$('#refreshConceptMap').addEventListener('click', () => {
  renderConceptMap();
  notify('Concept connections refreshed from your saved resources.');
});
$('#libraryNav').addEventListener('click', (event) => {
  event.preventDefault();
  showLibrary();
});
$('#helpBtn').addEventListener('click', () => notify('UN-देखा tip: start with text, then layer in your preferred formats.'));
$('#menuBtn').addEventListener('click', () => $('.sidebar').classList.toggle('open'));

document.querySelectorAll('.nav-item').forEach((item) => item.addEventListener('click', () => {
  document.querySelectorAll('.nav-item').forEach((link) => link.classList.remove('active'));
  item.classList.add('active');
  $('.sidebar').classList.remove('open');
}));

document.querySelectorAll('dialog').forEach((dialog) => {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      if (dialog === learningFormatDialog) stopLearningMedia();
      hideDialog(dialog);
    }
  });
});

const motionSections = document.querySelectorAll('.quick-settings, .studio, .workbench, .completion-note');
motionSections.forEach((section, index) => {
  section.classList.add('reveal');
  section.style.setProperty('--reveal-delay', `${Math.min(index * 45, 135)}ms`);
});

if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.14 });
  motionSections.forEach((section) => revealObserver.observe(section));
} else {
  motionSections.forEach((section) => section.classList.add('is-visible'));
}
