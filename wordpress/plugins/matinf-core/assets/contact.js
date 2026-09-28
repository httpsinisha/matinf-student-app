document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-matinf-contact]').forEach(form => {
    const status = form.querySelector('[data-status]');
    const fields = form.querySelector('[data-message-fields]');
    const codes = form.querySelector('[data-code-fields]');
    const submit = form.querySelector('[type=submit]');
    const edit = form.querySelector('[data-edit]');
    let requestId = '';
    edit.addEventListener('click', () => {
      requestId = ''; codes.hidden = true; codes.disabled = true;
      fields.disabled = false; edit.hidden = true; status.textContent = '';
      submit.textContent = 'Nastavi — pošalji kod';
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const payload = requestId ? { requestId, code: form.elements.code.value.trim() } : {
        staffId: Number(form.dataset.staff), name: form.elements.name.value.trim(),
        email: form.elements.email.value.trim(), subject: form.elements.subject.value.trim(), message: form.elements.message.value.trim(),
      };
      submit.disabled = true; edit.disabled = true; fields.disabled = true; codes.disabled = true;
      status.textContent = 'Slanje…';
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 45000);
      try {
        const response = await fetch(form.dataset.api + (requestId ? 'confirm' : 'request'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Slanje nije uspjelo.');
        status.textContent = result.message;
        if (result.sent) {
          submit.hidden = true; edit.hidden = true; codes.hidden = true;
          form.elements.message.value = ''; return;
        }
        requestId = result.requestId; codes.hidden = false; edit.hidden = false;
        form.elements.code.value = ''; submit.textContent = 'Potvrdi i pošalji';
      } catch (error) {
        status.textContent = error.name === 'AbortError' ? 'Server nije odgovorio na vrijeme. Provjerite mejl prije ponavljanja.' : error.message || 'Provjerite internet vezu.';
      } finally {
        clearTimeout(timer); submit.disabled = false; edit.disabled = false;
        fields.disabled = Boolean(requestId); codes.disabled = !requestId;
      }
    });
  });
});
