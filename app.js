/* Läxkollen – app.js
   - Hantera barn (listläge/editorläge)
   - Ämnes-dropdown med ikoner
   - Glosor-checkbox styr times-row
   - PROV badge i listan
   - Add-panel stängs efter "Lägg till"
   - Mini-tutorial om swipe: EN gång vid första tillagda uppgift + manuell knapp i Hantera barn
   - ALLA-läge: visa alla barns uppgifter (default), tydlig barn-badge per rad
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
const ALL_VIEW_KEY = '__ALL__';

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

const closeModalBtn = document.getElementById('close-modal');      // Stäng i listläge
const saveNewChildBtn = document.getElementById('save-new-child'); // Spara i editorläge

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
let editingChildNameForTask = null; // viktigt för ALLA-läget

// Hantera barn editor-state
let editingChildSubjectsName = null; // null = lägg till nytt barn

/* ----------------------------- Store ----------------------------- */
let store = loadStore();
migrateStore();

function hasAnyChild() {
  return store.children && Object.keys(store.children).length > 0;
}

function isAllView() {
  return store.currentChild === ALL_VIEW_KEY;
}

function getChildStateByName(name) {
  if (!name || !store.children || !store.children[name]) return null;
  const s = store.children[name];
  if (!('filter' in s)) s.filter = 'active';
  if (!('focusedSubject' in s)) s.focusedSubject = '';
  if (!Array.isArray(s.todos)) s.todos = [];
  if (!Array.isArray(s.subjects)) s.subjects = [];
  return s;
}

function allViewState() {
  store._allView = store._allView || { filter: 'active' };
  if (!('filter' in store._allView)) store._allView.filter = 'active';
  return store._allView;
}

function state() {
  if (isAllView()) {
    // “state” för ALLA gäller bara filter (inte subjects/todos)
    return allViewState();
  }

  const name = store.currentChild;
  const s = getChildStateByName(name);
  if (!s) return { subjects: [], todos: [], filter: 'active', focusedSubject: '' };
  return s;
}

/* ----------------------------- Swipe tutorial (one-time + manual) ----------------------------- */
function totalTaskCountAllChildren(){
  try{
    if(!store?.children) return 0;
    return Object.values(store.children).reduce((sum, child) => sum + ((child?.todos?.length) || 0), 0);
  }catch{ return 0; }
}

function hasSeenSwipeTutorial(){
  return !!(store?._tutorials && store._tutorials.swipe);
}

function markSwipeTutorialSeen(){
  store._tutorials = store._tutorials || {};
  store._tutorials.swipe = true;
  saveStore();
}

function showSwipeTutorial({ force = false } = {}){
  if (!force && hasSeenSwipeTutorial()) return;

  if (!force) markSwipeTutorialSeen();

  const overlay = document.createElement('div');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.zIndex = '9999';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.padding = '18px';
  overlay.style.background = 'rgba(0,0,0,0.45)';
  overlay.style.backdropFilter = 'blur(6px)';

  const card = document.createElement('div');
  card.style.width = 'min(420px, 100%)';
  card.style.background = '#fff';
  card.style.borderRadius = '16px';
  card.style.boxShadow = '0 10px 30px rgba(0,0,0,0.25)';
  card.style.padding = '16px';

  const title = document.createElement('div');
  title.textContent = 'Snabbguide';
  title.style.fontWeight = '800';
  title.style.fontSize = '18px';
  title.style.marginBottom = '10px';

  const body = document.createElement('div');
  body.style.fontSize = '14px';
  body.style.lineHeight = '1.35';
  body.style.color = '#222';
  body.style.marginBottom = '12px';
  body.innerHTML = `
    Du kan hantera en läxa direkt i listan:
    <div style="margin-top:10px; display:flex; flex-direction:column; gap:10px;">
      <div style="display:flex; align-items:center; gap:10px;">
        <div style="width:34px; height:34px; border-radius:999px; background:#e7f7ee; display:flex; align-items:center; justify-content:center; font-size:18px;">✅</div>
        <div><strong>Swipe höger</strong> för att klarmarkera</div>
      </div>
      <div style="display:flex; align-items:center; gap:10px;">
        <div style="width:34px; height:34px; border-radius:999px; background:#fde8e8; display:flex; align-items:center; justify-content:center; font-size:18px;">🗑️</div>
        <div><strong>Swipe vänster</strong> för att radera</div>
      </div>
    </div>
  `;

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.justifyContent = 'flex-end';
  actions.style.marginTop = '14px';

  const ok = document.createElement('button');
  ok.type = 'button';
  ok.textContent = 'Jag fattar';
  ok.style.border = 'none';
  ok.style.borderRadius = '12px';
  ok.style.padding = '10px 14px';
  ok.style.fontWeight = '800';
  ok.style.cursor = 'pointer';
  ok.style.background = '#111';
  ok.style.color = '#fff';

  const close = () => overlay.remove();

  ok.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.addEventListener('touchmove', (e) => e.preventDefault(), { passive:false });

  actions.appendChild(ok);
  card.appendChild(title);
  card.appendChild(body);
  card.appendChild(actions);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

function showSwipeTutorialOnce(){
  // EN gång, när första uppgiften läggs till
  if (hasSeenSwipeTutorial()) return;
  markSwipeTutorialSeen();
  showSwipeTutorial({ force: true });
}

/* ----------------------------- Init ----------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  if (subjectSummary) subjectSummary.style.display = 'none';

  wireEvents();
  renderAll();

  ensureOnboarding();
  validateForm();
  toggleTimesRow();
});

function wireEvents() {
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

  chips.forEach(c => {
    c.addEventListener('click', () => {
      if (!hasAnyChild()) {
        openModal(true);
        return;
      }
      const st = state();
      st.filter = c.dataset.filter || 'active';
      setActiveChip(st.filter);
      saveStore();
      renderAll();
    });
  });

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
  if (onboardingNote) onboardingNote.style.display = (isOnboarding || !hasAnyChild()) ? 'block' : 'none';

  if (!hasAnyChild()) {
    startAddChildMode(true);
  } else {
    showChildrenListMode();
  }

  if (closeModalBtn) closeModalBtn.disabled = !hasAnyChild();

  modalBackdrop?.removeAttribute('hidden');
}

function ensureQuickGuideButton() {
  if (!childrenListArea) return;
  if (childrenListArea.querySelector('[data-quickguide-btn="1"]')) return;

  // Lägg den nära "Lägg till barn"-knappen
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Visa snabbguide';
  btn.className = 'ghost';
  btn.setAttribute('data-quickguide-btn', '1');
  btn.style.marginLeft = '8px';

  btn.addEventListener('click', () => {
    showSwipeTutorial({ force: true });
  });

  // Försök placera efter Lägg till-knappen, annars sist i childrenListArea
  if (openChildEditorBtn && openChildEditorBtn.parentNode) {
    openChildEditorBtn.parentNode.insertBefore(btn, openChildEditorBtn.nextSibling);
  } else {
    childrenListArea.appendChild(btn);
  }
}

function showChildrenListMode() {
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
  ensureQuickGuideButton();
}

function startAddChildMode(forceOnboarding = false) {
  editingChildSubjectsName = null;

  if (childrenListArea) childrenListArea.style.display = 'none';
  if (childEditor) childEditor.removeAttribute('hidden');

  if (openChildEditorBtn) openChildEditorBtn.disabled = true;

  if (saveNewChildBtn) saveNewChildBtn.style.display = '';
  if (closeModalBtn) closeModalBtn.style.display = 'none';

  if (newChildName) {
    newChildName.disabled = false;
    newChildName.value = '';
    setTimeout(() => newChildName.focus(), 0);
  }
  if (newChildSubjects) {
    newChildSubjects.innerHTML = '';
    buildSubjectsRows(newChildSubjects, []);
  }

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
  if (!hasAnyChild()) return;
  modalBackdrop?.setAttribute('hidden','');
}

/* ----------------------------- Children CRUD ----------------------------- */
function onSaveChildClick() {
  if (editingChildSubjectsName) saveEditedChildSubjects();
  else addNewChild();
}

function addNewChild() {
  const name = (newChildName?.value || '').trim();
  if (!name) { alert('Ange ett namn.'); return; }
  if (store.children && store.children[name]) { alert('Det finns redan ett barn med det namnet.'); return; }

  const subjects = Array.from(newChildSubjects?.querySelectorAll('.sub-chip.active') || [])
    .map(b => b.dataset.sub);

  if (!store.children) store.children = {};
  store.children[name] = { subjects, todos: [], filter: 'active', focusedSubject: '' };

  // Om vi just lagt första barnet: gör default "ALLA" när vi återgår till appen
  store.currentChild = ALL_VIEW_KEY;

  saveStore();
  renderAll();

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

  // om inga barn kvar
  if (names.length === 0) store.currentChild = '';
  else store.currentChild = ALL_VIEW_KEY;

  saveStore();
  renderAll();

  if (!hasAnyChild()) openModal(true);
  else renderChildrenList();
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
  if (isAllView()) {
    alert('Välj ett barn i rullistan för att lägga till en läxa/prov.');
    return;
  }

  const wasEmptyBefore = totalTaskCountAllChildren() === 0;
  const s = state();

  const subj = subjectSelect?.value || '';
  const task = (taskInput?.value || '').trim();
  const due = dueInput?.value || '';

  const isExam = !!isExamInput?.checked;
  const isGlossary = !!isGlossaryInput?.checked;

  if (!due) { alert(isExam ? 'Ange datum för provet.' : 'Ange datum för läxan.'); dueInput?.focus(); return; }
  if (!task) { alert('Beskriv läxan.'); taskInput?.focus(); return; }
  if (!s.subjects.includes(subj)) { alert('Ämnet är inte aktivt för detta barn. Lägg till ämnet under "Hantera barn".'); return; }

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

  // Stäng add-panel
  if (inputRow && !inputRow.hasAttribute('hidden')) inputRow.setAttribute('hidden', '');
  if (addQuickBtn) {
    addQuickBtn.setAttribute('aria-expanded', 'false');
    addQuickBtn.textContent = 'Lägg till läxa/prov';
  }

  // visa snabbguide EN gång vid första uppgiften
  if (wasEmptyBefore) setTimeout(() => showSwipeTutorialOnce(), 80);
}

function tick(id, childName = null) {
  const targetChild = childName || store.currentChild;
  const s = getChildStateByName(targetChild);
  if (!s) return;
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

function removeItem(id, childName = null) {
  const targetChild = childName || store.currentChild;
  const s = getChildStateByName(targetChild);
  if (!s) return;
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

  // ALLA först
  const allOpt = document.createElement('option');
  allOpt.value = ALL_VIEW_KEY;
  allOpt.textContent = 'ALLA';
  childSelect.appendChild(allOpt);

  const names = Object.keys(store.children).sort((a,b)=>a.localeCompare(b,'sv'));
  names.forEach(name => {
    const o = document.createElement('option');
    o.value = name;
    o.textContent = name;
    childSelect.appendChild(o);
  });

  // Default: ALLA (om inte redan valt)
  if (!store.currentChild) store.currentChild = ALL_VIEW_KEY;
  if (store.currentChild !== ALL_VIEW_KEY && !store.children[store.currentChild]) {
    store.currentChild = ALL_VIEW_KEY;
  }

  childSelect.value = store.currentChild || ALL_VIEW_KEY;
}

function renderSubjectOptions() {
  if (!subjectSelect) return;

  // Om ALLA-läge: man ska inte kunna välja ämne/ lägga till uppgift
  if (isAllView()) {
    subjectSelect.innerHTML = '';
    const o = document.createElement('option');
    o.value = '';
    o.textContent = '(Välj ett barn för att lägga till läxa/prov)';
    subjectSelect.appendChild(o);
    subjectSelect.disabled = true;
    return;
  }

  subjectSelect.disabled = false;
  const s = state();
  subjectSelect.innerHTML = '';

  if (!s.subjects || s.subjects.length === 0) {
    const o = document.createElement('option');
    o.value = '';
    o.textContent = '(Lägg till barn & ämnen via "Hantera barn")';
    subjectSelect.appendChild(o);
    return;
  }

  ALL_SUBJECTS
    .filter(sub => s.subjects.includes(sub))
    .forEach(sub => {
      const o = document.createElement('option');
      o.value = sub;
      o.textContent = `${subjectIcons[sub] || '📘'} ${sub}`;
      subjectSelect.appendChild(o);
    });
}

function collectAllTodos() {
  const out = [];
  if (!store.children) return out;
  Object.keys(store.children).forEach(childName => {
    const s = getChildStateByName(childName);
    (s?.todos || []).forEach(t => out.push({ ...t, _child: childName }));
  });
  return out;
}

function renderList() {
  if (!listEl) return;
  listEl.innerHTML = '';

  const todayISO = todayLocalISO();
  const isNarrow = window.matchMedia('(max-width: 420px)').matches;

  const withinLastMonth = (iso) => {
    if (!iso) return false;
    const today = isoToDate(todayISO);
    const d = isoToDate(iso);
    const diff = daysDiff(today, d);
    return diff >= 0 && diff <= 30;
  };

  const viewFilter = state().filter || 'active';

  // Hämta items beroende på ALLA eller ett barn
  let baseItems = [];
  if (isAllView()) baseItems = collectAllTodos();
  else baseItems = (getChildStateByName(store.currentChild)?.todos || []).map(t => ({ ...t, _child: store.currentChild }));

  let items = baseItems.filter(t => {
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

    // Barn-badge (tydlig markering)
    const childBadge = document.createElement('span');
    childBadge.textContent = t._child || '';
    childBadge.style.display = 'inline-flex';
    childBadge.style.alignItems = 'center';
    childBadge.style.padding = '3px 8px';
    childBadge.style.borderRadius = '999px';
    childBadge.style.background = '#eee';
    childBadge.style.color = '#111';
    childBadge.style.fontSize = '12px';
    childBadge.style.fontWeight = '800';
    childBadge.style.marginRight = '8px';

    const mainText = document.createElement('span');
    mainText.textContent = `${subjectIcons[t.subj] || '📘'} ${t.subj}: ${t.task}`;

    text.appendChild(childBadge);
    text.appendChild(mainText);

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
      meta.innerHTML += ` • <span class="progress-badge">${isNarrow ? `${doneCount}/${total}` : `${doneCount}/${total} gjorda`}</span>`;
    }
    if (t.done && t.completedOn) meta.innerHTML += ` • Klar: ${formatDate(t.completedOn)}`;

    left.appendChild(text);
    left.appendChild(meta);

    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.alignItems = 'center';
    right.style.gap = '8px';
    right.style.marginLeft = 'auto';

    // PROV badge före kugghjulet
    if (t.isExam) {
      const examBadge = document.createElement('span');
      examBadge.textContent = 'PROV';
      examBadge.className = 'exam-badge';
      examBadge.style.display = 'inline-flex';
      examBadge.style.alignItems = 'center';
      examBadge.style.fontSize = '12px';
      examBadge.style.fontWeight = '800';
      examBadge.style.padding = '4px 8px';
      examBadge.style.borderRadius = '999px';
      examBadge.style.background = '#F2D35E';
      examBadge.style.color = '#111';
      examBadge.style.letterSpacing = '0.5px';
      right.appendChild(examBadge);
    }

    const editBtn = document.createElement('button');
    editBtn.textContent = '⚙️';
    editBtn.className = 'icon-btn';
    editBtn.title = 'Redigera';
    editBtn.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
    editBtn.addEventListener('mousedown', e => e.stopPropagation());
    editBtn.onclick = () => openEditModal(t.id, t._child);

    right.appendChild(editBtn);

    card.appendChild(left);
    card.appendChild(right);
    li.appendChild(card);

    attachSwipe(
      li,
      () => { if (!t.isExam) tick(t.id, t._child); else showToast('Provdatum styr avslut'); },
      () => removeItem(t.id, t._child)
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
  chips.forEach(x=>x.classList.remove('active'));
  const target = chips.find(x=>x.dataset.filter===filter);
  if (target) target.classList.add('active');
}

/* ----------------------------- Input row helpers ----------------------------- */
function toggleInputRow() {
  if (!inputRow) return;
  const isHidden = inputRow.hasAttribute('hidden');
  if (isHidden) {
    inputRow.removeAttribute('hidden');
    addQuickBtn?.setAttribute('aria-expanded','true');
    addQuickBtn && (addQuickBtn.textContent='Stäng');
    setTimeout(()=>taskInput?.focus(),0);
  } else abortInput();
}

function abortInput() {
  resetInputs();
  validateForm();
  inputRow?.setAttribute('hidden','');
  addQuickBtn?.setAttribute('aria-expanded','false');
  addQuickBtn && (addQuickBtn.textContent='Lägg till läxa/prov');
}

function toggleTimesRow() {
  const isExam = !!isExamInput?.checked;
  const isGlossary = !!isGlossaryInput?.checked;

  if (timesRow) {
    const show = (!isExam && isGlossary);
    if (show) timesRow.removeAttribute('hidden');
    else timesRow.setAttribute('hidden','');
  }

  if (isExam && isGlossaryInput) {
    isGlossaryInput.checked = false;
    if (timesRow) timesRow.setAttribute('hidden','');
  }
}

function validateForm() {
  // I ALLA-läge ska man inte kunna lägga till (måste välja barn)
  const ok =
    !isAllView() &&
    !!subjectSelect?.value &&
    (taskInput?.value || '').trim().length > 0 &&
    !!(dueInput?.value || '');

  if (addBtn) {
    addBtn.disabled = !ok;
    addBtn.setAttribute('aria-disabled', String(!ok));
  }
}

/* ----------------------------- Edit modal ----------------------------- */
function openEditModal(id, childName) {
  const s = getChildStateByName(childName || store.currentChild);
  if (!s) return;
  const t = s.todos.find(x=>x.id===id);
  if (!t) return;

  editingId = id;
  editingChildNameForTask = childName || store.currentChild;

  editSubject.innerHTML = '';
  s.subjects.forEach(sub=>{
    const o=document.createElement('option');
    o.value=sub;
    o.textContent=`${subjectIcons[sub]||'📘'} ${sub}`;
    editSubject.appendChild(o);
  });

  editSubject.value=t.subj;
  editTask.value=t.task;
  editIsExam.checked=!!t.isExam;
  editDue.value=t.due||'';
  editTimes.value=t.timesTotal||1;

  toggleEditTimesForExam();
  editBackdrop?.removeAttribute('hidden');
}

function toggleEditTimesForExam() {
  const isExam = !!editIsExam.checked;
  if (isExam) {
    editTimes.value='';
    editTimes.placeholder='–';
    editTimes.disabled=true;
  } else {
    editTimes.disabled=false;
    editTimes.placeholder='';
    if(!editTimes.value) editTimes.value=1;
  }
}

function closeEditModal() {
  editingId=null;
  editingChildNameForTask=null;
  editBackdrop?.setAttribute('hidden','');
}

function saveEditChanges() {
  if (editingId==null) return;
  const s = getChildStateByName(editingChildNameForTask || store.currentChild);
  if (!s) return;
  const t = s.todos.find(x=>x.id===editingId);
  if(!t) return;

  const newSubj=editSubject.value;
  const newTask=editTask.value.trim();
  const newIsExam=!!editIsExam.checked;
  const newDue=editDue.value;

  if(!newDue){ alert(newIsExam?'Ange datum för provet.':'Ange datum för läxan.'); return; }
  if(!newTask){ alert('Beskriv läxan.'); return; }
  if(!s.subjects.includes(newSubj)){ alert('Ämnet är inte aktivt för detta barn.'); return; }

  t.subj=newSubj;
  t.task=newTask;
  t.isExam=newIsExam;
  t.due=newDue;

  if (newIsExam) {
    t.timesTotal=1;
    t.timesLeft=t.done?0:1;
    t.isGlossary=false;
  } else {
    const newTotal=Math.max(1,parseInt(editTimes.value||'1',10));
    t.timesTotal=newTotal;
    if(!t.isGlossary){
      t.timesTotal=1;
      t.timesLeft=t.done?0:1;
    } else {
      const oldLeft=t.timesLeft ?? newTotal;
      t.timesLeft=Math.min(oldLeft,newTotal);
    }
  }

  saveStore();
  closeEditModal();
  renderAll();
  showToast('Uppgift uppdaterad');
}

/* ----------------------------- Exams finalize ----------------------------- */
function finalizeExamsByDate() {
  if (!store.children) return;
  const today=todayLocalISO();
  let changed=false;

  Object.keys(store.children).forEach(childName=>{
    const s=getChildStateByName(childName);
    if(!s) return;
    s.todos.forEach(t=>{
      if(t.isExam && t.due && t.due<today && !t.done){
        t.done=true;
        t.completedOn=t.due;
        changed=true;
      }
    });
  });

  if(changed) saveStore();
}

/* ----------------------------- Helpers ----------------------------- */
function todayLocalISO() {
  const d=new Date();
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const dd=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}
function isoToDate(iso){ return new Date(iso+'T00:00:00'); }
const MS_DAY=24*60*60*1000;
function daysDiff(a,b){
  const a0=new Date(a.getFullYear(),a.getMonth(),a.getDate());
  const b0=new Date(b.getFullYear(),b.getMonth(),b.getDate());
  return Math.floor((a0-b0)/MS_DAY);
}

function computeDueLabel(t,todayISO,dateNice){
  if(!t.due) return 'Ingen deadline';
  if(t.isExam && t.due<todayISO) return `Provdatum: ${dateNice}`;
  if(!t.done && t.due===todayISO) return 'Idag';
  if(!t.done && t.due<todayISO) return 'Försenad';
  return `${dateNice}`;
}
function computeDueClass(t,todayISO){
  if(!t.due) return '';
  if(t.isExam && t.due<todayISO) return '';
  if(!t.done && t.due===todayISO) return 'today';
  if(!t.done && t.due<todayISO) return 'overdue';
  return '';
}

function safeId(){ return 'id-'+Math.random().toString(36).slice(2,10); }

function resetInputs(){
  if(taskInput) taskInput.value='';
  if(dueInput) dueInput.value='';
  if(isExamInput) isExamInput.checked=false;
  if(isGlossaryInput) isGlossaryInput.checked=false;

  if(timesInput) timesInput.value=1;
  if(timesRow) timesRow.setAttribute('hidden','');

  toggleTimesRow();
}

function formatDate(d){
  try{ const [y,m,dd]=d.split('-'); return `${dd}/${m}/${y}`; }
  catch{ return d; }
}

let _toastTimer;
function showToast(msg,ms=1800){
  const el=document.getElementById('toast');
  if(!el) return;
  el.textContent=msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer=setTimeout(()=>el.classList.remove('show'),ms);
}

function haptic(type='light'){
  try{
    if('vibrate' in navigator){
      if(type==='heavy') navigator.vibrate([18,60,18]);
      else if(type==='medium') navigator.vibrate(30);
      else if(type==='success') navigator.vibrate([8,40,8]);
      else navigator.vibrate(10);
    }
  }catch{}
}

function attachSwipe(li,onRight,onLeft){
  const card=li.querySelector('.li-card')||li.firstChild;
  if(!card) return;

  const THRESHOLD=72;
  let startX=0,currentX=0,dragging=false,startedOnInteractive=false;
  const isInteractive=el=>!!el && el.closest && el.closest('button,a,input,select,textarea,[role="button"]');

  const start=(x,evt)=>{
    startedOnInteractive=isInteractive(evt?.target);
    if(startedOnInteractive) return;
    dragging=true;
    startX=x;
    card.style.transition='none';
    li.classList.remove('swipe-left','swipe-right');
  };

  const move=x=>{
    if(!dragging) return;
    currentX=x-startX;
    card.style.transform=`translateX(${currentX}px)`;
    if(currentX>0){ li.classList.add('swipe-right'); li.classList.remove('swipe-left'); }
    else if(currentX<0){ li.classList.add('swipe-left'); li.classList.remove('swipe-right'); }
  };

  const reset=()=>{
    card.style.transform='translateX(0)';
    li.classList.remove('swipe-left','swipe-right');
  };

  const end=()=>{
    if(startedOnInteractive){ startedOnInteractive=false; return; }
    if(!dragging) return;
    dragging=false;
    card.style.transition='';
    if(currentX>THRESHOLD){ haptic('success'); onRight?.(); reset(); }
    else if(currentX<-THRESHOLD){ haptic('heavy'); onLeft?.(); reset(); }
    else reset();
    currentX=0;
  };

  li.addEventListener('touchstart',e=>start(e.touches[0].clientX,e),{passive:true});
  li.addEventListener('touchmove',e=>move(e.touches[0].clientX),{passive:true});
  li.addEventListener('touchend',end);

  li.addEventListener('mousedown',e=>start(e.clientX,e));
  window.addEventListener('mousemove',e=>move(e.clientX));
  window.addEventListener('mouseup',end);
}

/* ----------------------------- Storage ----------------------------- */
function saveStore(){ localStorage.setItem(STORAGE_KEY,JSON.stringify(store)); }

function loadStore(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw) return { currentChild:'', children:{} };
    const parsed=JSON.parse(raw);
    if(!parsed.children) parsed.children={};
    return parsed;
  }catch{
    return { currentChild:'', children:{} };
  }
}

function migrateStore(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw) return;
    const parsed=JSON.parse(raw);
    if(!parsed.children) return;

    Object.values(parsed.children).forEach(c=>{
      if(!Array.isArray(c.subjects)) c.subjects=[];
      if(!Array.isArray(c.todos)) c.todos=[];

      c.todos.forEach(t=>{
        if(typeof t.timesTotal!=='number' || t.timesTotal<1) t.timesTotal=Math.max(1,t.timesLeft||1);
        if(typeof t.timesLeft!=='number') t.timesLeft=t.timesTotal;
        if(t.timesLeft>t.timesTotal) t.timesLeft=t.timesTotal;

        if(t.isExam && t.due && t.done && !t.completedOn) t.completedOn=t.due;
        if(t.done && !t.completedOn) t.completedOn=null;

        if(typeof t.isGlossary!=='boolean') t.isGlossary=false;

        if(t.isExam){
          t.isGlossary=false;
          t.timesTotal=1;
          t.timesLeft=t.done?0:1;
        }
      });
    });

    store = parsed;

    // Om currentChild saknas men barn finns: default ALLA
    if (store.children && Object.keys(store.children).length > 0) {
      if (!store.currentChild) store.currentChild = ALL_VIEW_KEY;
    }

    localStorage.setItem(STORAGE_KEY,JSON.stringify(store));
  }catch{}
}
