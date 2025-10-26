(function(){
'use strict';
const SUBJECT_GROUPS=[
  {title:"Språk",items:["Franska","Engelska","Spanska","Svenska","Italienska","Tyska"]},
  {title:"NO",items:["Biologi","Fysik","Kemi","Naturkunskap","NO"]},
  {title:"SO",items:["Geografi","Historia","Samhällskunskap","Religion","SO"]},
  {title:"Praktiskt-estetiska",items:["Musik","Bild","Idrott & Hälsa","Hemkunskap"]},
  {title:"Övrigt",items:["Matte","Teknik"]},
  {title:"Gymnasieämnen",items:["Juridik","Företagsekonomi","Psykologi","Filosofi"]}
];
const subjectIcons={"Franska":"🇫🇷","Engelska":"🇬🇧","Spanska":"🇪🇸","Svenska":"🇸🇪","Italienska":"🇮🇹","Tyska":"🇩🇪",
"Biologi":"🧬","Fysik":"⚛️","Kemi":"⚗️","Naturkunskap":"🌿","NO":"🔬","Geografi":"🗺️","Historia":"📜","Samhällskunskap":"🏛️",
"Religion":"⛪","SO":"🌍","Musik":"🎵","Bild":"🎨","Idrott & Hälsa":"🏃‍♂️","Hemkunskap":"🍳","Matte":"➗","Teknik":"⚙️",
"Juridik":"⚖️","Företagsekonomi":"💼","Psykologi":"🧠","Filosofi":"🤔"};

const $=id=>document.getElementById(id);
let modalBackdrop, newChildName, newChildSubjects;

document.addEventListener('DOMContentLoaded', ()=>{
  modalBackdrop=$('modal-backdrop');
  newChildName=$('new-child-name');
  newChildSubjects=$('new-child-subjects');

  // Wire modal buttons
  document.body.addEventListener('click', (e)=>{
    const b=e.target.closest('button'); if(!b) return;
    const txt=(b.textContent||'').trim().toLowerCase();
    if(b.id==='manage-children' || /hantera barn/.test(txt)){ openModal(); return; }
    if(b.id==='save-new-child' || /lägg till|spara/.test(txt)){ alert('Spara (demo)'); return; }
    if(b.id==='close-modal' || /^stäng$/.test(txt) || /^avbryt$/.test(txt)){ closeModal(); return; }
  });

  // Chip toggle
  document.body.addEventListener('click', (e)=>{
    const chip=e.target.closest('.sub-chip'); if(!chip) return;
    chip.classList.toggle('active');
  });

  // Build subjects
  renderSubjectPicker(newChildSubjects, new Set());

  // Force-open on load
  openModal();
});

function openModal(){
  if(!modalBackdrop) return;
  if(newChildName) newChildName.value='';
  if(newChildSubjects) renderSubjectPicker(newChildSubjects, new Set());
  modalBackdrop.removeAttribute('hidden');
}
function closeModal(){
  if(modalBackdrop) modalBackdrop.setAttribute('hidden','');
}

function renderSubjectPicker(container, selectedSet){
  if(!container) return;
  container.innerHTML='';
  SUBJECT_GROUPS.forEach(group=>{
    const gh=document.createElement('div'); gh.className='group-header'; gh.textContent=group.title; container.appendChild(gh);
    const row=document.createElement('div'); row.className='subjects-group';
    group.items.forEach(sub=>{
      const btn=document.createElement('button'); btn.type='button'; btn.className='sub-chip'+(selectedSet.has(sub)?' active':'');
      const icon = subjectIcons[sub] || '📘';
      btn.innerHTML = `<span class="i">${icon}</span> <span class="t">${sub}</span>`;
      row.appendChild(btn);
    });
    container.appendChild(row);
  });
}
})();