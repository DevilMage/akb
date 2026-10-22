/* Пьезодинамик (пьезо-излучатель) — элемент схемы.
   Горизонтальная ориентация: корпус-«шайба» с отверстием, два вывода.

   Выводы:
     pos — «+» (левый), подключается к пину Arduino / питанию;
     neg — «−» (правый), обычно к GND.

   Физика:
     - buzzFreq — текущая частота звучания, Гц (0 — молчит);
     - buzzVol  — громкость 0..1;
     - _freq    — вычисляется решателем/рантаймом по напряжению на выводах.

   Анимация:
     - если buzzFreq > 0, вокруг динамика расходятся 3 анимированные волны;
     - скорость и плотность волн зависят от частоты (чем выше Гц — тем быстрее/чаще);
     - в центре пульсирует свечение, имитируя вибрацию мембраны.

   Регистрируется в window.SchematicComponents под ключом 'buzzer'.
*/
(function () {
  'use strict';

  window.SchematicComponents = window.SchematicComponents || {};

  const COL = {
    body:       '#2a2a2c',
    bodyEdge:   '#0f0f10',
    bodyHi:     'rgba(255,255,255,0.12)',
    hole:       '#0a0a0a',
    holeEdge:   '#3a3a3c',
    cone:       '#1e1e20',
    pin:        '#a8a8a8',
    pinEdge:    '#2a2a2a',
    pinHi:      '#dcdcdc',
    labelPlus:  '#e74c3c',
    labelMinus: '#3498db',
    // Цвета волн
    wave1:      'rgba(255, 200, 60, 0.85)',
    wave2:      'rgba(255, 160, 40, 0.55)',
    wave3:      'rgba(255, 220, 100, 0.35)',
    glow:       'rgba(255, 200, 60, 0.40)'
  };

  const W = 56;
  const H = 56;
  const R_BODY = 24;
  const R_HOLE = 7;
  const PIN_LEN = 14;

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

  window.SchematicComponents.buzzer = {
    w: W,
    h: H,

    hitPadX: 4,
    hitPadY: 4,

    defaults: {
      type: 'buzzer',
      label: 'Пьезодинамик',
      buzzFreq: 0,
      buzzVol: 0,
      _freq: 0,
      _vol: 0
    },

    pins: [
      { id: 'pos', x: -R_BODY - PIN_LEN, y: 0, label: '+' },
      { id: 'neg', x:  R_BODY + PIN_LEN, y: 0, label: '−' }
    ],

    draw(ctx) {
      const freq = this.buzzFreq || this._freq || 0;
      const active = freq > 0;
      const now = performance.now();

      // ============================================================
      //  1) АНИМАЦИЯ ЗВУКОВЫХ ВОЛН (если активен)
      // ============================================================
      if (active) {
        // Нормализуем частоту: 100 Гц → 0, 5000 Гц → 1
        const fNorm = Math.max(0, Math.min(1, (freq - 100) / 4900));
        
        // Скорость анимации: от 0.6 до 2.2 циклов в секунду
        const speed = 0.6 + fNorm * 1.6;
        
        // Базовый радиус волны
        const r0 = R_BODY + 4;
        const rMax = R_BODY + 28;

        ctx.save();
        
        // 1.1. Общее «свечение» вокруг динамика (пульсирует)
        const glowPulse = 0.5 + 0.5 * Math.sin(now / 150);
        const glowR = R_BODY + 6 + glowPulse * 4;
        const g = ctx.createRadialGradient(0, 0, R_BODY, 0, 0, glowR);
        g.addColorStop(0, COL.glow);
        g.addColorStop(1, 'rgba(255, 200, 60, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, glowR, 0, Math.PI * 2);
        ctx.fill();

        // 1.2. Три расходящиеся волны с разными фазами
        const phases = [0, 0.33, 0.66];
        for (let i = 0; i < phases.length; i++) {
          // Фаза 0..1
          const ph = ((now / 1000) * speed + phases[i]) % 1;
          
          // Радиус волны
          const r = r0 + (rMax - r0) * ph;
          
          // Прозрачность: в начале ярко, в конце затухает
          const alpha = (1 - ph) * 0.7;
          
          // Толщина линии: толще в начале, тоньше в конце
          const lineW = 2.5 - ph * 1.8;

          // Выбираем цвет в зависимости от индекса
          let color;
          if (i === 0) color = `rgba(255, 200, 60, ${alpha})`;
          else if (i === 1) color = `rgba(255, 160, 40, ${alpha * 0.75})`;
          else color = `rgba(255, 220, 100, ${alpha * 0.5})`;

          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.strokeStyle = color;
          ctx.lineWidth = lineW;
          ctx.stroke();
        }

        ctx.restore();
      }

      // ============================================================
      //  2) ВЫВОДЫ
      // ============================================================
      ctx.strokeStyle = COL.pin;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-W / 2, 0);
      ctx.lineTo(-R_BODY, 0);
      ctx.moveTo(W / 2, 0);
      ctx.lineTo(R_BODY, 0);
      ctx.stroke();

      // наконечники
      ctx.fillStyle = COL.pinHi;
      ctx.beginPath();
      ctx.arc(-W / 2 + 1, 0, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(W / 2 - 1, 0, 2.2, 0, Math.PI * 2);
      ctx.fill();

      // ============================================================
      //  3) КОРПУС
      // ============================================================
      ctx.beginPath();
      ctx.arc(0, 0, R_BODY, 0, Math.PI * 2);
      ctx.fillStyle = COL.body;
      ctx.fill();
      ctx.strokeStyle = COL.bodyEdge;
      ctx.lineWidth = 2;
      ctx.stroke();

      // блик
      const bg = ctx.createRadialGradient(-8, -8, 2, 0, 0, R_BODY);
      bg.addColorStop(0, COL.bodyHi);
      bg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(0, 0, R_BODY - 1, 0, Math.PI * 2);
      ctx.fill();

      // внутреннее кольцо (конус)
      ctx.beginPath();
      ctx.arc(0, 0, R_BODY - 6, 0, Math.PI * 2);
      ctx.strokeStyle = COL.cone;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // ============================================================
      //  4) ОТВЕРСТИЕ + пульсирующая мембрана
      // ============================================================
      // Если активен — отверстие пульсирует
      let holeR = R_HOLE;
      if (active) {
        const pulse = Math.sin(now / 80) * 0.5 + 0.5; // 0..1
        holeR = R_HOLE + pulse * 1.5;
      }

      ctx.beginPath();
      ctx.arc(0, 0, holeR, 0, Math.PI * 2);
      ctx.fillStyle = COL.hole;
      ctx.fill();
      ctx.strokeStyle = COL.holeEdge;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Внутреннее свечение в отверстии при звуке
      if (active) {
        const innerGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, holeR);
        innerGlow.addColorStop(0, 'rgba(255, 200, 60, 0.6)');
        innerGlow.addColorStop(1, 'rgba(255, 200, 60, 0)');
        ctx.fillStyle = innerGlow;
        ctx.beginPath();
        ctx.arc(0, 0, holeR, 0, Math.PI * 2);
        ctx.fill();
      }

      // ============================================================
      //  5) ПОДПИСИ ПОЛЮСОВ
      // ============================================================
      ctx.fillStyle = COL.labelPlus;
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+', -R_BODY - 8, -R_BODY + 4);

      ctx.fillStyle = COL.labelMinus;
      ctx.fillText('−', R_BODY + 8, -R_BODY + 4);

      // ============================================================
      //  6) ПОДПИСЬ ЧАСТОТЫ
      // ============================================================
      if (active) {
        // Сама надпись тоже «дышит»
        const textScale = 1 + Math.sin(now / 100) * 0.05;
        ctx.save();
        ctx.fillStyle = '#f1c40f';
        ctx.font = `bold ${Math.round(9 * textScale)}px Consolas, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(freq.toFixed(0) + ' Гц', 0, R_BODY + 3);
        ctx.restore();
      }
    }
  };
})();