// MyBuddyPlanner · interfaz
// ===== Interfaz =====
const $ = (id) => document.getElementById(id);
const num = (id) => { const s = String($(id).value).trim().replace(',', '.'); if (s === '') return null; const n = Number(s); return isFinite(n) ? n : null; };
function F(x, d = 1) { const neg = x < 0; const s = Math.abs(x).toFixed(d); let [i, f] = s.split('.'); i = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.'); return (neg ? '−' : '') + i + (f ? ',' + f : ''); }
const Fn = (x) => F(x, Math.abs(x % 1) > 1e-9 ? 1 : 0);
const Fa = (x) => { let s = F(x, 2); if (s.endsWith('0')) s = s.slice(0, -1); return s; };
const row = (k, v) => `<div class="row"><span>${k}</span><b>${v}</b></div>`;
const msg = (c, t) => `<div class="msg ${c}">${t}</div>`;

const BIB = [[10, '10 L'], [12, '12 L'], [15, '15 L'], [18, '18 L'], [20, '2x10 L'], [24, '2x12 L'], [30, '2x15 L'], [36, '2x18 L']]; // de menor a mayor volumen
const DECO_BOT = [[5.7, 'S40 (5,7 L)'], [6, '6 L'], [7, '7 L'], [11.1, 'S80 (11,1 L)']];
const ejemplo = () => '<option value="" disabled selected hidden></option>'; // desplegable en blanco hasta que se elija
let bib = null; // hasta que el usuario elija botella
const bibName = () => bib ? BIB.find(b => b[0] === bib)[1] : '';
document.querySelectorAll('select.bib').forEach(s => {
  s.required = true;
  s.innerHTML = BIB.map(([v, l]) => `<option value="${v}">${l}</option>`).join('') + ejemplo(); // la opción en blanco al final: algunos móviles la muestran en la lista
  s.addEventListener('change', e => { bib = Number(e.target.value); document.querySelectorAll('select.bib').forEach(o => o.value = String(bib)); renderAll(); });
});

document.querySelectorAll('nav.tabs button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('nav.tabs button').forEach(x => x.setAttribute('aria-selected', String(x === b)));
  document.querySelectorAll('section.tab').forEach(s => s.classList.toggle('on', s.id === 't-' + b.dataset.t));
  window.scrollTo(0, 0);
  if (b.dataset.t === 'dc') dibujarPerfil(); // la gráfica necesita el ancho real de la pestaña visible
}));

function densMsg(dn) {
  if (dn > 6.2) return msg('bad', 'Densidad por encima de 6,2 g/L: demasiado alta. Añade helio o reduce la profundidad.');
  if (dn > 5.2) return msg('warn', 'Densidad por encima de 5,2 g/L, el valor recomendado. Respirar costará más esfuerzo.');
  return msg('ok', 'Densidad dentro de lo recomendado (hasta 5,2 g/L).');
}
function hipoxica(o2) {
  const d = Math.max(0, (0.16 / (o2 / 100) - 1) * 10);
  return msg('warn', `Mezcla hipóxica: no es respirable en superficie. Respirable a partir de ${F(d, 0)} m (ppO₂ 0,16); necesitas un gas de viaje.`);
}

// --- Gas mínimo ---
let GM = null;
function renderGM() {
  const d1 = num('gm-d1'), d2 = num('gm-d2'), out = $('gm-out');
  GM = null;
  if (d1 == null || d2 == null || d1 <= 0 || d2 < 0) { out.innerHTML = msg('info', 'Introduce la profundidad inicial y la final.'); return; }
  if (d2 >= d1) { out.innerHTML = msg('bad', 'La profundidad final tiene que ser menor que la inicial.'); return; }
  if (!bib) { out.innerHTML = msg('info', 'Elige la botella.'); return; }
  const r = ENG.gasMinimo(d1, d2, bib); GM = { ...r, d1, d2 };
  out.innerHTML = `<div class="res"><div class="k">Gas mínimo</div><div class="big">${r.bares} <small>bar</small></div><div class="sub">${F(r.litros, 0)} L con ${bibName()}</div></div>
  <div class="card"><h3>Desglose</h3>
  ${row('Ascenso', `${Fn(r.delta)} m ÷ 3 = ${F(r.ascensoExacto, 1)} → ${r.ascenso} min`)}
  ${row('Tiempo total', `${r.ascenso} + 2 = ${r.total} min`)}
  ${row('ATA media', `(${Fa(r.ataIni)} + ${Fa(r.ataFin)}) ÷ 2 = ${Fa(r.ataMedia)}`)}
  ${row('Litros', `40 × ${r.total} × ${Fa(r.ataMedia)} = ${F(r.litros, 0)} L`)}
  ${row('Bares', `${F(r.litros, 0)} ÷ ${bib} = ${F(r.litros / bib, 1)} → ${r.bares} bar`)}
  </div>`;
}

// --- Consumo ---
let CS = null;
// El gas mínimo llega de su pestaña, pero se puede cambiar a mano: solo se vuelve a copiar cuando cambia el planificado.
let gmCopiado;
function renderCS() {
  const planificado = GM ? GM.bares : null;
  if (planificado !== gmCopiado) { gmCopiado = planificado; $('cs-gm').value = planificado == null ? '' : String(planificado); }
  const p = num('cs-p'), gm = num('cs-gm'), d = num('cs-d'), sac = num('cs-sac'), out = $('cs-out');
  CS = null;
  $('cs-gm-hint').textContent = !GM ? 'Calcula el gas mínimo en su pestaña o escríbelo aquí.'
    : gm === GM.bares ? `Sale de la pestaña Gas mínimo (${Fn(GM.d1)} → ${Fn(GM.d2)} m con ${bibName()}). Puedes cambiarlo.`
    : `Cambiado a mano. El planificado en la pestaña Gas mínimo es ${GM.bares} bar.`;
  if (!bib || gm == null || gm < 0 || p == null || d == null || sac == null || d < 0 || sac <= 0) { out.innerHTML = msg('info', 'Completa los datos para calcular el tiempo.'); return; }
  const bares = p - gm;
  if (bares <= 0) { out.innerHTML = msg('bad', `La presión total (${Fn(p)} bar) no cubre el gas mínimo (${Fn(gm)} bar). No queda gas para gastar.`); return; }
  const r = ENG.consumo(bib, bares, d, sac);
  CS = { d, tiempo: r.tiempo };
  out.innerHTML = `<div class="res"><div class="k">Tiempo a esa profundidad</div><div class="big">${F(r.tiempo, 1)} <small>min</small></div></div>
  <div class="card"><h3>Desglose</h3>
  ${row('Bares a gastar', `${Fn(p)} − ${Fn(gm)} = ${Fn(bares)} bar`)}
  ${row('Gas disponible', `${Fn(bares)} × ${bib} = ${F(r.litros, 0)} L`)}
  ${row(`ATA a ${Fn(d)} m`, Fa(r.ata))}
  ${row('Consumo', `${Fn(sac)} × ${Fa(r.ata)} = ${F(r.lmin, 0)} L/min`)}
  ${row('Tiempo', `${F(r.litros, 0)} ÷ ${F(r.lmin, 0)} = ${F(r.tiempo, 1)} min`)}
  </div>`;
}

// --- Mezcla ---
function renderMZ() {
  const o2 = num('mz-o2'), he = num('mz-he') ?? 0, pp = num('mz-pp'), em = num('mz-end'), out = $('mz-out');
  if (o2 == null || o2 <= 0 || o2 > 100 || he < 0) { out.innerHTML = msg('info', 'Introduce el porcentaje de oxígeno y de helio.'); return; }
  if (o2 + he > 100) { out.innerHTML = msg('bad', 'Oxígeno y helio suman más del 100 %.'); return; }
  if (pp == null || pp <= 0 || (he > 0 && em == null)) { out.innerHTML = msg('info', he > 0 ? 'Introduce la ppO₂ máxima y la END máxima.' : 'Introduce la ppO₂ máxima.'); return; }
  const r = ENG.mezcla(o2, he, pp, em ?? 0);
  let h = '<div class="res"><div class="k">Profundidad máxima operativa</div>';
  if (r.conHelio) h += `<div class="duo" style="margin-top:8px"><div><div class="big">${F(r.mod, 1)} <small>m</small></div><div class="sub">Por oxígeno (MOD)</div></div><div><div class="big">${F(r.profEnd, 1)} <small>m</small></div><div class="sub">Por narcosis (END ${Fn(em)} m)</div></div></div>`;
  else h += `<div class="big">${F(r.mod, 1)} <small>m</small></div><div class="sub">Por oxígeno (MOD)</div>`;
  h += '</div>';
  if (!r.conHelio) h += '<p class="hint">Con helio a 0 solo se muestra la MOD, sin END.</p>';
  h += `<div class="card">${row(`Densidad a ${F(r.profTrabajo, 1)} m`, `${F(r.densidad, 2)} g/L`)}</div>` + densMsg(r.densidad);
  if (o2 < 18) h += hipoxica(o2);
  out.innerHTML = h;
}

function renderMI() {
  const d = num('mi-d'), pp = num('mi-pp'), em = num('mz-end'), out = $('mi-out'), conHe = $('mi-he').checked;
  $('mi-hint').textContent = conHe ? `El helio se calcula con la END máxima de arriba: ${em != null ? Fn(em) : '–'} m.` : 'Sin helio: solo se calcula el oxígeno (nitrox).';
  if (d == null || d <= 0 || pp == null || pp <= 0 || (conHe && em == null)) { out.innerHTML = msg('info', conHe ? 'Introduce la profundidad, la ppO₂ y la END máxima (arriba, en Mezcla).' : 'Introduce la profundidad y la ppO₂.'); return; }
  const r = ENG.mezclaIdeal(d, pp, em ?? 0, conHe);
  let h = `<div class="res"><div class="k">Mezcla recomendada para ${Fn(d)} m</div><div class="big" style="font-size:34px">${ENG.nombreGas(r.o2, r.he)}</div><div class="sub">O₂ ${r.o2} %, He ${r.he} %, N₂ ${r.n2} %</div></div>
  <div class="card"><h3>Desglose</h3>
  ${row('Oxígeno ideal', `${Fa(pp)} ÷ ${Fa(r.ata)} = ${F(r.o2Exacto, 1)} % → ${r.o2} %${r.limitado ? ' (tope 40 %)' : ''}`)}
  ${conHe ? row('Helio para la END', r.heExacto > 0 ? `${F(r.heExacto, 1)} % → ${r.he} %` : 'no hace falta') : ''}
  ${row(`ppO₂ a ${Fn(d)} m`, `${F(r.ppo2Real, 2)} bar`)}
  ${row(`END a ${Fn(d)} m`, `${F(r.endReal, 1)} m`)}
  ${row('Densidad', `${F(r.dens, 2)} g/L`)}
  </div>` + densMsg(r.dens);
  if (!conHe && em != null && r.endReal > em + 1e-9) h += msg('warn', `Sin helio, la END a ${Fn(d)} m es ${F(r.endReal, 1)} m, por encima de tu máximo (${Fn(em)} m).`);
  if (r.o2 < 18) h += hipoxica(r.o2);
  out.innerHTML = h;
}

// --- Deco ---
let decoGases = []; // sin gases de deco por defecto
let sacFondo = null; // SAC vacío hasta que el usuario lo escriba
function buildDecoGases() {
  $('dc-gases').innerHTML = decoGases.map((g, i) => `<div class="gasrow">
    <label class="f"><span class="l">O₂</span><span class="r"><input data-g="${i}" data-k="o2" inputmode="decimal" value="${g.o2}"><span class="u">%</span></span></label>
    <label class="f"><span class="l">He</span><span class="r"><input data-g="${i}" data-k="he" inputmode="decimal" value="${g.he}"><span class="u">%</span></span></label>
    <div class="gasname" id="dc-gn-${i}"></div>
    <button class="icon" data-del="${i}" aria-label="Quitar gas">×</button></div>`).join('') || '<p class="hint">Sin gases de deco.</p>';
}
document.addEventListener('click', e => {
  const a = e.target.closest('[data-add]');
  if (a) { if (decoGases.length >= 4) return; const o2 = Number(a.dataset.add); decoGases.push({ o2, he: 0, bot: null, sac: null }); buildDecoGases(); renderDeco(); return; }
  const d = e.target.closest('[data-del]');
  if (d) { decoGases.splice(Number(d.dataset.del), 1); buildDecoGases(); renderDeco(); return; }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset && t.dataset.g !== undefined) {
    const v = Number(String(t.value).replace(',', '.'));
    decoGases[Number(t.dataset.g)][t.dataset.k] = isFinite(v) ? v : NaN;
  }
  if (t.dataset && t.dataset.sac !== undefined) {
    const txt = String(t.value).trim(), v = Number(txt.replace(',', '.'));
    if (txt !== '' && !(isFinite(v) && v > 0)) return; // espera a un valor válido
    const val = txt === '' ? null : v;
    if (t.dataset.sac === 'f') sacFondo = val; else decoGases[Number(t.dataset.sac)].sac = val;
    renderDeco(); return;
  }
  if (t.tagName === 'INPUT') renderAll();
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset && t.dataset.bot !== undefined) { decoGases[Number(t.dataset.bot)].bot = Number(t.value); renderDeco(); return; }
  if (t.dataset && t.dataset.bibfondo !== undefined) { // botella del gas de espalda (Deco): se comparte con las demás pestañas
    bib = Number(t.value); document.querySelectorAll('select.bib').forEach(o => { o.value = String(bib); }); renderAll(); return;
  }
  if (t.tagName === 'SELECT' && !t.classList.contains('bib')) renderAll();
});

function renderDeco() {
  const act = document.activeElement, actId = act && act.id && act.id.startsWith('sac-') ? act.id : null;
  const selS = actId ? act.selectionStart : null, selE = actId ? act.selectionEnd : null;
  renderDecoCore();
  if (actId) { const el = $(actId); if (el) { el.focus(); try { el.setSelectionRange(selS, selE); } catch (e) {} } }
}
function renderDecoCore() {
  const out = $('dc-out');
  const d = num('dc-d'), t = num('dc-t'), gfl = num('dc-gfl'), gfh = num('dc-gfh'), alt = $('dc-alt').value === '' ? null : Number($('dc-alt').value);
  const fo2 = num('dc-fo2'), fhe = num('dc-fhe') ?? 0, vd = num('dc-vd'), va = num('dc-va');
  const ppMax = num('dc-ppf'), ppDeco = num('dc-ppd'), endMax = num('mz-end');
  const ppDecoOk = ppDeco != null && ppDeco >= 1 && ppDeco <= 1.7;
  // cambio de gas: a la primera parada (múltiplo de 3 m) donde la ppO₂ no pasa del máximo de deco
  const cambio = (o2) => Math.floor((ppDeco / (o2 / 100) - 1) * 10 / 3 + 1e-9) * 3;
  $('dc-gh').hidden = !decoGases.length; // la nota solo tiene sentido con gases de deco
  $('dc-gh').textContent = ppDecoOk ? `Gases de deco: se cambia a ppO₂ ${Fa(ppDeco)} (EAN50 a ${cambio(50)} m, oxígeno a ${cambio(100)} m) y cada cambio suma 1 minuto.` : 'Gases de deco: cada cambio suma 1 minuto.';
  // nombres de gases de deco
  decoGases.forEach((g, i) => { const el = $('dc-gn-' + i); if (!el) return;
    el.innerHTML = (g.o2 > 0 && g.o2 <= 100) ? `<b>${ENG.nombreGas(g.o2, g.he || 0)}</b>${ppDecoOk ? `MOD ${F((ppDeco / (g.o2 / 100) - 1) * 10, 0)} m` : ''}` : '<b>–</b>'; });

  if (d == null || t == null || d <= 0 || t <= 0) return void (out.innerHTML = msg('info', 'Introduce profundidad y tiempo de fondo.'));
  const falta = [[gfl, 'GF bajo'], [gfh, 'GF alto'], [vd, 'velocidad de descenso'], [va, 'velocidad de ascenso'], [ppMax, 'ppO₂ máx. de fondo'], [ppDeco, 'ppO₂ máx. de deco'], [fo2, 'O₂ del gas de fondo'], [$('dc-mod').value || null, 'modelo'], [$('dc-sal').value || null, 'tipo de agua'], [alt, 'altitud'], [$('dc-last').value || null, 'última parada']]
    .filter(([v]) => v == null).map(([, n]) => n);
  if (falta.length) return void (out.innerHTML = msg('info', `Completa: ${falta.join(', ')}.`));
  if (d > 150) return void (out.innerHTML = msg('bad', 'Profundidad fuera de rango (máximo 150 m).'));
  if (gfl == null || gfh == null || gfl <= 0 || gfh > 100 || gfl > gfh) return void (out.innerHTML = msg('bad', 'Revisa los GF: entre 1 y 100, y el bajo no puede ser mayor que el alto.'));
  if (vd == null || va == null || vd < 3 || vd > 30 || va < 3 || va > 18) return void (out.innerHTML = msg('bad', 'Revisa las velocidades: descenso entre 3 y 30 m/min, ascenso entre 3 y 18 m/min.'));
  if (fo2 == null || fo2 <= 0 || fhe < 0 || fo2 + fhe > 100) return void (out.innerHTML = msg('bad', 'Revisa el gas de fondo: O₂ y He no pueden sumar más del 100 %.'));
  if (ppMax == null || ppMax < 0.5 || ppMax > 1.6) return void (out.innerHTML = msg('bad', 'Revisa la ppO₂ máxima de fondo: entre 0,5 y 1,6 bar.'));
  if (!ppDecoOk) return void (out.innerHTML = msg('bad', 'Revisa la ppO₂ máxima de deco: entre 1,0 y 1,7 bar.'));
  if (fo2 > 40) return void (out.innerHTML = msg('bad', 'Como gas de fondo el máximo es EAN40. A partir de EAN41 ya se considera gas descompresivo: añádelo en los gases de deco.'));
  const validos = decoGases.map((g, i) => ({ ...g, i })).filter(g => g.o2 > 0 && g.o2 <= 100 && (g.he || 0) >= 0 && g.o2 + (g.he || 0) <= 100);

  const base = { modelo: $('dc-mod').value, prof: d, tiempo: t, gfLow: gfl, gfHigh: gfh, salinidad: $('dc-sal').value, altitud: alt, ultimaParada: Number($('dc-last').value),
    fondo: { o2: fo2, he: fhe }, deco: validos.map(g => ({ o2: g.o2, he: g.he || 0, sac: g.sac || 0 })), vDesc: vd, vAsc1: va, vAsc2: va, ppo2Deco: ppDeco, sacFondo: sacFondo || 0, sacDeco: 0 };
  const r = ENG.planDeco(base);
  if (r.error) return void (out.innerHTML = msg('bad', r.error));
  // descompresión mostrada: 0 si la única parada es el cambio de gas
  const dm = (x) => x.sinObligatorias ? 0 : Math.ceil(x.deco - 1e-9);
  const deco = dm(r), total = Math.ceil(r.runtime - 1e-9);

  // gas necesario
  const fondoG = r.gases[0];
  const decoG = r.gases.slice(1).map((g, k) => ({ ...g, cfg: validos[k] }));

  // avisos
  const av = [];
  const ppF = fo2 / 100 * (1 + d / 10);
  if (ppF > ppMax + 1e-9) av.push(msg('bad', `ppO₂ del gas de fondo a ${Fn(d)} m: ${F(ppF, 2)} bar, por encima de tu máximo (${F(ppMax, 2)}).`));
  const endF = (d + 10) * (1 - fhe / 100) - 10;
  if (endMax != null && endF > endMax + 1e-9) av.push(msg('warn', `END del gas de fondo a ${Fn(d)} m: ${F(endF, 1)} m, por encima de tu máximo (${Fn(endMax)} m).`));
  const dn = ENG.densidad(fo2 / 100, fhe / 100, 1 + d / 10);
  if (dn > 6.2) av.push(msg('bad', `Densidad del gas de fondo a ${Fn(d)} m: ${F(dn, 2)} g/L, por encima de 6,2.`));
  else if (dn > 5.2) av.push(msg('warn', `Densidad del gas de fondo a ${Fn(d)} m: ${F(dn, 2)} g/L, por encima de 5,2 recomendado.`));
  if (fo2 < 18) av.push(hipoxica(fo2));
  if (validos.length < decoGases.length) av.push(msg('warn', 'Hay un gas de deco con valores no válidos; no se ha tenido en cuenta.'));
  if (!r.ascensoDirecto) decoG.forEach(g => { if (g.tiempo <= 0) av.push(msg('info', `${g.nombre} no se usa en esta inmersión.`)); });
  decoG.forEach(g => { const b = Math.ceil(g.litros * 1.5 / g.cfg.bot - 1e-9); if (g.cfg.sac && g.cfg.bot && g.tiempo > 0 && b > 200) av.push(msg('warn', `${g.nombre}: el gas de emergencia (${b} bar) no cabe en una ${DECO_BOT.find(x => x[0] === g.cfg.bot)[1]}. Usa una botella mayor.`)); });
  if (r.cns > 100) av.push(msg('bad', `CNS ${F(r.cns, 0)} %: por encima del 100 %.`));
  else if (r.cns > 80) av.push(msg('warn', `CNS ${F(r.cns, 0)} %: por encima del 80 %.`));
  if (r.otu > 300) av.push(msg('warn', `${F(r.otu, 0)} OTU: por encima de 300, referencia para varios días seguidos.`));
  if (!av.length) av.push(msg('ok', 'Sin avisos: ppO₂, END, densidad, cambios de gas y toxicidad dentro de límites.'));

  // sensibilidad: cambio de la descompresión
  const sens = [];
  const run = (o) => { const x = ENG.planDeco({ ...base, ...o }); return x.error ? null : dm(x); };
  const tp = run({ tiempo: t + 5 }), tm = t - 5 > d / vd ? run({ tiempo: t - 5 }) : null;
  const dp = run({ prof: d + 3 }), dmn = d - 3 > 0 ? run({ prof: d - 3 }) : null;
  const sg = (x) => x == null ? '–' : `${x - deco >= 0 ? '+' : '−'}${Math.abs(x - deco)}' de deco`;
  sens.push(row('+5 min', sg(tp)), row('−5 min', sg(tm)), row('+3 m', sg(dp)), row('−3 m', sg(dmn)));
  const rMin = (tp != null && tm != null) ? (tp - tm) / 10 : null;
  const rM = (dp != null && dmn != null) ? (dp - dmn) / 6 : null;
  sens.push(row('Ratio por minuto de fondo', rMin == null ? '–' : `${F(rMin, 1)} min de deco`), row('Ratio por metro', rM == null ? '–' : `${F(rM, 1)} min de deco`));

  const gasCorto = (n) => n === 'Oxígeno' ? 'O₂' : n.replace('Trimix ', '');
  const mt = (t) => { const s = Math.round(t * 60), m = Math.floor(s / 60), ss = s % 60; return m ? `${m}'` + (ss ? `${String(ss).padStart(2, '0')}"` : '') : `${ss}"`; };
  const TIPO = { descenso: 'Descenso', fondo: 'Fondo', ascenso: 'Ascenso', cambio: 'Cambio de gas', parada: 'Parada' };
  // paradas obligatorias: el minuto de cambio de gas va únicamente en el runtime
  const obligatorias = r.paradas.filter(x => !x.soloCambio);
  const logRows = r.log.map(l => `<tr${l.tipo === 'cambio' ? ' class="sw"' : ''}><td>${TIPO[l.tipo]} ${l.d0 === l.d1 ? l.d0 + ' m' : Fn(l.d0) + '→' + Fn(l.d1) + ' m'}</td><td>${mt(l.t)}</td><td>${gasCorto(l.gas)}</td><td>${mt(l.fin)}</td></tr>`).join('');
  const stopsRows = obligatorias.map(s => `<tr><td>${s.prof} m</td><td>${s.tiempo}'</td><td>${gasCorto(s.gas)}</td><td>${Math.ceil(s.rt - 1e-9)}'</td></tr>`).join('');
  const fondoBar = bib ? Math.ceil(fondoG.litros / bib - 1e-9) : null;
  const sacBox = (key, val, gas) => `<label class="sacbox">SAC <input id="sac-${key}" data-sac="${key}" inputmode="decimal" value="${val == null ? '' : Fn(val)}" aria-label="SAC de ${gas}"> L/min</label>`;
  const sinSac = '<p class="hint" style="margin:6px 0 0">Escribe tu SAC para calcular el gas.</p>';
  const decoCards = decoG.map(g => {
    const L = g.litros, Le = L * 1.5, b = Math.ceil(L / g.cfg.bot - 1e-9), be = Math.ceil(Le / g.cfg.bot - 1e-9);
    const conSac = !!g.cfg.sac, conBot = !!g.cfg.bot;
    const opts = DECO_BOT.map(([v, l]) => `<option value="${v}"${v === g.cfg.bot ? ' selected' : ''}>${l}</option>`).join('') + (conBot ? '' : ejemplo());
    return `<div class="ngas"><div class="hd"><b>${g.nombre}</b>${sacBox(g.cfg.i, g.cfg.sac, g.nombre)}</div>
      <label class="f"><span class="l">Botella</span><span class="r"><select data-bot="${g.cfg.i}" required aria-label="Botella de ${g.nombre}">${opts}</select></span></label>
      <div class="vals">
        <div class="val hl"><div class="l">Desde</div><div class="n">${g.desde == null ? '–' : g.desde + ' m'}</div></div>
        <div class="val hl"><div class="l">Tiempo en este gas</div><div class="n">${F(g.tiempo, 0)}'</div></div>
        <div class="val"><div class="l">Litros</div><div class="n">${conSac ? F(L, 0) : '–'}</div></div>
        <div class="val"><div class="l">Bares</div><div class="n">${conSac && conBot ? b : '–'}</div></div>
      </div>
      ${!conSac ? sinSac : !conBot ? '<p class="hint" style="margin:6px 0 0">Elige la botella para ver los bares.</p>' : g.tiempo > 0 ? `<div class="emer${be > 200 ? ' over' : ''}"><span>Emergencia +50 %</span><span>${F(Le, 0)} L · ${be} bar</span></div>` : ''}</div>`;
  }).join('');

  out.innerHTML = `<div class="res"><div class="duo">
      <div><div class="k">Descompresión</div><div class="big">${deco} <small>min</small></div></div>
      <div><div class="k">Tiempo total</div><div class="big">${total} <small>min</small></div></div></div>
      <div class="sub" style="margin-top:6px">CNS ${F(r.cns, 0)} % · ${F(r.otu, 0)} OTU</div></div>
    ${obligatorias.length ? `<div class="card"><table class="stops"><thead><tr><th>Parada</th><th>Tiempo</th><th>Gas</th><th>Runtime</th></tr></thead><tbody>${stopsRows}</tbody></table></div>` : msg('ok', r.ascensoDirecto ? 'Sin paradas obligatorias: ascenso directo a superficie con el gas de fondo, sin cambios de gas.' : r.paradas.length ? 'Sin paradas obligatorias. El cambio de gas está en el runtime.' : 'Sin paradas obligatorias.')}
    <h2 class="sec">Perfil de la inmersión</h2><div class="card chart" id="dc-chart"></div>
    <h2 class="sec">Runtime</h2><div class="card"><table class="stops rtt"><thead><tr><th>Tramo</th><th>Tiempo</th><th>Gas</th><th>Runtime</th></tr></thead><tbody>${logRows}</tbody></table></div>
    <h2 class="sec">Avisos</h2>${av.join('')}
    <h2 class="sec">Sensibilidad</h2><div class="card">${sens.join('')}</div>
    <h2 class="sec">Gas necesario para la inmersión</h2>
    <div class="ngas"><div class="hd"><b>Gas de espalda · ${fondoG.nombre}</b>${sacBox('f', sacFondo, 'gas de espalda')}</div>
      <label class="f"><span class="l">Botella</span><span class="r"><select id="dc-bib" class="bib" data-bibfondo required aria-label="Botella del gas de espalda">${BIB.map(([v, l]) => `<option value="${v}"${v === bib ? ' selected' : ''}>${l}</option>`).join('')}${bib ? '' : ejemplo()}</select></span></label>
      <div class="vals"><div class="val"><div class="l">Litros</div><div class="n">${sacFondo ? F(fondoG.litros, 0) : '–'}</div></div>
      <div class="val"><div class="l">Bares${bib ? ` (${bibName()})` : ''}</div><div class="n">${sacFondo && bib ? fondoBar : '–'}</div></div></div>${!sacFondo ? sinSac : !bib ? '<p class="hint" style="margin:6px 0 0">Elige la botella para ver los bares.</p>' : ''}</div>
    ${decoCards}`;
  GRAF = { perfil: r.perfil, gf: `${Fn(gfl)}/${Fn(gfh)}` };
  dibujarPerfil();
}

// --- Gráfica del perfil: profundidad, techo con tus GF y techo con el valor M (GF 100 %) ---
const COL = { perfil: '#2fa38d', gf: '#c4842e', m: '#d0588a' }; // validados sobre el fondo oscuro
let GRAF = null;
function dibujarPerfil() {
  const box = $('dc-chart');
  if (!box || !GRAF) return;
  const f = GRAF.perfil, W = Math.max(260, box.clientWidth - 24), H = Math.round(Math.min(280, Math.max(200, W * 0.55)));
  const m = { l: 34, r: 8, t: 8, b: 22 };
  const tMax = f[f.length - 1].t, dMaxReal = Math.max(...f.map(x => x.d));
  const paso = dMaxReal > 80 ? 20 : 10, dMax = Math.ceil(dMaxReal / paso) * paso || paso;
  const pasoT = tMax > 120 ? 20 : 10;
  const X = (t) => m.l + (W - m.l - m.r) * t / tMax, Y = (d) => m.t + (H - m.t - m.b) * d / dMax;
  const linea = (k) => f.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p[k]).toFixed(1)}`).join('');
  // techos: solo donde hay techo (por debajo de la superficie)
  const techo = (k) => { let d = '', dentro = false;
    f.forEach((p, i) => { const on = p[k] > 0.05 || (f[i - 1] && f[i - 1][k] > 0.05) || (f[i + 1] && f[i + 1][k] > 0.05);
      if (on) { d += `${dentro ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p[k]).toFixed(1)}`; dentro = true; } else dentro = false; });
    return d; };
  let grid = '';
  for (let d = 0; d <= dMax; d += paso) grid += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(d)}" y2="${Y(d)}" stroke="var(--line)" stroke-width="1"/><text class="ax" x="${m.l - 6}" y="${Y(d) + 4}" text-anchor="end">${d}</text>`;
  for (let t = 0; t <= tMax; t += pasoT) grid += `<text class="ax" x="${X(t)}" y="${H - 6}" text-anchor="middle">${t}'</text>`;
  const AYUDA = '<div class="rd-help">Mueve el dedo o el ratón sobre la gráfica para ver cada momento de la inmersión.</div>';
  box.innerHTML = `<div class="leg"><span><i style="border-color:${COL.perfil}"></i>Perfil</span><span><i style="border-color:${COL.gf}"></i>Techo con GF ${GRAF.gf}</span><span><i class="dash" style="border-color:${COL.m}"></i>Techo con valor M (GF 100 %)</span></div>
    <div class="tip" aria-live="polite">${AYUDA}</div>
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" tabindex="0" role="img" aria-label="Perfil de la inmersión con los techos de descompresión. Mueve el dedo o el ratón, o usa las flechas, para ver los valores.">
      ${grid}
      <path d="${techo('techoM')}" fill="none" stroke="${COL.m}" stroke-width="2" stroke-dasharray="5 4" stroke-linejoin="round"/>
      <path d="${techo('techoGF')}" fill="none" stroke="${COL.gf}" stroke-width="2" stroke-linejoin="round"/>
      <path d="${linea('d')}" fill="none" stroke="${COL.perfil}" stroke-width="2" stroke-linejoin="round"/>
      <g id="dc-cur" visibility="hidden"><line y1="${m.t}" y2="${H - m.b}" stroke="var(--tx2)" stroke-width="1"/>
        <circle r="4" fill="${COL.perfil}" stroke="var(--surf)" stroke-width="2"/><circle r="4" fill="${COL.gf}" stroke="var(--surf)" stroke-width="2"/><circle r="4" fill="${COL.m}" stroke="var(--surf)" stroke-width="2"/></g>
    </svg>
    <p class="hint">Profundidad en metros y runtime en minutos.</p>`;
  const svg = box.querySelector('svg'), cur = $('dc-cur'), tip = box.querySelector('.tip');
  let idx = null;
  const mostrar = (i) => {
    idx = Math.max(0, Math.min(f.length - 1, i));
    const p = f[idx], x = X(p.t);
    cur.setAttribute('visibility', 'visible');
    cur.querySelector('line').setAttribute('x1', x); cur.querySelector('line').setAttribute('x2', x);
    const cs = cur.querySelectorAll('circle');
    [['d', 0], ['techoGF', 1], ['techoM', 2]].forEach(([k, j]) => { cs[j].setAttribute('cx', x); cs[j].setAttribute('cy', Y(p[k])); cs[j].setAttribute('visibility', k === 'd' || p[k] > 0.05 ? 'visible' : 'hidden'); });
    const s = Math.round(p.t * 60), rt = `${Math.floor(s / 60)}'${String(s % 60).padStart(2, '0')}"`;
    const tc = (v) => v > 0.05 ? `${F(v, 1)} m` : 'sin techo';
    tip.innerHTML = `<div class="rd-h"><b>${rt}</b> · ${F(p.d, 1)} m · ${p.gas === 'Oxígeno' ? 'O₂' : p.gas}</div>
      <div class="rd-v"><div><b>${tc(p.techoGF)}</b><span><i style="border-color:${COL.gf}"></i>Techo GF</span></div>
      <div><b>${tc(p.techoM)}</b><span><i class="dash" style="border-color:${COL.m}"></i>Techo valor M</span></div>
      <div><b>${p.sat > 0 ? F(p.sat, 0) + ' %' : '—'}</b><span>${p.sat > 0 ? `valor M (C${p.comp})` : 'sin sobresaturación'}</span></div></div>`;
  };
  const ocultar = () => { cur.setAttribute('visibility', 'hidden'); tip.innerHTML = AYUDA; };
  const cercano = (e) => {
    const r = svg.getBoundingClientRect(), t = (e.clientX - r.left - m.l) / (W - m.l - m.r) * tMax;
    let lo = 0, hi = f.length - 1;
    while (hi - lo > 1) { const md = (lo + hi) >> 1; if (f[md].t < t) lo = md; else hi = md; }
    return Math.abs(f[lo].t - t) <= Math.abs(f[hi].t - t) ? lo : hi;
  };
  svg.addEventListener('pointermove', (e) => mostrar(cercano(e)));
  svg.addEventListener('pointerdown', (e) => mostrar(cercano(e)));
  svg.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') ocultar(); });
  svg.addEventListener('blur', ocultar);
  svg.addEventListener('keydown', (e) => {
    const k = { ArrowRight: 1, ArrowLeft: -1, PageUp: 30, PageDown: -30 }[e.key];
    if (k == null) return; e.preventDefault(); mostrar(idx == null ? 0 : idx + k);
  });
}
let anchoGraf = 0;
window.addEventListener('resize', () => { const b = $('dc-chart'); if (b && b.clientWidth !== anchoGraf) { anchoGraf = b.clientWidth; dibujarPerfil(); } });

// Deco toma profundidad y tiempo de Consumo (tiempo redondeado abajo); sin cálculo de consumo, 0 m y 0 min.
// Solo se copian cuando cambia el resultado de Consumo, así se respeta lo que el usuario escriba en Deco.
let csCopiado = null;
function copiarConsumoADeco() {
  const v = CS ? { d: Fn(CS.d), t: String(Math.floor(CS.tiempo + 1e-9)) } : { d: '', t: '' };
  const clave = `${v.d}/${v.t}`;
  if (clave === csCopiado) return;
  csCopiado = clave;
  $('dc-d').value = v.d;
  $('dc-t').value = v.t;
}

// --- Gas Blender ---
const EUR = (x) => `${F(x, 2)} €`;
const gbPrecios = () => ({ he: num('gb-ph') ?? 0, o2: num('gb-po') ?? 0, aire: num('gb-pa') ?? 0 });

function renderGB() {
  const out = $('gb-out');
  const otra = $('gb-bot').value === 'otra';
  $('gb-volf').hidden = !otra;
  const vol = otra ? num('gb-vol') : Number($('gb-bot').value);
  const p0 = num('gb-p0') ?? 0, o0 = num('gb-o0') ?? (p0 > 0 ? 0 : 21), h0 = num('gb-h0') ?? 0;
  const p1 = num('gb-p1'), o1 = num('gb-o1'), h1 = num('gb-h1') ?? 0;
  const pr = gbPrecios();
  if (!$('gb-bot').value) return void (out.innerHTML = msg('info', 'Elige la botella.'));
  if (!$('gb-mod').value) return void (out.innerHTML = msg('info', 'Elige el modelo de gas (real o ideal).'));
  if (vol == null || vol <= 0) return void (out.innerHTML = msg('info', 'Indica el volumen de la botella.'));
  if (p1 == null || p1 <= 0 || o1 == null || o1 <= 0) return void (out.innerHTML = msg('info', 'Indica la presión y el oxígeno de la mezcla que quieres. Si la botella no está vacía, indica también lo que queda.'));
  if (p0 < 0 || o0 < 0 || h0 < 0 || h1 < 0 || o1 > 100 || o0 > 100) return void (out.innerHTML = msg('bad', 'Revisa los porcentajes y las presiones.'));
  if (p0 > 0 && o0 <= 0) return void (out.innerHTML = msg('bad', 'Indica el oxígeno de lo que queda en la botella.'));
  if (pr.he < 0 || pr.o2 < 0 || pr.aire < 0) return void (out.innerHTML = msg('bad', 'Los precios no pueden ser negativos.'));
  const real = $('gb-mod').value === 'real';
  const r = ENG.mezclado({ vol, p0, o2_0: o0, he_0: h0, p1, o2_1: o1, he_1: h1, real, precios: pr });
  if (r.error) return void (out.innerHTML = msg('bad', r.error));

  const NOMBRE = { he: 'Helio', o2: 'Oxígeno', aire: 'Aire' };
  const volTxt = otra ? `${Fn(vol)} L` : $('gb-bot').selectedOptions[0].textContent;
  const purga = r.vaciar != null;
  // sin ningún precio escrito no se muestra coste
  const conPrecio = ['gb-ph', 'gb-po', 'gb-pa'].some((id) => num(id) != null);
  const EURx = (x) => conPrecio ? EUR(x) : '—';
  const filas = r.pasos.map((s, i) => `<tr><td>${i + 1 + (purga ? 1 : 0)}. ${NOMBRE[s.gas]}</td><td>${s.litros > 0.5 ? '+' + F(s.hasta - s.desde, 1) : '—'}</td><td>${F(s.hasta, 1)}</td><td>${EURx(s.coste)}</td></tr>`).join('');
  let h = `<div class="res"><div class="k">${conPrecio ? 'Coste del llenado' : 'Llenado'}</div><div class="big">${conPrecio ? `${F(r.coste, 2)} <small>€</small>` : ENG.nombreGas(o1, h1)}</div>
    <div class="sub">${ENG.nombreGas(o1, h1)} a ${Fn(p1)} bar en ${volTxt}</div></div>`;
  if (purga) h += msg('warn', `Con lo que queda no se puede llegar a esa mezcla: primero vacía la botella de ${F(p0, 1)} a <b>${F(r.vaciar, 1)} bar</b>.`);
  h += `<div class="card"><table class="stops gbt"><thead><tr><th>Paso</th><th>Añades (bar)</th><th>Hasta (bar)</th><th>Coste</th></tr></thead><tbody>
    <tr><td>Inicio</td><td>—</td><td>${F(p0, 1)}</td><td>—</td></tr>${purga ? `<tr class="sw"><td>1. Vaciar</td><td>−${F(p0 - r.vaciar, 1)}</td><td>${F(r.vaciar, 1)}</td><td>—</td></tr>` : ''}${filas}</tbody></table></div>`;
  if (!conPrecio) h += '<p class="hint">Escribe los precios por litro para ver el coste.</p>';
  else h += `<div class="card"><h3>Desglose</h3>
    ${row('Helio', `${F(r.litros.he, 0)} L × ${F(pr.he, 4)} € = ${EUR(r.litros.he * pr.he)}`)}
    ${row('Oxígeno', `${F(r.litros.o2, 0)} L × ${F(pr.o2, 4)} € = ${EUR(r.litros.o2 * pr.o2)}`)}
    ${row('Aire', `${F(r.litros.aire, 0)} L × ${F(pr.aire, 4)} € = ${EUR(r.litros.aire * pr.aire)}`)}
    ${row('Total', EUR(r.coste))}</div>`;
  if (o1 < 18) h += hipoxica(o1);
  out.innerHTML = h;
}



function renderAll() { renderGM(); renderCS(); copiarConsumoADeco(); renderMZ(); renderMI(); renderDeco(); renderGB(); }
buildDecoGases();
renderAll();
