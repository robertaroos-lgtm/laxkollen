
const SUBJECT_GROUPS=[{title:'Språk',items:['Franska','Engelska','Spanska','Svenska','Italienska','Tyska']},{title:'NO',items:['Biologi','Fysik','Kemi','Naturkunskap','NO']},{title:'SO',items:['Geografi','Historia','Samhällskunskap','Religion','SO']},{title:'Praktiskt-estetiska',items:['Musik','Bild','Idrott & Hälsa','Hemkunskap']},{title:'Övrigt',items:['Matte','Teknik']},{title:'Gymnasieämnen',items:['Juridik','Företagsekonomi','Psykologi','Filosofi']}];
const ALL_SUBJECTS=SUBJECT_GROUPS.flatMap(g=>g.items);
const subjectAbbrev={'Svenska':'Sv','Engelska':'En','Spanska':'Sp','Franska':'Fr','Tyska':'Ty','Italienska':'It','Matte':'Ma','Teknik':'Te','Biologi':'Bi','Fysik':'Fy','Kemi':'Ke','Naturkunskap':'Nk','NO':'NO','Geografi':'Ge','Historia':'Hi','Samhällskunskap':'Sh','Religion':'Re','SO':'SO','Musik':'Mu','Bild':'Bl','Idrott & Hälsa':'Id','Hemkunskap':'Hk','Juridik':'Ju','Företagsekonomi':'Fe','Psykologi':'Ps','Filosofi':'Fi'};
const subjectIcons={'Franska':'🇫🇷','Engelska':'🇬🇧','Spanska':'🇪🇸','Svenska':'🇸🇪','Italienska':'🇮🇹','Tyska':'🇩🇪','Biologi':'🧬','Fysik':'⚛️','Kemi':'⚗️','Naturkunskap':'🌿','NO':'🔬','Geografi':'🗺️','Historia':'📜','Samhällskunskap':'🏛️','Religion':'⛪','SO':'🌍','Musik':'🎵','Bild':'🎨','Idrott & Hälsa':'🏃‍♂️','Hemkunskap':'🍳','Matte':'➗','Teknik':'⚙️','Juridik':'⚖️','Företagsekonomi':'💼','Psykologi':'🧠','Filosofi':'🤔'};
const STORAGE_KEY='läxkollen-multi-children-v1'; let store=loadStore(); migrateStore(); let modalSnapshot=null;
const childSelect=document.getElementById('child-select'),subjectSelect=document.getElementById('subject'),taskInput=document.getElementById('task'),dueInput=document.getElementById('due'),timesInput=document.getElementById('times'),isExamInput=document.getElementById('is-exam'),addBtn=document.getElementById('add'),addQuickBtn=document.getElementById('add-quick'),inputRow=document.getElementById('input-row'),chips=Array.from(document.querySelectorAll('.chip')),subjectSummary=document.getElementById('subject-summary'),listEl=document.getElementById('list'),historyNote=document.getElementById('history-note');
const modalBackdrop=document.getElementById('modal-backdrop'),manageBtn=document.getElementById('manage-children'),childrenList=document.getElementById('children-list'),newChildName=document.getElementById('new-child-name'),newChildSubjects=document.getElementById('new-child-subjects'),saveNewChildBtn=document.getElementById('save-new-child'),closeModalBtn=document.getElementById('close-modal'),cancelModalBtn=document.getElementById('cancel-modal'),onboardingNote=document.getElementById('onboarding-note');
const editBackdrop=document.getElementById('edit-backdrop'),editSubject=document.getElementById('edit-subject'),editTask=document.getElementById('edit-task'),editIsExam=document.getElementById('edit-is-exam'),editDue=document.getElementById('edit-due'),editTimes=document.getElementById('edit-times'),editCancel=document.getElementById('edit-cancel'),editSave=document.getElementById('edit-save'); let editingId=null;
document.addEventListener('DOMContentLoaded',()=>{renderAll();ensureOnboarding();toggleTimesForExam();validateForm();});
addBtn.onclick=addHomework; addQuickBtn.onclick=()=>{if(!hasAnyChild()){openModal(true);return;} toggleInputRow(); validateForm();}; manageBtn.onclick=()=>openModal(false);
document.addEventListener('keydown',e=>{const anyModalOpen=!modalBackdrop.hasAttribute('hidden')||!editBackdrop.hasAttribute('hidden'); if(e.key==='Escape'&&!anyModalOpen&&!inputRow.hasAttribute('hidden')) abortInput();});
isExamInput.addEventListener('change',()=>{toggleTimesForExam();validateForm();}); subjectSelect.addEventListener('change',validateForm); taskInput.addEventListener('input',validateForm); dueInput.addEventListener('change',validateForm);
editIsExam.addEventListener('change',toggleEditTimesForExam); editCancel.onclick=()=>closeEditModal(); editSave.onclick=saveEditChanges;
chips.forEach(c=>c.onclick=()=>{ if(!hasAnyChild()){openModal(true);return;} setActiveChip(c.dataset.filter); state().filter=c.dataset.filter; renderAll(); saveStore(); });
childSelect.onchange=()=>{store.currentChild=childSelect.value; if(!store.currentChild) return; state().filter='active'; state().focusedSubject=''; setActiveChip('active'); saveStore(); renderAll();};
closeModalBtn.onclick=()=>{ if(hasAnyChild()) closeModal(); }; cancelModalBtn.onclick=()=>{ if(modalSnapshot){store=modalSnapshot; modalSnapshot=null; saveStore(); renderAll(); showToast('Ändringar ångrade');} modalBackdrop.setAttribute('hidden','');}; saveNewChildBtn.onclick=addNewChild;
function hasAnyChild(){return store.children && Object.keys(store.children).length>0;} function ensureOnboarding(){ if(!hasAnyChild()) openModal(true); }
function state(){const name=store.currentChild; if(!name||!store.children||!store.children[name]) return {subjects:[],todos:[],filter:'active',focusedSubject:''}; const s=store.children[name]; if(!('filter'in s)) s.filter='active'; if(!('focusedSubject'in s)) s.focusedSubject=''; return s;}
function addHomework(){ if(!hasAnyChild()){ openModal(true); alert('Lägg till ett barn först.'); return;} const s=state(); const subj=subjectSelect.value; const task=taskInput.value.trim(); const due=dueInput.value; const isExam=!!isExamInput.checked; if(!due){ alert(isExam?'Ange datum för provet.':'Ange datum för läxan.'); dueInput.focus(); return;} const times=isExam?1:(parseInt(timesInput.value)||1); if(!s.subjects.includes(subj)){ alert('Ämnet är inte aktivt för detta barn. Lägg till ämnet under \"Hantera barn\".'); return;} if(!task) return; s.todos.push({id:safeId(),subj,task,due,timesLeft:times,timesTotal:times,done:false,isExam,completedOn:null}); saveStore(); resetInputs(); toggleTimesForExam(); validateForm(); if(!inputRow.hasAttribute('hidden')){inputRow.setAttribute('hidden',''); addQuickBtn.setAttribute('aria-expanded','false'); addQuickBtn.textContent='Lägg till läxa/prov';} renderAll(); showToast(isExam?'Prov tillagt':'Läxa tillagd');}
function tick(id){const s=state(); const t=s.todos.find(x=>x.id===id); if(!t) return; if(t.isExam){showToast('Prov försvinner automatiskt efter provdatum'); return;} if(t.timesLeft>1){ t.timesLeft--; saveStore(); renderAll(); const total=t.timesTotal||Math.max(1,t.timesLeft||1); const doneCount=Math.max(0,total-t.timesLeft); showToast(`Omgång avklarad (${doneCount}/${total} gjorda)`);} else { t.timesLeft=0; t.done=true; t.completedOn=todayLocalISO(); saveStore(); renderAll(); showToast('Läxa klar!');}}
function removeItem(id){const s=state(); const t=s.todos.find(x=>x.id===id); if(!t) return; const msg=t.isExam?'Är du säker på att du vill radera detta prov?':'Är du säker på att du vill radera denna läxa?'; if(!confirm(msg)) return; s.todos=s.todos.filter(x=>x.id!==id); saveStore(); renderAll(); showToast(t.isExam?'Prov borttaget':'Läxa borttagen');}
function openEditModal(id){const s=state(); const t=s.todos.find(x=>x.id===id); if(!t) return; editingId=id; editSubject.innerHTML=''; s.subjects.forEach(sub=>{const o=document.createElement('option'); o.value=sub; o.textContent=sub; editSubject.appendChild(o);}); editSubject.value=t.subj; editTask.value=t.task; editIsExam.checked=!!t.isExam; editDue.value=t.due||''; editTimes.value=t.timesTotal||Math.max(1,t.timesLeft||1); toggleEditTimesForExam(); editBackdrop.removeAttribute('hidden');}
function toggleEditTimesForExam(){const isExam=!!editIsExam.checked; if(isExam){ editTimes.value=''; editTimes.placeholder='–'; editTimes.disabled=true; } else { editTimes.disabled=false; editTimes.placeholder=''; if(!editTimes.value) editTimes.value=1; }}
function closeEditModal(){ editingId=null; editBackdrop.setAttribute('hidden',''); }
function saveEditChanges(){ if(editingId==null) return; const s=state(); const t=s.todos.find(x=>x.id===editingId); if(!t) return; const newSubj=editSubject.value; const newTask=editTask.value.trim(); const newIsExam=!!editIsExam.checked; const newDue=editDue.value; if(!newDue){ alert(newIsExam?'Ange datum för provet.':'Ange datum för läxan.'); return;} if(!newTask){ alert('Beskriv läxan.'); return;} if(!s.subjects.includes(newSubj)){ alert('Ämnet är inte aktivt för detta barn.'); return;} if(newIsExam){ t.timesTotal=1; t.timesLeft=t.done?0:1; } else { const oldTotal=t.timesTotal||Math.max(1,t.timesLeft||1); const oldDoneCount=Math.max(0,oldTotal-(t.timesLeft??oldTotal)); const newTotal=Math.max(1,parseInt(editTimes.value||'1')); let newLeft=Math.max(0,newTotal-oldDoneCount); if(t.done&&newLeft>0){ t.done=false; t.completedOn=null; } if(!t.done&&newLeft===0){ t.done=true; t.completedOn=t.completedOn||todayLocalISO(); } t.timesTotal=newTotal; t.timesLeft=newLeft; } t.subj=newSubj; t.task=newTask; t.isExam=newIsExam; t.due=newDue; saveStore(); closeEditModal(); renderAll(); showToast('Uppgift uppdaterad');}
function finalizeExamsByDate(){const s=state(); if(!s.todos) return; const today=todayLocalISO(); let changed=false; s.todos.forEach(t=>{ if(t.isExam && t.due && t.due<today && !t.done){ t.done=true; t.completedOn=t.due; changed=true; }}); if(changed) saveStore();}
function renderAll(){ finalizeExamsByDate(); renderChildSelect(); renderSubjectOptions(); renderSummary(); renderList(); toggleHistoryNote(); }
function renderChildSelect(){ childSelect.innerHTML=''; if(!hasAnyChild()){ childSelect.value=''; return;} Object.keys(store.children).sort().forEach(name=>{ const o=document.createElement('option'); o.value=name; o.textContent=name; childSelect.appendChild(o); }); if(!store.currentChild) store.currentChild=Object.keys(store.children)[0]||''; childSelect.value=store.currentChild||''; }
function renderSubjectOptions(){ const s=state(); subjectSelect.innerHTML=''; if(s.subjects.length===0){ const o=document.createElement('option'); o.value=''; o.textContent='(Lägg till barn & ämnen via \"Hantera barn\")'; subjectSelect.appendChild(o); } else { ALL_SUBJECTS.filter(sub=>s.subjects.includes(sub)).forEach(sub=>{ const o=document.createElement('option'); o.value=sub; o.textContent=sub; subjectSelect.appendChild(o); }); } }
function setActiveChip(filter){ chips.forEach(x=>x.classList.remove('active')); const target=chips.find(x=>x.dataset.filter===filter); if(target) target.classList.add('active'); }

function makeSubjectChip(labelFull, code, kvar, isSelected, onClick){
  const chip=document.createElement('button');
  chip.type='button';
  chip.className='subject-chip' + (isSelected?' selected':'');
  chip.setAttribute('aria-pressed', isSelected?'true':'false');
  chip.setAttribute('title', labelFull);
  chip.setAttribute('aria-label', `${labelFull}${kvar>0?`, ${kvar} kvar`:''}`);

  const iconSpan=document.createElement('span');
  iconSpan.textContent=(subjectIcons[labelFull]||'📘');

  const codeSpan=document.createElement('span');
  codeSpan.className='subject-code';
  codeSpan.textContent=' ' + code;

  chip.appendChild(iconSpan);
  chip.appendChild(codeSpan);

  if(kvar>0){
    const b=document.createElement('span');
    b.className='subject-badge';
    b.textContent=String(kvar);
    chip.appendChild(b);
  }

  // Toggle focus on click/keyboard
  chip.onclick=()=>onClick();
  chip.addEventListener('keydown', e=>{
    if(e.key==='Enter'||e.key===' '){ e.preventDefault(); onClick(); }
  });

  // Prevent iOS selection / context menu
  chip.addEventListener('contextmenu', e=>e.preventDefault());
  chip.addEventListener('selectstart', e=>e.preventDefault());

  // Long-press tooltip with movement threshold (iOS-safe)
  let pressTimer=null, sx=0, sy=0;

  const start=(x,y)=>{
    sx=x; sy=y;
    clearTimeout(pressTimer);
    pressTimer=setTimeout(()=>{ showToast(labelFull, 1200); }, 500); // 500ms
  };

  const move=(x,y)=>{
    if(!pressTimer) return;
    const dx=Math.abs(x-sx), dy=Math.abs(y-sy);
    if(dx>10 || dy>10){ clearTimeout(pressTimer); pressTimer=null; }
  };

  const clear=()=>{ if(pressTimer){ clearTimeout(pressTimer); pressTimer=null; } };

  chip.addEventListener('touchstart', e=>{
    const t=e.touches[0];
    start(t.clientX,t.clientY);
  }, {passive:true});

  chip.addEventListener('touchmove', e=>{
    const t=e.touches[0];
    move(t.clientX,t.clientY);
  }, {passive:true});

  chip.addEventListener('touchend', clear);
  chip.addEventListener('touchcancel', clear);

  return chip;
}

function renderSummary(){
  const s = state(); const focused = s.focusedSubject || ''; const totalKvar = s.todos.filter(t=>!t.done).length;
  const wrap = subjectSummary; wrap.innerHTML=''; wrap.classList.add('compact-subjects');
  const allChip = makeSubjectChip('Alla', 'Alla', totalKvar, (focused===''), ()=>{
    s.filter='active'; s.focusedSubject=''; setActiveChip('active'); renderAll();
  });
  wrap.appendChild(allChip);
  ALL_SUBJECTS.filter(sub=>s.subjects.includes(sub)).forEach(sub=>{
    const kvar = s.todos.filter(t=>t.subj===sub && !t.done).length;
    const code = subjectAbbrev[sub] || sub.slice(0,2);
    const chip = makeSubjectChip(sub, code, kvar, (focused===sub), ()=>{
      s.filter='active'; s.focusedSubject = (focused===sub) ? '' : sub;
      setActiveChip('active'); renderAll();
    });
    wrap.appendChild(chip);
  });
}
function renderList(){ const s=state(); listEl.innerHTML=''; const viewFilter=s.filter||'active'; const subjFocus=s.focusedSubject||''; const todayISO=todayLocalISO(); const today=isoToDate(todayISO); const isNarrow=window.matchMedia('(max-width: 420px)').matches; const withinLastMonth=(iso)=>{ if(!iso) return false; const d=isoToDate(iso); return daysDiff(today,d)>=0 && daysDiff(today,d)<=30; }; const items=s.todos.filter(t=>{ if(subjFocus && t.subj!==subjFocus) return false; if(viewFilter==='active' && t.done) return false; if(viewFilter==='exam' && (t.done||!t.isExam)) return false; if(viewFilter==='done' && !t.done) return false; if(viewFilter==='done'){ const ref=t.completedOn||t.due||''; if(!withinLastMonth(ref)) return false; } return true; }); if((s.filter||'active')==='done'){ items.sort((a,b)=>{ const ad=a.completedOn||a.due||''; const bd=b.completedOn||b.due||''; return bd.localeCompare(ad); }); } else { const rank=t=>{ if(!t.due) return 3; if(!t.done && t.due<todayISO) return 0; if(!t.done && t.due===todayISO) return 1; return 2; }; items.sort((a,b)=>{ const ra=rank(a), rb=rank(b); if(ra!==rb) return ra-rb; if(a.due&&b.due) return a.due.localeCompare(b.due); return 0; }); } items.forEach(t=>{ const li=document.createElement('li'); if(!t.done && t.due){ if(t.due<todayISO) li.classList.add('overdue'); else if(t.due===todayISO) li.classList.add('today'); } if(t.done) li.classList.add('done'); if(t.isExam) li.classList.add('exam'); const card=document.createElement('div'); card.className='li-card'; const left=document.createElement('div'); const text=document.createElement('div'); text.className='text'; text.textContent=`${subjectIcons[t.subj]||'📘'} ${t.subj}: ${t.task}`; const meta=document.createElement('div'); meta.className='meta-line'; const dateNice=t.due?formatDate(t.due):''; const dueLabel=computeDueLabel(t,todayISO,dateNice); const dueClass=computeDueClass(t,todayISO); meta.innerHTML=dueLabel?`<span class="due-badge ${dueClass}">${dueLabel}</span>`:''; if(!t.isExam && (t.timesTotal||1)>1){ const total=t.timesTotal||Math.max(1,t.timesLeft||1); const doneCount=Math.max(0,total-(t.timesLeft??total)); meta.innerHTML+=` • <span class="progress-badge">${isNarrow?`${doneCount}/${total}`:`${doneCount}/${total} gjorda`}</span>`; } if(t.done && t.completedOn){ meta.innerHTML+=` • Klar: ${formatDate(t.completedOn)}`; } left.appendChild(text); left.appendChild(meta); const right=document.createElement("div"); right.style.display="flex"; right.style.flexDirection='row'; right.style.alignItems='center'; right.style.gap='8px'; if (t.isExam) {
  const examI = document.createElement("span");
  examB.className = "exam-badge";
  examB.textContent = "PROV";
  right.appendChild(examB);
}
 const editBtn=document.createElement("button"); editBtn.textContent='⚙️'; editBtn.className='icon-btn'; editBtn.title="Redigera"; editBtn.addEventListener('touchstart',e=>e.stopPropagation(),{passive:true}); editBtn.addEventListener('mousedown',e=>e.stopPropagation()); editBtn.onclick=()=>openEditModal(t.id); right.appendChild(editBtn); card.appendChild(left); card.appendChild(right); const icCheck=document.createElement('div'); icCheck.className='swipe-hint check'; icCheck.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>'; const icTrash=document.createElement('div'); icTrash.className='swipe-hint trash'; icTrash.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>'; li.appendChild(icCheck); li.appendChild(icTrash); li.appendChild(card); attachSwipe(li,()=>{ if(!t.isExam) tick(t.id); else showToast('Provdatum styr avslut'); },()=>removeItem(t.id)); listEl.appendChild(li); }); }
function toggleHistoryNote(){ try{ const show=(state().filter||'active')==='done'; if(historyNote) historyNote.hidden=!show; }catch{}}
function todayLocalISO(){ const d=new Date(); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }
function isoToDate(iso){ return new Date(iso+'T00:00:00'); }
const MS_DAY=24*60*60*1000; function daysDiff(a,b){ const a0=new Date(a.getFullYear(),a.getMonth(),a.getDate()); const b0=new Date(b.getFullYear(),b.getMonth(),b.getDate()); return Math.floor((a0-b0)/MS_DAY); }
function computeDueLabel(t,todayISO,dateNice){ if(!t.due) return 'Ingen deadline'; if(t.isExam && t.due<todayISO) return `Provdatum: ${dateNice}`; if(!t.done && t.due===todayISO) return 'Idag'; if(!t.done && t.due<todayISO) return 'Försenad'; return `${dateNice}`;}
function computeDueClass(t,todayISO){ if(!t.due) return ''; if(t.isExam && t.due<todayISO) return ''; if(!t.done && t.due===todayISO) return 'today'; if(!t.done && t.due<todayISO) return 'overdue'; return ''; }
function openModal(isOnboarding=false){ try{ modalSnapshot=JSON.parse(JSON.stringify(store)); }catch{ modalSnapshot=null;} renderChildrenEditor(); onboardingNote.style.display=(isOnboarding||!hasAnyChild())?'block':'none'; newChildName.value=''; newChildSubjects.innerHTML=''; buildSubjectsRows(newChildSubjects); const lock=!hasAnyChild(); closeModalBtn.disabled=lock; cancelModalBtn.disabled=lock; modalBackdrop.removeAttribute('hidden'); }
function closeModal(){ if(!hasAnyChild()) return; const selections={}; Object.keys(store.children).forEach(n=>selections[n]=[]); const active=Array.from(document.querySelectorAll('#children-list .sub-chip.active[data-child]')); active.forEach(btn=>{ const nm=btn.dataset.child; (selections[nm] ||= []).push(btn.dataset.sub); }); Object.entries(selections).forEach(([childName,subjects])=>{ if(store.children[childName]) store.children[childName].subjects=subjects; }); saveStore(); renderAll(); showToast('Ämnen sparade'); modalSnapshot=null; modalBackdrop.setAttribute('hidden',''); }
function renderChildrenEditor(){ childrenList.innerHTML=''; if(!hasAnyChild()) return; Object.entries(store.children).forEach(([name,obj])=>{ const wrap=document.createElement('div'); wrap.className='child-row'; const nameEl=document.createElement('div'); nameEl.style.minWidth='140px'; nameEl.innerHTML=`<strong>${name}</strong>`; const coll=document.createElement('div'); coll.className='subjects-collection'; buildSubjectsRows(coll,obj.subjects,name); const actions=document.createElement('div'); actions.style.display='flex'; actions.style.gap='8px'; actions.style.alignItems='center'; const delBtn=document.createElement('button'); delBtn.className='ghost danger-text'; delBtn.textContent='Ta bort barn'; delBtn.title='Tar bort barnet och alla dess läxor'; delBtn.onclick=()=>deleteChild(name); actions.appendChild(delBtn); wrap.appendChild(nameEl); wrap.appendChild(coll); wrap.appendChild(actions); childrenList.appendChild(wrap); }); }
function buildSubjectsRows(container,preselected=[],childName=null){ SUBJECT_GROUPS.forEach(group=>{ const gwrap=document.createElement('div'); gwrap.className='subjects-group'; const header=document.createElement('div'); header.className='group-header'; header.textContent=group.title; const row=document.createElement('div'); row.className='subject-row'; group.items.forEach(sub=>{ const btn=document.createElement('button'); btn.type='button'; btn.className='sub-chip'; btn.dataset.sub=sub; if(childName) btn.dataset.child=childName; const selected=!!(preselected&&preselected.includes(sub)); if(selected) btn.classList.add('active'); btn.setAttribute('aria-pressed',selected?'true':'false'); btn.textContent=`${subjectIcons[sub]||'📘'} ${sub}`; btn.onclick=()=>{ const ns=!btn.classList.contains('active'); btn.classList.toggle('active',ns); btn.setAttribute('aria-pressed',ns?'true':'false'); }; row.appendChild(btn); }); gwrap.appendChild(header); gwrap.appendChild(row); container.appendChild(gwrap); }); }
function addNewChild(){ const name=newChildName.value.trim(); if(!name){ alert('Ange ett namn.'); return;} if(store.children && store.children[name]){ alert('Det finns redan ett barn med det namnet.'); return;} const subjects=Array.from(newChildSubjects.querySelectorAll('.sub-chip.active')).map(b=>b.dataset.sub); if(!store.children) store.children={}; store.children[name]={subjects,todos:[],filter:'active',focusedSubject:''}; store.currentChild=name; saveStore(); renderAll(); renderChildrenEditor(); closeModalBtn.disabled=false; cancelModalBtn.disabled=false; showToast(`Lade till ${name}`); newChildName.value=''; newChildSubjects.innerHTML=''; buildSubjectsRows(newChildSubjects); }
function deleteChild(name){ if(!confirm(`Vill du ta bort ${name}? Detta tar bort alla läxor för barnet.`)) return; if(store.children) delete store.children[name]; const names=store.children?Object.keys(store.children):[]; store.currentChild=names.length?names[0]:''; if(names.length===0 && !modalBackdrop.hasAttribute('hidden')){ closeModalBtn.disabled=true; cancelModalBtn.disabled=true; } saveStore(); renderAll(); renderChildrenEditor(); }
function toggleInputRow(){ const isHidden=inputRow.hasAttribute('hidden'); if(isHidden){ inputRow.removeAttribute('hidden'); addQuickBtn.setAttribute('aria-expanded','true'); addQuickBtn.textContent='Stäng'; setTimeout(()=>taskInput.focus(),0);} else { abortInput(); } }
function abortInput(){ resetInputs(); toggleTimesForExam(); validateForm(); inputRow.setAttribute('hidden',''); addQuickBtn.setAttribute('aria-expanded','false'); addQuickBtn.textContent='Lägg till läxa/prov'; }
function toggleTimesForExam(){ const isExam=!!isExamInput.checked; if(isExam){ timesInput.value=''; timesInput.placeholder='–'; timesInput.disabled=true; } else { timesInput.disabled=false; timesInput.placeholder=''; if(!timesInput.value) timesInput.value=1; } }
function validateForm(){ const ok=!!subjectSelect.value && taskInput.value.trim().length>0 && !!dueInput.value; addBtn.disabled=!ok; addBtn.setAttribute('aria-disabled',String(!ok)); }
function migrateStore(){ try{ const raw=localStorage.getItem(STORAGE_KEY); if(!raw) return; const parsed=JSON.parse(raw); if(!parsed.children) return; Object.values(parsed.children).forEach(c=>{ (c.todos||[]).forEach(t=>{ if(typeof t.timesTotal!=='number'||t.timesTotal<1){ t.timesTotal=Math.max(1,t.timesLeft||1);} if(t.timesLeft>t.timesTotal){ t.timesLeft=t.timesTotal;} if(t.isExam && t.due && t.done && !t.completedOn){ t.completedOn=t.due;} if(t.done && !t.completedOn){ t.completedOn=null;} });}); store=parsed; localStorage.setItem(STORAGE_KEY,JSON.stringify(store)); }catch{} }
function saveStore(){ localStorage.setItem(STORAGE_KEY,JSON.stringify(store)); }
function loadStore(){ try{ const raw=localStorage.getItem(STORAGE_KEY); if(!raw) return {currentChild:'',children:{}}; const parsed=JSON.parse(raw); if(!parsed.children) parsed.children={}; return parsed; }catch{ return {currentChild:'',children:{}}; } }
function safeId(){ return 'id-'+Math.random().toString(36).slice(2,10); }
function resetInputs(){ taskInput.value=''; dueInput.value=''; timesInput.value=1; isExamInput.checked=false; }
function formatDate(d){ try{ const [y,m,dd]=d.split('-'); return `${dd}/${m}/${y}`; }catch{ return d; } }
let _toastTimer; function showToast(msg,ms=1800){ const el=document.getElementById('toast'); if(!el) return; el.textContent=msg; el.classList.add('show'); clearTimeout(_toastTimer); _toastTimer=setTimeout(()=>el.classList.remove('show'),ms); }
function haptic(type='light'){ try{ if('vibrate' in navigator){ if(type==='heavy') navigator.vibrate([18,60,18]); else if(type==='medium') navigator.vibrate(30); else if(type==='success') navigator.vibrate([8,40,8]); else navigator.vibrate(10); } }catch{} }
function attachSwipe(li,onRight,onLeft){ const card=li.querySelector('.li-card'); const THRESHOLD=72; let startX=0,currentX=0,dragging=false,startedOnInteractive=false; const isInteractive=el=>!!el && el.closest && el.closest('button,a,input,select,textarea,[role="button"]'); const start=(x,evt)=>{ startedOnInteractive=isInteractive(evt?.target); if(startedOnInteractive) return; dragging=true; startX=x; card.style.transition='none'; li.classList.remove('swipe-left','swipe-right'); }; const move=x=>{ if(!dragging) return; currentX=x-startX; card.style.transform=`translateX(${currentX}px)`; if(currentX>0){ li.classList.add('swipe-right'); li.classList.remove('swipe-left'); } else if(currentX<0){ li.classList.add('swipe-left'); li.classList.remove('swipe-right'); } }; const reset=()=>{ card.style.transform='translateX(0)'; li.classList.remove('swipe-left','swipe-right'); }; const end=()=>{ if(startedOnInteractive){ startedOnInteractive=false; return;} if(!dragging) return; dragging=false; card.style.transition=''; if(currentX>THRESHOLD){ haptic('success'); onRight?.(); reset(); } else if(currentX<-THRESHOLD){ haptic('heavy'); onLeft?.(); } else { reset(); } currentX=0; }; li.addEventListener('touchstart',e=>start(e.touches[0].clientX,e),{passive:true}); li.addEventListener('touchmove',e=>move(e.touches[0].clientX),{passive:true}); li.addEventListener('touchend',end); li.addEventListener('mousedown',e=>start(e.clientX,e)); window.addEventListener('mousemove',e=>move(e.clientX)); window.addEventListener('mouseup',end); }
if('serviceWorker' in navigator){ window.addEventListener('load',()=>{ navigator.serviceWorker.register('./sw.js').catch(()=>{}); }); }
