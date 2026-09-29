const toggle = document.querySelector('.menu-toggle');
const menu = document.querySelector('#main-navigation');
toggle?.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Zatvori navigaciju' : 'Otvori navigaciju');
  menu?.classList.toggle('open', open);
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const dropdown = document.querySelector('.nav-more[open]');
  if (dropdown) { dropdown.open = false; dropdown.querySelector('summary')?.focus(); return; }
  if (toggle?.getAttribute('aria-expanded') === 'true') { toggle.click(); toggle.focus(); }
});
document.addEventListener('click', event => {
  const dropdown = document.querySelector('.nav-more[open]');
  if (dropdown && !dropdown.contains(event.target)) dropdown.open = false;
});

const scheduleProgram = document.querySelector('.schedule-choice [name=program_id]');
const scheduleYear = document.querySelector('.schedule-choice [name=study_year]');
scheduleProgram?.addEventListener('change', () => {
  if (!scheduleYear) return;
  const duration = Number(scheduleProgram.selectedOptions[0]?.dataset.duration) || 1;
  const selected = Math.min(Number(scheduleYear.value) || 1, duration);
  scheduleYear.replaceChildren(...Array.from({ length: duration }, (_, index) => {
    const year = index + 1;
    return new Option(`${year}. godina`, String(year), false, year === selected);
  }));
});
