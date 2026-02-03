/* Läxkollen – Familj-sync med Supabase (anonym inloggning)
   - Ingen e-post/lösen
   - Skapa/join familj via kod/QR
   - Full sync av barn + läxor/prov
*/

const SUPABASE_URL = 'https://cxceqsdvxgzskkhkwmpl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xU53VmiQboqZ4E8ckK8lGA_BbQ2QcpH';

const SUBJECT_GROUPS=[
  {title:'Språk',items:['Franska','Engelska','Spanska','Svenska','Italienska','Tyska']},
  {title:'NO',items:['Biologi','Fysik','Kemi','Naturkunskap','NO']},
  {title:'SO',items:['Geografi','Historia','Samhällskunskap','Religion','SO']},
  {title:'Praktiskt-estetiska',items:['Musik','Bild','Idrott & Hälsa','Hemkunskap']},
  {title:'Övrigt',items:['Matte','Teknik']},
  {title:'Gymnasieämnen',items:['Juridik','Företagsekonomi','Psykologi','Filosofi']}
];
const ALL_SUBJECTS=SUBJECT_GROUPS.flatMap(g=>g.items);
const subjectAbbrev={'Svenska':'Sv','Engelska':'En','Spanska':'Sp','Franska':'Fr','Tyska':'Ty','Italienska':'It','Matte':'Ma','Teknik':'Te','Biologi':'Bi','Fysik':'Fy','Kemi':'Ke','Naturkunskap':'Nk','NO':'NO','Geografi':'Ge','Historia':'Hi','Samhällskunskap':'Sh','Religion':'Re','SO':'SO','Musik':'Mu','Bild':'Bl','Idrott & Hälsa':'Id','Hemkunskap':'Hk','Juridik':'Ju','Företagsekonomi':'Fe','Psykologi':'Ps','Filosofi':'Fi'};
const subjectIcons={'Franska':'🇫🇷','Engelska':'🇬🇧','Spanska':'🇪🇸','Svenska':'🇸🇪','Italienska':'🇮🇹','Tyska':'🇩🇪','Biologi':'🧬','Fysik':'⚛️','Kemi':'⚗️','Naturkunskap':'🌿','NO':'🔬','Geografi':'🗺️','Historia':'📜','Samhällskunskap':'🏛️','Religion':'⛪','SO':'🌍','Musik':'🎵','Bild':'🎨','Idrott & Hälsa':'🏃‍♂️','Hemkunskap':'🍳','Matte':'➗','Teknik':'⚙️','Juridik':'⚖️','Företagsekonomi':'💼','Psykologi':'🧠','Filosofi':'🤔'};

const FAMILY_ID_KEY='laxkollen_family_id_v1';
const SWIPE_GUIDE_KEY='laxkollen_swipe_guide_shown_v1';
const ALL_VALUE='__ALL__';

let supabase=null;
let store={
  familyId:null,
  currentChild:ALL_VALUE,
  children:{}, // name -> { id, name, subjects:[], todos:[], filter:'active', focusedSubject:'' }
  ui:{ filter:'active', focusedSubject:'' },
};
let modalSnapshot=null;

// DOM
const childSelect=document.getElementById('child-select');
const subjectSelect=document.getElementById('subject');
const taskInput=document.getElementById('task');
const dueInput=document.getElementById('due');
const timesInput=document.getElementById('times');
const isExamInput=document.getElementById('is-exam');
const addBtn=document.getElementById('add');
const addQuickBtn=document.getElementById('add-quick');
const inputRow=document.getElementById('input-row');
const chips=Array.from(document.querySelectorAll('.chip'));
const subjectSummary=document.getElementById('subject-summary');
const listEl=document.getElementById('list');
const historyNote=document.getElementById('history-note');

const modalBackdrop=document.getElementById('modal-backdrop');
const manageBtn=document.getElementById('manage-children');
const childrenList=document.getElementById('children-list');
const newChildName=document.getElementById('new-child-name');
const newChildSubjects=document.getElementById('new-child-subjects');
const saveNewChildBtn=document.getElementById('save-new-child');
const closeModalBtn=document.getElementById('close-modal');
const cancelModalBtn=document.getElementById('cancel-modal');
const onboardingNote=document.getElementById('onboarding-note');

const editBackdrop=document.getElementById('edit-backdrop');
const editSubject=document.getElementById('edit-subject');
const editTask=document.getElementById('edit-task');
const editIsExam=document.getElementById('edit-is-exam');
const editDue=document.getElementById('edit-due');
const editTimes=document.getElementById('edit-times');
const editCancel=document.getElementById('edit-cancel');
const editSave=document.getElementById('edit-save');
let editingId=null;

// Boot
document.addEventListener('DOMContentLoaded',()=>{ boot().catch(err=>{ console.error(err); showToast('Tekniskt fel vid start'); }); });

async function boot(){
  // Wire UI (must exist even before sync)
  addBtn.onclick=addHomework;
  addQuickBtn.onclick=()=>{ if(!hasAnyChild()){ openModal(true); return; } toggleInputRow(); validateForm(); };
  manageBtn.onclick=()=>openModal(false);

  document.addEventListener('keydown',e=>{
    const anyModalOpen=!modalBackdrop.hasAttribute('hidden')||!editBackdrop.hasAttribute('hidden')||isFamilyOverlayOpen();
    if(e.key==='Escape'&&!anyModalOpen&&!inputRow.hasAttribute('hidden')) abortInput();
  });

  isExamInput.addEventListener('change',()=>{ toggleTimesForExam(); validateForm(); });
  subjectSelect.addEventListener('change',validateForm);
  taskInput.addEventListener('input',validateForm);
  dueInput.addEventListener('change',validateForm);

  editIsExam.addEventListener('change',toggleEditTimesForExam);
  editCancel.onclick=()=>closeEditModal();
  editSave.onclick=saveEditChanges;

  chips.forEach(c=>c.onclick=()=>{
    if(!hasAnyChild()){ openModal(true); return; }
    setActiveChip(c.dataset.filter);
    (state().filter = c.dataset.filter);
    renderAll();
  });

  childSelect.onchange=()=>{
    store.currentChild = childSelect.value;
    if(!store.currentChild) return;
    state().filter='active';
    state().focusedSubject='';
    setActiveChip('active');
    renderAll();
  };

  closeModalBtn.onclick=()=>{ if(hasAnyChild()) closeModal(); };
  cancelModalBtn.onclick=()=>{ rollbackModal(); modalBackdrop.setAttribute('hidden',''); };
  saveNewChildBtn.onclick=addNewChild;

  // Supabase init
  if(!window.supabase){
    // CDN script is defer; wait a tick
    await waitFor(()=>window.supabase, 4000);
  }
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  await ensureAnonSession();
  await ensureFamily();
  await loadFamilyData();

  renderAll();
  ensureOnboarding();
  toggleTimesForExam();
  validateForm();
}

function waitFor(fn, ms=2000){
  const start=Date.now();
  return new Promise((resolve,reject)=>{
    const tick=()=>{
      if(fn()) return resolve(true);
      if(Date.now()-start>ms) return reject(new Error('Timeout'));
      setTimeout(tick,30);
    };
    tick();
  });
}

async function ensureAnonSession(){
  const { data } = await supabase.auth.getSession();
  if(data?.session) return;
  // Anonymous sign-in so Safari may keep it in Keychain/better persistence
  await supabase.auth.signInAnonymously();
}

function parseFamilyCodeFromUrl(){
  try{
    const u=new URL(window.location.href);
    const code=(u.searchParams.get('family')||'').trim();
    return code||null;
  }catch{ return null; }
}

async function ensureFamily(){
  // 1) Join by URL ?family=CODE
  const urlCode=parseFamilyCodeFromUrl();
  if(urlCode){
    const ok = await joinFamilyByCode(urlCode);
    if(ok){
      // Clean URL (avoid re-join on refresh)
      try{ const u=new URL(window.location.href); u.searchParams.delete('family'); window.history.replaceState({},'',u.toString()); }catch{}
      return;
    }
  }

  // 2) Use stored family id
  const stored = localStorage.getItem(FAMILY_ID_KEY);
  if(stored){
    store.familyId = stored;
    const ok = await verifyFamilyMembership(stored);
    if(ok) return;
    store.familyId = null;
    localStorage.removeItem(FAMILY_ID_KEY);
  }

  // 3) Ask user
  await showFamilyOverlay();
}

async function verifyFamilyMembership(familyId){
  try{
    const uid=(await supabase.auth.getUser()).data.user?.id;
    if(!uid) return false;
    const { data, error } = await supabase
      .from('family_members')
      .select('family_id')
      .eq('family_id', familyId)
      .eq('user_id', uid)
      .maybeSingle();
    if(error) return false;
    return !!data;
  }catch{ return false; }
}

function isFamilyOverlayOpen(){
  return !!document.getElementById('family-overlay');
}

async function showFamilyOverlay(){
  return new Promise((resolve)=>{
    const overlay=document.createElement('div');
    overlay.id='family-overlay';
    overlay.className='family-overlay';

    overlay.innerHTML = `
      <div class="family-card" role="dialog" aria-modal="true" aria-labelledby="family-title">
        <div class="family-title" id="family-title">Skapa eller anslut till familj</div>
        <div class="family-sub">För att dela läxor mellan flera enheter skapar du en familj (en kod), eller ansluter genom att skanna en QR-kod.</div>

        <div class="family-actions">
          <button type="button" id="family-create" class="family-primary">Skapa familj</button>
          <button type="button" id="family-join" class="family-secondary">Anslut med kod</button>
        </div>

        <div id="family-join-area" style="display:none;">
          <label class="family-label" for="family-code">Familjekod</label>
          <input id="family-code" class="family-input" inputmode="text" autocomplete="off" placeholder="t.ex. 7KQ9P2" />
          <button type="button" id="family-join-confirm" class="family-primary" style="margin-top:10px;">Anslut</button>
        </div>

        <div id="family-created-area" style="display:none;">
          <div class="family-qr"><canvas id="family-qr"></canvas></div>
          <div class="family-code" id="family-code-out"></div>
          <button type="button" id="family-copy" class="family-smallbtn">Kopiera kod</button>
        </div>

        <div class="family-msg" id="family-msg"></div>
      </div>
    `;

    document.body.appendChild(overlay);

    const msg=overlay.querySelector('#family-msg');
    const createBtn=overlay.querySelector('#family-create');
    const joinBtn=overlay.querySelector('#family-join');
    const joinArea=overlay.querySelector('#family-join-area');
    const joinConfirm=overlay.querySelector('#family-join-confirm');
    const codeInput=overlay.querySelector('#family-code');
    const createdArea=overlay.querySelector('#family-created-area');
    const codeOut=overlay.querySelector('#family-code-out');
    const copyBtn=overlay.querySelector('#family-copy');

    const setMsg=(t)=>{ msg.textContent=t||''; };
    const setBusy=(b)=>{ createBtn.disabled=b; joinBtn.disabled=b; joinConfirm.disabled=b; };

    joinBtn.onclick=()=>{ joinArea.style.display='block'; setMsg(''); codeInput.focus(); };

    createBtn.onclick=async()=>{
      setBusy(true);
      setMsg('Skapar familj…');
      const res = await createFamily();
      if(!res.ok){ setBusy(false); setMsg(res.error||'Kunde inte skapa familj'); return; }

      joinArea.style.display='none';
      createdArea.style.display='block';
      codeOut.textContent = res.code;

      try{
        const link = makeFamilyLink(res.code);
        const canvas = overlay.querySelector('#family-qr');
        if(window.QRCode && canvas){
          await window.QRCode.toCanvas(canvas, link, { margin:1, width:220 });
        }
      }catch{}

      copyBtn.onclick=async()=>{
        try{ await navigator.clipboard.writeText(res.code); showToast('Kopierat'); }catch{ showToast('Kunde inte kopiera'); }
      };

      setMsg('Klart! Låt en familjemedlem skanna QR-koden eller skriva in koden.');
      setBusy(false);

      // When family created we can continue immediately
      setTimeout(()=>{
        overlay.remove();
        resolve(true);
      }, 900);
    };

    joinConfirm.onclick=async()=>{
      const code=(codeInput.value||'').trim();
      if(!code){ setMsg('Skriv in en kod.'); return; }
      setBusy(true);
      setMsg('Ansluter…');
      const ok = await joinFamilyByCode(code);
      if(!ok){ setBusy(false); setMsg('Koden verkar inte stämma.'); return; }
      setMsg('Ansluten!');
      setTimeout(()=>{
        overlay.remove();
        resolve(true);
      }, 400);
    };
  });
}

function makeFamilyLink(code){
  try{
    const u=new URL(window.location.href);
    u.searchParams.set('family', code);
    return u.toString();
  }catch{
    return `?family=${encodeURIComponent(code)}`;
  }
}

function genFamilyCode(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out='';
  for(let i=0;i<6;i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}

async function createFamily(){
  try{
    const uid=(await supabase.auth.getUser()).data.user?.id;
    if(!uid) return {ok:false,error:'Ingen användare'};

    // try few codes to avoid collision
    let code=null, familyRow=null;
    for(let i=0;i<5;i++){
      const c=genFamilyCode();
      const { data, error } = await supabase
        .from('families')
        .insert({ code: c })
        .select('id,code')
        .single();
      if(!error && data){ code=data.code; familyRow=data; break; }
    }
    if(!familyRow) return {ok:false,error:'Kunde inte skapa familj'};

    const { error: mErr } = await supabase
      .from('family_members')
      .insert({ family_id: familyRow.id, user_id: uid });
    if(mErr) return {ok:false,error:'Kunde inte lägga till medlem'};

    store.familyId = familyRow.id;
    localStorage.setItem(FAMILY_ID_KEY, store.familyId);

    return {ok:true, code: familyRow.code};
  }catch(e){
    return {ok:false,error:String(e?.message||e)};
  }
}

async function joinFamilyByCode(codeRaw){
  const code=(codeRaw||'').trim().toUpperCase();
  if(!code) return false;
  try{
    const uid=(await supabase.auth.getUser()).data.user?.id;
    if(!uid) return false;

    // Preferred: RPC (if you add it). If not exists, fallback.
    const { data: rpcData, error: rpcErr } = await supabase.rpc('join_family_by_code', { p_code: code });
    if(!rpcErr && rpcData){
      store.familyId = rpcData;
      localStorage.setItem(FAMILY_ID_KEY, store.familyId);
      return true;
    }

    const { data: fam, error: fErr } = await supabase
      .from('families')
      .select('id,code')
      .eq('code', code)
      .single();
    if(fErr || !fam) return false;

    // upsert membership
    await supabase
      .from('family_members')
      .upsert({ family_id: fam.id, user_id: uid }, { onConflict: 'family_id,user_id' });

    store.familyId = fam.id;
    localStorage.setItem(FAMILY_ID_KEY, store.familyId);
    return true;
  }catch{ return false; }
}

// =====================
// Data loading / syncing
// =====================

async function loadFamilyData(){
  store.children = {};

  if(!store.familyId) return;

  const { data: kids, error: kidsErr } = await supabase
    .from('children')
    .select('id,name,subjects')
    .eq('family_id', store.familyId)
    .order('created_at', { ascending: true });

  if(kidsErr){
    console.error(kidsErr);
    showToast('Kunde inte läsa barn');
    return;
  }

  (kids||[]).forEach(k=>{
    store.children[k.name] = {
      id: k.id,
      name: k.name,
      subjects: Array.isArray(k.subjects) ? k.subjects : [],
      todos: [],
      filter:'active',
      focusedSubject:''
    };
  });

  const { data: tasks, error: tErr } = await supabase
    .from('tasks')
    .select('id,child_id,subj,task,due,times_left,times_total,done,is_exam,completed_on,created_at')
    .eq('family_id', store.familyId);

  if(tErr){
    console.error(tErr);
    showToast('Kunde inte läsa läxor');
    return;
  }

  const byId = new Map(Object.values(store.children).map(c=>[c.id,c]));
  (tasks||[]).forEach(t=>{
    const child = byId.get(t.child_id);
    if(!child) return;
    child.todos.push({
      id: t.id,
      childId: t.child_id,
      childName: child.name,
      subj: t.subj,
      task: t.task,
      due: t.due,
      timesLeft: t.times_left ?? 1,
      timesTotal: t.times_total ?? 1,
      done: !!t.done,
      isExam: !!t.is_exam,
      completedOn: t.completed_on || null,
    });
  });

  // default view
  if(!store.currentChild) store.currentChild = ALL_VALUE;
}

function hasAnyChild(){
  return store.children && Object.keys(store.children).length>0;
}

function ensureOnboarding(){
  if(!hasAnyChild()) openModal(true);
}

function state(){
  const name=store.currentChild;
  if(name===ALL_VALUE){
    return store.ui;
  }
  if(!name || !store.children || !store.children[name]){
    return { subjects:[], todos:[], filter:'active', focusedSubject:'' };
  }
  const s=store.children[name];
  if(!('filter' in s)) s.filter='active';
  if(!('focusedSubject' in s)) s.focusedSubject='';
  return s;
}

function allTodos(){
  return Object.values(store.children).flatMap(c=>c.todos||[]);
}

function currentTodos(){
  if(store.currentChild===ALL_VALUE) return allTodos();
  return (store.children[store.currentChild]?.todos)||[];
}

function currentSubjects(){
  if(store.currentChild===ALL_VALUE){
    const set=new Set();
    Object.values(store.children).forEach(c=>(c.subjects||[]).forEach(s=>set.add(s)));
    return Array.from(set);
  }
  return (store.children[store.currentChild]?.subjects)||[];
}

// =====================
// Homework CRUD (synced)
// =====================

async function addHomework(){
  if(!hasAnyChild()){
    openModal(true);
    alert('Lägg till ett barn först.');
    return;
  }

  if(store.currentChild===ALL_VALUE){
    alert('Välj ett barn i rullistan innan du lägger till en läxa/prov.');
    return;
  }

  const child=store.children[store.currentChild];
  if(!child){
    alert('Välj ett barn.');
    return;
  }

  const subj=subjectSelect.value;
  const task=taskInput.value.trim();
  const due=dueInput.value;
  const isExam=!!isExamInput.checked;

  if(!due){
    alert(isExam?'Ange datum för provet.':'Ange datum för läxan.');
    dueInput.focus();
    return;
  }

  const times=isExam?1:(parseInt(timesInput.value)||1);

  if(!(child.subjects||[]).includes(subj)){
    alert('Ämnet är inte aktivt för detta barn. Lägg till ämnet under "Hantera barn".');
    return;
  }
  if(!task) return;

  const payload={
    family_id: store.familyId,
    child_id: child.id,
    subj,
    task,
    due,
    times_left: times,
    times_total: times,
    done: false,
    is_exam: isExam,
    completed_on: null,
  };

  const { data, error } = await supabase
    .from('tasks')
    .insert(payload)
    .select('id,child_id,subj,task,due,times_left,times_total,done,is_exam,completed_on')
    .single();

  if(error){
    console.error(error);
    showToast('Kunde inte spara');
    return;
  }

  child.todos.push({
    id: data.id,
    childId: child.id,
    childName: child.name,
    subj: data.subj,
    task: data.task,
    due: data.due,
    timesLeft: data.times_left ?? 1,
    timesTotal: data.times_total ?? 1,
    done: !!data.done,
    isExam: !!data.is_exam,
    completedOn: data.completed_on || null,
  });

  resetInputs();
  toggleTimesForExam();
  validateForm();

  // close add-row
  if(!inputRow.hasAttribute('hidden')){
    inputRow.setAttribute('hidden','');
    addQuickBtn.setAttribute('aria-expanded','false');
    addQuickBtn.textContent='Lägg till läxa/prov';
  }

  renderAll();
  showToast(isExam?'Prov tillagt':'Läxa tillagd');

  // swipe mini-tutorial first time
  try{
    if(!localStorage.getItem(SWIPE_GUIDE_KEY)){
      localStorage.setItem(SWIPE_GUIDE_KEY,'1');
      setTimeout(()=>{
        showToast('Tips: swipe → för KLAR, swipe ← för RADERA', 2600);
      }, 450);
    }
  }catch{}
}

function findTaskById(id){
  for(const c of Object.values(store.children)){
    const t=(c.todos||[]).find(x=>x.id===id);
    if(t) return { child:c, task:t };
  }
  return null;
}

async function tick(id){
  const found=findTaskById(id);
  if(!found) return;
  const { child, task:t } = found;

  if(t.isExam){
    showToast('Prov försvinner automatiskt efter provdatum');
    return;
  }

  let update={};
  if((t.timesLeft||1)>1){
    t.timesLeft--;
    update = { times_left: t.timesLeft };
  } else {
    t.timesLeft=0;
    t.done=true;
    t.completedOn=todayLocalISO();
    update = { times_left: 0, done: true, completed_on: t.completedOn };
  }

  const { error } = await supabase.from('tasks').update(update).eq('id', t.id);
  if(error){
    console.error(error);
    showToast('Kunde inte spara');
    return;
  }

  renderAll();

  if(update.done){
    showToast('Läxa klar!');
  } else {
    const total=t.timesTotal||Math.max(1,t.timesLeft||1);
    const doneCount=Math.max(0,total-t.timesLeft);
    showToast(`Omgång avklarad (${doneCount}/${total} gjorda)`);
  }
}

async function removeItem(id){
  const found=findTaskById(id);
  if(!found) return;
  const { child, task:t } = found;

  const msg=t.isExam?'Är du säker på att du vill radera detta prov?':'Är du säker på att du vill radera denna läxa?';
  if(!confirm(msg)) return;

  const { error } = await supabase.from('tasks').delete().eq('id', t.id);
  if(error){
    console.error(error);
    showToast('Kunde inte radera');
    return;
  }

  child.todos = (child.todos||[]).filter(x=>x.id!==t.id);
  renderAll();
  showToast(t.isExam?'Prov borttaget':'Läxa borttagen');
}

function openEditModal(id){
  const found=findTaskById(id);
  if(!found) return;
  const { child, task:t } = found;

  editingId=id;
  editSubject.innerHTML='';
  (child.subjects||[]).forEach(sub=>{
    const o=document.createElement('option');
    o.value=sub;
    o.textContent=`${subjectIcons[sub]||'📘'} ${sub}`;
    editSubject.appendChild(o);
  });

  editSubject.value=t.subj;
  editTask.value=t.task;
  editIsExam.checked=!!t.isExam;
  editDue.value=t.due||'';
  editTimes.value=t.timesTotal||Math.max(1,t.timesLeft||1);
  toggleEditTimesForExam();
  editBackdrop.removeAttribute('hidden');
}

function toggleEditTimesForExam(){
  const isExam=!!editIsExam.checked;
  if(isExam){
    editTimes.value='';
    editTimes.placeholder='–';
    editTimes.disabled=true;
  } else {
    editTimes.disabled=false;
    editTimes.placeholder='';
    if(!editTimes.value) editTimes.value=1;
  }
}

function closeEditModal(){
  editingId=null;
  editBackdrop.setAttribute('hidden','');
}

async function saveEditChanges(){
  if(editingId==null) return;
  const found=findTaskById(editingId);
  if(!found) return;
  const { child, task:t } = found;

  const newSubj=editSubject.value;
  const newTask=editTask.value.trim();
  const newIsExam=!!editIsExam.checked;
  const newDue=editDue.value;

  if(!newDue){
    alert(newIsExam?'Ange datum för provet.':'Ange datum för läxan.');
    return;
  }
  if(!newTask){
    alert('Beskriv läxan.');
    return;
  }
  if(!(child.subjects||[]).includes(newSubj)){
    alert('Ämnet är inte aktivt för detta barn.');
    return;
  }

  // compute repetition fields
  let times_total=t.timesTotal||Math.max(1,t.timesLeft||1);
  let times_left=t.timesLeft??times_total;
  let done=t.done;
  let completed_on=t.completedOn||null;

  if(newIsExam){
    times_total=1;
    times_left=done?0:1;
  } else {
    const oldTotal=t.timesTotal||Math.max(1,t.timesLeft||1);
    const oldDoneCount=Math.max(0, oldTotal-(t.timesLeft??oldTotal));
    const newTotal=Math.max(1, parseInt(editTimes.value||'1'));
    let newLeft=Math.max(0, newTotal-oldDoneCount);

    if(done && newLeft>0){
      done=false;
      completed_on=null;
    }
    if(!done && newLeft===0){
      done=true;
      completed_on=completed_on||todayLocalISO();
    }

    times_total=newTotal;
    times_left=newLeft;
  }

  const updatePayload={
    subj: newSubj,
    task: newTask,
    due: newDue,
    is_exam: newIsExam,
    times_total,
    times_left,
    done,
    completed_on,
  };

  const { error } = await supabase.from('tasks').update(updatePayload).eq('id', t.id);
  if(error){
    console.error(error);
    showToast('Kunde inte spara');
    return;
  }

  // update local
  t.subj=newSubj;
  t.task=newTask;
  t.due=newDue;
  t.isExam=newIsExam;
  t.timesTotal=times_total;
  t.timesLeft=times_left;
  t.done=done;
  t.completedOn=completed_on;

  closeEditModal();
  renderAll();
  showToast('Uppgift uppdaterad');
}

async function finalizeExamsByDate(){
  // Mark old exams as done (local + remote), best-effort.
  const today=todayLocalISO();
  const toUpdate=[];
  for(const c of Object.values(store.children)){
    (c.todos||[]).forEach(t=>{
      if(t.isExam && t.due && t.due<today && !t.done){
        t.done=true;
        t.completedOn=t.due;
        toUpdate.push({ id:t.id, done:true, completed_on:t.due, times_left:0 });
      }
    });
  }
  if(toUpdate.length===0) return;

  try{
    // update one by one (small volumes)
    for(const u of toUpdate){
      await supabase.from('tasks').update({ done:u.done, completed_on:u.completed_on }).eq('id', u.id);
    }
  }catch{}
}

// ============
// Render
// ============

function renderAll(){
  finalizeExamsByDate();
  renderChildSelect();
  renderSubjectOptions();
  renderSummary();
  renderList();
  toggleHistoryNote();
}

function renderChildSelect(){
  childSelect.innerHTML='';

  const allOpt=document.createElement('option');
  allOpt.value=ALL_VALUE;
  allOpt.textContent='Alla';
  childSelect.appendChild(allOpt);

  const names=Object.keys(store.children||{}).sort();
  names.forEach(name=>{
    const o=document.createElement('option');
    o.value=name;
    o.textContent=name;
    childSelect.appendChild(o);
  });

  if(!store.currentChild) store.currentChild=ALL_VALUE;
  if(store.currentChild!==ALL_VALUE && !store.children[store.currentChild]){
    store.currentChild = names[0] || ALL_VALUE;
  }

  childSelect.value = store.currentChild;
}

function renderSubjectOptions(){
  const subs = currentSubjects();
  subjectSelect.innerHTML='';

  if(store.currentChild===ALL_VALUE){
    const o=document.createElement('option');
    o.value='';
    o.textContent='(Välj ett barn för att lägga till)';
    subjectSelect.appendChild(o);
    return;
  }

  if(subs.length===0){
    const o=document.createElement('option');
    o.value='';
    o.textContent='(Lägg till ämnen via "Hantera barn")';
    subjectSelect.appendChild(o);
    return;
  }

  ALL_SUBJECTS.filter(s=>subs.includes(s)).forEach(sub=>{
    const o=document.createElement('option');
    o.value=sub;
    o.textContent=`${subjectIcons[sub]||'📘'} ${sub}`;
    subjectSelect.appendChild(o);
  });
}

function setActiveChip(filter){
  chips.forEach(x=>x.classList.remove('active'));
  const target=chips.find(x=>x.dataset.filter===filter);
  if(target) target.classList.add('active');
}

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

  chip.onclick=()=>onClick();
  chip.addEventListener('keydown', e=>{
    if(e.key==='Enter'||e.key===' '){ e.preventDefault(); onClick(); }
  });

  chip.addEventListener('contextmenu', e=>e.preventDefault());
  chip.addEventListener('selectstart', e=>e.preventDefault());

  // long press tooltip
  let pressTimer=null, sx=0, sy=0;
  const start=(x,y)=>{ sx=x; sy=y; clearTimeout(pressTimer); pressTimer=setTimeout(()=>{ showToast(labelFull, 1200); }, 500); };
  const move=(x,y)=>{ if(!pressTimer) return; const dx=Math.abs(x-sx), dy=Math.abs(y-sy); if(dx>10||dy>10){ clearTimeout(pressTimer); pressTimer=null; } };
  const clear=()=>{ if(pressTimer){ clearTimeout(pressTimer); pressTimer=null; } };

  chip.addEventListener('touchstart', e=>{ const t=e.touches[0]; start(t.clientX,t.clientY); }, {passive:true});
  chip.addEventListener('touchmove', e=>{ const t=e.touches[0]; move(t.clientX,t.clientY); }, {passive:true});
  chip.addEventListener('touchend', clear);
  chip.addEventListener('touchcancel', clear);

  return chip;
}

function renderSummary(){
  // For ALL-view this gets noisy; keep it but based on current selection
  const s=state();
  const focused=s.focusedSubject || '';
  const todos=currentTodos();
  const totalKvar=todos.filter(t=>!t.done).length;

  const wrap=subjectSummary;
  if(!wrap) return;

  wrap.innerHTML='';
  wrap.classList.add('compact-subjects');

  const allChip=makeSubjectChip('Alla', 'Alla', totalKvar, (focused===''), ()=>{
    s.filter='active';
    s.focusedSubject='';
    setActiveChip('active');
    renderAll();
  });
  wrap.appendChild(allChip);

  const subs=currentSubjects();
  ALL_SUBJECTS.filter(sub=>subs.includes(sub)).forEach(sub=>{
    const kvar=todos.filter(t=>t.subj===sub && !t.done).length;
    const code=subjectAbbrev[sub] || sub.slice(0,2);
    const chip=makeSubjectChip(sub, code, kvar, (focused===sub), ()=>{
      s.filter='active';
      s.focusedSubject = (focused===sub) ? '' : sub;
      setActiveChip('active');
      renderAll();
    });
    wrap.appendChild(chip);
  });
}

function renderList(){
  const s=state();
  listEl.innerHTML='';

  const viewFilter=s.filter||'active';
  const subjFocus=s.focusedSubject||'';
  const todayISO=todayLocalISO();
  const today=isoToDate(todayISO);
  const isNarrow=window.matchMedia('(max-width: 420px)').matches;

  const withinLastMonth=(iso)=>{
    if(!iso) return false;
    const d=isoToDate(iso);
    return daysDiff(today,d)>=0 && daysDiff(today,d)<=30;
  };

  let items=currentTodos().filter(t=>{
    if(subjFocus && t.subj!==subjFocus) return false;
    if(viewFilter==='active' && t.done) return false;
    if(viewFilter==='exam' && (t.done||!t.isExam)) return false;
    if(viewFilter==='done' && !t.done) return false;
    if(viewFilter==='done'){
      const ref=t.completedOn||t.due||'';
      if(!withinLastMonth(ref)) return false;
    }
    return true;
  });

  if(viewFilter==='done'){
    items.sort((a,b)=>{
      const ad=a.completedOn||a.due||'';
      const bd=b.completedOn||b.due||'';
      return bd.localeCompare(ad);
    });
  } else {
    const rank=t=>{
      if(!t.due) return 3;
      if(!t.done && t.due<todayISO) return 0;
      if(!t.done && t.due===todayISO) return 1;
      return 2;
    };
    items.sort((a,b)=>{
      const ra=rank(a), rb=rank(b);
      if(ra!==rb) return ra-rb;
      if(a.due && b.due) return a.due.localeCompare(b.due);
      return 0;
    });
  }

  items.forEach(t=>{
    const li=document.createElement('li');
    if(!t.done && t.due){
      if(t.due<todayISO) li.classList.add('overdue');
      else if(t.due===todayISO) li.classList.add('today');
    }
    if(t.done) li.classList.add('done');
    if(t.isExam) li.classList.add('exam');

    const card=document.createElement('div');
    card.className='li-card';

    const left=document.createElement('div');

    const text=document.createElement('div');
    text.className='text';
    const childPrefix = (store.currentChild===ALL_VALUE) ? `${t.childName} • ` : '';
    text.textContent=`${childPrefix}${subjectIcons[t.subj]||'📘'} ${t.subj}: ${t.task}`;

    const meta=document.createElement('div');
    meta.className='meta-line';
    const dateNice=t.due?formatDate(t.due):'';
    const dueLabel=computeDueLabel(t,todayISO,dateNice);
    const dueClass=computeDueClass(t,todayISO);
    meta.innerHTML=dueLabel?`<span class="due-badge ${dueClass}">${dueLabel}</span>`:'';

    if(!t.isExam && (t.timesTotal||1)>1){
      const total=t.timesTotal||Math.max(1,t.timesLeft||1);
      const doneCount=Math.max(0,total-(t.timesLeft??total));
      meta.innerHTML+=` • <span class="progress-badge">${isNarrow?`${doneCount}/${total}`:`${doneCount}/${total} gjorda`}</span>`;
    }
    if(t.done && t.completedOn){
      meta.innerHTML+=` • Klar: ${formatDate(t.completedOn)}`;
    }

    left.appendChild(text);
    left.appendChild(meta);

    const right=document.createElement('div');
    right.style.display='flex';
    right.style.flexDirection='row';
    right.style.alignItems='center';
    right.style.gap='8px';

    // 1) PROV badge (gul) före kugghjul
    if(t.isExam){
      const examB=document.createElement('span');
      examB.className='exam-badge';
      examB.textContent='PROV';
      right.appendChild(examB);
    }

    // 2) edit button
    const editBtn=document.createElement('button');
    editBtn.textContent='⚙️';
    editBtn.className='icon-btn';
    editBtn.title='Redigera';
    editBtn.addEventListener('touchstart',e=>e.stopPropagation(),{passive:true});
    editBtn.addEventListener('mousedown',e=>e.stopPropagation());
    editBtn.onclick=()=>openEditModal(t.id);
    right.appendChild(editBtn);

    card.appendChild(left);
    card.appendChild(right);

    const icCheck=document.createElement('div');
    icCheck.className='swipe-hint check';
    icCheck.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';

    const icTrash=document.createElement('div');
    icTrash.className='swipe-hint trash';
    icTrash.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>';

    li.appendChild(icCheck);
    li.appendChild(icTrash);
    li.appendChild(card);

    attachSwipe(li,
      ()=>{ if(!t.isExam) tick(t.id); else showToast('Provdatum styr avslut'); },
      ()=>removeItem(t.id)
    );

    listEl.appendChild(li);
  });
}

function toggleHistoryNote(){
  try{
    const show=(state().filter||'active')==='done';
    if(historyNote) historyNote.hidden=!show;
  }catch{}
}

// ============
// Children modal (synced)
// ============

function openModal(isOnboarding=false){
  modalSnapshot=deepCloneStoreSnapshot();

  // Build subject picker if empty
  if(newChildSubjects && newChildSubjects.children.length===0){
    buildSubjectsRows(newChildSubjects);
  }

  if(onboardingNote){
    onboardingNote.style.display=(isOnboarding||!hasAnyChild())?'block':'none';
  }

  const lock=!hasAnyChild();
  closeModalBtn.disabled=lock;
  cancelModalBtn.disabled=lock;

  renderChildrenEditor();
  modalBackdrop.removeAttribute('hidden');
}

function rollbackModal(){
  if(modalSnapshot){
    store = modalSnapshot;
    modalSnapshot=null;
    renderAll();
    showToast('Ändringar ångrade');
  }
}

function closeModal(){
  if(!hasAnyChild()) return;
  modalSnapshot=null;
  modalBackdrop.setAttribute('hidden','');
}

function renderChildrenEditor(){
  if(!childrenList) return;
  childrenList.innerHTML='';

  const names=Object.keys(store.children||{}).sort();
  if(names.length===0) return;

  names.forEach(name=>{
    const child=store.children[name];

    const wrap=document.createElement('div');
    wrap.className='child-row';

    const nameEl=document.createElement('div');
    nameEl.style.minWidth='140px';
    nameEl.innerHTML=`<strong>${name}</strong>`;

    const coll=document.createElement('div');
    coll.className='subjects-collection';
    coll.textContent='';

    const actions=document.createElement('div');
    actions.style.display='flex';
    actions.style.gap='8px';
    actions.style.alignItems='center';
    actions.style.marginLeft='auto';

    const editBtn=document.createElement('button');
    editBtn.type='button';
    editBtn.className='ghost icon-btn';
    editBtn.textContent='⚙️';
    editBtn.title='Redigera ämnen';
    editBtn.onclick=()=>startEditChildSubjects(name);

    const delBtn=document.createElement('button');
    delBtn.className='ghost danger-text';
    delBtn.textContent='Ta bort barn';
    delBtn.title='Tar bort barnet och alla dess läxor';
    delBtn.onclick=()=>deleteChild(name);

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    wrap.appendChild(nameEl);
    wrap.appendChild(coll);
    wrap.appendChild(actions);

    childrenList.appendChild(wrap);
  });
}

let editingChildName=null;

function buildSubjectsRows(container, preselected=[]){
  container.innerHTML='';
  SUBJECT_GROUPS.forEach(group=>{
    const gwrap=document.createElement('div');
    gwrap.className='subjects-group';

    const header=document.createElement('div');
    header.className='group-header';
    header.textContent=group.title;

    const row=document.createElement('div');
    row.className='subject-row';

    group.items.forEach(sub=>{
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='sub-chip';
      btn.dataset.sub=sub;

      const selected=!!(preselected&&preselected.includes(sub));
      if(selected) btn.classList.add('active');
      btn.setAttribute('aria-pressed', selected?'true':'false');

      btn.textContent=`${subjectIcons[sub]||'📘'} ${sub}`;

      btn.onclick=()=>{
        const ns=!btn.classList.contains('active');
        btn.classList.toggle('active', ns);
        btn.setAttribute('aria-pressed', ns?'true':'false');
      };

      row.appendChild(btn);
    });

    gwrap.appendChild(header);
    gwrap.appendChild(row);
    container.appendChild(gwrap);
  });
}

function selectedSubjects(){
  return Array.from(newChildSubjects.querySelectorAll('.sub-chip.active')).map(b=>b.dataset.sub);
}

async function addNewChild(){
  const name=(newChildName.value||'').trim();
  if(!name){ alert('Ange ett namn.'); return; }
  if(store.children && store.children[name]){ alert('Det finns redan ett barn med det namnet.'); return; }

  const subjects=selectedSubjects();

  const payload={
    family_id: store.familyId,
    name,
    subjects
  };

  const { data, error } = await supabase
    .from('children')
    .insert(payload)
    .select('id,name,subjects')
    .single();

  if(error){
    console.error(error);
    showToast('Kunde inte spara barn');
    return;
  }

  store.children[data.name]={
    id:data.id,
    name:data.name,
    subjects:Array.isArray(data.subjects)?data.subjects:[],
    todos:[],
    filter:'active',
    focusedSubject:''
  };

  store.currentChild = data.name;
  childSelect.value = data.name;

  // reset inputs
  newChildName.value='';
  buildSubjectsRows(newChildSubjects);

  closeModalBtn.disabled=false;
  cancelModalBtn.disabled=false;

  renderAll();
  renderChildrenEditor();
  showToast(`Lade till ${data.name}`);
}

function startEditChildSubjects(name){
  if(!store.children || !store.children[name]) return;
  editingChildName = name;

  newChildName.value = name;
  newChildName.disabled = true;

  buildSubjectsRows(newChildSubjects, store.children[name].subjects||[]);

  saveNewChildBtn.textContent='Spara ändringar';
  saveNewChildBtn.onclick = saveEditedChildSubjects;
}

async function saveEditedChildSubjects(){
  const name=editingChildName;
  if(!name || !store.children[name]){ resetChildEditor(); return; }

  const subjects=selectedSubjects();
  const child=store.children[name];

  const { error } = await supabase
    .from('children')
    .update({ subjects })
    .eq('id', child.id);

  if(error){
    console.error(error);
    showToast('Kunde inte spara');
    return;
  }

  child.subjects = subjects;

  // If some tasks now have invalid subject, keep them but they won't be selectable.
  renderAll();
  renderChildrenEditor();
  showToast(`Uppdaterade ämnen för ${name}`);

  resetChildEditor();
}

function resetChildEditor(){
  editingChildName=null;
  newChildName.disabled=false;
  newChildName.value='';
  buildSubjectsRows(newChildSubjects);
  saveNewChildBtn.textContent='Lägg till barn';
  saveNewChildBtn.onclick=addNewChild;
}

async function deleteChild(name){
  if(!confirm(`Vill du ta bort ${name}? Detta tar bort alla läxor för barnet.`)) return;
  const child=store.children?.[name];
  if(!child) return;

  const { error } = await supabase
    .from('children')
    .delete()
    .eq('id', child.id);

  if(error){
    console.error(error);
    showToast('Kunde inte ta bort');
    return;
  }

  delete store.children[name];

  const names=Object.keys(store.children||{});
  store.currentChild = names.length ? names[0] : ALL_VALUE;

  if(names.length===0 && !modalBackdrop.hasAttribute('hidden')){
    closeModalBtn.disabled=true;
    cancelModalBtn.disabled=true;
  }

  renderAll();
  renderChildrenEditor();
}

function deepCloneStoreSnapshot(){
  try{ return JSON.parse(JSON.stringify(store)); }catch{ return null; }
}

// ============
// Input row
// ============

function toggleInputRow(){
  const isHidden=inputRow.hasAttribute('hidden');
  if(isHidden){
    inputRow.removeAttribute('hidden');
    addQuickBtn.setAttribute('aria-expanded','true');
    addQuickBtn.textContent='Stäng';
    setTimeout(()=>taskInput.focus(),0);
  } else {
    abortInput();
  }
}

function abortInput(){
  resetInputs();
  toggleTimesForExam();
  validateForm();
  inputRow.setAttribute('hidden','');
  addQuickBtn.setAttribute('aria-expanded','false');
  addQuickBtn.textContent='Lägg till läxa/prov';
}

function toggleTimesForExam(){
  const isExam=!!isExamInput.checked;
  if(isExam){
    timesInput.value='';
    timesInput.placeholder='–';
    timesInput.disabled=true;
  } else {
    timesInput.disabled=false;
    timesInput.placeholder='';
    if(!timesInput.value) timesInput.value=1;
  }
}

function validateForm(){
  const ok=!!subjectSelect.value && taskInput.value.trim().length>0 && !!dueInput.value && store.currentChild!==ALL_VALUE;
  addBtn.disabled=!ok;
  addBtn.setAttribute('aria-disabled',String(!ok));
}

function resetInputs(){
  taskInput.value='';
  dueInput.value='';
  timesInput.value=1;
  isExamInput.checked=false;
}

// ============
// Utils
// ============

function todayLocalISO(){
  const d=new Date();
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const dd=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}

function isoToDate(iso){
  return new Date(iso+'T00:00:00');
}

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

function formatDate(d){
  try{
    const [y,m,dd]=d.split('-');
    return `${dd}/${m}/${y}`;
  }catch{ return d; }
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
  const card=li.querySelector('.li-card');
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
    if(currentX>0){
      li.classList.add('swipe-right');
      li.classList.remove('swipe-left');
    } else if(currentX<0){
      li.classList.add('swipe-left');
      li.classList.remove('swipe-right');
    }
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

    if(currentX>THRESHOLD){
      haptic('success');
      onRight?.();
      reset();
    } else if(currentX<-THRESHOLD){
      haptic('heavy');
      onLeft?.();
    } else {
      reset();
    }
    currentX=0;
  };

  li.addEventListener('touchstart',e=>start(e.touches[0].clientX,e),{passive:true});
  li.addEventListener('touchmove',e=>move(e.touches[0].clientX),{passive:true});
  li.addEventListener('touchend',end);

  li.addEventListener('mousedown',e=>start(e.clientX,e));
  window.addEventListener('mousemove',e=>move(e.clientX));
  window.addEventListener('mouseup',end);
}

// Safety: keep SW registration here too if inline removed
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  });
}
