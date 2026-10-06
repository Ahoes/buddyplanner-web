// BuddyPlanner · app instalable (service worker y botón Instalar)
const $p = (id) => document.getElementById(id);
// ===== App instalable =====
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
(() => {
  const btn = $p('instalar'), sheet = $p('inst-sheet'), pasos = $p('inst-pasos');
  const instalada = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (instalada) return;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let aviso = null;
  if (ios) btn.hidden = false;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); aviso = e; btn.hidden = false; });
  window.addEventListener('appinstalled', () => { btn.hidden = true; sheet.hidden = true; });
  btn.addEventListener('click', async () => {
    if (aviso) { aviso.prompt(); try { await aviso.userChoice; } catch (e) {} aviso = null; btn.hidden = true; return; }
    pasos.innerHTML = ios
      ? '<li>Abre esta página en <b>Safari</b>.</li><li>Pulsa <b>Compartir</b> (el cuadrado con la flecha hacia arriba).</li><li>Elige <b>Añadir a pantalla de inicio</b> y pulsa <b>Añadir</b>.</li>'
      : '<li>Abre el menú del navegador (⋮).</li><li>Pulsa <b>Instalar app</b> o <b>Añadir a pantalla de inicio</b>.</li>';
    sheet.hidden = false;
  });
  $p('inst-ok').addEventListener('click', () => { sheet.hidden = true; });
  sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.hidden = true; });
})();
