/* Потенциометр (переменный резистор) — элемент схемы.
   Круглый корпус с вращающимся штоком-указателем.

   Три вывода:
     - a — левый край (сопротивление от движка при wiper=0 → 0)
     - w — движок (ползунок)
     - b — правый край (сопротивление от движка при wiper=1 → 0)

   Характеристики:
     - resistance — полное сопротивление, Ом (по умолчанию 10 000);
     - wiper      — положение движка, 0..1 (0 — движок у A, 1 — у B);
     - power      — номинальная мощность, Вт (по умолчанию 0.25);
     - burned     — перегорел ли.

   Сопротивления:
     R(a→w) = resistance · wiper
     R(w→b) = resistance · (1 − wiper)

   Регистрируется в window.SchematicComponents под ключом 'potentiometer'.
*/
(function () {
  'use strict';

  window.SchematicComponents = window.SchematicComponents || {};

  const COL = {
    body:        '#2b2b2e',
    bodyEdge:    '#0f0f10',
    bodyHi:      'rgba(255,255,255,0.10)',
    ring:        '#4a4a4c',
    ringEdge:    '#2a2a2c',
    wiper:       '#c9a04a',
    wiperEdge:   '#7a5a20',
    wiperHi:     'rgba(255,255,255,0.45)',
    shaft:       '#8a8a8a',
    shaftEdge:   '#3a3a3a',
    shaftHi:     '#dcdcdc',
    pin:         '#a8a8a8',
    pinEdge:     '#2a2a2a',
    pinLabel:    '#bdc3c7',
    mark:        '#f1c40f',
    burned:      '#4a4038',
    burnedEdge:  '#2a2420',
    label:       '#7f8c8d',
    value:       '#bdc3c7'
  };

  const W = 72;
  const H = 72;

  const R_BODY = 28;      // радиус корпуса
  const R_RING = 22;      // радиус дорожки
  const R_SHAFT = 12;     // радиус штока
  const PIN_LEN = 12;     // длина выводов

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

  function formatOhms(R) {
    if (R >= 1e6) return (R / 1e6).toFixed(2) + ' МОм';
    if (R >= 1e3) return (R / 1e3).toFixed(2) + ' кОм';
    return R.toFixed(0) + ' Ом';
  }

  window.SchematicComponents.potentiometer = {
    w: W,
    h: H,

    hitPadX: 6,
    hitPadY: 6,

    defaults: {
      type: 'potentiometer',
      label: 'Потенциометр',
      resistance: 10000,
      power: 0.25,
      wiper: 0.5,
      burned: false
    },

    pins: [
      { id: 'a', x: -W / 2 - PIN_LEN, y: 0, label: 'a' },
      { id: 'w', x: 0,                 y: -H / 2 - PIN_LEN, label: 'w' },
      { id: 'b', x:  W / 2 + PIN_LEN, y: 0, label: 'b' }
    ],

    draw(ctx) {
      const burned = !!this.burned;
      const wiper = Math.max(0, Math.min(1, this.wiper !== undefined ? this.wiper : 0.5));

      // ---- Выводы (ножки) ----
      const pinColor = burned ? '#3a3a3a' : COL.pin;
      const pinEdge = burned ? '#1a1a1a' : COL.pinEdge;

      ctx.strokeStyle = pinColor;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';

      // левая ножка
      ctx.beginPath();
      ctx.moveTo(-W / 2 - PIN_LEN, 0);
      ctx.lineTo(-R_BODY, 0);
      ctx.stroke();

      // правая ножка
      ctx.beginPath();
      ctx.moveTo(W / 2 + PIN_LEN, 0);
      ctx.lineTo(R_BODY, 0);
      ctx.stroke();

      // верхняя ножка (движок)
      ctx.beginPath();
      ctx.moveTo(0, -H / 2 - PIN_LEN);
      ctx.lineTo(0, -R_BODY);
      ctx.stroke();

      // подписи выводов
      ctx.fillStyle = burned ? '#8a8a8a' : COL.pinLabel;
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('a', -W / 2 - PIN_LEN + 2, -10);
      ctx.fillText('b',  W / 2 + PIN_LEN - 2, -10);
      ctx.fillText('w',  8, -H / 2 - PIN_LEN + 4);

      // ---- Корпус ----
      ctx.beginPath();
      ctx.arc(0, 0, R_BODY, 0, Math.PI * 2);
      ctx.fillStyle = burned ? COL.burned : COL.body;
      ctx.fill();
      ctx.strokeStyle = burned ? COL.burnedEdge : COL.bodyEdge;
      ctx.lineWidth = 2;
      ctx.stroke();

      // блик корпуса
      if (!burned) {
        const grad = ctx.createRadialGradient(-8, -8, 2, 0, 0, R_BODY);
        grad.addColorStop(0, 'rgba(255,255,255,0.18)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, R_BODY - 1, 0, Math.PI * 2);
        ctx.fill();
      }

      // ---- Круговая дорожка ----
      ctx.beginPath();
      ctx.arc(0, 0, R_RING, 0, Math.PI * 2);
      ctx.strokeStyle = burned ? '#3a3a3a' : COL.ring;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.strokeStyle = burned ? '#1a1a1a' : COL.ringEdge;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Метки-риски по кругу (0% слева, 100% справа)
      const marks = 11;
      for (let i = 0; i < marks; i++) {
        const t = i / (marks - 1);
        // Угол: 180° (слева) → 0° (справа) через верх
        const ang = Math.PI * (1 - t);
        const cxm = Math.cos(ang) * R_RING;
        const cym = -Math.sin(ang) * R_RING;
        const cxo = Math.cos(ang) * (R_RING + 4);
        const cyo = -Math.sin(ang) * (R_RING + 4);
        ctx.beginPath();
        ctx.moveTo(cxm, cym);
        ctx.lineTo(cxo, cyo);
        ctx.strokeStyle = burned ? '#3a3a3a' : '#8a8a8a';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // ---- Шток-указатель ----
      // Угол: wiper=0 → 180° (влево), wiper=1 → 0° (вправо), через верх
      const ang = Math.PI * (1 - wiper);
      const ux = Math.cos(ang) * (R_RING - 2);
      const uy = -Math.sin(ang) * (R_RING - 2);

      // шток-стержень от центра к краю дорожки
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(ux, uy);
      ctx.strokeStyle = burned ? '#3a3a3a' : COL.shaftEdge;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(ux, uy);
      ctx.strokeStyle = burned ? '#5a5a5a' : COL.shaft;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(ux, uy);
      ctx.strokeStyle = burned ? '#7a7a7a' : COL.shaftHi;
      ctx.lineWidth = 1;
      ctx.stroke();

      // метка на конце штока
      ctx.beginPath();
      ctx.arc(ux, uy, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = burned ? '#5a5a5a' : COL.mark;
      ctx.fill();
      ctx.strokeStyle = burned ? '#2a2a2a' : '#a07a10';
      ctx.lineWidth = 1;
      ctx.stroke();

      // ---- Шток (центральная втулка) ----
      ctx.beginPath();
      ctx.arc(0, 0, R_SHAFT, 0, Math.PI * 2);
      ctx.fillStyle = burned ? '#3a3a3a' : COL.shaft;
      ctx.fill();
      ctx.strokeStyle = burned ? '#1a1a1a' : COL.shaftEdge;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // внутренний кружок
      ctx.beginPath();
      ctx.arc(0, 0, R_SHAFT - 4, 0, Math.PI * 2);
      ctx.fillStyle = burned ? '#2a2a2a' : '#6a6a6a';
      ctx.fill();
      ctx.strokeStyle = burned ? '#1a1a1a' : '#3a3a3a';
      ctx.lineWidth = 1;
      ctx.stroke();

      // блик на штоке
      if (!burned) {
        ctx.beginPath();
        ctx.arc(-3, -3, 3, 0, Math.PI * 2);
        ctx.fillStyle = COL.shaftHi;
        ctx.fill();
      }

      // ---- Подпись номинала ----
      const R = this.resistance || 10000;
      ctx.fillStyle = burned ? '#c0392b' : COL.label;
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(
        burned ? '💥 ' + formatOhms(R) : formatOhms(R),
        0, R_BODY + 2
      );

      // ---- Индикатор процента ----
      const pct = Math.round(wiper * 100);
      ctx.fillStyle = burned ? '#8a8a8a' : COL.value;
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText(pct + '%', 0, R_BODY + 14);
    },

    // Проверка попадания по штоку (для вращения)
    hitShaft(lx, ly) {
      return Math.hypot(lx, ly) <= R_BODY;
    }
  };
})();