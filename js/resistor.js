/* Резистор — элемент схемы.
   Горизонтальная ориентация. Два вывода a и b.

   Характеристики:
     - resistance — сопротивление, Ом (по умолчанию 220);
     - power      — номинальная мощность рассеивания, Вт (по умолчанию 0.25);
     - burned     — перегорел ли.

   Цветовые полосы рассчитываются по стандарту IEC 60062
   (4 полосы: 2 значащие цифры + множитель + допуск).
   Допуск по умолчанию — золотой (±5%).

   При перегорании из резистора идёт дым.

   Регистрируется в window.SchematicComponents под ключом 'resistor'.
*/
(function () {
  'use strict';

  window.SchematicComponents = window.SchematicComponents || {};

  const COL = {
    body:       '#e8d5a8',
    bodyEdge:   '#b0987a',
    lead:       '#7f8c8d',
    leadDark:   '#5a6672',
    label:      '#7f8c8d',
    burnedBody: '#4a4038',
    burnedEdge: '#2a2420',
    burnedLbl:  '#c0392b'
  };

  // Стандартные цвета полос IEC 60062
  const BAND_COLORS = {
    0: '#000000', // чёрный
    1: '#8B4513', // коричневый
    2: '#e74c3c', // красный
    3: '#e67e22', // оранжевый
    4: '#f1c40f', // жёлтый
    5: '#27ae60', // зелёный
    6: '#2980b9', // синий
    7: '#8e44ad', // фиолетовый
    8: '#7f8c8d', // серый
    9: '#ecf0f1'  // белый
  };

  // Цвета допусков
  const TOLERANCE_COLORS = {
    '±1%':   '#8B4513', // коричневый
    '±2%':   '#e74c3c', // красный
    '±5%':   '#d4ac0d', // золотой
    '±10%':  '#bdc3c7'  // серебристый
  };

  const W = 68;
  const H = 22;
  const X0 = -W / 2;
  const Y0 = -H / 2;
  const BODY_W = 44;
  const BODY_H = 22;
  const LEAD_LEN = (W - BODY_W) / 2; // 12

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y,     x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x,     y + h, rr);
    ctx.arcTo(x,     y + h, x,     y,     rr);
    ctx.arcTo(x,     y,     x + w, y,     rr);
    ctx.closePath();
  }

  function formatPower(P) {
    if (P >= 1)    return P.toFixed(2) + ' Вт';
    if (P >= 1e-3) return (P * 1e3).toFixed(1) + ' мВт';
    if (P >= 1e-6) return (P * 1e6).toFixed(1) + ' мкВт';
    return (P * 1e9).toFixed(1) + ' нВт';
  }

  // ===================== РАСЧЁТ ПОЛОС =====================
  // Возвращает массив из 4 цветов: [A, B, C, D].
  // Допуск D — золотой (±5%).
  function calcResistorBands(resistance) {
    const R = Math.max(0, resistance || 220);

    // Если сопротивление <= 0 — не рисуем полосы.
    if (R <= 0) return null;

    // Приводим к формату: две значащие цифры + множитель.
    // Например: 220 → [2, 2, ×10]  → A=2, B=2, C=1 (10^1)
    //           470 → [4, 7, ×10]  → A=4, B=7, C=1
    //           1000 → [1, 0, ×100] → A=1, B=0, C=2
    //           0.47 → [4, 7, ×0.01] → A=4, B=7, C=-2

    // Логарифмический подход: нормализуем в диапазон [10, 100).
    let exp = Math.floor(Math.log10(R)) - 1;
    let mantissa = R / Math.pow(10, exp);

    // Округление мантиссы до 2 значащих цифр
    let m = Math.round(mantissa);
    if (m >= 100) { m = Math.round(m / 10); exp += 1; }
    if (m < 10)   { m *= 10;                 exp -= 1; }

    let digitA = Math.floor(m / 10);
    let digitB = m % 10;

    // digitA не должен быть 0 (иначе теряем значащую цифру)
    if (digitA === 0) {
      digitA = digitB;
      digitB = 0;
      exp -= 1;
    }

    // Ограничим множитель допустимым диапазоном цветов (−2…9).
    if (exp < -2) exp = -2;
    if (exp >  9) exp =  9;

    // В стандартной маркировке множитель кодируется цветом для 10^exp.
    // Для отрицательных exp используют золотой (-1) и серебристый (-2),
    // но обычно маркируют 3-4 полосами без отрицательных значений.
    // Здесь для отрицательных exp используем:
    //   exp = -1 → золотой (10^-1)
    //   exp = -2 → серебристый (10^-2)
    // Для exp >= 0 — стандартный цвет.
    const multiplierColor = exp >= 0
      ? BAND_COLORS[Math.min(exp, 9)]
      : (exp === -1 ? TOLERANCE_COLORS['±5%'] : '#bdc3c7');

    const bandA = BAND_COLORS[digitA];
    const bandB = BAND_COLORS[digitB];
    const bandC = multiplierColor;
    const bandD = TOLERANCE_COLORS['±5%']; // золотой

    return [bandA, bandB, bandC, bandD];
  }

  // ===================== ДЫМ =====================
  function spawnSmokeParticle() {
    const baseX = (Math.random() - 0.5) * BODY_W * 0.35;
    const baseY = -BODY_H / 2 - 1 + Math.random() * 2;
    return {
      x: baseX,
      y: baseY,
      vx: (Math.random() - 0.5) * 0.35,
      vy: -(0.9 + Math.random() * 0.7),
      r: 2 + Math.random() * 2.5,
      life: 0,
      maxLife: 1.8 + Math.random() * 1.4,
      seed: Math.random() * Math.PI * 2,
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
      p.x += Math.sin((p.life * 3) + p.seed) * 0.25 * dt * 60;
      p.vy -= 0.03 * dt * 60;
      p.vx *= 0.985;
      p.r += dt * 8;
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

  window.SchematicComponents.resistor = {
    w: W,
    h: H,

    hitPadX: 4,
    hitPadY: 6,

    defaults: {
      type: 'resistor',
      label: 'Резистор',
      resistance: 220,
      power: 0.25,
      burned: false
    },

    pins: [
      { id: 'a', x: -W / 2, y: 0, label: 'a' },
      { id: 'b', x:  W / 2, y: 0, label: 'b' }
    ],

    draw(ctx) {
      const burned = !!this.burned;

      // ---- Выводы (металлические ножки) ----
      ctx.strokeStyle = burned ? '#3a3a3a' : COL.lead;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(X0, 0);
      ctx.lineTo(X0 + LEAD_LEN, 0);
      ctx.moveTo(X0 + W, 0);
      ctx.lineTo(X0 + W - LEAD_LEN, 0);
      ctx.stroke();

      // ---- Корпус ----
      const bx = -BODY_W / 2;
      const by = -BODY_H / 2;

      ctx.fillStyle = burned ? COL.burnedBody : COL.body;
      ctx.strokeStyle = burned ? COL.burnedEdge : COL.bodyEdge;
      ctx.lineWidth = 1.5;
      roundRect(ctx, bx, by, BODY_W, BODY_H, 6);
      ctx.fill();
      ctx.stroke();

      // Лёгкий блик сверху
      if (!burned) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(bx + 3, by + 1.5, BODY_W - 6, 1.5);
      }

      // ---- Цветовые полосы по номиналу ----
      if (!burned) {
        const bands = calcResistorBands(this.resistance || 220);
        if (bands) {
          const bandW = 4;
          const bandH = BODY_H - 4;
          const bandY = by + 2;

          // Расположение полос (4 полосы): смещение от левого края корпуса
          // A — 6 px от левого края; B — 6+6=12; C — 6+12=18; D — ближе к правому краю (24).
          const offsets = [6, 12, 18, 30];

          for (let i = 0; i < bands.length; i++) {
            const xPos = bx + offsets[i];
            // Не вылезаем за пределы корпуса
            if (xPos + bandW > bx + BODY_W - 2) continue;

            ctx.fillStyle = bands[i];
            ctx.fillRect(xPos, bandY, bandW, bandH);

            // Тонкая тёмная обводка для белых/светлых полос
            if (i === 3 || bands[i] === BAND_COLORS[9] || bands[i] === BAND_COLORS[8]) {
              ctx.strokeStyle = 'rgba(0,0,0,0.35)';
              ctx.lineWidth = 0.5;
              ctx.strokeRect(xPos + 0.25, bandY + 0.25, bandW - 0.5, bandH - 0.5);
            }
          }
        }
      } else {
        // «Трещины» на перегоревшем резисторе
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx + 12, by + 4);
        ctx.lineTo(bx + 18, by + BODY_H - 6);
        ctx.lineTo(bx + 24, by + 8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bx + 30, by + 4);
        ctx.lineTo(bx + 34, by + BODY_H - 4);
        ctx.stroke();
      }

      // ---- Подпись: сопротивление + мощность ----
      const R = this.resistance || 220;
      const P = this.power || 0.25;
      let rText;
      if (R >= 1e6)      rText = (R / 1e6).toFixed(2) + ' МОм';
      else if (R >= 1e3) rText = (R / 1e3).toFixed(2) + ' кОм';
      else               rText = R.toFixed(0) + ' Ом';

      const pText = formatPower(P);

      ctx.fillStyle = burned ? COL.burnedLbl : COL.label;
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (burned) {
        ctx.fillText('💥 ' + rText, 0, by + BODY_H + 9);
      } else {
        ctx.fillText(rText + ' · ' + pText, 0, by + BODY_H + 9);
      }
    },

    updateSmoke(dt) {
      updateSmokeParticles(this, dt);
    },

    drawSmoke(ctx) {
      drawSmoke(ctx, this);
    }
  };
})();