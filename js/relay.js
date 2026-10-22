/* Реле — электромагнитный переключатель.
   Пять выводов:
     coilA, coilB — обмотка (управление). Ток через обмотку > I_pull → якорь
                    перекидывается.
     com          — общий контакт переключаемой цепи;
     no           — нормально разомкнутый (Normaly Open);
     nc           — нормально замкнутый (Normaly Closed).

   Физика (учитывается решателем):
     Rcoil   — активное сопротивление обмотки, Ом (по умолчанию 400 → ~12.5 мА при 5 В);
     I_pull  — ток срабатывания, А (по умолчанию 0.015);
     I_drop  — ток отпускания (гистерезис), А (по умолчанию 0.008);
     Ron     — сопротивление замкнутого контакта, Ом (0.05);
     Roff    — сопротивление разомкнутого контакта, Ом (1e9).

   Состояния:
     _Icoil   — текущий ток обмотки (вычисляет решатель);
     _energized — true, если реле сработало (защёлкнулось);
     _contacts  — 'nc' (нормально замкнут) или 'no' (переключился);
     burned   — обмотка перегорела (Icoil > Imax).

   Переключение в симуляции: ПКМ по реле в режиме моделирования —
   ручной форсаж (toggle). В обычном режиме ПКМ вращает компонент,
   как у остальных.

   Регистрируется в window.SchematicComponents под ключом 'relay'.
*/
(function () {
  'use strict';

  window.SchematicComponents = window.SchematicComponents || {};

  const COL = {
    body:        '#2b2b2e',
    bodyEdge:    '#0f0f10',
    bodyHi:      'rgba(255,255,255,0.10)',
    coil:        '#b87333',
    coilEdge:    '#6a3d10',
    coilHi:      'rgba(255,255,255,0.25)',
    arm:         '#c8c8c8',
    armEdge:     '#3a3a3a',
    contact:     '#c9a04a',
    contactEdge: '#7a5a20',
    pin:         '#a8a8a8',
    pinEdge:     '#2a2a2a',
    label:       '#7f8c8d',
    on:          '#27ae60',
    off:         '#7f8c8d',
    burned:      '#4a4038',
    burnedEdge:  '#2a2420'
  };

  const W = 80;
  const H = 56;
  const X0 = -W / 2;
  const Y0 = -H / 2;

  // Геометрия обмотки (слева)
  const COIL_W = 26;
  const COIL_H = 30;
  const COIL_X = X0 + 8;
  const COIL_Y = -COIL_H / 2;

  // Геометрия контактов (справа)
  const COM_X = 14;
  const NO_X  = 30;
  const NC_X  = 30;
  const COM_Y = 0;
  const NO_Y  = -14;
  const NC_Y  =  14;

  // Выводы обмотки: слева сверху и слева снизу
  const COIL_PIN_A_Y = COIL_Y + 5;
  const COIL_PIN_B_Y = COIL_Y + COIL_H - 5;
  const COIL_PIN_X   = X0 - 10;

  // Выводы контактов: справа
  const COM_PIN_X = X0 + W + 10;
  const NO_PIN_X  = X0 + W + 10;
  const NC_PIN_X  = X0 + W + 10;

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
    if (R >= 1)   return R.toFixed(0) + ' Ом';
    return (R * 1000).toFixed(0) + ' мОм';
  }

  function formatAmps(I) {
    const a = Math.abs(I);
    if (a >= 1)    return I.toFixed(2) + ' А';
    if (a >= 1e-3) return (I * 1e3).toFixed(2) + ' мА';
    if (a >= 1e-6) return (I * 1e6).toFixed(1) + ' мкА';
    return (I * 1e9).toFixed(0) + ' нА';
  }

  window.SchematicComponents.relay = {
    w: W,
    h: H,

    hitPadX: 4,
    hitPadY: 6,

    defaults: {
      type: 'relay',
      label: 'Реле',
      Rcoil: 400,
      I_pull: 0.015,
      I_drop: 0.008,
      Ron: 0.05,
      Roff: 1e9,
      Imax: 0.08,
      burned: false,
      _Icoil: 0,
      _energized: false,
      _contacts: 'nc',
      _manual: false
    },

    pins: [
      { id: 'coilA', x: COIL_PIN_X, y: COIL_PIN_A_Y, label: 'A1' },
      { id: 'coilB', x: COIL_PIN_X, y: COIL_PIN_B_Y, label: 'A2' },
      { id: 'com',   x: COM_PIN_X,  y: COM_Y,        label: 'COM' },
      { id: 'no',    x: NO_PIN_X,   y: NO_Y,         label: 'NO'  },
      { id: 'nc',    x: NC_PIN_X,   y: NC_Y,         label: 'NC'  }
    ],

    draw(ctx) {
      const burned    = !!this.burned;
      const energized = !!this._energized;
      const contacts  = this._contacts || 'nc';
      const Icoil     = this._Icoil || 0;

      // ---- Выводы ----
      ctx.strokeStyle = burned ? '#3a3a3a' : COL.pin;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';

      // обмотка
      ctx.beginPath();
      ctx.moveTo(COIL_PIN_X, COIL_PIN_A_Y);
      ctx.lineTo(COIL_X,     COIL_PIN_A_Y);
      ctx.moveTo(COIL_PIN_X, COIL_PIN_B_Y);
      ctx.lineTo(COIL_X,     COIL_PIN_B_Y);
      ctx.stroke();

      // контакты
      ctx.beginPath();
      ctx.moveTo(COM_X, COM_Y);
      ctx.lineTo(COM_PIN_X, COM_Y);
      ctx.moveTo(NO_X,  NO_Y);
      ctx.lineTo(NO_PIN_X, NO_Y);
      ctx.moveTo(NC_X,  NC_Y);
      ctx.lineTo(NC_PIN_X, NC_Y);
      ctx.stroke();

      // ---- Корпус ----
      ctx.fillStyle = burned ? COL.burned : COL.body;
      ctx.strokeStyle = burned ? COL.burnedEdge : COL.bodyEdge;
      ctx.lineWidth = 1.5;
      roundRect(ctx, X0, Y0, W, H, 6);
      ctx.fill();
      ctx.stroke();

      if (!burned) {
        ctx.fillStyle = COL.bodyHi;
        ctx.fillRect(X0 + 3, Y0 + 2, W - 6, 2);
      }

      // ---- Обмотка (катушка) ----
      ctx.fillStyle = burned ? '#5a4a3a' : COL.coil;
      ctx.strokeStyle = burned ? '#2a2018' : COL.coilEdge;
      ctx.lineWidth = 1.2;
      roundRect(ctx, COIL_X, COIL_Y, COIL_W, COIL_H, 3);
      ctx.fill();
      ctx.stroke();

      // витки
      ctx.strokeStyle = burned ? '#3a2a1a' : COL.coilHi;
      ctx.lineWidth = 1;
      for (let i = 1; i < 6; i++) {
        const yy = COIL_Y + (COIL_H / 6) * i;
        ctx.beginPath();
        ctx.moveTo(COIL_X + 2, yy);
        ctx.lineTo(COIL_X + COIL_W - 2, yy);
        ctx.stroke();
      }

      // сердечник (штриховка)
      ctx.strokeStyle = burned ? '#4a3a2a' : '#8a5a2a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(COIL_X + COIL_W + 2, COIL_Y + 4);
      ctx.lineTo(COIL_X + COIL_W + 2, COIL_Y + COIL_H - 4);
      ctx.stroke();

      // ---- Контактные площадки ----
      function drawContact(x, y, active) {
        ctx.fillStyle = active ? COL.contact : '#7a7a7a';
        ctx.strokeStyle = COL.contactEdge;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.beginPath();
        ctx.arc(x - 1.2, y - 1.2, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }

      drawContact(COM_X, COM_Y, true);
      drawContact(NO_X,  NO_Y,  contacts === 'no');
      drawContact(NC_X,  NC_Y,  contacts === 'nc');

      // ---- Якорь ----
      const armTipX = contacts === 'no' ? NO_X - 2 : NC_X - 2;
      const armTipY = contacts === 'no' ? NO_Y      : NC_Y;

      ctx.strokeStyle = COL.armEdge;
      ctx.lineWidth = 4.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(COM_X, COM_Y);
      ctx.lineTo(armTipX, armTipY);
      ctx.stroke();

      ctx.strokeStyle = burned ? '#5a5a5a' : COL.arm;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(COM_X, COM_Y);
      ctx.lineTo(armTipX, armTipY);
      ctx.stroke();

      // ---- Индикатор срабатывания ----
      const ledX = X0 + W - 8;
      const ledY = Y0 + 8;
      ctx.beginPath();
      ctx.arc(ledX, ledY, 3, 0, Math.PI * 2);
      ctx.fillStyle = energized ? COL.on : COL.off;
      ctx.fill();
      if (energized) {
        const g = ctx.createRadialGradient(ledX, ledY, 0, ledX, ledY, 8);
        g.addColorStop(0, 'rgba(39, 174, 96, 0.65)');
        g.addColorStop(1, 'rgba(39, 174, 96, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(ledX, ledY, 8, 0, Math.PI * 2);
        ctx.fill();
      }

      // ---- Надписи ----
      ctx.fillStyle = burned ? '#c0392b' : COL.label;
      ctx.font = 'bold 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const label = burned
        ? '💥 ' + formatOhms(this.Rcoil || 400)
        : formatOhms(this.Rcoil || 400);
      ctx.fillText(label, COIL_X + COIL_W / 2, COIL_Y + COIL_H + 3);

      ctx.fillStyle = energized ? COL.on : COL.off;
      ctx.font = 'bold 8px system-ui, sans-serif';
      ctx.textBaseline = 'bottom';
      const stateText = burned ? 'обрыв' : (energized ? 'ON' : 'OFF');
      ctx.fillText(stateText, COIL_X + COIL_W / 2, COIL_Y - 3);

      // ток обмотки (мелко, у правого края корпуса)
      ctx.fillStyle = COL.label;
      ctx.font = '7px Consolas, monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(formatAmps(Icoil), X0 + W - 4, Y0 + H - 3);

      // ---- Подписи выводов ----
      ctx.fillStyle = COL.pin;
      ctx.font = 'bold 7px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('A1', COIL_PIN_X + 2, COIL_PIN_A_Y - 4);
      ctx.fillText('A2', COIL_PIN_X + 2, COIL_PIN_B_Y + 4);
      ctx.textAlign = 'right';
      ctx.fillText('COM', COM_PIN_X + 2, COM_Y);
      ctx.fillText('NO',  NO_PIN_X  + 2, NO_Y);
      ctx.fillText('NC',  NC_PIN_X  + 2, NC_Y);
    }
  };
})();