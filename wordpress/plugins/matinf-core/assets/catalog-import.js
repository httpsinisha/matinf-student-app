document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#matinf-catalog-import');
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(form); data.set('action', 'matinf_import_catalog_step');
    const button = form.querySelector('[type="submit"]');
    const status = document.querySelector('#matinf-import-status');
    button.disabled = true;
    try {
      let batch = 0;
      for (;;) {
        status.textContent = `Uvoz je u toku (${++batch}. grupa). Ostavite stranicu otvorenu…`;
        const response = await fetch(ajaxurl, { method: 'POST', body: data });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.data?.message || 'Uvoz nije završen. Pokušajte ponovo.');
        if (!result.data.pending) { status.textContent = 'Katalog i raspored su uvezeni.'; location.reload(); break; }
      }
    } catch (error) { status.textContent = `${error.message} Završeni koraci ostaju sačuvani, pa možete nastaviti uvoz.`; }
    finally { button.disabled = false; }
  });
});
