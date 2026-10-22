/* Пьезодинамик (пьезо-излучатель) — элемент схемы.
   Горизонтальная ориентация: корпус-«шайба» с отверстием, два вывода.

   Выводы:
     pos — «+» (левый), подключается к пину Arduino / питанию;
     neg — «−» (правый), обычно к GND.

   Физика:
     - buzzFreq — текущая частота звучания, Гц (0 — молчит);
     - buzzVol  — громкость 0..1;
     - _freq    — вычисляется решателем/рантаймом по напряжению на выводах.

   Arduino-runtime вызывает BuzzerRuntime.attach(comp) при старте и
   BuzzerRuntime.stopAll() при остановке скетча.

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
    wave:       'rgba(255, 200, 60, 0.85)',
    waveSoft:   'rgba(255, 200, 60, 0.25)'
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
      const active = (this.buzzFreq || this._freq || 0) > 0;

      // ---- Выводы ----
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

      // ---- Звуковые волны (если активен) ----
      if (active) {
        const t = (performance.now() % 1000) / 1000;
        ctx.save();
        for (let i = 0; i < 3; i++) {
          const ph = (t + i / 3) % 1;
          const r = R_HOLE + 6 + ph * (R_BODY - R_HOLE - 2);
          const alpha = (1 - ph) * 0.7;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 200, 60, ${alpha})`;
          ctx.lineWidth = 1.8;
          ctx.stroke();
        }
        ctx.restore();

        // ореол
        const g = ctx.createRadialGradient(0, 0, R_HOLE, 0, 0, R_BODY * 1.6);
        g.addColorStop(0, COL.waveSoft);
        g.addColorStop(1, 'rgba(255, 200, 60, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, R_BODY * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }

      // ---- Корпус ----
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

      // ---- Отверстие ----
      ctx.beginPath();
      ctx.arc(0, 0, R_HOLE, 0, Math.PI * 2);
      ctx.fillStyle = COL.hole;
      ctx.fill();
      ctx.strokeStyle = COL.holeEdge;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // ---- Подписи полюсов ----
      ctx.fillStyle = COL.labelPlus;
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+', -R_BODY - 8, -R_BODY + 4);

      ctx.fillStyle = COL.labelMinus;
      ctx.fillText('−', R_BODY + 8, -R_BODY + 4);

      // ---- Подпись частоты ----
      if (active) {
        const f = this.buzzFreq || this._freq || 0;
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 9px Consolas, monospace';
        ctx.textBaseline = 'top';
        ctx.fillText(f.toFixed(0) + ' Гц', 0, R_BODY + 3);
      }
    }
  };
})();