const toggle = document.querySelector('.menu-toggle');
const menu = document.querySelector('#main-navigation');
toggle?.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Zatvori navigaciju' : 'Otvori navigaciju');
  menu?.classList.toggle('open', open);
});
