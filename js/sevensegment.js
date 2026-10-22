/* Семисегментный индикатор (одноразрядный, с точкой) — элемент схемы.

   Пины:
     сверху (4):  a, b, c, d
     снизу  (4):  e, f, g, dp
     справа (1):  com

   Порядок сегментов a → b → c → d → e → f → g → dp идёт сверху вниз,
   слева направо.

   ★ Координаты пинов в PINS включают BODY_SHIFT_X, поэтому узлы
     контактов на схеме точно совпадают с визуальными концами ножек.

   Регистрируется в window.SchematicComponents под ключом 'sevensegment'.
*/
(function () {
  'use strict';

  window.SchematicComponents = window.SchematicComponents || {};

  // ============================================================
  //  ПАРАМЕТРЫ КОРПУСА И СЕГМЕНТОВ
  // ============================================================
  const W = 56;
  const H = 90;
  const BODY_SHIFT_X = -4;

  const SEG_INSET = 4;
  const TH        = 7;
  const GAP_H     = 3.0;
  const H_SIDE    = 2.5;
  const GAP_V     = -2.6;
  const DP_SHIFT  = -2;
  const DP_R      = 3.0;

  const CENTER_PAD = 2;

  const PIN_LEN = 12;

  // ============================================================
  //  ПИНЫ — порядок a, b, c, d / e, f, g, dp
  // ============================================================
  const TOP_PIN_IDS    = ['a', 'b', 'c', 'd'];
  const BOTTOM_PIN_IDS = ['e', 'f', 'g', 'dp'];

  const PIN_STEP_X = 10.5;

  // Y-координата концов выводов (в локальных координатах компонента)
  const TOP_PIN_Y    = -H / 2 - PIN_LEN;
  const BOTTOM_PIN_Y =  H / 2 + PIN_LEN;

  // X-координаты выводов БЕЗ учёта BODY_SHIFT_X
  const TOP_PIN_XS = (function () {
    const arr = [];
    const total = (TOP_PIN_IDS.length - 1) * PIN_STEP_X;
    const startX = -total / 2;
    for (let i = 0; i < TOP_PIN_IDS.length; i++) {
      arr.push(startX + i * PIN_STEP_X);
    }
    return arr;
  })();

  const BOTTOM_PIN_XS = (function () {
    const arr = [];
    const total = (BOTTOM_PIN_IDS.length - 1) * PIN_STEP_X;
    const startX = -total / 2;
    for (let i = 0; i < BOTTOM_PIN_IDS.length; i++) {
      arr.push(startX + i * PIN_STEP_X);
    }
    return arr;
  })();

  const COM_X_BASE = W / 2 + PIN_LEN + 4;
  const COM_Y      = 0;

  // ★ Итоговые координаты пинов — со сдвигом корпуса.
  const PINS = (function () {
    const arr = [];

    for (let i = 0; i < TOP_PIN_IDS.length; i++) {
      arr.push({
        id:    TOP_PIN_IDS[i],
        x:     TOP_PIN_XS[i] + BODY_SHIFT_X,
        y:     TOP_PIN_Y,
        label: TOP_PIN_IDS[i]
      });
    }

    for (let i = 0; i < BOTTOM_PIN_IDS.length; i++) {
      arr.push({
        id:    BOTTOM_PIN_IDS[i],
        x:     BOTTOM_PIN_XS[i] + BODY_SHIFT_X,
        y:     BOTTOM_PIN_Y,
        label: BOTTOM_PIN_IDS[i]
      });
    }

    arr.push({
      id:    'com',
      x:     COM_X_BASE + BODY_SHIFT_X,
      y:     COM_Y,
      label: 'com'
    });

    return arr;
  })();

  // ============================================================
  //  ЦВЕТА
  // ============================================================
  const COL = {
    bodyFill:    '#0f0f10',
    bodyEdge:    '#2a2a2c',
    bodyTopHi:   'rgba(255,255,255,0.06)',
    pinBody:     '#c8c8c8',
    pinLabel:    '#bdc3c7',
    segOn:       '#ff2d1a',
    segOnGlow:   'rgba(255, 45, 26, 0.55)',
    segOff:      '#2a0d0d',
    dpOn:        '#ff2d1a',
    dpOff:       '#2a0d0d',
    textLabel:   '#bdc3c7'
  };

  // ============================================================
  //  ХЕЛПЕРЫ
  // ============================================================
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

  function drawSegmentH(ctx, x0, x1, y, on) {
    const t2 = TH / 2;
    ctx.beginPath();
    ctx.moveTo(x0 + t2, y);
    ctx.lineTo(x1 - t2, y);
    ctx.lineTo(x1,      y + t2);
    ctx.lineTo(x1 - t2, y + TH);
    ctx.lineTo(x0 + t2, y + TH);
    ctx.lineTo(x0,      y + t2);
    ctx.closePath();

    if (on) {
      ctx.save();
      ctx.shadowColor = COL.segOnGlow;
      ctx.shadowBlur = 8;
      ctx.fillStyle = COL.segOn;
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = on ? COL.segOn : COL.segOff;
    ctx.fill();
  }

  function drawSegmentV(ctx, x0, y0, y1, on) {
    const t2 = TH / 2;
    ctx.beginPath();
    ctx.moveTo(x0,         y0 + t2);
    ctx.lineTo(x0 + t2,    y0);
    ctx.lineTo(x0 + TH,    y0 + t2);
    ctx.lineTo(x0 + TH,    y1 - t2);
    ctx.lineTo(x0 + t2,    y1);
    ctx.lineTo(x0,         y1 - t2);
    ctx.closePath();

    if (on) {
      ctx.save();
      ctx.shadowColor = COL.segOnGlow;
      ctx.shadowBlur = 8;
      ctx.fillStyle = COL.segOn;
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = on ? COL.segOn : COL.segOff;
    ctx.fill();
  }

  function drawDp(ctx, cx, cy, r, on) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    if (on) {
      ctx.save();
      ctx.shadowColor = COL.segOnGlow;
      ctx.shadowBlur = 8;
      ctx.fillStyle = COL.dpOn;
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = on ? COL.dpOn : COL.dpOff;
    ctx.fill();
  }

  // ============================================================
  //  ГЕОМЕТРИЯ СЕГМЕНТОВ
  // ============================================================
  function computeSegmentLayout() {
    const halfW = W / 2;
    const halfH = H / 2;

    const left  = -halfW + SEG_INSET;
    const right =  halfW - SEG_INSET - 10;
    const top   = -halfH + SEG_INSET;
    const bot   =  halfH - SEG_INSET;
    const midY  = (top + bot) / 2;

    const hx0 = left  + GAP_H + H_SIDE;
    const hx1 = right - GAP_H - H_SIDE;

    const vTopA = top + TH + GAP_V;
    const vBotA = midY - TH / 2 - GAP_V;
    const vTopB = midY + TH / 2 + GAP_V;
    const vBotB = bot - TH - GAP_V;

    return { left, right, top, bot, midY, hx0, hx1,
             vTopA, vBotA, vTopB, vBotB };
  }

  function computeGroupBBox() {
    const halfW = W / 2;
    const left  = -halfW + SEG_INSET;
    const right =  halfW - SEG_INSET - 10;

    const hx0 = left + GAP_H + H_SIDE;
    const leftEdge = Math.min(left, hx0);

    const dpCX = right + 5 + DP_R + DP_SHIFT;
    const dpRightEdge = dpCX + DP_R;

    const rightEdge = Math.max(right, dpRightEdge);
    return { center: (leftEdge + rightEdge) / 2 };
  }

  // ============================================================
  //  КОМПОНЕНТ
  // ============================================================
  window.SchematicComponents.sevensegment = {
    w: W + PIN_LEN * 2 + 8 + Math.abs(BODY_SHIFT_X),
    h: H + PIN_LEN * 2 + 12,

    hitPadX: 0,
    hitPadY: 0,

    defaults: {
      type: 'sevensegment',
      label: '7SEG',
      commonType: 'cathode',
      segments: { a: 0, b: 0, c: 0, d: 0, e: 0, f: 0, g: 0, dp: 0 }
    },

    pins: PINS,

    draw(ctx) {
      const segs = this.segments || { a:0,b:0,c:0,d:0,e:0,f:0,g:0,dp:0 };

      const halfW = W / 2;
      const halfH = H / 2;

      // ---- КОРПУС ----
      ctx.save();
      ctx.translate(BODY_SHIFT_X, 0);

      roundRect(ctx, -halfW, -halfH, W, H, 4);
      ctx.fillStyle = COL.bodyFill;
      ctx.fill();
      ctx.strokeStyle = COL.bodyEdge;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = COL.bodyTopHi;
      ctx.fillRect(-halfW + 2, -halfH + 2, W - 4, 4);
      ctx.restore();

      // ---- СЕГМЕНТЫ ----
      const bb = computeGroupBBox();
      const groupOffsetX = -bb.center - CENTER_PAD;

      ctx.save();
      ctx.translate(groupOffsetX, 0);

      const L = computeSegmentLayout();

      const onA  = segs.a  > 0.5;
      const onB  = segs.b  > 0.5;
      const onC  = segs.c  > 0.5;
      const onD  = segs.d  > 0.5;
      const onE  = segs.e  > 0.5;
      const onF  = segs.f  > 0.5;
      const onG  = segs.g  > 0.5;
      const onDP = segs.dp > 0.5;

      drawSegmentH(ctx, L.hx0, L.hx1, L.top,          onA);
      drawSegmentH(ctx, L.hx0, L.hx1, L.midY - TH/2,  onG);
      drawSegmentH(ctx, L.hx0, L.hx1, L.bot - TH,     onD);

      drawSegmentV(ctx, L.left,        L.vTopA, L.vBotA, onF);
      drawSegmentV(ctx, L.right - TH,  L.vTopA, L.vBotA, onB);
      drawSegmentV(ctx, L.left,        L.vTopB, L.vBotB, onE);
      drawSegmentV(ctx, L.right - TH,  L.vTopB, L.vBotB, onC);

      const dpCX = L.right + 5 + DP_R + DP_SHIFT;
      const dpCY = L.bot - TH / 2;
      drawDp(ctx, dpCX, dpCY, DP_R, onDP);

      ctx.restore();

      // ---- ВЫВОДЫ ----
      ctx.save();
      ctx.strokeStyle = COL.pinBody;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';

      // Верхние — a, b, c, d
      for (let i = 0; i < TOP_PIN_IDS.length; i++) {
        const x = TOP_PIN_XS[i] + BODY_SHIFT_X;
        ctx.beginPath();
        ctx.moveTo(x, -H / 2);
        ctx.lineTo(x, -H / 2 - PIN_LEN);
        ctx.stroke();
      }

      // Нижние — e, f, g, dp
      for (let i = 0; i < BOTTOM_PIN_IDS.length; i++) {
        const x = BOTTOM_PIN_XS[i] + BODY_SHIFT_X;
        ctx.beginPath();
        ctx.moveTo(x, H / 2);
        ctx.lineTo(x, H / 2 + PIN_LEN);
        ctx.stroke();
      }

      // com — справа
      ctx.beginPath();
      ctx.moveTo(W / 2 + BODY_SHIFT_X, COM_Y);
      ctx.lineTo(COM_X_BASE + BODY_SHIFT_X, COM_Y);
      ctx.stroke();
      ctx.restore();

      // ---- ПОДПИСИ ----
      ctx.save();
      ctx.fillStyle = COL.pinLabel;
      ctx.font = 'bold 8px system-ui, sans-serif';
      ctx.textAlign = 'center';

      // Верхние подписи
      ctx.textBaseline = 'bottom';
      for (let i = 0; i < TOP_PIN_IDS.length; i++) {
        const x = TOP_PIN_XS[i] + BODY_SHIFT_X;
        ctx.fillText(TOP_PIN_IDS[i], x, -H / 2 - PIN_LEN - 3);
      }

      // Нижние подписи
      ctx.textBaseline = 'top';
      for (let i = 0; i < BOTTOM_PIN_IDS.length; i++) {
        const x = BOTTOM_PIN_XS[i] + BODY_SHIFT_X;
        ctx.fillText(BOTTOM_PIN_IDS[i], x, H / 2 + PIN_LEN + 3);
      }

      ctx.textBaseline = 'middle';
      ctx.fillText('com', COM_X_BASE + BODY_SHIFT_X + 10, COM_Y);

      // Надпись под компонентом
      ctx.fillStyle = COL.textLabel;
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(this.label || '7SEG', BODY_SHIFT_X, H / 2 + PIN_LEN + 14);
      ctx.restore();
    },

    updateSmoke() {},
    drawSmoke() {}
  };
})();