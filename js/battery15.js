/* Батарейка «AA» 1.5V — элемент схемы.
   Оформлена в стиле «Кроны» 9V, но:
     - корпус в 2 раза уже (ширина 30);
     - сверху только ОДИН контакт — по центру («+»), узкая ножка;
     - снизу — плоский минусовой торец (вывод «−»);
     - значки «+» и «−» — по центру по горизонтали:
       «+» ближе к верхнему контакту (на оранжевой этикетке),
       «−» у начала минусового контакта (над нижним торцом);
     - надпись «1.5V» — в начале чёрной части корпуса.

   Характеристики:
     - voltage   — напряжение, В (1.5)
     - capacity  — ёмкость, мА·ч (2500)
     - label     — подпись

   Выводы (pins):
     - pos — на верхнем плюсовом контакте (по центру);
     - neg — на ПОВЕРХНОСТИ минусового контакта (нижняя кромка торца).

   Регистрируется в window.SchematicComponents под ключом 'battery15'.
*/
(function () {
  'use strict';

  window.SchematicComponents = window.SchematicComponents || {};

  const COL = {
    bodyOrange:   '#f07c00',
    bodyBlack:    '#141414',
    bodyEdge:     '#000000',
    terminal:     '#8a8a8a',
    terminalTop:  '#a8a8a8',
    terminalEdge: '#000000',
    sign:         '#ffffff'
  };

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

  function topRoundedRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.arcTo(x + w, y, x + w, y + rr, rr);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + rr);
    ctx.arcTo(x, y, x + rr, y, rr);
    ctx.closePath();
  }

  // Только один верхний контакт — узкая ножка «+», по центру
  const STEM_W = 14, STEM_H = 5;

  // Корпус в 2 раза уже «Кроны»: 30 × 100
  const W = 30, H = 100;
  const X0 = -W / 2;
  const Y0 = -H / 2;

  // Плюсовой контакт — по центру корпуса
  const POS_X = 0;

  // Плюсовой пин — на верхней кромке ножки
  const POS_PIN_Y = Y0 - STEM_H;

  // Минусовой торец снизу — плоская пластина
  const BOT_W = W - 6;
  const BOT_H = 3;
  // Торец рисуется от y0 + H - 1 до y0 + H - 1 + BOT_H.
  // Пин neg — ровно на нижней кромке торца (на его поверхности).
  const BOT_TOP_Y = Y0 + H - 1;
  const BOT_BOT_Y = BOT_TOP_Y + BOT_H;
  const NEG_PIN_Y = BOT_BOT_Y;

  function drawTerminalPlain(ctx, cx, baseY) {
    ctx.save();
    ctx.translate(cx, baseY);

    ctx.fillStyle = COL.terminal;
    ctx.strokeStyle = COL.terminalEdge;
    ctx.lineWidth = 1;

    topRoundedRect(ctx, -STEM_W / 2, -STEM_H, STEM_W, STEM_H, 3);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = COL.terminalTop;
    ctx.fillRect(-STEM_W / 2 + 2, -STEM_H + 1, STEM_W - 4, 1);

    ctx.restore();
  }

  function drawPlusSign(ctx, cx, cy, size) {
    const barW = size;
    const barH = size * 0.28;
    ctx.fillStyle = COL.sign;
    ctx.fillRect(cx - barW / 2, cy - barH / 2, barW, barH);
    ctx.fillRect(cx - barH / 2, cy - barW / 2, barH, barW);
  }

  function drawMinusSign(ctx, cx, cy, size) {
    const barW = size;
    const barH = size * 0.28;
    ctx.fillStyle = COL.sign;
    ctx.fillRect(cx - barW / 2, cy - barH / 2, barW, barH);
  }

  window.SchematicComponents.battery15 = {
    w: W,
    h: H + BOT_H,

    hitPadX: 2,
    hitPadY: 12,

    defaults: {
      type: 'battery15',
      voltage: 1.5,
      capacity: 2500,
      label: 'AA 1.5V'
    },

    pins: [
      { id: 'pos', x: POS_X, y: POS_PIN_Y, label: '+' },
      { id: 'neg', x: 0,     y: NEG_PIN_Y, label: '−' }
    ],

    draw(ctx) {
      const x0 = X0;
      const y0 = Y0;
      const outerR = 6;

      const orangeH = Math.round(H / 3);
      const blackH  = H - orangeH;

      // ---- Чёрная (нижняя) часть корпуса ----
      ctx.fillStyle = COL.bodyBlack;
      ctx.strokeStyle = COL.bodyEdge;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const rB = outerR;
      ctx.moveTo(x0, y0 + orangeH);
      ctx.lineTo(x0 + W, y0 + orangeH);
      ctx.lineTo(x0 + W, y0 + H - rB);
      ctx.arcTo(x0 + W, y0 + H, x0 + W - rB, y0 + H, rB);
      ctx.lineTo(x0 + rB, y0 + H);
      ctx.arcTo(x0, y0 + H, x0, y0 + H - rB, rB);
      ctx.lineTo(x0, y0 + orangeH);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // ---- Оранжевая (верхняя) этикетка ----
      ctx.fillStyle = COL.bodyOrange;
      ctx.beginPath();
      const rT = outerR;
      ctx.moveTo(x0, y0 + orangeH);
      ctx.lineTo(x0, y0 + rT);
      ctx.arcTo(x0, y0, x0 + rT, y0, rT);
      ctx.lineTo(x0 + W - rT, y0);
      ctx.arcTo(x0 + W, y0, x0 + W, y0 + rT, rT);
      ctx.lineTo(x0 + W, y0 + orangeH);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Линия раздела этикетки и чёрного корпуса
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.moveTo(x0, y0 + orangeH);
      ctx.lineTo(x0 + W, y0 + orangeH);
      ctx.stroke();

      // ---- Плюсовой контакт сверху (по центру) ----
      drawTerminalPlain(ctx, POS_X, y0);

      // ---- Минусовой торец снизу ----
      ctx.fillStyle = COL.terminal;
      ctx.strokeStyle = COL.terminalEdge;
      ctx.lineWidth = 1;
      roundRect(ctx, -BOT_W / 2, BOT_TOP_Y, BOT_W, BOT_H, 1.5);
      ctx.fill();
      ctx.stroke();

      // ---- Значки «+» и «−» — по центру по горизонтали ----
      const signSize = 11;

      // «+» ближе к верхнему контакту — в верхней части оранжевой этикетки
      const plusY  = y0 + 12;
      drawPlusSign(ctx, 0, plusY, signSize);

      // «−» у начала минусового контакта — прямо над нижним торцом
      const minusY = BOT_TOP_Y - 6;
      drawMinusSign(ctx, 0, minusY, signSize);

      // ---- Надпись «1.5V» — в начале чёрной части корпуса ----
      ctx.save();
      ctx.fillStyle = COL.sign;
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const labelY = y0 + orangeH + 8;
      ctx.fillText('1.5V', 0, labelY);
      ctx.restore();
    }
  };
})();