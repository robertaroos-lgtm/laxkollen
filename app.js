
const SUBJECT_GROUPS = [
  { title: "Språk", items: ["Franska","Engelska","Spanska","Svenska","Italienska","Tyska"] },
  { title: "NO", items: ["Biologi","Fysik","Kemi","Naturkunskap","NO"] },
  { title: "SO", items: ["Geografi","Historia","Samhällskunskap","Religion","SO"] },
  { title: "Praktiskt-estetiska", items: ["Musik","Bild","Idrott & Hälsa","Hemkunskap"] },
  { title: "Övrigt", items: ["Matte","Teknik"] },
  { title: "Gymnasieämnen", items: ["Juridik","Företagsekonomi","Psykologi","Filosofi"] }
];

const modal = document.getElementById('modal-backdrop');
const manageBtn = document.getElementById('manage-children');
const closeModalBtn = document.getElementById('close-modal');
const cancelModalBtn = document.getElementById('cancel-modal');
const newChildSubjects = document.getElementById('new-child-subjects');

function buildSubjectsRows(container){
  container.innerHTML='';
  SUBJECT_GROUPS.forEach(group=>{
    const gwrap=document.createElement('div'); gwrap.className='subjects-group';
    const header=document.createElement('div'); header.className='group-header'; header.textContent=group.title;
    const row=document.createElement('div'); row.className='subject-row';
    group.items.forEach(sub=>{
      const btn=document.createElement('button');
      btn.type='button'; btn.className='sub-chip'; btn.textContent=sub;
      btn.onclick=()=> btn.classList.toggle('active');
      row.appendChild(btn);
    });
    gwrap.appendChild(header); gwrap.appendChild(row);
    container.appendChild(gwrap);
  });
}

document.addEventListener('DOMContentLoaded', ()=>{
  // Onboarding: open modal if no children (simulated via localStorage flag)
  const hasChildren = !!localStorage.getItem('hasChild');
  buildSubjectsRows(newChildSubjects);
  if(!hasChildren){ modal.removeAttribute('hidden'); }

  manageBtn.onclick=()=>{ buildSubjectsRows(newChildSubjects); modal.removeAttribute('hidden'); };
  const hide=()=> modal.setAttribute('hidden','');
  closeModalBtn.onclick = hide;
  cancelModalBtn.onclick = hide;
});
