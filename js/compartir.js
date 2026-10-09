// MyBuddyPlanner · compartir el plan de Deco como imagen (se dibuja en el móvil, sin conexión)
// ===== Compartir imagen =====
const IMG = {
  ancho: 540, escala: 2, margen: 22,
  c: { fondo: '#0b1216', surf: '#121b20', linea: '#223038', tx: '#e2eaed', tx2: '#a9b8be', mut: '#71858d', acc: '#3fb8a0', warn: '#e3a44a', perfil: '#2fa38d', gf: '#c4842e', m: '#d0588a' },
  sans: '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
};

// Dibuja la imagen del plan. plan: datos que deja renderDecoCore en PLAN_DECO.
function dibujarPlanImagen(plan) {
  const { c, sans } = IMG, W = IMG.ancho, M = IMG.margen, AN = W - 2 * M;
  const lienzo = document.createElement('canvas');
  const ctx = lienzo.getContext('2d');
  const fuente = (peso, tam) => { ctx.font = `${peso} ${tam}px ${sans}`; };
  // texto partido en líneas que caben en el ancho
  const partir = (texto, ancho) => {
    const out = []; let linea = '';
    for (const p of texto.split(' ')) {
      const prueba = linea ? linea + ' ' + p : p;
      if (ctx.measureText(prueba).width > ancho && linea) { out.push(linea); linea = p; } else linea = prueba;
    }
    if (linea) out.push(linea);
    return out;
  };
  const caja = (x, y, w, h, r = 10) => {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = c.surf; ctx.fill();
    ctx.strokeStyle = c.linea; ctx.lineWidth = 1; ctx.stroke();
  };

  // dos pasadas: la primera mide la altura, la segunda dibuja
  const pintar = (dibuja) => {
    let y = M;
    const T = (txt, x, yy, peso, tam, color, alin = 'left') => { if (!dibuja) return; fuente(peso, tam); ctx.fillStyle = color; ctx.textAlign = alin; ctx.fillText(txt, x, yy); };
    // cabecera
    T('MyBuddyPlanner', M, y + 17, 600, 17, c.tx);
    T(`${plan.fecha} · ${plan.version}`, W - M, y + 17, 400, 12, c.mut, 'right');
    y += 30;
    // datos de la inmersión
    fuente(400, 14);
    const lineas = partir(plan.datos, AN);
    lineas.forEach((l, i) => T(l, M, y + 16 + i * 21, i === 0 ? 400 : 400, 14, c.tx2));
    y += lineas.length * 21 + 12;
    // resultado
    if (dibuja) caja(M, y, AN, 96, 12);
    if (dibuja) { ctx.strokeStyle = c.linea; ctx.beginPath(); ctx.moveTo(W / 2, y + 12); ctx.lineTo(W / 2, y + 62); ctx.stroke(); }
    T('Descompresión', M + AN / 4, y + 24, 400, 12, c.tx2, 'center');
    T('Tiempo total', M + 3 * AN / 4, y + 24, 400, 12, c.tx2, 'center');
    for (const [v, x] of [[plan.deco, M + AN / 4], [plan.total, M + 3 * AN / 4]]) {
      if (!dibuja) continue;
      fuente(600, 36); const wv = ctx.measureText(String(v)).width; fuente(400, 15); const wm = ctx.measureText(' min').width;
      const x0 = x - (wv + wm) / 2;
      T(String(v), x0, y + 62, 600, 36, c.acc); T(' min', x0 + wv, y + 62, 400, 15, c.tx2);
    }
    T(plan.cnsOtu, W / 2, y + 84, 400, 12, c.mut, 'center');
    y += 96 + 18;
    // paradas
    if (plan.paradas.length) {
      T('Paradas', M, y + 13, 600, 13, c.tx); y += 22;
      const col = [M, M + AN * 0.25, M + AN * 0.5, M + AN * 0.75];
      ['Parada', 'Tiempo', 'Gas', 'Runtime'].forEach((h, i) => T(h, col[i], y + 12, 400, 11.5, c.mut));
      y += 18; if (dibuja) { ctx.fillStyle = c.linea; ctx.fillRect(M, y, AN, 1); }
      for (const s of plan.paradas) {
        [s.prof, s.tiempo, s.gas, s.rt].forEach((v, i) => T(v, col[i], y + 19, 400, 13.5, i === 2 ? c.acc : c.tx));
        y += 27; if (dibuja) { ctx.fillStyle = c.linea; ctx.fillRect(M, y, AN, 1); }
      }
      y += 6;
    } else {
      T(plan.sinParadas, M, y + 14, 400, 13, c.acc); y += 24;
    }
    for (const cg of plan.cambios) { T(cg, M, y + 14, 400, 12.5, c.warn); y += 20; }
    y += 10;
    // gráfica del perfil
    T('Perfil', M, y + 13, 600, 13, c.tx); y += 20;
    const G = { x: M, y, w: AN, h: 170 }, ml = 28, mb = 18, mt = 6;
    if (dibuja) dibujarGraficaImagen(ctx, plan.perfil, G, ml, mb, mt);
    y += G.h + 4;
    if (dibuja) {
      let x = M; fuente(400, 11);
      for (const [txt, col, disc] of [['Perfil', c.perfil], [`Techo GF ${plan.gf}`, c.gf], ['Techo valor M', c.m, true]]) {
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash(disc ? [3, 2] : []);
        ctx.beginPath(); ctx.moveTo(x, y + 8); ctx.lineTo(x + 12, y + 8); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = c.tx2; ctx.textAlign = 'left'; ctx.fillText(txt, x + 16, y + 12); x += 16 + ctx.measureText(txt).width + 14;
      }
    }
    y += 26;
    // gas necesario
    T('Gas necesario', M, y + 13, 600, 13, c.tx); y += 22;
    const gw = (AN - 8) / 2;
    for (let i = 0; i < plan.gases.length; i += 2) {
      const fila = plan.gases.slice(i, i + 2);
      const alto = Math.max(...fila.map((g) => 30 + g.lineas.length * 17));
      fila.forEach((g, k) => {
        const x = M + k * (gw + 8);
        if (dibuja) caja(x, y, gw, alto);
        T(g.titulo, x + 10, y + 21, 600, 13.5, c.tx);
        g.lineas.forEach((l, j) => T(l, x + 10, y + 40 + j * 17, 400, 12.5, c.tx2));
      });
      y += alto + 8;
    }
    // pie
    y += 6;
    if (dibuja) { ctx.fillStyle = c.linea; ctx.fillRect(M, y, AN, 1); }
    fuente(400, 10.5);
    partir('Plan orientativo generado con MyBuddyPlanner. No sustituye tu formación ni tu ordenador de buceo. Revisa el plan con tu compañero antes de bucear.', AN)
      .forEach((l, i) => T(l, M, y + 18 + i * 15, 400, 10.5, c.mut));
    return y + 18 + 2 * 15 + M - 6;
  };

  fuente(400, 14);
  const alto = Math.ceil(pintar(false));
  lienzo.width = W * IMG.escala; lienzo.height = alto * IMG.escala;
  ctx.scale(IMG.escala, IMG.escala);
  ctx.fillStyle = c.fondo; ctx.fillRect(0, 0, W, alto);
  ctx.textBaseline = 'alphabetic';
  pintar(true);
  return lienzo;
}

function dibujarGraficaImagen(ctx, f, G, ml, mb, mt) {
  const { c, sans } = IMG;
  const tMax = f[f.length - 1].t, dReal = Math.max(...f.map((q) => q.d));
  const paso = dReal > 80 ? 20 : 10, dMax = Math.ceil(dReal / paso) * paso || paso, pasoT = tMax > 120 ? 20 : 10;
  const X = (t) => G.x + ml + (G.w - ml - 4) * t / tMax, Y = (d) => G.y + mt + (G.h - mt - mb) * d / dMax;
  ctx.font = `400 10px ${sans}`; ctx.lineWidth = 1;
  for (let d = 0; d <= dMax; d += paso) {
    ctx.strokeStyle = c.linea; ctx.beginPath(); ctx.moveTo(G.x + ml, Y(d)); ctx.lineTo(G.x + G.w - 4, Y(d)); ctx.stroke();
    ctx.fillStyle = c.mut; ctx.textAlign = 'right'; ctx.fillText(String(d), G.x + ml - 5, Y(d) + 4);
  }
  ctx.textAlign = 'center';
  for (let t = 0; t <= tMax; t += pasoT) ctx.fillText(`${t}'`, X(t), G.y + G.h - 3);
  const traza = (k, color, ancho, disc, soloTecho) => {
    ctx.strokeStyle = color; ctx.lineWidth = ancho; ctx.setLineDash(disc ? [4, 3] : []); ctx.lineJoin = 'round';
    ctx.beginPath(); let dentro = false;
    f.forEach((q, i) => {
      const on = !soloTecho || q[k] > 0.05 || (f[i - 1] && f[i - 1][k] > 0.05) || (f[i + 1] && f[i + 1][k] > 0.05);
      if (on) { if (dentro) ctx.lineTo(X(q.t), Y(q[k])); else ctx.moveTo(X(q.t), Y(q[k])); dentro = true; } else dentro = false;
    });
    ctx.stroke(); ctx.setLineDash([]);
  };
  traza('techoM', c.m, 1.6, true, true);
  traza('techoGF', c.gf, 1.6, false, true);
  traza('d', c.perfil, 2, false, false);
}

// Botón "Compartir imagen": menú de compartir del móvil o, si no se puede, descarga.
async function compartirPlanImagen() {
  if (typeof PLAN_DECO === 'undefined' || !PLAN_DECO) return;
  try { await document.fonts.load(`600 16px "IBM Plex Sans"`); await document.fonts.load(`400 14px "IBM Plex Sans"`); } catch (e) {}
  const lienzo = dibujarPlanImagen(PLAN_DECO);
  const blob = await new Promise((ok) => lienzo.toBlob(ok, 'image/png'));
  if (!blob) return;
  const nombre = `plan-${PLAN_DECO.nombreArchivo}.png`;
  const archivo = new File([blob], nombre, { type: 'image/png' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [archivo] })) { await navigator.share({ files: [archivo], title: 'Plan de inmersión · MyBuddyPlanner' }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
document.addEventListener('click', (e) => { if (e.target.closest('#dc-compartir')) compartirPlanImagen(); });
