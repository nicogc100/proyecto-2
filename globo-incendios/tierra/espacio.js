// Fondo espacial de Fire Sat: estrellas, Vía Láctea, nebulosa, brillo del Sol y estrellas fugaces.
// Es una capa independiente (canvas 2D) que va detrás del canvas WebGL de la Tierra,
// que ya se dibuja con fondo transparente. No toca tierra.js ni el render del planeta.
(() => {
  const escena = document.querySelector('#escena');
  const tierra = document.querySelector('#tierra');
  if (!escena || !tierra) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'espacio';
  canvas.setAttribute('aria-hidden', 'true');
  escena.insertBefore(canvas, tierra);
  const ctx = canvas.getContext('2d');

  const reducirMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MARGEN = 40; // px extra para el paralaje
  let ancho = 0, alto = 0, dpr = 1;
  let fondo = null;          // capa estática pre-dibujada (nebulosa + estrellas tenues)
  let brillantes = [];       // estrellas que titilan
  let fugaz = null;          // estrella fugaz activa
  let proximaFugaz = 4000 + Math.random() * 6000;
  let paraX = 0, paraY = 0, metaX = 0, metaY = 0;

  // Generador pseudoaleatorio con semilla: el cielo es el mismo en cada visita
  function azar(semilla) {
    let s = semilla >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Colores reales de estrellas: azuladas (calientes) a anaranjadas (frías)
  const COLORES = ['#9bb0ff', '#aabfff', '#cad7ff', '#f8f7ff', '#f8f7ff', '#fff4ea', '#ffd2a1', '#ffcc6f'];

  function dibujarFondo() {
    const w = ancho + MARGEN * 2, h = alto + MARGEN * 2;
    fondo = document.createElement('canvas');
    fondo.width = Math.round(w * dpr);
    fondo.height = Math.round(h * dpr);
    const g = fondo.getContext('2d');
    g.scale(dpr, dpr);
    const r = azar(20261115);

    // Espacio profundo
    const base = g.createLinearGradient(0, 0, w * 0.3, h);
    base.addColorStop(0, '#04060f');
    base.addColorStop(0.55, '#050a1a');
    base.addColorStop(1, '#02030a');
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);

    // Banda de la Vía Láctea: diagonal de arriba-derecha a abajo-izquierda
    const bx0 = w * 1.05, by0 = -h * 0.1, bx1 = -w * 0.05, by1 = h * 1.1;
    const largo = Math.hypot(bx1 - bx0, by1 - by0);
    const ux = (bx1 - bx0) / largo, uy = (by1 - by0) / largo; // dirección de la banda
    const nx = -uy, ny = ux;                                  // perpendicular
    const ancho_banda = Math.min(w, h) * 0.22;

    g.globalCompositeOperation = 'lighter';
    // Nubes de la nebulosa y la banda (manchas difusas superpuestas)
    const tonos = [
      [70, 90, 190], [120, 60, 170], [40, 120, 160], [150, 80, 140], [90, 110, 200],
    ];
    for (let i = 0; i < 70; i++) {
      const t = r();
      const desv = (r() + r() + r() - 1.5) * ancho_banda * 0.9;
      const x = bx0 + ux * largo * t + nx * desv;
      const y = by0 + uy * largo * t + ny * desv;
      const rad = ancho_banda * (0.35 + r() * 0.9);
      const [cr, cg, cb] = tonos[Math.floor(r() * tonos.length)];
      const a = 0.025 + r() * 0.045;
      const grad = g.createRadialGradient(x, y, 0, x, y, rad);
      grad.addColorStop(0, `rgba(${cr},${cg},${cb},${a})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // Núcleo claro de la banda
    for (let i = 0; i < 40; i++) {
      const t = 0.15 + r() * 0.7;
      const desv = (r() - 0.5) * ancho_banda * 0.5;
      const x = bx0 + ux * largo * t + nx * desv;
      const y = by0 + uy * largo * t + ny * desv;
      const rad = ancho_banda * (0.2 + r() * 0.35);
      const grad = g.createRadialGradient(x, y, 0, x, y, rad);
      grad.addColorStop(0, `rgba(210,200,235,${0.02 + r() * 0.03})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }

    // Brillo cálido del Sol fuera de cuadro (arriba a la izquierda, como la luz del globo)
    const sol = g.createRadialGradient(-w * 0.05, h * 0.05, 0, -w * 0.05, h * 0.05, Math.max(w, h) * 0.55);
    sol.addColorStop(0, 'rgba(255,190,120,0.16)');
    sol.addColorStop(0.35, 'rgba(255,140,80,0.05)');
    sol.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sol;
    g.fillRect(0, 0, w, h);

    // Polvo de estrellas: muchas, diminutas, más densas en la banda
    const densidad = (w * h) / 1000;
    for (let i = 0; i < densidad * 1.6; i++) {
      let x, y;
      if (r() < 0.55) {
        const t = r();
        const desv = (r() + r() + r() - 1.5) * ancho_banda * 0.8;
        x = bx0 + ux * largo * t + nx * desv;
        y = by0 + uy * largo * t + ny * desv;
      } else {
        x = r() * w; y = r() * h;
      }
      const brillo = Math.pow(r(), 2.4);
      g.globalAlpha = 0.15 + brillo * 0.75;
      g.fillStyle = COLORES[Math.floor(r() * COLORES.length)];
      const s = 0.35 + brillo * 0.9;
      g.fillRect(x, y, s, s);
    }
    g.globalAlpha = 1;

    // Estrellas medianas con un pequeño halo
    for (let i = 0; i < densidad * 0.05; i++) {
      const x = r() * w, y = r() * h;
      const rad = 2 + r() * 3;
      const col = COLORES[Math.floor(r() * COLORES.length)];
      const grad = g.createRadialGradient(x, y, 0, x, y, rad);
      grad.addColorStop(0, col);
      grad.addColorStop(0.25, col + '55');
      grad.addColorStop(1, '#0000');
      g.fillStyle = grad;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    g.globalCompositeOperation = 'source-over';

    // Estrellas brillantes que titilan (se dibujan en cada cuadro)
    brillantes = [];
    const n = Math.round(Math.min(220, densidad * 0.12));
    for (let i = 0; i < n; i++) {
      brillantes.push({
        x: r() * w, y: r() * h,
        tam: 0.8 + Math.pow(r(), 3) * 2.2,
        fase: r() * Math.PI * 2,
        vel: 0.6 + r() * 1.8,
        col: COLORES[Math.floor(r() * COLORES.length)],
        cruz: r() < 0.08, // destello en cruz para las más brillantes
      });
    }
  }

  function ajustar() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    ancho = escena.clientWidth;
    alto = escena.clientHeight;
    canvas.width = Math.round(ancho * dpr);
    canvas.height = Math.round(alto * dpr);
    dibujarFondo();
    if (reducirMovimiento) cuadro(0);
  }

  function dibujarFugaz(dt) {
    if (!fugaz) return;
    fugaz.t += dt;
    const p = fugaz.t / fugaz.dur;
    if (p >= 1) { fugaz = null; return; }
    const x = fugaz.x + fugaz.dx * p, y = fugaz.y + fugaz.dy * p;
    const cola = 0.18;
    const x0 = x - fugaz.dx * cola, y0 = y - fugaz.dy * cola;
    const alfa = Math.sin(p * Math.PI);
    const grad = ctx.createLinearGradient(x0, y0, x, y);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(1, `rgba(255,240,220,${0.85 * alfa})`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x, y); ctx.stroke();
  }

  let anterior = 0;
  function cuadro(tiempo) {
    const dt = anterior ? Math.min(tiempo - anterior, 50) : 16;
    anterior = tiempo;
    paraX += (metaX - paraX) * 0.05;
    paraY += (metaY - paraY) * 0.05;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(fondo, Math.round((-MARGEN + paraX) * dpr), Math.round((-MARGEN + paraY) * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, (-MARGEN + paraX * 1.6) * dpr, (-MARGEN + paraY * 1.6) * dpr);

    const s = tiempo / 1000;
    ctx.globalCompositeOperation = 'lighter';
    for (const e of brillantes) {
      const tw = reducirMovimiento ? 0.8 : 0.55 + 0.45 * Math.sin(s * e.vel + e.fase);
      const rad = e.tam * 3.2;
      ctx.globalAlpha = tw;
      const grad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, rad);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.18, e.col);
      grad.addColorStop(1, '#0000');
      ctx.fillStyle = grad;
      ctx.fillRect(e.x - rad, e.y - rad, rad * 2, rad * 2);
      if (e.cruz) {
        ctx.globalAlpha = tw * 0.45;
        ctx.fillStyle = e.col;
        ctx.fillRect(e.x - rad * 2.4, e.y - 0.4, rad * 4.8, 0.8);
        ctx.fillRect(e.x - 0.4, e.y - rad * 2.4, 0.8, rad * 4.8);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    if (!reducirMovimiento) {
      proximaFugaz -= dt;
      if (proximaFugaz <= 0 && !fugaz) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        fugaz = {
          x: ancho * (0.1 + Math.random() * 0.8), y: alto * Math.random() * 0.4,
          dx: dir * ancho * (0.18 + Math.random() * 0.15), dy: alto * (0.12 + Math.random() * 0.12),
          t: 0, dur: 700 + Math.random() * 500,
        };
        proximaFugaz = 9000 + Math.random() * 14000;
      }
      dibujarFugaz(dt);
    }
  }

  function bucle(tiempo) {
    if (!document.hidden) cuadro(tiempo);
    requestAnimationFrame(bucle);
  }

  // Paralaje suave con el mouse (las estrellas se mueven apenas, da profundidad)
  if (!reducirMovimiento) {
    window.addEventListener('pointermove', ev => {
      metaX = (ev.clientX / ancho - 0.5) * -MARGEN * 0.6;
      metaY = (ev.clientY / alto - 0.5) * -MARGEN * 0.6;
    }, { passive: true });
  }

  new ResizeObserver(ajustar).observe(escena);
  ajustar();
  if (!reducirMovimiento) requestAnimationFrame(bucle);
})();
