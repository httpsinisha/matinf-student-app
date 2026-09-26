document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#matinf-calendar-form');
  if (!form) return;
  const rows = document.querySelector('#matinf-calendar-rows');
  let index = rows.children.length;
  document.querySelector('#matinf-add-event').addEventListener('click', () => {
    if (rows.children.length >= 80) return;
    rows.insertAdjacentHTML('beforeend', document.querySelector('#matinf-event-template').innerHTML.replaceAll('__INDEX__', String(index++)));
    rows.lastElementChild.querySelector('select').focus();
  });
  rows.addEventListener('click', event => { if (event.target.classList.contains('mf-remove-event')) event.target.closest('tr').remove(); });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const status = document.querySelector('#matinf-calendar-status');
    const body = new FormData(form); const controls = Array.from(form.elements); controls.forEach(control => { control.disabled = true; }); status.textContent = 'Čuvanje…';
    try {
      const result = await (await fetch(form.getAttribute('action'), { method: 'POST', body, credentials: 'same-origin' })).json();
      if (!result.success) throw new Error(result.data?.message || 'Čuvanje nije uspjelo.');
      form.elements.revision.value = result.data.revision;
      rows.querySelectorAll('input[name$="[id]"]').forEach((input, index) => { input.value = result.data.ids[index]; });
      status.textContent = 'Raspored je sačuvan. Broj termina: ' + result.data.count + '.';
    } catch (error) { status.textContent = error.message || 'Provjerite vezu i pokušajte ponovo.'; }
    finally { controls.forEach(control => { control.disabled = false; }); }
  });
});
