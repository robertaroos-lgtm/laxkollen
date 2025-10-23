(function(){
'use strict';

/* ======= KONSTANTER & DATA ======= */
const SUBJECT_GROUPS=[
  {title:"Språk",items:["Franska","Engelska","Spanska","Svenska","Italienska","Tyska"]},
  {title:"NO",items:["Biologi","Fysik","Kemi","Naturkunskap","NO"]},
  {title:"SO",items:["Geografi","Historia","Samhällskunskap","Religion","SO"]},
  {title:"Praktiskt-estetiska",items:["Musik","Bild","Idrott & Hälsa","Hemkunskap"]},
  {title:"Övrigt",items:["Matte","Teknik"]},
  {title:"Gymnasieämnen",items:["Juridik","Företagsekonomi","Psykologi","Filosofi"]}
];
const ALL_SUBJECTS=SUBJECT_GROUPS.flatMap(g=>g.items);
const subjectIcons={"Franska":"🇫🇷","Engelska":"🇬🇧","Spanska":"🇪🇸","Svenska":"🇸🇪","Italienska":"🇮🇹","Tyska":"🇩🇪","Biologi":"🧬","Fysik":"⚛️","Kemi":"⚗️","Naturkunskap":"🌿","NO":"🔬","Geografi":"🗺️","Historia":"📜","Samhällskunskap":"🏛️","Religion":"⛪","SO":"🌍","Musik":"🎵","Bild":"🎨","Idrott & Hälsa":"🏃‍♂️","Hemkunskap":"🍳","Matte":"➗","Teknik":"⚙️","Juridik":"⚖️","Företagsekonomi":"💼","Psykologi":"🧠","Filosofi":"🤔"};

const STORAGE_KEY="läxkollen-multi-children-v1";
let store=loadStore(); if(!store.children) store.children={};
let modalSnapshot=null;

/* ======= DOM ======= */
const $=id=>document.getElementById(id);
const childSelect=$("child-select"),
      subjectSelect=$("subject"),
      taskInput=$("task"),
      dueInput=$("due"),
      timesInput=$("times"),
      isExamInput=$("is-exam"),
      addBtn=$("add"),
      addQuickBtn=$("add-quick"),
      inputRow=$("input-row"),
      subjectSummary=$("subject-summary"),
      listEl=$("list"),
      historyNotice=$("history-notice");

const modalBackdrop=$("modal-backdrop"),
      manageBtn=$("manage-children"),
      childrenList=$("children-list"),
      newChildName=$("new-child-name"),
      newChildSubjects=$("new-child-subjects"),
      saveNewChildBtn=$("save-new-child"),
      closeModalBtn=$("close-modal"),
      cancelModalBtn=$("cancel-modal"),
      onboardingNote=$("onboarding-note");

const editBackdrop=$("edit-backdrop"),
      editSubject=$("edit-subject"),
      editTask=$("edit-task"),
      editIsExam=$("edit-is-exam"),
      editDue=$("edit-due"),
      editTimes=$("edit-times"),
      editCancel=$("edit-cancel"),
      editSave=$("edit-save");

let editingId=null;

/* ======= INIT ======= */
document.addEventListener("DOMContentLoaded", init);

function init(){
  // iOS zoom-prevention på inputs
  Array.from(document.querySelectorAll('input,select,textarea')).forEach(el=>{el.style.fontSize='16px';});

  // Event listeners – huvudform
  addBtn.addEventListener("click", addHomework);
  addQuickBtn.addEventListener("click", ()=>{ if(!hasAnyChild()){ openModal(true); return; } toggleInputRow(); validateForm(); });
  isExamInput.addEventListener("change", ()=>{ toggleTimesForExam(); validateForm(); });
  subjectSelect.addEventListener("change", validateForm);
  taskInput.addEventListener("input", validateForm);
  dueInput.addEventListener("change", validateForm);

  // Edit modal
  editIsExam.addEventListener("change", toggleEditTimesForExam);
  editCancel.addEventListener("click", ()=> closeEditModal());
  editSave.addEventListener("click", saveEditChanges);

  // Manage children modal
  manageBtn.addEventListener("click", ()=>openModal(false));
  closeModalBtn.addEventListener("click", ()=>{ if(hasAnyChild()) closeModal(); });
  cancelModalBtn.addEventListener("click", ()=>{ if(modalSnapshot){ store=modalSnapshot; modalSnapshot=null; saveStore(); renderAll(); } modalBackdrop.setAttribute("hidden",""); });
  saveNewChildBtn.addEventListener("click", addNewChild);

  // Filter chips (Kvar/Prov/Historik)
  wireFilterChips();

  // Migering & första render
  migrateStore();
  renderAll();
  ensureOnboarding();
  toggleTimesForExam();
  validateForm();
}

/* ======= STATE HELPERS ======= */
function hasAnyChild(){ return store.children && Object.keys(store.children).length>0; }
function ensureOnboarding(){ if(!hasAnyChild()) openModal(true); }
function state(){
  const name=store.currentChild;
  if(!name||!store.children||!store.children[name]) return {subjects:[],todos:[],filter:"active",focusedSubject:""};
  const s=store.children[name];
  if(!("filter" in s)) s.filter="active";
  if(!("focusedSubject" in s)) s.focusedSubject="";
  if(!("todos" in s)) s.todos=[];
  if(!("subjects" in s)) s.subjects=[];
  return s;
}

/* ======= ADD HOMEWORK ======= */
function addHomework(){
  if(!hasAnyChild()){ openModal(true); alert("Lägg till ett barn först."); return; }
  const s=state();
  const subj=subjectSelect.value;
  const task=taskInput.value.trim();
  const due=dueInput.value;
  const isExam=!!isExamInput.checked;

  if(!due){ alert(isExam?"Ange datum för provet.":"Ange datum för läxan."); dueInput.focus(); return; }
  const times=isExam?1:(parseInt(timesInput.value)||1);
  if(!s.subjects.includes(subj)){ alert("Ämnet är inte aktivt för detta barn. Lägg till ämnet under 'Hantera barn'."); return; }
  if(!task) return;

  s.todos.push({ id:safeId(), subj, task, due, timesLeft:times, timesTotal:times, done:false, isExam, completedOn:null });
  saveStore();
  resetInputs();
  toggleTimesForExam();
  validateForm();

  if(!inputRow.hasAttribute("hidden")){
    inputRow.setAttribute("hidden","");
    addQuickBtn.setAttribute("aria-expanded","false");
    addQuickBtn.textContent="Lägg till läxa/prov";
  }
  renderAll();
}

/* ======= LIST INTERAKTION ======= */
function tick(id){
  const s=state(); const t=s.todos.find(x=>x.id===id); if(!t) return;
  if(t.isExam){ return; }
  if(t.timesLeft>1){ t.timesLeft--; saveStore(); renderAll(); }
  else { t.timesLeft=0; t.done=true; t.completedOn=todayLocalISO(); saveStore(); renderAll(); }
}
function removeItem(id){
  const s=state(); const t=s.todos.find(x=>x.id===id); if(!t) return;
  if(!confirm(t.isExam?"Är du säker på att du vill radera detta prov?":"Är du säker på att du vill radera denna läxa?")) return;
  s.todos=s.todos.filter(x=>x.id!==id); saveStore(); renderAll();
}

/* ======= EDIT MODAL ======= */
function openEditModal(id){
  const s=state(); const t=s.todos.find(x=>x.id===id); if(!t) return; editingId=id;
  editSubject.innerHTML="";
  s.subjects.forEach(sub=>{ const o=document.createElement("option"); o.value=sub; o.textContent=sub; editSubject.appendChild(o); });
  editSubject.value=t.subj;
  editTask.value=t.task;
  editIsExam.checked=!!t.isExam;
  editDue.value=t.due||"";
  editTimes.value=t.timesTotal||Math.max(1,t.timesLeft||1);
  toggleEditTimesForExam();
  editBackdrop.removeAttribute("hidden");
}
function toggleEditTimesForExam(){
  const isExam=!!editIsExam.checked;
  if(isExam){ editTimes.value=""; editTimes.placeholder="–"; editTimes.disabled=true; }
  else { editTimes.disabled=false; editTimes.placeholder=""; if(!editTimes.value) editTimes.value=1; }
}
function closeEditModal(){ editingId=null; editBackdrop.setAttribute("hidden",""); }
function saveEditChanges(){
  if(editingId==null) return;
  const s=state(); const t=s.todos.find(x=>x.id===editingId); if(!t) return;

  const newSubj=editSubject.value;
  const newTask=editTask.value.trim();
  const newIsExam=!!editIsExam.checked;
  const newDue=editDue.value;

  if(!newDue){ alert(newIsExam?"Ange datum för provet.":"Ange datum för läxan."); return; }
  if(!newTask){ alert("Beskriv läxan."); return; }
  if(!s.subjects.includes(newSubj)){ alert("Ämnet är inte aktivt för detta barn."); return; }

  if(newIsExam){
    t.timesTotal=1;
    t.timesLeft=t.done?0:1;
  } else {
    const oldTotal=t.timesTotal||Math.max(1,t.timesLeft||1);
    const oldDone=Math.max(0,oldTotal-(t.timesLeft??oldTotal));
    const newTotal=Math.max(1, parseInt(editTimes.value||"1"));
    let newLeft=Math.max(0,newTotal-oldDone);
    if(t.done&&newLeft>0){ t.done=false; t.completedOn=null; }
    if(!t.done&&newLeft===0){ t.done=true; t.completedOn=t.completedOn||todayLocalISO(); }
    t.timesTotal=newTotal; t.timesLeft=newLeft;
  }
  t.subj=newSubj; t.task=newTask; t.isExam=newIsExam; t.due=newDue;
  saveStore(); closeEditModal(); renderAll();
}

/* ======= AUTO-FINALISERA PROV ======= */
function finalizeExamsByDate(){
  const s=state(); if(!s.todos) return;
  const today=todayLocalISO(); let changed=false;
  s.todos.forEach(t=>{
    if(t.isExam && t.due && t.due<today && !t.done){ t.done=true; t.completedOn=t.due; changed=true; }
  });
  if(changed) saveStore();
}

/* ======= RENDER ======= */
function renderAll(){
  finalizeExamsByDate();
  renderChildSelect();
  renderSubjectOptions();
  renderSummary();
  renderList();
  renderChildrenList(); // så listan i modalen alltid är uppdaterad
}

function renderChildSelect(){
  childSelect.innerHTML="";
  if(!hasAnyChild()){ childSelect.value=""; return; }
  Object.keys(store.children).sort().forEach(name=>{
    const o=document.createElement("option"); o.value=name; o.textContent=name; childSelect.appendChild(o);
  });
  if(!store.currentChild) store.currentChild=Object.keys(store.children)[0]||"";
  childSelect.value=store.currentChild||"";
  childSelect.onchange = ()=>{
    store.currentChild=childSelect.value;
    if(!store.currentChild) return;
    state().filter="active";
    state().focusedSubject="";
    saveStore();
    renderAll();
  };
}

function renderSubjectOptions(){
  const s=state(); subjectSelect.innerHTML="";
  if(s.subjects.length===0){
    const o=document.createElement("option"); o.value=""; o.textContent="(Lägg till barn & ämnen via 'Hantera barn')"; subjectSelect.appendChild(o);
  } else {
    ALL_SUBJECTS.filter(sub=>s.subjects.includes(sub)).forEach(sub=>{
      const o=document.createElement("option"); o.value=sub; o.textContent=sub; subjectSelect.appendChild(o);
    });
  }
}

function renderSummary(){
  const s=state(); const focused=s.focusedSubject||''; const wrap=subjectSummary; wrap.innerHTML='';
  const allBtn=document.createElement('button');
  allBtn.type='button';
  allBtn.className='subject-chip'+(focused===''?' selected':'');
  allBtn.textContent='📊 Alla';
  allBtn.addEventListener('click',()=>{ s.filter='active'; s.focusedSubject=''; renderAll(); });
  wrap.appendChild(allBtn);

  ALL_SUBJECTS.filter(sub=>s.subjects.includes(sub)).forEach(sub=>{
    const kvar=s.todos.filter(t=>t.subj===sub && !t.done).length;
    const btn=document.createElement('button'); btn.type='button'; btn.className='subject-chip'+(focused===sub?' selected':''); btn.title=sub;
    btn.innerHTML=(subjectIcons[sub]||'📘')+' '+sub.slice(0,2)+'<span class="subject-badge">'+kvar+'</span>';
    btn.addEventListener('click',()=>{ s.filter='active'; s.focusedSubject=(focused===sub)?'':sub; renderAll(); });
    wrap.appendChild(btn);
  });
}

function renderList(){
  const s=state(); listEl.innerHTML="";
  const viewFilter=s.filter||"active"; const subjFocus=s.focusedSubject||""; const todayISO=todayLocalISO();
  historyNotice.hidden = !(viewFilter==='done');

  const items=s.todos.filter(t=>{
    if(subjFocus && t.subj!==subjFocus) return false;
    if(viewFilter==="active"&&t.done) return false;
    if(viewFilter==="exam"&&(t.done||!t.isExam)) return false;
    if(viewFilter==="done"&&!t.done) return false;
    if(viewFilter==="done"){
      if(!t.completedOn) return false;
      const d=daysDiff(isoToDate(todayISO), isoToDate(t.completedOn));
      if(!(d>=0&&d<=30)) return false;
    }
    return true;
  });

  if(viewFilter==="done"){
    items.sort((a,b)=>{ const ad=a.completedOn||a.due||""; const bd=b.completedOn||b.due||""; return bd.localeCompare(ad); });
  } else {
    const rank=t=>{ if(!t.due) return 3; if(!t.done && t.due<todayISO) return 0; if(!t.done && t.due===todayISO) return 1; return 2; };
    items.sort((a,b)=>{ const ra=rank(a), rb=rank(b); if(ra!==rb) return ra-rb; if(a.due&&b.due) return a.due.localeCompare(b.due); return 0; });
  }

  items.forEach(t=>{
    const li=document.createElement("li");
    if(!t.done&&t.due){ if(t.due<todayISO) li.classList.add("overdue"); else if(t.due===todayISO) li.classList.add("today"); }
    if(t.done) li.classList.add("done");
    if(t.isExam) li.classList.add("exam");

    const card=document.createElement("div"); card.className="li-card";

    const left=document.createElement("div"); left.className="li-main";
    const text=document.createElement("div"); text.className="text"; text.textContent=`${subjectIcons[t.subj]||"📘"} ${t.subj}: ${t.task}`;
    const meta=document.createElement("div"); meta.className="meta-line"; const dateNice=t.due?formatDate(t.due):"";
    meta.textContent = t.due ? dateNice : "Ingen deadline";
    if(!t.isExam && (t.timesTotal||1)>1){
      const total=t.timesTotal||Math.max(1,t.timesLeft||1);
      const doneCount=Math.max(0,total-(t.timesLeft??total));
      meta.textContent += ` • ${doneCount}/${total} gjorda`;
    }
    if(t.done && t.completedOn){ meta.textContent += ` • Klar: ${formatDate(t.completedOn)}`; }
    left.appendChild(text); left.appendChild(meta);

    const right=document.createElement("div"); right.className="right-actions";
    if(t.isExam){ const examB=document.createElement("span"); examB.className="exam-badge"; examB.textContent="PROV"; right.appendChild(examB); }
    const editBtn=document.createElement("button"); editBtn.textContent="⚙️"; editBtn.className="icon-btn"; editBtn.title="Redigera";
    editBtn.addEventListener('touchstart', e=>e.stopPropagation(), {passive:true});
    editBtn.addEventListener('mousedown', e=>e.stopPropagation());
    editBtn.addEventListener('click', ()=>openEditModal(t.id));
    right.appendChild(editBtn);

    card.appendChild(left); card.appendChild(right);
    li.appendChild(card);
    listEl.appendChild(li);
  });
}

/* ======= FILTER-CHIPS ======= */
function wireFilterChips(){
  const chips=document.querySelectorAll('.chip[data-filter]');
  chips.forEach(ch=>{
    ch.addEventListener('click', ()=>{
      const f=ch.getAttribute('data-filter')||'active';
      const s=state();
      s.filter=f; s.focusedSubject="";
      document.querySelectorAll('.chip[data-filter]').forEach(x=>x.classList.remove('active'));
      ch.classList.add('active');
      renderAll();
    });
  });
}

/* ======= MANAGE CHILDREN MODAL ======= */
function openModal(isOnboarding){
  // snapshot för Avbryt
  modalSnapshot = JSON.parse(JSON.stringify(store));

  // Onboarding-notis
  onboardingNote.style.display = isOnboarding ? 'block' : 'none';

  // rensa inputs
  newChildName.value = '';
  renderSubjectPicker(newChildSubjects, new Set()); // inget valt från början

  // lista nuvarande barn
  renderChildrenList();

  modalBackdrop.removeAttribute('hidden');
}
function closeModal(){
  modalSnapshot=null;
  modalBackdrop.setAttribute('hidden','');
  // vid stäng: säkerställ att currentChild är vettig
  if(!store.currentChild && hasAnyChild()){
    store.currentChild = Object.keys(store.children)[0];
    saveStore();
    renderAll();
  }
}

function renderChildrenList(){
  if(!childrenList) return;
  childrenList.innerHTML='';
  if(!hasAnyChild()){
    const p=document.createElement('p');
    p.textContent="Inga barn tillagda ännu.";
    childrenList.appendChild(p);
    return;
  }
  Object.keys(store.children).sort().forEach(name=>{
    const box=document.createElement('div');
    box.style.border='1px solid #eee';
    box.style.borderRadius='10px';
    box.style.padding='8px';
    box.style.margin='6px 0';

    const title=document.createElement('div');
    title.style.fontWeight='700';
    title.style.marginBottom='4px';
    title.textContent=name;
    box.appendChild(title);

    const subs=document.createElement('div');
    const s=store.children[name];
    subs.textContent = (s.subjects&&s.subjects.length)? s.subjects.join(', ') : '(Inga ämnen valda)';
    box.appendChild(subs);

    childrenList.appendChild(box);
  });
}

function renderSubjectPicker(container, selectedSet){
  container.innerHTML='';
  SUBJECT_GROUPS.forEach(group=>{
    const gh=document.createElement('div');
    gh.className='group-header';
    gh.textContent=group.title;
    container.appendChild(gh);

    const row=document.createElement('div');
    row.className='subjects-group subject-row';
    group.items.forEach(sub=>{
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='sub-chip'+(selectedSet.has(sub)?' active':'');
      btn.textContent=sub;
      btn.addEventListener('click', ()=>{
        if(selectedSet.has(sub)) selectedSet.delete(sub);
        else selectedSet.add(sub);
        btn.classList.toggle('active');
      });
      row.appendChild(btn);
    });
    container.appendChild(row);
  });

  // spara valet på containern så addNewChild kan läsa
  container._selectedSet = selectedSet;
}

function addNewChild(){
  const name = newChildName.value.trim();
  const selectedSet = (newChildSubjects && newChildSubjects._selectedSet) ? newChildSubjects._selectedSet : new Set();
  const subjects = Array.from(selectedSet);

  if(!name){ alert("Ange barnets namn."); newChildName.focus(); return; }
  if(subjects.length===0){ alert("Välj minst ett ämne."); return; }
  if(!store.children) store.children = {};
  if(store.children[name]){ alert("Det finns redan ett barn med det namnet."); return; }

  store.children[name] = {
    subjects,
    todos: [],
    filter: 'active',
    focusedSubject: ''
  };
  store.currentChild = name;
  saveStore();
  renderAll();
  closeModal();
}

/* ======= HJÄLPFUNKTIONER ======= */
function todayLocalISO(){ const d=new Date(); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }
function isoToDate(iso){ return new Date(iso+'T00:00:00'); }
const MS_DAY=24*60*60*1000; function daysDiff(a,b){ const a0=new Date(a.getFullYear(),a.getMonth(),a.getDate()); const b0=new Date(b.getFullYear(),b.getMonth(),b.getDate()); return Math.floor((a0-b0)/MS_DAY); }
function formatDate(d){ try{ const [y,m,dd]=d.split('-'); return `${dd}/${m}/${y}`; } catch { return d; } }

function toggleInputRow(){
  const isHidden=inputRow.hasAttribute("hidden");
  if(isHidden){
    inputRow.removeAttribute("hidden");
    addQuickBtn.setAttribute("aria-expanded","true");
    addQuickBtn.textContent="Stäng";
    setTimeout(()=> taskInput.focus(), 0);
  } else {
    abortInput();
  }
}
function abortInput(){
  resetInputs(); toggleTimesForExam(); validateForm();
  inputRow.setAttribute("hidden","");
  addQuickBtn.setAttribute("aria-expanded","false");
  addQuickBtn.textContent="Lägg till läxa/prov";
}
function toggleTimesForExam(){
  const isExam=!!isExamInput.checked;
  if(isExam){ timesInput.value=""; timesInput.placeholder="–"; timesInput.disabled=true; }
  else { timesInput.disabled=false; timesInput.placeholder=""; if(!timesInput.value) timesInput.value=1; }
}
function validateForm(){
  const ok=!!subjectSelect.value && taskInput.value.trim().length>0 && !!dueInput.value;
  addBtn.disabled=!ok;
  addBtn.setAttribute("aria-disabled", String(!ok));
}

function migrateStore(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY); if(!raw) return;
    const parsed=JSON.parse(raw); if(!parsed.children) return;
    Object.values(parsed.children).forEach(c=>{
      (c.todos||[]).forEach(t=>{
        if(typeof t.timesTotal!=="number"||t.timesTotal<1){ t.timesTotal=Math.max(1,t.timesLeft||1); }
        if(t.timesLeft>t.timesTotal){ t.timesLeft=t.timesTotal; }
        if(t.isExam&&t.due&&t.done&&!t.completedOn){ t.completedOn=t.due; }
        if(t.done&&!t.completedOn){ t.completedOn=null; }
      });
    });
    store=parsed;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }catch{}
}
function saveStore(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }
function loadStore(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw) return { currentChild:'', children:{} };
    const parsed=JSON.parse(raw);
    if(!parsed.children) parsed.children={};
    return parsed;
  }catch{ return { currentChild:'', children:{} }; }
}
function safeId(){ return 'id-'+Math.random().toString(36).slice(2,10); }
function resetInputs(){ taskInput.value=''; dueInput.value=''; timesInput.value=1; isExamInput.checked=false; }

})();