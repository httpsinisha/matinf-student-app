document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.mf-audience-program').forEach(program => {
    program.addEventListener('change', () => {
      program.querySelector('.mf-choice-count').textContent = `(${program.querySelectorAll('input:checked').length} označeno)`;
    });
  });
  const container = document.querySelector('#mf-attachments');
  container?.addEventListener('click', event => {
    if (event.target.matches('.mf-remove-file')) event.target.closest('p').remove();
  });
  document.querySelector('#mf-upload-files')?.addEventListener('click', () => {
    const frame = wp.media({ title: 'Dokumenti uz objavu', button: { text: 'Dodaj dokumente' }, multiple: true });
    frame.on('select', () => frame.state().get('selection').toJSON().forEach(file => {
      if (container.querySelector(`input[value="${Number(file.id)}"]`)) return;
      const row = document.createElement('p');
      const input = document.createElement('input'); input.type = 'hidden'; input.name = 'matinf[attachmentIds][]'; input.value = file.id;
      const label = document.createElement('span'); label.textContent = file.title || file.filename;
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'button mf-remove-file'; remove.textContent = 'Ukloni iz objave';
      row.append(input, label, ' ', remove); container.append(row);
    }));
    frame.open();
  });
});
