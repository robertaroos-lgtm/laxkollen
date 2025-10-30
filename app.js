(function(){
'use strict';
const log=(...a)=>{ try{console.log('[LK]',...a);}catch{} };

const SUBJECT_GROUPS=[
  {title:"Språk",items:["Franska","Engelska","Spanska","Svenska","Italienska","Tyska"]},
  {title:"NO",items:["Biologi","Fysik","Kemi","Naturkunskap","NO"]},
  {title:"SO",items:["Geografi","Historia","Samhällskunskap","Religion","SO"]},
  {title:"Praktiskt-estetiska",items:["Musik","Bild","Idrott & Hälsa","Hemkunskap"]},
  {title:"Övrigt",items:["Matte","Teknik"]},
  {title:"Gymnasieämnen",items:["Juridik","Företagsekonomi","Psykologi","Filosofi"]}
];
const subjectIcons={"Franska":"🇫🇷","Engelska":"🇬🇧","Spanska":"🇪🇸","Svenska":"🇸🇪","Italienska":"🇮🇹","Tyska":"🇩🇪","Biologi":"🧬","Fysik":"⚛️","Kemi":"⚗️","Naturkunskap":"🌿","NO":"🔬","Geografi":"🗺️","Historia":"📜","Samhällskunskap":"🏛️","Religion":"⛪","SO":"🌍","Musik":"🎵","Bild":"🎨","Idrott & Hälsa":"🏃‍♂️","Hemkunskap":"🍳","Matte":"➗","Teknik":"⚙️","Juridik":"⚖️","Företagsekonomi":"💼","Psykologi":"🧠","Filosofi":"🤔"};
const ALL_SUBJECTS=SUBJECT_GROUPS.flatMap(g=>g.items);

const STORAGE_KEY="läxkollen-multi-children-v1";
let store=loadStore(); if(!store.children) store.children={};
const $=id=>document.getElementById(id);
const on=(el,ev,fn)=>{ if(el&&el.addEventListener) el.addEventListener(ev,fn,{passive:false}); };

let childSelect,subjectSelect,taskInput,dueInput,timesInput,isExamInput,addBtn,addQuickBtn,inputRow,subjectSummary,listEl,historyNotice;
let modalBackdrop,manageBtn,childrenList,newChildName,newChildSubjects,saveNewChildBtn,closeModalBtn,cancelModalBtn,onboardingNote;
let editBackdrop,editSubject,editTask,editIsExam,editDue,editTimes,editCancel,editSave;

function boot(){
  try{
    bindDom(); init();
    if(!hasAnyChild()){ openModal(true); }
  }catch(e){ banner('Init-fel: '+(e.message||e)); console.error(e); }
}
document.addEventListener('DOMContentLoaded', boot);
window.addEventListener('load', ()=>{ if(!document.body._lkBooted){ document.body._lkBooted=true; boot(); } });

function banner(t){ var b=$('lk-banner'); if(b){ b.style.display='block'; b.textContent=t; } }

function bindDom(){
  childSelect=$('child-select'); subjectSelect=$('subject'); taskInput=$('task'); dueInput=$('due');
  timesInput=$('times'); isExamInput=$('is-exam'); addBtn=$('add'); addQuickBtn=$('add-quick');
  inputRow=$('input-row'); subjectSummary=$('subject-summary'); listEl=$('list'); historyNotice=$('history-notice');
  modalBackdrop=$('modal-backdrop'); manageBtn=$('manage-children'); childrenList=$('children-list');
  newChildName=$('new-child-name'); newChildSubjects=$('new-child-subjects'); saveNewChildBtn=$('save-new-child');
  closeModalBtn=$('close-modal'); cancelModalBtn=$('cancel-modal'); onboardingNote=$('onboarding-note');
  editBackdrop=$('edit-backdrop'); editSubject=$('edit-subject'); editTask=$('edit-task');
  editIsExam=$('edit-is-exam'); editDue=$('edit-due'); editTimes=$('edit-times'); editCancel=$('edit-cancel'); editSave=$('edit-save');
}

function init(){
  Array.from(document.querySelectorAll('input,select,textarea')).forEach(el=>{ el.style.fontSize='16px'; });

  on(addBtn,'click', addHomework);
  on(addQuickBtn,'click', ()=>{ if(!hasAnyChild()){ openModal(true); return; } toggleInputRow(); validateForm(); });
  on(isExamInput,'change', ()=>{ toggleTimesForExam(); validateForm(); });
  on(subjectSelect,'change', validateForm);
  on(taskInput,'input', validateForm);
  on(dueInput,'change', validateForm);

  on(editIsExam,'change', toggleEditTimesForExam);
  on(editCancel,'click', ()=> closeEditModal());
  on(editSave,'click', saveEditChanges);

  on(manageBtn,'click', ()=>openModal(false));
  on(closeModalBtn,'click', ()=>{ if(hasAnyChild()) closeModal(); });
  on(cancelModalBtn,'click', ()=> closeModal(true));
  on(saveNewChildBtn,'click', addNewChild);

  if(modalBackdrop){
    modalBackdrop.addEventListener('click', (e)=>{
      const b=e.target.closest('button'); if(!b) return;
      const txt=(b.textContent||'').trim().toLowerCase();
      if(/lägg till barn|lägg till|spara och stäng/.test(txt)){ e.preventDefault(); addNewChild(); }
      else if(/^stäng$/.test(txt)){ e.preventDefault(); closeModal(); }
      else if(/^avbryt$/.test(txt)){ e.preventDefault(); closeModal(true); }
    }, {passive:false});
  }

  document.body.addEventListener('click', (e)=>{
    const chip=e.target.closest('.sub-chip'); if(!chip) return;
    e.preventDefault();
    chip.classList.toggle('active');
    const wrap=chip.closest('.subjects-picker-wrap');
    if(wrap){
      const chosen=Array.from(wrap.querySelectorAll('.sub-chip.active .t')).map(t=>t.textContent.trim());
      wrap._selectedSet=new Set(chosen);
    }
  }, {passive:false});

  migrateStore();
  renderAll();
  toggleTimesForExam(); validateForm();
}

function hasAnyChild(){ return store.children && Object.keys(store.children).length>0; }
function openModal(isOnboarding){
  if(!modalBackdrop) return;
  if(onboardingNote) onboardingNote.style.display = isOnboarding ? 'block' : 'none';
  if(newChildName) newChildName.value='';
  if(newChildSubjects) renderSubjectPicker(newChildSubjects, new Set());
  renderChildrenList();
  modalBackdrop.removeAttribute('hidden');
}
function closeModal(isCancel){
  if(modalBackdrop) modalBackdrop.setAttribute('hidden','');
  if(!store.currentChild && hasAnyChild()){
    store.currentChild = Object.keys(store.children)[0];
    saveStore(); renderAll();
  }
}
function addNewChild(){
  const name=(newChildName&&newChildName.value||'').trim();
  const chosen=newChildSubjects? Array.from(newChildSubjects.querySelectorAll('.sub-chip.active .t')).map(t=>t.textContent.trim()) : [];
  if(!name){ alert('Ange barnets namn.'); if(newChildName) newChildName.focus(); return; }
  if(chosen.length===0){ alert('Välj minst ett ämne.'); return; }
  if(!store.children) store.children={};
  if(store.children[name]){ alert('Det finns redan ett barn med det namnet.'); return; }
  store.children[name]={ subjects: chosen, todos: [], filter:'active', focusedSubject:'' };
  store.currentChild=name;
  saveStore(); renderAll(); closeModal();
}

function renderChildrenList(){
  if(!childrenList) return;
  childrenList.innerHTML='';
  const names=Object.keys(store.children).sort();
  if(names.length===0){
    const p=document.createElement('p'); p.textContent='Inga barn tillagda ännu.'; childrenList.appendChild(p); return;
  }
  names.forEach(name=>{
    const data=store.children[name];
    const box=document.createElement('div'); box.className='child-box';
    const head=document.createElement('button'); head.type='button'; head.className='child-row';
    head.innerHTML=`<span class="child-name">${name}</span><span class="child-subjects-preview">${(data.subjects||[]).join(', ')||'(Inga ämnen)'}</span>`;
    const panel=document.createElement('div'); panel.className='child-panel hidden';

    const nameLabel=document.createElement('label'); nameLabel.className='fld-label'; nameLabel.textContent='Namn';
    const nameInput=document.createElement('input'); nameInput.type='text'; nameInput.className='fld-input'; nameInput.value=name;

    const subjLabel=document.createElement('div'); subjLabel.className='fld-label'; subjLabel.textContent='Aktiva ämnen';
    const subjWrap=document.createElement('div'); subjWrap.className='subjects-picker-wrap';
    const preSel=new Set(data.subjects||[]);
    renderSubjectPicker(subjWrap, preSel);

    const btnRow=document.createElement('div'); btnRow.className='btn-row';
    const saveBtn=document.createElement('button'); saveBtn.type='button'; saveBtn.className='btn'; saveBtn.textContent='Spara';
    const delBtn=document.createElement('button'); delBtn.type='button'; delBtn.className='btn'; delBtn.textContent='Ta bort';
    const closeBtn=document.createElement('button'); closeBtn.type='button'; closeBtn.className='btn'; closeBtn.textContent='Stäng';
    btnRow.appendChild(saveBtn); btnRow.appendChild(delBtn); btnRow.appendChild(closeBtn);

    panel.appendChild(nameLabel); panel.appendChild(nameInput);
    panel.appendChild(subjLabel); panel.appendChild(subjWrap);
    panel.appendChild(btnRow);

    box.appendChild(head); box.appendChild(panel); childrenList.appendChild(box);

    head.addEventListener('click', ()=> panel.classList.toggle('hidden'));
    saveBtn.addEventListener('click', ()=>{
      const newName=(nameInput.value||'').trim();
      const chosen=Array.from(subjWrap.querySelectorAll('.sub-chip.active .t')).map(t=>t.textContent.trim());
      if(!newName){ alert('Ange namn.'); return; }
      if(chosen.length===0){ alert('Välj minst ett ämne.'); return; }
      if(newName!==name){
        if(store.children[newName]){ alert('Det finns redan ett barn med detta namn.'); return; }
        store.children[newName]=store.children[name]; delete store.children[name];
        if(store.currentChild===name) store.currentChild=newName;
      }
      store.children[newName].subjects=chosen;
      saveStore(); renderChildrenList(); renderChildSelect(); renderSubjectOptions();
    });
    delBtn.addEventListener('click', ()=>{
      if(!confirm(`Ta bort ${name}?`)) return;
      delete store.children[name];
      if(store.currentChild===name){
        const remain=Object.keys(store.children); store.currentChild=remain[0]||'';
      }
      saveStore(); renderChildrenList(); renderChildSelect(); renderSubjectOptions();
      if(!hasAnyChild()) openModal(true);
    });
    closeBtn.addEventListener('click', ()=> panel.classList.add('hidden'));
  });
}

function renderSubjectPicker(container, selectedSet){
  if(!container) return;
  container.innerHTML='';
  SUBJECT_GROUPS.forEach(group=>{
    const gh=document.createElement('div'); gh.className='group-header'; gh.textContent=group.title; container.appendChild(gh);
    const row=document.createElement('div'); row.className='subjects-group subject-row';
    group.items.forEach(sub=>{
      const btn=document.createElement('button'); btn.type='button'; btn.className='sub-chip'+(selectedSet.has(sub)?' active':'');
      const icon = subjectIcons[sub] || '📘';
      btn.innerHTML = `<span class="i">${icon}</span> <span class="t">${sub}</span>`;
      row.appendChild(btn);
    });
    container.appendChild(row);
  });
  container._selectedSet = selectedSet;
}

function addHomework(){
  if(!hasAnyChild()){ openModal(true); alert('Lägg till ett barn först.'); return; }
  const s=state();
  const subj=subjectSelect?subjectSelect.value:"";
  const task=(taskInput?taskInput.value:"").trim();
  const due=dueInput?dueInput.value:"";
  const isExam=!!(isExamInput&&isExamInput.checked);
  if(!due){ alert(isExam?'Ange datum för provet.':'Ange datum för läxan.'); if(dueInput) dueInput.focus(); return; }
  const times=isExam?1:(parseInt(timesInput&&timesInput.value)||1);
  if(!s.subjects.includes(subj)){ alert('Ämnet är inte aktivt för detta barn. Lägg till ämnet under Hantera barn.'); return; }
  if(!task) return;
  s.todos.push({ id:safeId(), subj, task, due, timesLeft:times, timesTotal:times, done:false, isExam, completedOn:null });
  saveStore(); resetInputs(); toggleTimesForExam(); validateForm();
  if(inputRow && !inputRow.hasAttribute('hidden')){ inputRow.setAttribute('hidden',''); if(addQuickBtn){ addQuickBtn.setAttribute('aria-expanded','false'); addQuickBtn.textContent='Lägg till läxa/prov'; } }
  renderAll();
}

function state(){
  const name=store.currentChild;
  if(!name||!store.children||!store.children[name]) return {subjects:[],todos:[],filter:"active",focusedSubject:""};
  const s=store.children[name];
  if(!('filter' in s)) s.filter='active';
  if(!('focusedSubject' in s)) s.focusedSubject='';
  if(!('todos' in s)) s.todos=[];
  if(!('subjects' in s)) s.subjects=[];
  return s;
}
function renderAll(){
  finalizeExamsByDate();
  renderChildSelect();
  renderSubjectOptions();
  renderSummary();
  renderList();
  renderChildrenList();
}
function renderChildSelect(){
  if(!childSelect) return;
  childSelect.innerHTML='';
  if(!hasAnyChild()){ childSelect.value=''; return; }
  Object.keys(store.children).sort().forEach(name=>{
    const o=document.createElement('option'); o.value=name; o.textContent=name; childSelect.appendChild(o);
  });
  if(!store.currentChild) store.currentChild=Object.keys(store.children)[0]||'';
  childSelect.value=store.currentChild||'';
  childSelect.onchange=()=>{ store.currentChild=childSelect.value; if(!store.currentChild) return; state().filter='active'; state().focusedSubject=''; saveStore(); renderAll(); };
}
function renderSubjectOptions(){
  if(!subjectSelect) return;
  const s=state(); subjectSelect.innerHTML='';
  if(s.subjects.length===0){
    const o=document.createElement('option'); o.value=''; o.textContent="(Lägg till barn & ämnen via 'Hantera barn')"; subjectSelect.appendChild(o);
  } else {
    ALL_SUBJECTS.filter(sub=>s.subjects.includes(sub)).forEach(sub=>{
      const o=document.createElement('option'); o.value=sub; o.textContent=sub; subjectSelect.appendChild(o);
    });
  }
}
function renderSummary(){
  if(!subjectSummary) return;
  const s=state(); const focused=s.focusedSubject||''; subjectSummary.innerHTML='';
  const allBtn=document.createElement('button'); allBtn.type='button'; allBtn.className='subject-chip'+(focused===''?' selected':''); allBtn.textContent='📊 Alla';
  allBtn.addEventListener('click',()=>{ s.filter='active'; s.focusedSubject=''; renderAll(); });
  subjectSummary.appendChild(allBtn);
  ALL_SUBJECTS.filter(sub=>s.subjects.includes(sub)).forEach(sub=>{
    const kvar=s.todos.filter(t=>t.subj===sub && !t.done).length;
    const btn=document.createElement('button'); btn.type='button'; btn.className='subject-chip'+(focused===sub?' selected':''); btn.title=sub;
    btn.innerHTML=(subjectIcons[sub]||'📘')+' '+sub.slice(0,2)+'<span class="subject-badge">'+kvar+'</span>';
    btn.addEventListener('click',()=>{ s.filter='active'; s.focusedSubject=(focused===sub)?'':sub; renderAll(); });
    subjectSummary.appendChild(btn);
  });
}
function renderList(){
  if(!listEl||!historyNotice) return;
  const s=state(); listEl.innerHTML='';
  const view=s.filter||'active'; const subjFocus=s.focusedSubject||''; const todayISO=todayLocalISO();
  historyNotice.hidden = !(view==='done');

  const items=s.todos.filter(t=>{
    if(subjFocus && t.subj!==subjFocus) return false;
    if(view==='active'&&t.done) return false;
    if(view==='exam'&&(t.done||!t.isExam)) return false;
    if(view==='done'&&!t.done) return false;
    if(view==='done'){
      if(!t.completedOn) return false;
      const d=daysDiff(isoToDate(todayISO), isoToDate(t.completedOn));
      if(!(d>=0&&d<=30)) return false;
    }
    return true;
  });

  if(view==='done'){
    items.sort((a,b)=>{ const ad=a.completedOn||a.due||''; const bd=b.completedOn||b.due||''; return bd.localeCompare(ad); });
  } else {
    const rank=t=>{ if(!t.due) return 3; if(!t.done && t.due<todayISO) return 0; if(!t.done && t.due===todayISO) return 1; return 2; };
    items.sort((a,b)=>{ const ra=rank(a), rb=rank(b); if(ra!==rb) return ra-rb; if(a.due&&b.due) return a.due.localeCompare(b.due); return 0; });
  }

  items.forEach(t=>{
    const li=document.createElement('li');
    if(!t.done&&t.due){ if(t.due<todayISO) li.classList.add('overdue'); else if(t.due===todayISO) li.classList.add('today'); }
    if(t.done) li.classList.add('done');
    if(t.isExam) li.classList.add('exam');
    const card=document.createElement('div'); card.className='li-card li-card-lg';
    const left=document.createElement('div'); left.className='li-main';
    const text=document.createElement('div'); text.className='text text-lg'; text.textContent=`${subjectIcons[t.subj]||"📘"} ${t.subj}: ${t.task}`;
    const meta=document.createElement('div'); meta.className='meta-line meta-lg'; const dateNice=t.due?formatDate(t.due):'';
    meta.textContent = t.due ? dateNice : 'Ingen deadline';
    if(!t.isExam && (t.timesTotal||1)>1){
      const total=t.timesTotal||Math.max(1,t.timesLeft||1);
      const doneCount=Math.max(0,total-(t.timesLeft??total));
      meta.textContent += ` • ${doneCount}/${total} gjorda`;
    }
    if(t.done && t.completedOn){ meta.textContent += ` • Klar: ${formatDate(t.completedOn)}`; }
    left.appendChild(text); left.appendChild(meta);
    const right=document.createElement('div'); right.className='right-actions';
    if(t.isExam){ const examB=document.createElement('span'); examB.className='exam-badge'; examB.textContent='PROV'; right.appendChild(examB); }
    const editBtn=document.createElement('button'); editBtn.textContent='⚙️'; editBtn.className='icon-btn icon-btn-lg'; editBtn.title='Redigera';
    editBtn.addEventListener('click', ()=>openEditModal(t.id));
    right.appendChild(editBtn);
    card.appendChild(left); card.appendChild(right); li.appendChild(card); listEl.appendChild(li);
  });
}

function openEditModal(id){ if(editBackdrop) editBackdrop.removeAttribute('hidden'); }
function toggleEditTimesForExam(){ if(!editTimes||!editIsExam) return; const isExam=!!editIsExam.checked; editTimes.disabled=isExam; if(isExam){ editTimes.value=''; editTimes.placeholder='–'; } else { editTimes.placeholder=''; if(!editTimes.value) editTimes.value=1; } }
function closeEditModal(){ if(editBackdrop) editBackdrop.setAttribute('hidden',''); }
function saveEditChanges(){ closeEditModal(); }

function todayLocalISO(){ const d=new Date(); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }
function isoToDate(iso){ return new Date(iso+'T00:00:00'); }
const MS_DAY=24*60*60*1000; function daysDiff(a,b){ const a0=new Date(a.getFullYear(),a.getMonth(),a.getDate()); const b0=new Date(b.getFullYear(),b.getMonth(),b.getDate()); return Math.floor((a0-b0)/MS_DAY); }
function formatDate(d){ try{ const [y,m,dd]=d.split('-'); return `${dd}/${m}/${y}`; } catch { return d; } }
function migrateStore(){
  try{ const raw=localStorage.getItem(STORAGE_KEY); if(!raw) return;
    const parsed=JSON.parse(raw); if(!parsed.children) return;
    Object.values(parsed.children).forEach(c=>{ (c.todos||[]).forEach(t=>{
      if(typeof t.timesTotal!=='number'||t.timesTotal<1){ t.timesTotal=Math.max(1,t.timesLeft||1); }
      if(t.timesLeft>t.timesTotal){ t.timesLeft=t.timesTotal; }
      if(t.isExam&&t.due&&t.done&&!t.completedOn){ t.completedOn=t.due; }
      if(t.done&&!t.completedOn){ t.completedOn=null; }
    }); });
    store=parsed; localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }catch{}
}
function saveStore(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }catch{} }
function loadStore(){ try{ const raw=localStorage.getItem(STORAGE_KEY); if(!raw) return { currentChild:'', children:{} }; const parsed=JSON.parse(raw); if(!parsed.children) parsed.children={}; return parsed; }catch{ return { currentChild:'', children:{} }; }
function safeId(){ return 'id-'+Math.random().toString(36).slice(2,10); }
function resetInputs(){ if(taskInput) taskInput.value=''; if(dueInput) dueInput.value=''; if(timesInput) timesInput.value=1; if(isExamInput) isExamInput.checked=false; }
function finalizeExamsByDate(){
  const s=state(); if(!s.todos) return;
  const today=todayLocalISO(); let changed=false;
  s.todos.forEach(t=>{ if(t.isExam && t.due && t.due<today && !t.done){ t.done=true; t.completedOn=t.due; changed=true; } });
  if(changed) saveStore();
}
})();