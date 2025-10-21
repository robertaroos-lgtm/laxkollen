// Minimal test to verify buttons wired (the full JS did not fit in this cell earlier)
document.addEventListener('DOMContentLoaded', () => {
  const manageBtn = document.getElementById('manage-children');
  const addQuick = document.getElementById('add-quick');
  const modal = document.getElementById('modal-backdrop');
  const editModal = document.getElementById('edit-backdrop');
  manageBtn.onclick = ()=> modal.style.display='flex';
  addQuick.onclick = ()=> alert('Add quick clicked (test)');
});