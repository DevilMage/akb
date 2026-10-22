/* Полевой транзистор IRF540N (N-канальный MOSFET) — элемент схемы.

   Отрисовка повторяет эталонный SVG (фланец с прозрачным отверстием,
   корпус с надписями IRF540N / I / пиктограмма диода / R / 227P / 8F 2E,
   три контактные площадки-трапеции, три ножки).

   Пиктограмма диода:
     • верхний шток + треугольник опущены на 2 px вниз;
     • планка — на своём месте;
     • НИЖНИЙ ШТОК начинается ровно от нижней кромки планки
       и идёт вниз (касается диода).

   Буквы:
     • I на x = 113;
     • R на x = 153.

   Регистрируется в window.SchematicComponents под ключом 'mosfet'.
*/
(function () {
  'use strict';

  window.SchematicComponents = window.SchematicComponents || {};

  // ============================================================
  //  МАСШТАБ
  // ============================================================
  const AA_W = 30;
  const TARGET_BODY_W = AA_W * 1.10;              // 33
  const SVG_BODY_W = 190;
  const SCALE = TARGET_BODY_W / SVG_BODY_W;       // ≈ 0.173684

  const CX = 170;
  const CY = 170;
  const sx = (x) => (x - CX) * SCALE;
  const sy = (y) => (y - CY) * SCALE;
  const sw = (v) => v * SCALE;

  // ---- Фланец ----
  const FLANGE_X = sx(70);
  const FLANGE_Y = sy(20);
  const FLANGE_W = sw(200);
  const FLANGE_H = sw(90);
  const FLANGE_R = sw(4);
  const HOLE_CX  = sx(170);
  const HOLE_CY  = sy(65);
  const HOLE_R   = sw(21);

  // ---- Корпус ----
  const BODY_X = sx(75);
  const BODY_Y = sy(95);
  const BODY_W = sw(190);
  const BODY_H = sw(150);
  const BODY_R = sw(4);

  // ---- Контактные площадки ----
  const CONTACT_TOP_Y  = sy(245);
  const CONTACT_BOT_Y  = sy(258);
  const CONTACT_TOP_HALF_W = sw(12);
  const CONTACT_BOT_HALF_W = sw(6);
  const CONTACT_X = [sx(118), sx(170), sx(222)];

  // ---- Ножки ----
  const LEG_TOP_Y = sy(258);
  const LEG_LEN   = sw(127);
  const LEG_W     = sw(12);

  const PIN_Y = LEG_TOP_Y + LEG_LEN;

  const W = sw(360);
  const H = sw(450);

  const LABEL_ABOVE_Y = FLANGE_Y - sw(8);

  // ============================================================
  //  БУКВЫ I И R И ПИКТОГРАММА ДИОДА
  // ============================================================
  const LETTER_I_X = 113;
  const LETTER_R_X = 153;
  const LETTER_CY  = 184;
  const LETTER_TOP = 175.9;
  const LETTER_BOT = 192.1;

  const DIO_CX = 130.5;

  const DIO_H = 22.2;

  // Длина штока — одинаковая для обоих штоков
  const DIO_SHAFT_LEN = 3.2;

  // Верхний шток + треугольник опущены на 2 px вниз
  const DIO_TOP_DROP_Y = 2.0;

  const DIO_TOP_BASE = 171.9;

  // Верхний шток
  const DIO_TOP_Y      = DIO_TOP_BASE + DIO_TOP_DROP_Y;   // 173.9
  const DIO_YSHAFT_BOT = DIO_TOP_Y + DIO_SHAFT_LEN;

  // Треугольник
  const DIO_YTRI_BOT = DIO_YSHAFT_BOT + DIO_H * 0.396;

  // Планка (поднята на 2 px относительно треугольника)
  const DIO_BAR_SHIFT = -2.0;
  const DIO_YBAR_TOP  = DIO_YTRI_BOT + DIO_BAR_SHIFT;
  const DIO_YBAR_BOT  = DIO_YBAR_TOP + DIO_H * 0.124;

  // ★ Нижний шток начинается ровно от НИЖНЕЙ КРОМКИ ПЛАНКИ
  //   и идёт вниз на ту же длину, что и верхний шток.
  const DIO_YBOT_TOP = DIO_YBAR_BOT;
  const DIO_YBOT_BOT = DIO_YBOT_TOP + DIO_SHAFT_LEN;

  const DIO_TRI_W   = 16.0;
  const DIO_BAR_W   = 18.0;
  const DIO_SHAFT_W = 2.6;

  const COL = {
    bodyEdge:    '#0a0a0a',
    flangeEdge:  '#666',
    holeEdge:    '#555',
    legEdge:     '#777',
    contactEdge: '#888',
    text:        '#e8e8e8',
    subText:     '#cccccc',
    pinText:     '#bdc3c7',
    burnedBody:  '#2a1e1e',
    burnedEdge:  '#4a2020',
    burnedText:  '#c0392b'
  };

  // ============================================================
  //  ХЕЛПЕРЫ
  // ============================================================
  function roundRectPath(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y,     x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x,     y + h, rr);
    ctx.arcTo(x,     y + h, x,     y,     rr);
    ctx.arcTo(x,     y,     x + w, y,     rr);
    ctx.closePath();
  }

  function openness(Vgs, Vth, Vov) {
    if (Vgs <= Vth) return 0;
    if (Vgs >= Vth + Vov) return 1;
    return (Vgs - Vth) / Vov;
  }

  // ============== ДЫМ ==============
  function spawnSmokeParticle() {
    const baseX = (Math.random() - 0.5) * BODY_W * 0.4;
    const baseY = BODY_Y + sw(10) + Math.random() * sw(4);
    return {
      x: baseX,
      y: baseY,
      vx: (Math.random() - 0.5) * 0.25,
      vy: -(0.7 + Math.random() * 0.6),
      r: 1.5 + Math.random() * 2,
      life: 0,
      maxLife: 1.8 + Math.random() * 1.4,
      seed: Math.random() * Math.PI * 2
    };
  }

  function updateSmokeParticles(comp, dt) {
    if (!comp._smoke) comp._smoke = [];
    const particles = comp._smoke;

    if (comp.burned) {
      comp._smokeSpawnAcc = (comp._smokeSpawnAcc || 0) + dt;
      const interval = 0.07;
      while (comp._smokeSpawnAcc >= interval) {
        comp._smokeSpawnAcc -= interval;
        particles.push(spawnSmokeParticle());
        if (particles.length > 150) particles.shift();
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) { particles.splice(i, 1); continue; }

      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.x += Math.sin((p.life * 3) + p.seed) * 0.2 * dt * 60;
      p.vy -= 0.02 * dt * 60;
      p.vx *= 0.985;
      p.r += dt * 6;
    }
  }

  function drawSmoke(ctx, comp) {
    if (!comp._smoke || comp._smoke.length === 0) return;
    ctx.save();
    ctx.translate(comp.x, comp.y);
    for (const p of comp._smoke) {
      const t = p.life / p.maxLife;
      const alpha = (1 - t) * 0.45;
      const r = p.r;
      const gray = 60 + Math.round(110 * t);
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      grad.addColorStop(0, `rgba(${gray}, ${gray}, ${gray}, ${alpha})`);
      grad.addColorStop(1, `rgba(${gray}, ${gray}, ${gray}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function formatOhms(R) {
    if (R >= 1e9)  return '∞';
    if (R >= 1e6)  return (R / 1e6).toFixed(2) + ' МОм';
    if (R >= 1e3)  return (R / 1e3).toFixed(2) + ' кОм';
    if (R >= 1)    return R.toFixed(1) + ' Ом';
    return (R * 1000).toFixed(0) + ' мОм';
  }

  // ============================================================
  //  ГРАДИЕНТЫ
  // ============================================================
  function makeFlangeGradient(ctx, burned) {
    const g = ctx.createLinearGradient(0, FLANGE_Y, 0, FLANGE_Y + FLANGE_H);
    if (burned) {
      g.addColorStop(0,    '#8a8a8a');
      g.addColorStop(0.40, '#7a7a7a');
      g.addColorStop(0.70, '#5a5a5a');
      g.addColorStop(1,    '#3a3a3a');
    } else {
      g.addColorStop(0,    '#e8e8e8');
      g.addColorStop(0.40, '#c8c8c8');
      g.addColorStop(0.70, '#a8a8a8');
      g.addColorStop(1,    '#909090');
    }
    return g;
  }

  function makeBodyGradient(ctx, burned) {
    const g = ctx.createLinearGradient(BODY_X, 0, BODY_X + BODY_W, 0);
    if (burned) {
      g.addColorStop(0,    '#3a2a2a');
      g.addColorStop(0.20, '#2a1a1a');
      g.addColorStop(0.50, '#1e1010');
      g.addColorStop(0.80, '#2a1a1a');
      g.addColorStop(1,    '#3a2a2a');
    } else {
      g.addColorStop(0,    '#3a3a3a');
      g.addColorStop(0.20, '#2a2a2a');
      g.addColorStop(0.50, '#1e1e1e');
      g.addColorStop(0.80, '#2a2a2a');
      g.addColorStop(1,    '#3a3a3a');
    }
    return g;
  }

  function makeLegGradient(ctx, lx, burned) {
    const g = ctx.createLinearGradient(lx, 0, lx + LEG_W, 0);
    if (burned) {
      g.addColorStop(0,    '#5a5a5a');
      g.addColorStop(0.30, '#8a8a8a');
      g.addColorStop(0.60, '#6a6a6a');
      g.addColorStop(1,    '#3a3a3a');
    } else {
      g.addColorStop(0,    '#b8b8b8');
      g.addColorStop(0.30, '#e0e0e0');
      g.addColorStop(0.60, '#c0c0c0');
      g.addColorStop(1,    '#909090');
    }
    return g;
  }

  // ============================================================
  //  ФЛАНЕЦ С ОТВЕРСТИЕМ
  // ============================================================
  function drawFlangeBody(ctx, burned) {
    ctx.save();
    roundRectPath(ctx, FLANGE_X, FLANGE_Y, FLANGE_W, FLANGE_H, FLANGE_R);
    ctx.fillStyle = makeFlangeGradient(ctx, burned);
    ctx.fill();
    ctx.restore();

    ctx.save();
    roundRectPath(ctx, FLANGE_X, FLANGE_Y, FLANGE_W, FLANGE_H, FLANGE_R);
    const shade = ctx.createLinearGradient(FLANGE_X, 0, FLANGE_X + FLANGE_W, 0);
    shade.addColorStop(0,    '#00000030');
    shade.addColorStop(0.15, '#00000000');
    shade.addColorStop(0.85, '#00000000');
    shade.addColorStop(1,    '#00000030');
    ctx.fillStyle = shade;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#ffffff30';
    ctx.beginPath();
    roundRectPath(ctx, sx(75), sy(24), sw(190), sw(8), sw(2));
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(HOLE_CX, HOLE_CY, HOLE_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    roundRectPath(ctx, FLANGE_X, FLANGE_Y, FLANGE_W, FLANGE_H, FLANGE_R);
    ctx.strokeStyle = COL.flangeEdge;
    ctx.lineWidth = 0.7;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(HOLE_CX, HOLE_CY, HOLE_R, 0, Math.PI * 2);
    ctx.strokeStyle = COL.holeEdge;
    ctx.lineWidth = 0.7;
    ctx.stroke();
    ctx.restore();
  }

  // ============================================================
  //  КОМПОНЕНТ
  // ============================================================
  window.SchematicComponents.mosfet = {
    w: W,
    h: H,

    hitPadX: 2,
    hitPadY: 3,

    defaults: {
      type: 'mosfet',
      label: 'IRF540N',
      Vth: 2.0,
      Vov: 5.0,
      Ron: 0.044,
      Roff: 1e9,
      Pmax: 40,
      burned: false,
      Vgs: 0,
      Vds: 0,
      Ids: 0,
      Rds: 1e9,
      dissipatedPower: 0
    },

    pins: [
      { id: 'g', x: CONTACT_X[0], y: PIN_Y, label: 'G' },
      { id: 'd', x: CONTACT_X[1], y: PIN_Y, label: 'D' },
      { id: 's', x: CONTACT_X[2], y: PIN_Y, label: 'S' }
    ],

    computeRds(comp, Vg, Vs) {
      if (comp.burned) return 1e12;
      const Vgs = Vg - Vs;
      const Vth = comp.Vth !== undefined ? comp.Vth : 2.0;
      const Vov = comp.Vov !== undefined ? comp.Vov : 5.0;
      const Ron = Math.max(comp.Ron !== undefined ? comp.Ron : 0.044, 1e-4);
      const Roff = comp.Roff !== undefined ? comp.Roff : 1e9;
      const k = openness(Vgs, Vth, Vov);
      if (k <= 0) return Roff;
      if (k >= 1) return Ron;
      const Goff = 1 / Roff;
      const Gon  = 1 / Ron;
      const G    = Goff + (Gon - Goff) * k;
      return 1 / Math.max(G, 1e-12);
    },

    draw(ctx) {
      const burned = !!this.burned;

      // ---- Надпись Rds — над фланцем ----
      ctx.save();
      ctx.fillStyle = burned ? COL.burnedText : COL.pinText;
      ctx.font = `bold ${Math.max(5, sw(14))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      const info = burned
        ? '💥 Сгорел'
        : `Rds=${formatOhms(this.Rds !== undefined ? this.Rds : 1e9)}`;
      ctx.fillText(info, 0, LABEL_ABOVE_Y);
      ctx.restore();

      // ---- Фланец ----
      drawFlangeBody(ctx, burned);

      // ---- Корпус ----
      ctx.save();
      roundRectPath(ctx, BODY_X, BODY_Y, BODY_W, BODY_H, BODY_R);
      ctx.fillStyle = makeBodyGradient(ctx, burned);
      ctx.fill();
      ctx.strokeStyle = burned ? COL.burnedEdge : COL.bodyEdge;
      ctx.lineWidth = 0.7;
      ctx.stroke();
      ctx.restore();

      // светлая полоса сверху корпуса
      ctx.save();
      ctx.fillStyle = '#ffffff10';
      ctx.beginPath();
      roundRectPath(ctx, sx(78), sy(97), sw(184), sw(20), sw(3));
      ctx.fill();
      ctx.restore();

      // ---- Надписи на корпусе ----
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // IRF540N
      ctx.fillStyle = burned ? COL.burnedText : COL.text;
      ctx.font = `bold ${Math.max(5, sw(22))}px Arial, sans-serif`;
      ctx.fillText('IRF540N', sx(170), sy(152));

      // "I"
      ctx.fillStyle = burned ? COL.burnedText : COL.subText;
      ctx.font = `bold ${Math.max(4, sw(15))}px Arial, sans-serif`;
      ctx.fillText('I', sx(LETTER_I_X), sy(LETTER_CY));

      // ★ ПИКТОГРАММА ДИОДА
      //   — верхний шток и треугольник опущены на 2 px;
      //   — планка — на своём месте;
      //   — нижний шток начинается ОТ ПЛАНКИ и касается диода.
      ctx.save();
      ctx.translate(sx(DIO_CX), 0);
      ctx.fillStyle = burned ? COL.burnedText : COL.subText;

      // 1) верхний шток
      ctx.fillRect(
        sw(-DIO_SHAFT_W / 2),
        sy(DIO_TOP_Y),
        sw(DIO_SHAFT_W),
        sy(DIO_YSHAFT_BOT) - sy(DIO_TOP_Y)
      );

      // 2) треугольник-стрелка
      ctx.beginPath();
      ctx.moveTo(sw(-DIO_TRI_W / 2), sy(DIO_YSHAFT_BOT));
      ctx.lineTo(sw( DIO_TRI_W / 2), sy(DIO_YSHAFT_BOT));
      ctx.lineTo(sw(0),              sy(DIO_YTRI_BOT));
      ctx.closePath();
      ctx.fill();

      // 3) горизонтальная планка
      ctx.fillRect(
        sw(-DIO_BAR_W / 2),
        sy(DIO_YBAR_TOP),
        sw(DIO_BAR_W),
        sy(DIO_YBAR_BOT) - sy(DIO_YBAR_TOP)
      );

      // 4) нижний шток — начинается ровно от низа планки
      ctx.fillRect(
        sw(-DIO_SHAFT_W / 2),
        sy(DIO_YBOT_TOP),
        sw(DIO_SHAFT_W),
        sy(DIO_YBOT_BOT) - sy(DIO_YBOT_TOP)
      );

      ctx.restore();

      // "R"
      ctx.fillStyle = burned ? COL.burnedText : COL.subText;
      ctx.font = `bold ${Math.max(4, sw(15))}px Arial, sans-serif`;
      ctx.fillText('R', sx(LETTER_R_X), sy(LETTER_CY));

      // "227P"
      ctx.fillStyle = burned ? COL.burnedText : COL.subText;
      ctx.font = `${Math.max(4, sw(14))}px Arial, sans-serif`;
      ctx.fillText('227P', sx(203), sy(LETTER_CY));

      // "8F   2E"
      ctx.fillStyle = burned ? COL.burnedText : COL.subText;
      ctx.font = `${Math.max(4, sw(14))}px Arial, sans-serif`;
      ctx.fillText('8F   2E', sx(170), sy(207));

      ctx.restore();

      // ---- Контактные площадки ----
      ctx.save();
      for (let i = 0; i < 3; i++) {
        const cx = CONTACT_X[i];
        ctx.fillStyle = '#d0d0d0';
        ctx.strokeStyle = COL.contactEdge;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(cx - CONTACT_TOP_HALF_W, CONTACT_TOP_Y);
        ctx.lineTo(cx + CONTACT_TOP_HALF_W, CONTACT_TOP_Y);
        ctx.lineTo(cx + CONTACT_BOT_HALF_W, CONTACT_BOT_Y);
        ctx.lineTo(cx - CONTACT_BOT_HALF_W, CONTACT_BOT_Y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();

      // ---- Ножки ----
      ctx.save();
      for (let i = 0; i < 3; i++) {
        const cx = CONTACT_X[i];
        const lx = cx - LEG_W / 2;

        ctx.fillStyle = makeLegGradient(ctx, lx, burned);
        ctx.strokeStyle = COL.legEdge;
        ctx.lineWidth = 0.4;
        ctx.fillRect(lx, LEG_TOP_Y, LEG_W, LEG_LEN);
        ctx.strokeRect(lx, LEG_TOP_Y, LEG_W, LEG_LEN);

        ctx.fillStyle = burned ? '#a0a0a050' : '#ffffff50';
        ctx.fillRect(lx + sw(1), LEG_TOP_Y + sw(4), sw(3), LEG_LEN - sw(8));
      }
      ctx.restore();

      // ---- Подписи выводов G / D / S ----
      ctx.save();
      ctx.fillStyle = COL.pinText;
      ctx.font = `bold ${Math.max(5, sw(14))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const labelY = PIN_Y + sw(2);
      ctx.fillText('G', CONTACT_X[0], labelY);
      ctx.fillText('D', CONTACT_X[1], labelY);
      ctx.fillText('S', CONTACT_X[2], labelY);
      ctx.restore();
    },

    updateSmoke(dt) {
      updateSmokeParticles(this, dt);
    },

    drawSmoke(ctx) {
      drawSmoke(ctx, this);
    }
  };
})();