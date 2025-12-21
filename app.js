/* Läxkollen – app.js (anpassad för din aktuella index.html)
   - Fixar Hantera barn-flödet (listläge vs editorläge)
   - Döljer ämnessammanfattningsraden
   - Lägger ikon i ämnes-dropdown
   - Glosor-checkbox visar/döljer times-row
*/

const SUBJECT_GROUPS = [
  { title: 'Språk', items: ['Franska','Engelska','Spanska','Svenska','Italienska','Tyska'] },
  { title: 'NO', items: ['Biologi','Fysik','Kemi','Naturkunskap','NO'] },
  { title: 'SO', items: ['Geografi','Historia','Samhällskunskap','Religion','SO'] },
  { title: 'Praktiskt-estetiska', items: ['Musik','Bild','Idrott & Hälsa','Hemkunskap'] },
  { title: 'Övrigt', items: ['Matte','Teknik'] },
  { title: 'Gymnasieämnen', items: ['Juridik','Företagsekonomi','Psykologi','Filosofi'] }
];
const ALL_SUBJECTS = SUBJECT_GROUPS.flatMap(g => g.items);

const subjectIcons = {
  'Franska':'🇫🇷','Engelska':'🇬🇧','Spanska':'🇪🇸','Svenska':'🇸🇪','Italienska':'🇮🇹','Tyska':'🇩🇪',
  'Biologi':'🧬','Fysik':'⚛️','Kemi':'⚗️','Naturkunskap':'🌿','NO':'🔬',
  'Geografi':'🗺️','Historia':'📜','Samhällskunskap':'🏛️','Religion':'⛪','SO':'🌍',
  'Musik':'🎵','Bild':'🎨','Idrott & Hälsa':'🏃‍♂️','Hemkunskap':'🍳',
  'Matte':'➗','Teknik':'⚙️',
  'Juridik':'⚖️','Företagsekonomi':'💼','Psykologi':'🧠','Filosofi':'🤔'
};

const STORAGE_KEY = 'läxkollen-multi-children-v1';

/* ----------------------------- DOM refs ----------------------------- */
const childSelect = document.getElementById('child-select');
const subjectSelect = document.getElementById('subject');
const taskInput = document.getElementById('task');
const dueInput = document.getElementById('due');
const addBtn = document.getElementById('add');
const addQuickBtn = document.getElementById('add-quick');
const inputRow = document.getElementById('input-row');

const isExamInput = document.getElementById('is-exam');
const isGlossaryInput = document.getElementById('is-glossary');

const timesRow = document.getElementById('times-row');
const timesInput = document.getElementById('times');

const listEl = document.getElementById('list');
const historyNote = document.getElementById('history-note');
const chips = Array.from(document.querySelectorAll('.chip'));

const subjectSummary = document.getElementById('subject-summary'); // ska döljas

// Modal: Hantera barn
const modalBackdrop = document.getElementById('modal-backdrop');
const manageBtn = document.getElementById('manage-children');

const onboardingNote = document.getElementById('onboarding-note');

const childrenListArea = document.getElementById('children-list-area');
const childrenList = document.getElementById('children-list');
const openChildEditorBtn = document.getElementById('open-child-editor');

const childEditor = document.getElementById('child-editor');
const newChildName = document.getElementById('new-child-name');
const newChildSubjects = document.getElementById('new-child-subjects');

const closeModalBtn = document.getElementById('close-modal');     // "Stäng" i listläge
const saveNewChildBtn = document.getElementById('save-new-child'); // "Spara" i editorläge

// Edit modal
const editBackdrop = document.getElementById('edit-backdrop');
const editSubject = document.getElementById('edit-subject');
const editTask = document.getElementById('edit-task');
const editIsExam = document.getElementById('edit-is-exam');
const editDue = document.getElementById('edit-due');
const editTimes = document.getElementById('edit-times');
const editCancel = document.getElementById('edit-cancel');
const editSave = document.getElementById('edit-save');

let editingId = null;

// Hantera barn editor-state
let editingChildSubjectsName = null; // null = lägg till nytt barn

/* ----------------------------- Store ----------------------------- */
let store = loadStore();
migrateStore();

function hasAnyChild() {
  return store.children && Object.keys(store.children).length > 0;
}

function state() {
  const name = store.currentChild;
  if (!name || !store.children || !store.children[name]) {
    return { subjects: [], todos: [], filter: 'active', focusedSubject: '' };
  }
  const s = store.children[name];
  if (!('filter' in s)) s.filter = 'active';
  if (!('focusedSubject' in s)) s.focusedSubject = '';
  if (!Array.isArray(s.todos)) s.todos = [];
  if (!Array.isArray(s.subjects)) s.subjects = [];
  return s;
}

/* ----------------------------- Init ----------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  // DÖLJ ämnes-sammanfattningen (du vill ta bort den raden)
  if (subjectSummary) subjectSummary.style.display = 'none';

  wireEvents();
  renderAll();

  // Onboarding: om inga barn finns, öppna direkt och visa add-läge med ämnen
  ensureOnboarding();
  validateForm();
  toggleTimesRow();
});

function wireEvents() {
  // Top-level actions
  if (addBtn) addBtn.addEventListener('click', addHomework);
  if (addQuickBtn) addQuickBtn.addEventListener('click', () => {
    if (!hasAnyChild()) {
      openModal(true);
      return;
    }
    toggleInputRow();
    validateForm();
  });

  if (manageBtn) manageBtn.addEventListener('click', () => openModal(false));

  if (childSelect) {
    childSelect.addEventListener('change', () => {
      store.currentChild = childSelect.value;
      saveStore();
      renderAll();
    });
  }

  // Filters
  chips.forEach(c => {
    c.addEventListener('click', () => {
      if (!hasAnyChild()) {
        openModal(true);
        return;
      }
      const s = state();
      s.filter = c.dataset.filter || 'active';
      setActiveChip(s.filter);
      saveStore();
      renderAll();
    });
  });

  // Inputs
  if (isExamInput) isExamInput.addEventListener('change', () => {
    toggleTimesRow();
    validateForm();
  });
  if (isGlossaryInput) isGlossaryInput.addEventListener('change', () => {
    toggleTimesRow();
    validateForm();
  });
  if (subjectSelect) subjectSelect.addEventListener('change', validateForm);
  if (taskInput) taskInput.addEventListener('input', validateForm);
  if (dueInput) dueInput.addEventListener('change', validateForm);

  // Modal (Hantera barn)
  if (openChildEditorBtn) openChildEditorBtn.addEventListener('click', () => startAddChildMode());
  if (closeModalBtn) closeModalBtn.addEventListener('click', () => closeModal());
  if (saveNewChildBtn) saveNewChildBtn.addEventListener('click', () => onSaveChildClick());

  // Edit modal
  if (editCancel) editCancel.addEventListener('click', () => closeEditModal());
  if (editSave) editSave.addEventListener('click', saveEditChanges);
  if (editIsExam) editIsExam.addEventListener('change', toggleEditTimesForExam);

  // ESC
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const anyModalOpen = !modalBackdrop?.hasAttribute('hidden') || !editBackdrop?.hasAttribute('hidden');
    if (anyModalOpen) return;
    if (inputRow && !inputRow.hasAttribute('hidden')) abortInput();
  });
}

/* ----------------------------- Onboarding/modal flow ----------------------------- */
function ensureOnboarding() {
  if (!hasAnyChild()) openModal(true);
}

function openModal(isOnboarding = false) {
  // onboarding text
  if (onboardingNote) onboardingNote.style.display = (isOnboarding || !hasAnyChild()) ? 'block' : 'none';

  // om inga barn: direkt add-läge (editor), list döljs
  if (!hasAnyChild()) {
    startAddChildMode(true);
  } else {
    showChildrenListMode();
  }

  // Stäng får inte gå om inga barn finns
  if (closeModalBtn) closeModalBtn.disabled = !hasAnyChild();

  modalBackdrop?.removeAttribute('hidden');
}

function showChildrenListMode() {
  // listläge: visa list, dölj editor
  if (childrenListArea) childrenListArea.style.display = '';
  if (childEditor) childEditor.setAttribute('hidden','');

  if (saveNewChildBtn) saveNewChildBtn.style.display = 'none';
  if (closeModalBtn) {
    closeModalBtn.style.display = '';
    closeModalBtn.textContent = 'Stäng';
  }
  if (openChildEditorBtn) openChildEditorBtn.disabled = false;

  editingChildSubjectsName = null;
  renderChildrenList();
}

function startAddChildMode(forceOnboarding = false) {
  editingChildSubjectsName = null;

  // add-läge: dölj list, visa editor
  if (childrenListArea) childrenListArea.style.display = 'none';
  if (childEditor) childEditor.removeAttribute('hidden');

  if (openChildEditorBtn) openChildEditorBtn.disabled = true;

  // knappar: visa Spara, göm Stäng (så man inte stänger av misstag)
  if (saveNewChildBtn) saveNewChildBtn.style.display = '';
  if (closeModalBtn) closeModalBtn.style.display = 'none';

  // reset form
  if (newChildName) {
    newChildName.disabled = false;
    newChildName.value = '';
    setTimeout(() => newChildName.focus(), 0);
  }
  if (newChildSubjects) {
    newChildSubjects.innerHTML = '';
    buildSubjectsRows(newChildSubjects, []);
  }

  // onboarding kräver minst 1 barn
  if (forceOnboarding && closeModalBtn) closeModalBtn.disabled = true;
}

function startEditChildSubjects(name) {
  if (!store.children || !store.children[name]) return;
  editingChildSubjectsName = name;

  if (childrenListArea) childrenListArea.style.display = 'none';
  if (childEditor) childEditor.removeAttribute('hidden');

  if (openChildEditorBtn) openChildEditorBtn.disabled = true;

  if (saveNewChildBtn) saveNewChildBtn.style.display = '';
  if (closeModalBtn) closeModalBtn.style.display = 'none';

  const child = store.children[name];

  if (newChildName) {
    newChildName.value = name;
    newChildName.disabled = true;
  }
  if (newChildSubjects) {
    newChildSubjects.innerHTML = '';
    buildSubjectsRows(newChildSubjects, child.subjects || []);
  }
}

function closeModal() {
  // får inte stänga om inga barn finns
  if (!hasAnyChild()) return;
  modalBackdrop?.setAttribute('hidden','');
}

/* ----------------------------- Children CRUD ----------------------------- */
function onSaveChildClick() {
  if (editingChildSubjectsName) {
    saveEditedChildSubjects();
  } else {
    addNewChild();
  }
}

function addNewChild() {
  const name = (newChildName?.value || '').trim();
  if (!name) {
    alert('Ange ett namn.');
    return;
  }
  if (store.children && store.children[name]) {
    alert('Det finns redan ett barn med det namnet.');
    return;
  }
  const subjects = Array.from(newChildSubjects?.querySelectorAll('.sub-chip.active') || [])
    .map(b => b.dataset.sub);

  if (!store.children) store.children = {};
  store.children[name] = { subjects, todos: [], filter: 'active', focusedSubject: '' };
  store.currentChild = name;

  saveStore();
  renderAll();

  // efter spar: tillbaka till listläge
  if (closeModalBtn) closeModalBtn.disabled = false;
  showToast(`Lade till ${name}`);
  showChildrenListMode();
}

function saveEditedChildSubjects() {
  const name = editingChildSubjectsName;
  if (!name || !store.children || !store.children[name]) {
    showChildrenListMode();
    return;
  }
  const subjects = Array.from(newChildSubjects?.querySelectorAll('.sub-chip.active') || [])
    .map(b => b.dataset.sub);

  store.children[name].subjects = subjects;
  saveStore();
  renderAll();

  showToast(`Uppdaterade ämnen för ${name}`);
  showChildrenListMode();
}

function deleteChild(name) {
  if (!confirm(`Vill du ta bort ${name}? Detta tar bort alla läxor för barnet.`)) return;

  if (store.children) delete store.children[name];
  const names = store.children ? Object.keys(store.children) : [];
  store.currentChild = names.length ? names.sort()[0] : '';

  saveStore();
  renderAll();

  if (!hasAnyChild()) {
    // tillbaka till onboarding/add-läge
    openModal(true);
  } else {
    renderChildrenList();
  }
}

function renderChildrenList() {
  if (!childrenList) return;
  childrenList.innerHTML = '';

  if (!hasAnyChild()) return;

  const names = Object.keys(store.children).sort((a,b)=>a.localeCompare(b,'sv'));
  names.forEach(name => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '12px';
    row.style.padding = '10px 0';

    const nameEl = document.createElement('div');
    nameEl.style.minWidth = '120px';
    nameEl.style.fontWeight = '700';
    nameEl.textContent = name;

    const spacer = document.createElement('div');
    spacer.style.flex = '1';

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '10px';
    actions.style.alignItems = 'center';
    actions.style.marginLeft = 'auto';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'ghost icon-btn';
    editBtn.textContent = '⚙️';
    editBtn.title = 'Redigera ämnen';
    editBtn.onclick = () => startEditChildSubjects(name);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'ghost danger-text';
    delBtn.textContent = 'Ta bort barn';
    delBtn.title = 'Tar bort barnet och alla dess läxor';
    delBtn.onclick = () => deleteChild(name);

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    row.appendChild(nameEl);
    row.appendChild(spacer);
    row.appendChild(actions);

    childrenList.appendChild(row);
  });
}

function buildSubjectsRows(container, preselected = []) {
  SUBJECT_GROUPS.forEach(group => {
    const gwrap = document.createElement('div');
    gwrap.className = 'subjects-group';

    const header = document.createElement('div');
    header.className = 'group-header';
    header.textContent = group.title;

    const row = document.createElement('div');
    row.className = 'subject-row';

    group.items.forEach(sub => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sub-chip';
      btn.dataset.sub = sub;

      const selected = !!(preselected && preselected.includes(sub));
      if (selected) btn.classList.add('active');
      btn.setAttribute('aria-pressed', selected ? 'true' : 'false');

      btn.textContent = `${subjectIcons[sub] || '📘'} ${sub}`;
      btn.onclick = () => {
        const ns = !btn.classList.contains('active');
        btn.classList.toggle('active', ns);
        btn.setAttribute('aria-pressed', ns ? 'true' : 'false');
      };

      row.appendChild(btn);
    });

    gwrap.appendChild(header);
    gwrap.appendChild(row);
    container.appendChild(gwrap);
  });
}

/* ----------------------------- Homework CRUD ----------------------------- */
function addHomework() {
  if (!hasAnyChild()) {
    openModal(true);
    alert('Lägg till ett barn först.');
    return;
  }
  const s = state();

  const subj = subjectSelect?.value || '';
  const task = (taskInput?.value || '').trim();
  const due = dueInput?.value || '';

  const isExam = !!isExamInput?.checked;
  const isGlossary = !!isGlossaryInput?.checked;

  if (!due) {
    alert(isExam ? 'Ange datum för provet.' : 'Ange datum för läxan.');
    dueInput?.focus();
    return;
  }
  if (!task) {
    alert('Beskriv läxan.');
    taskInput?.focus();
    return;
  }
  if (!s.subjects.includes(subj)) {
    alert('Ämnet är inte aktivt för detta barn. Lägg till ämnet under "Hantera barn".');
    return;
  }

  // repetitioner bara om glosor och inte prov
  const times = (!isExam && isGlossary) ? (parseInt(timesInput?.value || '1', 10) || 1) : 1;

  s.todos.push({
    id: safeId(),
    subj,
    task,
    due,
    timesLeft: times,
    timesTotal: times,
    done: false,
    isExam,
    isGlossary,
    completedOn: null
  });

  saveStore();
  resetInputs();
  validateForm();
  renderAll();
  showToast(isExam ? 'Prov tillagt' : 'Läxa tillagd');
  // Stäng "Lägg till läxa/prov"-panelen efter att man lagt till
if (inputRow && !inputRow.hasAttribute('hidden')) {
  inputRow.setAttribute('hidden', '');
}
if (addQuickBtn) {
  addQuickBtn.setAttribute('aria-expanded', 'false');
  addQuickBtn.textContent = 'Lägg till läxa/prov';
}

}

function tick(id) {
  const s = state();
  const t = s.todos.find(x => x.id === id);
  if (!t) return;

  if (t.isExam) {
    showToast('Prov försvinner automatiskt efter provdatum');
    return;
  }

  if (t.isGlossary && (t.timesLeft || 1) > 1) {
    t.timesLeft--;
    saveStore();
    renderAll();
    const total = t.timesTotal || 1;
    const doneCount = Math.max(0, total - t.timesLeft);
    showToast(`Omgång avklarad (${doneCount}/${total})`);
    return;
  }

  t.timesLeft = 0;
  t.done = true;
  t.completedOn = todayLocalISO();
  saveStore();
  renderAll();
  showToast('Läxa klar!');
}

function removeItem(id) {
  const s = state();
  const t = s.todos.find(x => x.id === id);
  if (!t) return;

  const msg = t.isExam ? 'Är du säker på att du vill radera detta prov?' : 'Är du säker på att du vill radera denna läxa?';
  if (!confirm(msg)) return;

  s.todos = s.todos.filter(x => x.id !== id);
  saveStore();
  renderAll();
  showToast(t.isExam ? 'Prov borttaget' : 'Läxa borttagen');
}

/* ----------------------------- Render ----------------------------- */
function renderAll() {
  finalizeExamsByDate();
  renderChildSelect();
  renderSubjectOptions();
  renderList();
  toggleHistoryNote();
}

function renderChildSelect() {
  if (!childSelect) return;
  childSelect.innerHTML = '';

  if (!hasAnyChild()) {
    childSelect.value = '';
    return;
  }

  const names = Object.keys(store.children).sort((a,b)=>a.localeCompare(b,'sv'));
  names.forEach(name => {
    const o = document.createElement('option');
    o.value = name;
    o.textContent = name;
    childSelect.appendChild(o);
  });

  if (!store.currentChild || !store.children[store.currentChild]) {
    store.currentChild = names[0] || '';
    saveStore();
  }
  childSelect.value = store.currentChild || '';
}

function renderSubjectOptions() {
  if (!subjectSelect) return;
  const s = state();
  subjectSelect.innerHTML = '';

  if (!s.subjects || s.subjects.length === 0) {
    const o = document.createElement('option');
    o.value = '';
    o.textContent = '(Lägg till barn & ämnen via "Hantera barn")';
    subjectSelect.appendChild(o);
    return;
  }

  // visa bara aktiverade ämnen + ikon
  ALL_SUBJECTS
    .filter(sub => s.subjects.includes(sub))
    .forEach(sub => {
      const o = document.createElement('option');
      o.value = sub;
      o.textContent = `${subjectIcons[sub] || '📘'} ${sub}`;
      subjectSelect.appendChild(o);
    });
}

function renderList() {
  if (!listEl) return;
  const s = state();
  listEl.innerHTML = '';

  const viewFilter = s.filter || 'active';
  const todayISO = todayLocalISO();

  const withinLastMonth = (iso) => {
    if (!iso) return false;
    const today = isoToDate(todayISO);
    const d = isoToDate(iso);
    const diff = daysDiff(today, d);
    return diff >= 0 && diff <= 30;
  };

  let items = (s.todos || []).filter(t => {
    if (viewFilter === 'active' && t.done) return false;
    if (viewFilter === 'exam' && (t.done || !t.isExam)) return false;
    if (viewFilter === 'done' && !t.done) return false;
    if (viewFilter === 'done') {
      const ref = t.completedOn || t.due || '';
      if (!withinLastMonth(ref)) return false;
    }
    return true;
  });

  // sort
  if (viewFilter === 'done') {
    items.sort((a,b) => (b.completedOn||b.due||'').localeCompare(a.completedOn||a.due||''));
  } else {
    const rank = (t) => {
      if (!t.due) return 3;
      if (!t.done && t.due < todayISO) return 0;
      if (!t.done && t.due === todayISO) return 1;
      return 2;
    };
    items.sort((a,b) => {
      const ra = rank(a), rb = rank(b);
      if (ra !== rb) return ra - rb;
      return (a.due||'').localeCompare(b.due||'');
    });
  }

  items.forEach(t => {
    const li = document.createElement('li');

    if (!t.done && t.due) {
      if (t.due < todayISO) li.classList.add('overdue');
      else if (t.due === todayISO) li.classList.add('today');
    }
    if (t.done) li.classList.add('done');
    if (t.isExam) li.classList.add('exam');

    const card = document.createElement('div');
    card.className = 'li-card';

    const left = document.createElement('div');
    const text = document.createElement('div');
    text.className = 'text';
    text.textContent = `${subjectIcons[t.subj] || '📘'} ${t.subj}: ${t.task}`;

    const meta = document.createElement('div');
    meta.className = 'meta-line';
    const dateNice = t.due ? formatDate(t.due) : '';
    const dueLabel = computeDueLabel(t, todayISO, dateNice);
    const dueClass = computeDueClass(t, todayISO);
    meta.innerHTML = dueLabel ? `<span class="due-badge ${dueClass}">${dueLabel}</span>` : '';

    if (!t.isExam && t.isGlossary && (t.timesTotal || 1) > 1) {
      const total = t.timesTotal || 1;
      const leftCount = t.timesLeft ?? total;
      const doneCount = Math.max(0, total - leftCount);
      meta.innerHTML += ` • <span class="progress-badge">${doneCount}/${total} gjorda</span>`;
    }
    if (t.done && t.completedOn) {
      meta.innerHTML += ` • Klar: ${formatDate(t.completedOn)}`;
    }

    left.appendChild(text);
    left.appendChild(meta);

    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.alignItems = 'center';
    right.style.gap = '8px';
    right.style.marginLeft = 'auto';

    const editBtn = document.createElement('button');
    editBtn.textContent = '⚙️';
    editBtn.className = 'icon-btn';
    editBtn.title = 'Redigera';
    editBtn.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
    editBtn.addEventListener('mousedown', e => e.stopPropagation());
    editBtn.onclick = () => openEditModal(t.id);

// PROV-badge (gul) – visas bara om uppgiften är prov
if (t.isExam) {
  const examBadge = document.createElement('span');
  examBadge.textContent = 'PROV';
  examBadge.className = 'exam-badge'; // om du vill styla i CSS senare
  // "failsafe"-style så den alltid blir gul även om CSS saknas
  examBadge.style.display = 'inline-flex';
  examBadge.style.alignItems = 'center';
  examBadge.style.fontSize = '12px';
  examBadge.style.fontWeight = '800';
  examBadge.style.padding = '4px 8px';
  examBadge.style.borderRadius = '999px';
  examBadge.style.background = '#F2D35E'; // gul
  examBadge.style.color = '#111';
  examBadge.style.letterSpacing = '0.5px';

  right.appendChild(examBadge);
}

    right.appendChild(editBtn);

    card.appendChild(left);
    card.appendChild(right);
    li.appendChild(card);

    attachSwipe(
      li,
      () => { if (!t.isExam) tick(t.id); else showToast('Provdatum styr avslut'); },
      () => removeItem(t.id)
    );

    listEl.appendChild(li);
  });
}

function toggleHistoryNote() {
  try {
    const show = (state().filter || 'active') === 'done';
    if (historyNote) historyNote.hidden = !show;
  } catch {}
}

function setActiveChip(filter) {
  chips.forEach(x => x.classList.remove('active'));
  const target = chips.find(x => x.dataset.filter === filter);
  if (target) target.classList.add('active');
}

/* ----------------------------- Input row helpers ----------------------------- */
function toggleInputRow() {
  if (!inputRow) return;
  const isHidden = inputRow.hasAttribute('hidden');
  if (isHidden) {
    inputRow.removeAttribute('hidden');
    addQuickBtn?.setAttribute('aria-expanded','true');
    addQuickBtn && (addQuickBtn.textContent = 'Stäng');
    setTimeout(() => taskInput?.focus(), 0);
  } else {
    abortInput();
  }
}

function abortInput() {
  resetInputs();
  validateForm();
  inputRow?.setAttribute('hidden','');
  addQuickBtn?.setAttribute('aria-expanded','false');
  addQuickBtn && (addQuickBtn.textContent = 'Lägg till läxa/prov');
}

function toggleTimesRow() {
  // Repetitioner ska visas bara om "Glosor" är ikryssad och inte prov
  const isExam = !!isExamInput?.checked;
  const isGlossary = !!isGlossaryInput?.checked;

  if (timesRow) {
    const show = (!isExam && isGlossary);
    if (show) timesRow.removeAttribute('hidden');
    else timesRow.setAttribute('hidden','');
  }

  // om prov: tvinga bort glosor UI-krock logiskt (valfritt – men håller rent)
  if (isExam && isGlossaryInput) {
    // låt användaren ha kvar check visuellt om du vill – jag väljer att auto-avmarkera för tydlighet
    isGlossaryInput.checked = false;
    if (timesRow) timesRow.setAttribute('hidden','');
  }
}

function validateForm() {
  const ok =
    !!subjectSelect?.value &&
    (taskInput?.value || '').trim().length > 0 &&
    !!(dueInput?.value || '');

  if (addBtn) {
    addBtn.disabled = !ok;
    addBtn.setAttribute('aria-disabled', String(!ok));
  }
}

/* ----------------------------- Edit modal ----------------------------- */
function openEditModal(id) {
  const s = state();
  const t = s.todos.find(x => x.id === id);
  if (!t) return;

  editingId = id;

  editSubject.innerHTML = '';
  s.subjects.forEach(sub => {
    const o = document.createElement('option');
    o.value = sub;
    o.textContent = `${subjectIcons[sub] || '📘'} ${sub}`;
    editSubject.appendChild(o);
  });

  editSubject.value = t.subj;
  editTask.value = t.task;
  editIsExam.checked = !!t.isExam;
  editDue.value = t.due || '';
  editTimes.value = t.timesTotal || 1;

  toggleEditTimesForExam();
  editBackdrop?.removeAttribute('hidden');
}

function toggleEditTimesForExam() {
  const isExam = !!editIsExam.checked;
  if (isExam) {
    editTimes.value = '';
    editTimes.placeholder = '–';
    editTimes.disabled = true;
  } else {
    editTimes.disabled = false;
    editTimes.placeholder = '';
    if (!editTimes.value) editTimes.value = 1;
  }
}

function closeEditModal() {
  editingId = null;
  editBackdrop?.setAttribute('hidden','');
}

function saveEditChanges() {
  if (editingId == null) return;
  const s = state();
  const t = s.todos.find(x => x.id === editingId);
  if (!t) return;

  const newSubj = editSubject.value;
  const newTask = editTask.value.trim();
  const newIsExam = !!editIsExam.checked;
  const newDue = editDue.value;

  if (!newDue) {
    alert(newIsExam ? 'Ange datum för provet.' : 'Ange datum för läxan.');
    return;
  }
  if (!newTask) {
    alert('Beskriv läxan.');
    return;
  }
  if (!s.subjects.includes(newSubj)) {
    alert('Ämnet är inte aktivt för detta barn.');
    return;
  }

  t.subj = newSubj;
  t.task = newTask;
  t.isExam = newIsExam;
  t.due = newDue;

  if (newIsExam) {
    t.timesTotal = 1;
    t.timesLeft = t.done ? 0 : 1;
    t.isGlossary = false;
  } else {
    const newTotal = Math.max(1, parseInt(editTimes.value || '1', 10));
    t.timesTotal = newTotal;
    if (!t.isGlossary) {
      // om inte glosor: håll det som 1
      t.timesTotal = 1;
      t.timesLeft = t.done ? 0 : 1;
    } else {
      const oldLeft = t.timesLeft ?? newTotal;
      t.timesLeft = Math.min(oldLeft, newTotal);
    }
  }

  saveStore();
  closeEditModal();
  renderAll();
  showToast('Uppgift uppdaterad');
}

/* ----------------------------- Exams finalize ----------------------------- */
function finalizeExamsByDate() {
  const s = state();
  if (!s.todos) return;

  const today = todayLocalISO();
  let changed = false;

  s.todos.forEach(t => {
    if (t.isExam && t.due && t.due < today && !t.done) {
      t.done = true;
      t.completedOn = t.due;
      changed = true;
    }
  });

  if (changed) saveStore();
}

/* ----------------------------- Helpers ----------------------------- */
function todayLocalISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}
function isoToDate(iso) { return new Date(iso + 'T00:00:00'); }
const MS_DAY = 24*60*60*1000;
function daysDiff(a,b) {
  const a0 = new Date(a.getFullYear(),a.getMonth(),a.getDate());
  const b0 = new Date(b.getFullYear(),b.getMonth(),b.getDate());
  return Math.floor((a0-b0)/MS_DAY);
}

function computeDueLabel(t, todayISO, dateNice) {
  if (!t.due) return 'Ingen deadline';
  if (t.isExam && t.due < todayISO) return `Provdatum: ${dateNice}`;
  if (!t.done && t.due === todayISO) return 'Idag';
  if (!t.done && t.due < todayISO) return 'Försenad';
  return `${dateNice}`;
}
function computeDueClass(t, todayISO) {
  if (!t.due) return '';
  if (t.isExam && t.due < todayISO) return '';
  if (!t.done && t.due === todayISO) return 'today';
  if (!t.done && t.due < todayISO) return 'overdue';
  return '';
}

function safeId() {
  return 'id-' + Math.random().toString(36).slice(2,10);
}

function resetInputs() {
  if (taskInput) taskInput.value = '';
  if (dueInput) dueInput.value = '';
  if (isExamInput) isExamInput.checked = false;
  if (isGlossaryInput) isGlossaryInput.checked = false;

  if (timesInput) timesInput.value = 1;
  if (timesRow) timesRow.setAttribute('hidden','');

  // behåll input-row öppet/stängt som det är, men times-row styrs av toggleTimesRow
  toggleTimesRow();
}

function formatDate(d) {
  try {
    const [y,m,dd] = d.split('-');
    return `${dd}/${m}/${y}`;
  } catch { return d; }
}

let _toastTimer;
function showToast(msg, ms = 1800) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

function haptic(type='light') {
  try {
    if ('vibrate' in navigator) {
      if (type === 'heavy') navigator.vibrate([18,60,18]);
      else if (type === 'medium') navigator.vibrate(30);
      else if (type === 'success') navigator.vibrate([8,40,8]);
      else navigator.vibrate(10);
    }
  } catch {}
}

function attachSwipe(li, onRight, onLeft) {
  const card = li.querySelector('.li-card') || li.firstChild;
  if (!card) return;

  const THRESHOLD = 72;
  let startX = 0, currentX = 0, dragging = false, startedOnInteractive = false;

  const isInteractive = (el) => !!el && el.closest && el.closest('button,a,input,select,textarea,[role="button"]');

  const start = (x, evt) => {
    startedOnInteractive = isInteractive(evt?.target);
    if (startedOnInteractive) return;
    dragging = true;
    startX = x;
    card.style.transition = 'none';
    li.classList.remove('swipe-left','swipe-right');
  };

  const move = (x) => {
    if (!dragging) return;
    currentX = x - startX;
    card.style.transform = `translateX(${currentX}px)`;
    if (currentX > 0) {
      li.classList.add('swipe-right');
      li.classList.remove('swipe-left');
    } else if (currentX < 0) {
      li.classList.add('swipe-left');
      li.classList.remove('swipe-right');
    }
  };

  const reset = () => {
    card.style.transform = 'translateX(0)';
    li.classList.remove('swipe-left','swipe-right');
  };

  const end = () => {
    if (startedOnInteractive) { startedOnInteractive = false; return; }
    if (!dragging) return;
    dragging = false;
    card.style.transition = '';
    if (currentX > THRESHOLD) {
      haptic('success');
      onRight?.();
      reset();
    } else if (currentX < -THRESHOLD) {
      haptic('heavy');
      onLeft?.();
      reset();
    } else {
      reset();
    }
    currentX = 0;
  };

  li.addEventListener('touchstart', e => start(e.touches[0].clientX, e), { passive: true });
  li.addEventListener('touchmove',  e => move(e.touches[0].clientX), { passive: true });
  li.addEventListener('touchend', end);

  li.addEventListener('mousedown', e => start(e.clientX, e));
  window.addEventListener('mousemove', e => move(e.clientX));
  window.addEventListener('mouseup', end);
}

/* ----------------------------- Storage ----------------------------- */
function saveStore() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { currentChild: '', children: {} };
    const parsed = JSON.parse(raw);
    if (!parsed.children) parsed.children = {};
    return parsed;
  } catch {
    return { currentChild: '', children: {} };
  }
}

function migrateStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed.children) return;

    Object.values(parsed.children).forEach(c => {
      if (!Array.isArray(c.subjects)) c.subjects = [];
      if (!Array.isArray(c.todos)) c.todos = [];

      c.todos.forEach(t => {
        // bakåtkompat
        if (typeof t.timesTotal !== 'number' || t.timesTotal < 1) t.timesTotal = Math.max(1, t.timesLeft || 1);
        if (typeof t.timesLeft !== 'number') t.timesLeft = t.timesTotal;

        if (t.timesLeft > t.timesTotal) t.timesLeft = t.timesTotal;

        if (t.isExam && t.due && t.done && !t.completedOn) t.completedOn = t.due;
        if (t.done && !t.completedOn) t.completedOn = null;

        // glosor default false
        if (typeof t.isGlossary !== 'boolean') t.isGlossary = false;

        // prov ska inte vara glosor
        if (t.isExam) {
          t.isGlossary = false;
          t.timesTotal = 1;
          t.timesLeft = t.done ? 0 : 1;
        }
      });
    });

    store = parsed;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {}
}
