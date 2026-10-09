// MyBuddyPlanner · motor de cálculo (sin dependencias del navegador; se prueba con node --test)
// ===== Motor de cálculo =====
const ENG = (() => {
  const ceilTo = (x) => Math.ceil(x - 1e-9);

  // --- Gas mínimo (metodología fija del usuario) ---
  function gasMinimo(d1, d2, vol) {
    const delta = d1 - d2;
    const ascensoExacto = delta / 3;
    const ascenso = ceilTo(ascensoExacto);
    const total = ascenso + 2;
    const ataIni = 1 + d1 / 10, ataFin = 1 + d2 / 10;
    const ataMedia = (ataIni + ataFin) / 2;
    const litros = 40 * total * ataMedia;
    const bares = ceilTo(litros / vol);
    return { delta, ascensoExacto, ascenso, total, ataIni, ataFin, ataMedia, litros, bares };
  }

  // --- Consumo ---
  function consumo(vol, bares, prof, sac) {
    const litros = bares * vol;
    const ata = 1 + prof / 10;
    const lmin = sac * ata;
    const tiempo = litros / lmin;
    return { litros, ata, lmin, tiempo };
  }

  // --- Densidad (g/L a una ATA) ---
  function densidad(fO2, fHe, ata) {
    const fN2 = 1 - fO2 - fHe;
    return (fO2 * 1.429 + fHe * 0.1786 + fN2 * 1.2506) * ata;
  }

  // --- Mezcla ---
  function mezcla(o2, he, ppo2, endMax) {
    const fO2 = o2 / 100, fHe = he / 100;
    const mod = (ppo2 / fO2 - 1) * 10;
    const res = { mod, conHelio: he > 0 };
    if (he > 0) res.profEnd = (endMax + 10) / (1 - fHe) - 10;
    const profTrabajo = he > 0 ? Math.min(mod, res.profEnd) : mod;
    res.profTrabajo = profTrabajo;
    res.densidad = densidad(fO2, fHe, 1 + profTrabajo / 10);
    return res;
  }

  function mezclaIdeal(prof, ppo2, endMax, conHelio = true) {
    const ata = 1 + prof / 10;
    const o2Exacto = ppo2 / ata * 100;
    const o2Ideal = Math.floor(o2Exacto + 1e-9);
    const limitado = o2Ideal > 40; // como gas de fondo, máximo EAN40
    const o2 = Math.min(40, o2Ideal);
    let heExacto = conHelio ? (1 - (endMax + 10) / (prof + 10)) * 100 : 0;
    if (heExacto < 0) heExacto = 0;
    let he = Math.max(0, ceilTo(heExacto)) + 0;
    if (o2 + he > 100) he = 100 - o2;
    const n2 = 100 - o2 - he;
    const ppo2Real = o2 / 100 * ata;
    const endReal = (prof + 10) * (1 - he / 100) - 10;
    const dens = densidad(o2 / 100, he / 100, ata);
    return { ata, o2Exacto, o2Ideal, limitado, o2, heExacto, he, n2, ppo2Real, endReal, dens };
  }

  // --- Bühlmann ZHL-16C ---
  const N2_HT = [5.0, 8.0, 12.5, 18.5, 27.0, 38.3, 54.3, 77.0, 109.0, 146.0, 187.0, 239.0, 305.0, 390.0, 498.0, 635.0];
  const N2_A = [1.1696, 1.0, 0.8618, 0.7562, 0.62, 0.5043, 0.441, 0.4, 0.375, 0.35, 0.3295, 0.3065, 0.2835, 0.261, 0.248, 0.2327];
  const N2_B = [0.5578, 0.6514, 0.7222, 0.7825, 0.8126, 0.8434, 0.8693, 0.891, 0.9092, 0.9222, 0.9319, 0.9403, 0.9477, 0.9544, 0.9602, 0.9653];
  const HE_HT = [1.88, 3.02, 4.72, 6.99, 10.21, 14.48, 20.53, 29.11, 41.20, 55.19, 70.69, 90.34, 115.29, 147.42, 188.24, 240.03];
  const HE_A = [1.6189, 1.383, 1.1919, 1.0458, 0.922, 0.8205, 0.7305, 0.6502, 0.595, 0.5545, 0.5333, 0.5189, 0.5181, 0.5176, 0.5172, 0.5119];
  const HE_B = [0.4770, 0.5747, 0.6527, 0.7223, 0.7582, 0.7957, 0.8279, 0.8553, 0.8757, 0.8903, 0.8997, 0.9073, 0.9122, 0.9171, 0.9217, 0.9267];
  // variantes A, B y C: cambian los coeficientes "a" del nitrógeno (A además usa el compartimento 1 de 4 min)
  const N2_A_VAR = {
    A: [1.2599, 1.0, 0.8618, 0.7562, 0.6667, 0.5933, 0.5282, 0.4701, 0.4187, 0.3798, 0.3497, 0.3223, 0.2971, 0.2737, 0.2523, 0.2327],
    B: [1.1696, 1.0, 0.8618, 0.7562, 0.6667, 0.5600, 0.4947, 0.4500, 0.4187, 0.3798, 0.3497, 0.3223, 0.2850, 0.2737, 0.2523, 0.2327],
    C: N2_A,
  };
  function coef(v) {
    const nA = N2_A_VAR[v] || N2_A, nB = N2_B.slice(), nHT = N2_HT.slice(), hHT = HE_HT.slice(), hA = HE_A.slice(), hB = HE_B.slice();
    if (v === 'A') { nHT[0] = 4.0; nB[0] = 0.5050; hHT[0] = 1.51; hA[0] = 1.7424; hB[0] = 0.4245; }
    return { nHT, nA, nB, hHT, hA, hB };
  }
  const PWV = 0.0627;
  const LN2 = Math.log(2);

  // tabla NOAA de límites CNS (min) por ppO2
  const CNS_T = [[0.6, 720], [0.7, 570], [0.8, 450], [0.9, 360], [1.0, 300], [1.1, 240], [1.2, 210], [1.3, 180], [1.4, 150], [1.5, 120], [1.6, 45], [1.7, 30], [2.0, 10]];
  function cnsLimite(p) {
    if (p < 0.5) return Infinity;
    if (p <= 0.6) return 720;
    for (let i = 1; i < CNS_T.length; i++) {
      if (p <= CNS_T[i][0]) {
        const [p0, t0] = CNS_T[i - 1], [p1, t1] = CNS_T[i];
        return t0 + (t1 - t0) * (p - p0) / (p1 - p0);
      }
    }
    return 5;
  }

  // densidad del agua (kg/m³), como Subsurface
  const DENSIDAD_AGUA = { dulce: 1000, mar: 1030, en13319: 1020 };

  function nombreGas(o2, he) {
    if (o2 === 100) return 'Oxígeno';
    if (he > 0) return `Trimix ${o2}/${he}`;
    if (o2 === 21) return 'Aire';
    return `EAN${o2}`;
  }

  function planDeco(p) {
    // p: {prof, tiempo, gfLow, gfHigh, salinidad, altitud, ultimaParada, fondo:{o2,he}, deco:[{o2,he}], vDesc, vAsc1, vAsc2, ppo2Deco, sacFondo, sacDeco}
    // presión en superficie con la altitud como Subsurface (escala de 7.800 m)
    const psurf = 1.01325 * Math.exp(-p.altitud / 7800);
    const barM = (DENSIDAD_AGUA[p.salinidad] || 1030) * 9.80665 / 1e5;
    const P = (d) => psurf + d * barM;
    const ataConv = (d) => 1 + d / 10; // convención del buceador para cambios de gas

    const gases = [{ o2: p.fondo.o2, he: p.fondo.he, rol: 'fondo', idx: -1 }]
      .concat(p.deco.map((g, i) => ({ o2: g.o2, he: g.he || 0, sac: g.sac, rol: 'deco', idx: i })));
    gases.forEach(g => { g.fO2 = g.o2 / 100; g.fHe = g.he / 100; g.fN2 = 1 - g.fO2 - g.fHe; g.nombre = nombreGas(g.o2, g.he); g.litros = 0; g.tiempo = 0; g.desde = null; });

    const C = coef(p.modelo || 'C');
    const pN2 = new Array(16).fill((psurf - PWV) * 0.781); // nitrógeno del aire como Subsurface
    const pHe = new Array(16).fill(0);
    let cns = 0, otu = 0, runtime = 0;

    // tejidos (Schreiner)
    function cargar(n2, he, d0, d1, t, g) {
      const pa0 = P(d0) - PWV, rate = (P(d1) - P(d0)) / t;
      for (let i = 0; i < 16; i++) {
        let k = LN2 / C.nHT[i], pi0 = pa0 * g.fN2, R = rate * g.fN2;
        n2[i] = pi0 + R * (t - 1 / k) - (pi0 - n2[i] - R / k) * Math.exp(-k * t);
        k = LN2 / C.hHT[i]; pi0 = pa0 * g.fHe; R = rate * g.fHe;
        he[i] = pi0 + R * (t - 1 / k) - (pi0 - he[i] - R / k) * Math.exp(-k * t);
      }
    }

    const log = [];
    // muestras para la gráfica (cada 10 s): copia de los tejidos, sin tocar el cálculo
    const muestras = [{ t: 0, d: 0, gas: gases[0].nombre, n2: pN2.slice(), he: pHe.slice() }];
    function muestrear(d0, d1, t, g) {
      const n2 = pN2.slice(), he = pHe.slice(), n = Math.max(1, Math.ceil(t * 6 - 1e-9)), dt = t / n;
      for (let j = 1; j <= n; j++) {
        const da = d0 + (d1 - d0) * (j - 1) / n, db = d0 + (d1 - d0) * j / n;
        cargar(n2, he, da, db, dt, g);
        muestras.push({ t: runtime + dt * j, d: db, gas: g.nombre, n2: n2.slice(), he: he.slice() });
      }
    }
    function segmento(d0, d1, t, g, tipo) {
      if (t <= 0) return;
      muestrear(d0, d1, t, g);
      cargar(pN2, pHe, d0, d1, t, g);
      // oxígeno y gas, por pasos
      const n = Math.max(1, Math.ceil(t / 0.1));
      const dt = t / n;
      const sac = g.rol === 'fondo' ? p.sacFondo : (g.sac || p.sacDeco);
      for (let j = 0; j < n; j++) {
        const d = d0 + (d1 - d0) * (j + 0.5) / n;
        const pp = g.fO2 * P(d);
        cns += dt / cnsLimite(pp) * 100;
        if (pp > 0.5) otu += dt * Math.pow((pp - 0.5) / 0.5, 0.83);
        g.litros += sac * P(d) * dt;
      }
      g.tiempo += t;
      runtime += t;
      const last = log[log.length - 1];
      if (last && last.tipo === tipo && last.gas === g.nombre && (tipo === 'ascenso' ? last.d1 === d0 : last.d0 === d0)) { last.d1 = d1; last.t += t; last.fin = runtime; }
      else log.push({ tipo, d0, d1, t, gas: g.nombre, fin: runtime });
    }

    // presión ambiente mínima tolerada con un GF fijo
    function presionTolerada(gf, n2 = pN2, he = pHe) {
      let max = 0;
      for (let i = 0; i < 16; i++) {
        const pt = n2[i] + he[i];
        const a = (C.nA[i] * n2[i] + C.hA[i] * he[i]) / pt;
        const b = (C.nB[i] * n2[i] + C.hB[i] * he[i]) / pt;
        const ptol = (pt - a * gf) / (gf / b + 1 - gf);
        if (ptol > max) max = ptol;
      }
      return max;
    }
    const techo = (gf) => (presionTolerada(gf) - psurf) / barM; // metros

    // Techo con GF variable como Subsurface: la línea recta va sobre la presión tolerada,
    // entre el GF alto en superficie y el GF bajo en el ancla (presión pAncla).
    let pAncla;
    function techoGF(n2, he) {
      const gfL = p.gfLow / 100, gfH = p.gfHigh / 100, s = psurf, g = pAncla;
      let ret = 0;
      for (let i = 0; i < 16; i++) {
        const pt = n2[i] + he[i];
        const a = (C.nA[i] * n2[i] + C.hA[i] * he[i]) / pt;
        const b = (C.nB[i] * n2[i] + C.hB[i] * he[i]) / pt;
        let tol = ret;
        if ((s / b + a - s) * gfH + s < (g / b + a - g) * gfL + g)
          tol = (-a * b * (gfH * g - gfL * s) - (1 - b) * (gfH - gfL) * g * s + b * (g - s) * pt) /
            (-a * b * (gfH - gfL) + (1 - b) * (gfL * g - gfH * s) + b * (g - s));
        if (tol > ret) ret = tol;
      }
      return (ret - psurf) / barM; // metros
    }

    // Prueba de ascenso (como Subsurface): sube de d a "hasta" en pasos de 2 s y en cada paso
    // el techo no puede quedar por debajo de la profundidad a la que se va a subir.
    function puedeSubir(d, hasta, vel, g) {
      const n2 = pN2.slice(), he = pHe.slice(), dt = 2 / 60;
      while (d > hasta + 1e-9) {
        const paso = Math.min(vel * dt, d);
        cargar(n2, he, d, d, dt, g);
        if (techoGF(n2, he) > d - paso + 1e-6) return false;
        d -= paso;
      }
      return true;
    }

    const fondo = gases[0];
    const tDesc = p.prof / p.vDesc;
    if (tDesc >= p.tiempo) return { error: 'El tiempo de fondo es menor que el tiempo de descenso.' };
    fondo.desde = 0;
    segmento(0, p.prof, tDesc, fondo, 'descenso');
    segmento(p.prof, p.prof, p.tiempo - tDesc, fondo, 'fondo');

    const gfL = p.gfLow / 100;
    let primera = Math.ceil(Math.max(0, techo(gfL)) / 3 - 1e-9) * 3;
    if (primera >= p.prof) primera = Math.floor((p.prof - 0.001) / 3) * 3;
    // ancla del GF bajo: techo exacto con GF bajo al final del fondo, y como mínimo 1 bar por debajo de la superficie (Subsurface)
    pAncla = Math.max(psurf + 1, presionTolerada(gfL));

    const mejorGas = (d, actual) => {
      let best = actual;
      for (const g of gases) {
        if (g.rol !== 'deco') continue;
        if (g.fO2 * ataConv(d) > p.ppo2Deco + 1e-9) continue;
        if (g.fO2 > best.fO2) best = g;
      }
      return best;
    };

    const paradas = [];
    let inicioDeco = null;
    let gas = fondo, cur = p.prof;
    let nivel = Math.floor((p.prof - 0.001) / 3) * 3;
    let guard = 0;
    while (nivel >= p.ultimaParada && guard++ < 200) {
      const vel = nivel >= primera ? p.vAsc1 : p.vAsc2;
      segmento(cur, nivel, (cur - nivel) / vel, gas, 'ascenso');
      cur = nivel;
      let minimo = 0;
      const nuevo = mejorGas(nivel, gas);
      if (nuevo !== gas) {
        gas = nuevo; minimo = 1;
        if (gas.desde === null) gas.desde = nivel;
      }
      const siguiente = nivel === p.ultimaParada ? 0 : nivel - 3;
      const velSig = (siguiente > 0 ? siguiente >= primera : nivel > primera) ? p.vAsc1 : p.vAsc2;
      let g2 = 0, paro = false;
      // ¿se podría seguir subiendo al llegar? (si es así y solo se para por el cambio de gas, no es parada obligatoria)
      const libre = minimo > 0 && puedeSubir(nivel, siguiente, velSig, gas);
      if (minimo > 0 || !puedeSubir(nivel, siguiente, velSig, gas)) {
        paro = true;
        if (inicioDeco === null) inicioDeco = runtime;
        const ref = paradas.length ? paradas[paradas.length - 1].rt : runtime;
        // completar hasta el minuto entero (el traslado entra en la parada)
        if (minimo > 0) segmento(nivel, nivel, 1, gas, 'cambio'); // minuto de cambio de gas, siempre
        const frac = Math.ceil(runtime - 1e-6) - runtime;
        if (frac > 1e-6) segmento(nivel, nivel, frac, gas, 'parada');
        while (!puedeSubir(nivel, siguiente, velSig, gas) && g2++ < 2000) segmento(nivel, nivel, 1, gas, 'parada');
      }
      if (paro) {
        const ini = paradas.length ? paradas[paradas.length - 1].rt : inicioDeco;
        paradas.push({ prof: nivel, tiempo: Math.round(runtime - ini), gas: gas.nombre, rt: runtime, soloCambio: libre && g2 === 0 });
      }
      if (g2 >= 2000) return { error: 'La descompresión no converge con estos datos.' };
      nivel -= 3;
      if (nivel < p.ultimaParada) break;
    }
    // a superficie
    const vFinal = cur > primera ? p.vAsc1 : p.vAsc2;
    segmento(cur, 0, cur / vFinal, gas, 'ascenso');

    // perfil para la gráfica: techo con tus GF, techo con el valor M (GF 100 %) y sobresaturación
    const perfil = muestras.map(m => {
      const pamb = P(m.d);
      let sat = -Infinity, comp = 0;
      for (let i = 0; i < 16; i++) {
        const pt = m.n2[i] + m.he[i];
        const a = (C.nA[i] * m.n2[i] + C.hA[i] * m.he[i]) / pt;
        const b = (C.nB[i] * m.n2[i] + C.hB[i] * m.he[i]) / pt;
        const s = (pt - pamb) / (pamb / b + a - pamb); // fracción del valor M a esta profundidad
        if (s > sat) { sat = s; comp = i + 1; }
      }
      return { t: m.t, d: m.d, gas: m.gas, techoGF: Math.max(0, techoGF(m.n2, m.he)),
        techoM: Math.max(0, (presionTolerada(1, m.n2, m.he) - psurf) / barM), sat: sat * 100, comp };
    });

    const ascenso = runtime - p.tiempo;
    const deco = paradas.length ? runtime - inicioDeco : 0;
    const sinObligatorias = paradas.length > 0 && paradas.every((x) => x.soloCambio);
    return {
      paradas, log, primera, deco, ascenso, runtime, cns, otu, psurf, barM, perfil, sinObligatorias,
      gases: gases.map(g => ({ nombre: g.nombre, rol: g.rol, idx: g.idx, o2: g.o2, he: g.he, litros: g.litros, tiempo: g.tiempo, desde: g.desde })),
    };
  }

  // --- Gas Blender: mezclado por presiones parciales (helio, oxígeno y aire, en ese orden) ---
  // Gas real con Van der Waals (como Gas Blender Toolkit) o gas ideal; temperatura fija de 20 °C.
  // Mismas constantes y reglas de mezcla que Gas Blender Toolkit (a y b con media geométrica).
  // Litros = gas a 1 bar y 20 °C (bar·litro), con el volumen molar real de cada gas, como Gas Blender Toolkit.
  const R = 0.0831451, TK = 293.15, AIRE_O2 = 0.21;
  const VDW = { o2: [1.378, 0.0318], n2: [1.408, 0.0391], he: [0.0345, 0.0237] }; // a (L²·bar/mol²), b (L/mol)
  const VM0 = { o2: 22.392, n2: 22.402, he: 22.426 }; // L/mol a 0 °C y 1 atm
  function vdwMezcla(fO2, fHe) {
    const fN2 = Math.max(0, 1 - fO2 - fHe);
    const sa = fO2 * Math.sqrt(VDW.o2[0]) + fN2 * Math.sqrt(VDW.n2[0]) + fHe * Math.sqrt(VDW.he[0]);
    const sb = fO2 * Math.sqrt(VDW.o2[1]) + fN2 * Math.sqrt(VDW.n2[1]) + fHe * Math.sqrt(VDW.he[1]);
    return { a: sa * sa, b: sb * sb };
  }
  function moles(P, V, fO2, fHe, real) {
    if (P <= 0 || V <= 0) return 0;
    if (!real) return P * V / (R * TK);
    const { a, b } = vdwMezcla(fO2, fHe);
    let vm = R * TK / P + b; // volumen molar, por Newton
    for (let i = 0; i < 50; i++) {
      const f = R * TK / (vm - b) - a / (vm * vm) - P;
      const df = -R * TK / ((vm - b) * (vm - b)) + 2 * a / (vm * vm * vm);
      const paso = f / df;
      vm -= paso;
      if (Math.abs(paso) < 1e-12) break;
    }
    return V / vm;
  }
  function presion(n, V, fO2, fHe, real) {
    if (n <= 0) return 0;
    const vm = V / n;
    if (!real) return R * TK / vm;
    const { a, b } = vdwMezcla(fO2, fHe);
    return R * TK / (vm - b) - a / (vm * vm);
  }
  const VM_AIRE = AIRE_O2 * VM0.o2 + (1 - AIRE_O2) * VM0.n2;
  const litrosDe = (n, gas) => n * (gas === 'aire' ? VM_AIRE : VM0[gas]) * 1.01325 * TK / 273.15;

  function mezclado(p) {
    // p: {vol, p0, o2_0, he_0, p1, o2_1, he_1, real, precios:{he,o2,aire} (€/L)}
    const real = !!p.real, V = p.vol;
    const f0 = { o2: p.o2_0 / 100, he: p.he_0 / 100 }; f0.n2 = 1 - f0.o2 - f0.he;
    const f1 = { o2: p.o2_1 / 100, he: p.he_1 / 100 }; f1.n2 = 1 - f1.o2 - f1.he;
    if (f1.n2 < -1e-9 || f0.n2 < -1e-9) return { error: 'El oxígeno y el helio no pueden sumar más del 100 %.' };
    const nt = moles(p.p1, V, f1.o2, f1.he, real);
    const adds = (pIni) => {
      const n0 = moles(pIni, V, f0.o2, f0.he, real);
      const aire = (nt * f1.n2 - n0 * f0.n2) / (1 - AIRE_O2);
      return { n0, he: nt * f1.he - n0 * f0.he, aire, o2: nt * f1.o2 - n0 * f0.o2 - aire * AIRE_O2 };
    };
    const vale = (x) => x.he >= -1e-9 && x.o2 >= -1e-9 && x.aire >= -1e-9;
    let pIni = p.p0, x = adds(pIni), vaciar = null;
    if (!vale(x)) {
      if (!vale(adds(0))) return { error: 'Esa mezcla no se puede hacer con helio, oxígeno y aire (tendría menos oxígeno que el aire y nada de helio).' };
      let lo = 0, hi = p.p0;
      for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (vale(adds(m))) lo = m; else hi = m; }
      vaciar = lo < 1e-6 ? 0 : lo; // purgar hasta aquí (exacto, como Gas Blender Toolkit)
      pIni = vaciar; x = adds(pIni);
    }
    ['he', 'o2', 'aire'].forEach((k) => { if (x[k] < 1e-6) x[k] = 0; });
    // presiones al terminar cada paso (helio → oxígeno → aire)
    const m = { o2: x.n0 * f0.o2, he: x.n0 * f0.he, n2: x.n0 * f0.n2 };
    const pAhora = () => { const t = m.o2 + m.he + m.n2; return t > 0 ? presion(t, V, m.o2 / t, m.he / t, real) : 0; };
    const pasos = [];
    const precio = p.precios || { he: 0, o2: 0, aire: 0 };
    const paso = (gas, n) => {
      const antes = pAhora();
      if (gas === 'aire') { m.o2 += n * AIRE_O2; m.n2 += n * (1 - AIRE_O2); } else m[gas] += n;
      const L = litrosDe(n, gas);
      pasos.push({ gas, desde: antes, hasta: pAhora(), litros: L, coste: L * (precio[gas] || 0) });
    };
    paso('he', x.he); paso('o2', x.o2); paso('aire', x.aire);
    const total = pasos.reduce((s, q) => s + q.coste, 0);
    return { pIni, vaciar, pasos, coste: total, final: pAhora(), litros: { he: litrosDe(x.he, 'he'), o2: litrosDe(x.o2, 'o2'), aire: litrosDe(x.aire, 'aire') } };
  }

  return { gasMinimo, consumo, densidad, mezcla, mezclaIdeal, planDeco, nombreGas, cnsLimite, mezclado, moles, presion };
})();
if (typeof module !== 'undefined') module.exports = ENG;
