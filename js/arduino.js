/* Arduino UNO — элемент схемы.
   Рисуется поверх изображения img/Arduino.png (2947×2065).
   Содержит 26 узлов (пинов), координаты которых взяты из Coord.txt.

   Встроенные светодиоды:
     L  (1385; 427) — пин 13
     TX (1389; 641) — индикатор передачи Serial (пин 1)
     RX (1388; 730) — индикатор приёма Serial (пин 0)
     ON (2548; 641) — питание
   Светодиоды рисуются БЕЗ чёрной рамки.

   Пины AREF, Reset, IOREF НЕ получают индикатор (флаг silent).

   Пин TX→1 = d1, RX←0 = d0.

   ★ Индикатор ON горит только когда реально работает скетч
     (window.ArduinoRuntime.running === true). При остановке скетча
     или простом моделировании без скетча — не горит.

   Регистрируется в window.SchematicComponents под ключом 'arduino'.
*/
(function () {
  'use strict';

  window.SchematicComponents = window.SchematicComponents || {};

  const IMG_W = 2947;
  const IMG_H = 2065;
  const SCALE = 0.14 / 1.5;

  const W = IMG_W * SCALE;
  const H = IMG_H * SCALE;
  const X0 = -W / 2;
  const Y0 = -H / 2;

  // ---- Встроенные светодиоды ----
  const ONBOARD_LEDS = [
    { id: 'L',  x: 1385, y: 427,  size: 52, color: '#9acd32', offColor: '#3a3a2c' },
    { id: 'TX', x: 1389, y: 641,  size: 52, color: '#f5d13a', offColor: '#3a3a2c' },
    { id: 'RX', x: 1388, y: 730,  size: 52, color: '#f5d13a', offColor: '#3a3a2c' },
    { id: 'ON', x: 2548, y: 641,  size: 52, color: '#3ddc5b', offColor: '#1e3a1e' }
  ];

  // ---- Пины ----
  // silent: true — без индикатора состояния (AREF, Reset, IOREF)
  // digital/analog/power — тип пина
  // pwm: true — поддерживает ШИМ
  const TOP_PINS = [
    { id: 'aref',  label: 'AREF', x: 1220, y: 78,   type: 'power', silent: true },
    { id: 'gnd1',  label: 'GND',  x: 1321, y: 78,   type: 'power' },
    { id: 'd13',   label: '13',   x: 1421, y: 78,   type: 'digital' },
    { id: 'd12',   label: '12',   x: 1523, y: 78,   type: 'digital' },
    { id: 'd11',   label: '~11',  x: 1621, y: 78,   type: 'digital', pwm: true },
    { id: 'd10',   label: '~10',  x: 1722, y: 78,   type: 'digital', pwm: true },
    { id: 'd9',    label: '~9',   x: 1822, y: 78,   type: 'digital', pwm: true },
    { id: 'd8',    label: '8',    x: 1922, y: 78,   type: 'digital' },
    { id: 'd7',    label: '7',    x: 2073, y: 78,   type: 'digital' },
    { id: 'd6',    label: '~6',   x: 2172, y: 78,   type: 'digital', pwm: true },
    { id: 'd5',    label: '~5',   x: 2272, y: 78,   type: 'digital', pwm: true },
    { id: 'd4',    label: '4',    x: 2373, y: 78,   type: 'digital' },
    { id: 'd3',    label: '~3',   x: 2472, y: 78,   type: 'digital', pwm: true },
    { id: 'd2',    label: '2',    x: 2578, y: 78,   type: 'digital' },
    { id: 'd1',    label: 'TX→1', x: 2677, y: 78,   type: 'digital' },   // ★ TX = пин 1
    { id: 'd0',    label: 'RX←0', x: 2778, y: 78,   type: 'digital' }    // ★ RX = пин 0
  ];

  const BOTTOM_PINS = [
    { id: 'ioref', label: 'IOREF', x: 1469, y: 1954, type: 'power', silent: true },
    { id: 'reset', label: 'Reset', x: 1567, y: 1954, type: 'power', silent: true },
    { id: 'v33',   label: '3.3V',  x: 1667, y: 1954, type: 'power' },
    { id: 'v5',    label: '5V',    x: 1768, y: 1954, type: 'power' },
    { id: 'gnd2',  label: 'GND',   x: 1882, y: 1954, type: 'power' },
    { id: 'gnd3',  label: 'GND',   x: 1981, y: 1954, type: 'power' },
    { id: 'vin',   label: 'Vin',   x: 2083, y: 1954, type: 'power' },
    { id: 'a0',    label: 'A0',    x: 2281, y: 1954, type: 'analog' },
    { id: 'a1',    label: 'A1',    x: 2385, y: 1954, type: 'analog' },
    { id: 'a2',    label: 'A2',    x: 2485, y: 1954, type: 'analog' },
    { id: 'a3',    label: 'A3',    x: 2584, y: 1954, type: 'analog' },
    { id: 'a4',    label: 'A4',    x: 2684, y: 1954, type: 'analog' },
    { id: 'a5',    label: 'A5',    x: 2782, y: 1954, type: 'analog' }
  ];

  function toLocal(px, py) {
    return { x: X0 + px * SCALE, y: Y0 + py * SCALE };
  }

  const PINS = [];
  for (const p of TOP_PINS.concat(BOTTOM_PINS)) {
    const loc = toLocal(p.x, p.y);
    PINS.push({
      id: p.id,
      x: loc.x,
      y: loc.y,
      label: p.label,
      type: p.type || 'digital',
      pwm: !!p.pwm,
      silent: !!p.silent
    });
  }

  const PIN_MAP = {};
  for (const p of PINS) PIN_MAP[p.id] = p;

  const POWER_VOLTAGES = {
    v5:    { voltage: 5.0,  label: '+5 В'   },
    v33:   { voltage: 3.3,  label: '+3.3 В' },
    vin:   { voltage: 0.0,  label: 'Vin (GND в симуляторе)' },
    gnd1:  { voltage: 0.0,  label: 'GND'    },
    gnd2:  { voltage: 0.0,  label: 'GND'    },
    gnd3:  { voltage: 0.0,  label: 'GND'    }
  };

  const img = new Image();
  let imgReady = false;
  let imgError = false;

  img.onload = () => {
    imgReady = true;
    console.log('[Arduino] изображение загружено:', img.naturalWidth + '×' + img.naturalHeight);
    if (typeof render === 'function') render();
  };
  img.onerror = () => {
    imgError = true;
    console.error('[Arduino] НЕ УДАЛОСЬ загрузить: img/Arduino.png');
    if (typeof render === 'function') render();
  };
  img.src = 'img/Arduino.png';

  // ===================== ИНДИКАЦИЯ ПИНОВ =====================

  function getPinVisual(pin, st) {
    if (pin.silent) return { color: null, glow: null, voltage: null, mode: null };

    if (pin.type === 'power') {
      const fixed = POWER_VOLTAGES[pin.id];
      if (fixed) {
        let color, glow;
        if (fixed.voltage > 3.5) {
          color = '#ff3b30'; glow = 'rgba(255, 59, 48, 0.65)';
        } else if (fixed.voltage > 0.5) {
          color = '#ff9500'; glow = 'rgba(255, 149, 0, 0.55)';
        } else {
          color = '#3a3a3c'; glow = null;
        }
        return { color, glow, voltage: fixed.voltage.toFixed(2) + ' В', mode: fixed.label };
      }
      return { color: null, glow: null, voltage: null, mode: 'Питание' };
    }

    if (!st) return { color: null, glow: null, voltage: null, mode: null };

    const mode = st.mode || 'INPUT';

    if (mode === 'OUTPUT') {
      if (st.pwm !== undefined && st.pwm > 0 && st.pwm < 255) {
        const k = st.pwm / 255;
        const realV = (st.voltage !== undefined && isFinite(st.voltage)) ? st.voltage : 5 * k;
        return {
          color: `rgba(255, ${Math.round(120 + 100 * k)}, 30, ${0.5 + 0.5 * k})`,
          glow:  `rgba(255, 160, 30, ${0.15 + 0.55 * k})`,
          voltage: realV.toFixed(2) + ' В (ШИМ)',
          mode: 'OUTPUT (PWM)'
        };
      }
      if (st.digital) {
        const realV = (st.voltage !== undefined && isFinite(st.voltage)) ? st.voltage : 5;
        return { color: '#ff3b30', glow: 'rgba(255, 59, 48, 0.65)',
                 voltage: realV.toFixed(2) + ' В', mode: 'OUTPUT (HIGH)' };
      } else {
        const realV = (st.voltage !== undefined && isFinite(st.voltage)) ? st.voltage : 0;
        return { color: '#3a3a3c', glow: null,
                 voltage: realV.toFixed(2) + ' В', mode: 'OUTPUT (LOW)' };
      }
    }

    if (mode === 'INPUT_PULLUP') {
      const realV = (st.voltage !== undefined && isFinite(st.voltage)) ? st.voltage : (st.digital ? 5 : 0);
      return { color: '#7a5cff', glow: 'rgba(120, 90, 255, 0.35)',
               voltage: realV.toFixed(2) + ' В (pull-up)', mode: 'INPUT_PULLUP' };
    }

    const realV = (st.voltage !== undefined && isFinite(st.voltage)) ? st.voltage : (st.digital ? 5 : 0);
    return { color: '#3a6ea5', glow: 'rgba(80, 130, 220, 0.30)',
             voltage: realV.toFixed(2) + ' В', mode: 'INPUT' };
  }

  function getPin(pinId) { return PIN_MAP[pinId] || null; }

  function drawPinStates(ctx, comp) {
    for (const pinId in POWER_VOLTAGES) {
      const pin = getPin(pinId);
      if (!pin || pin.silent) continue;
      drawOnePin(ctx, pin, getPinVisual(pin, null), comp);
    }
    if (comp.pinStates) {
      for (const pinId in comp.pinStates) {
        if (POWER_VOLTAGES[pinId]) continue;
        const pin = getPin(pinId);
        if (!pin || pin.silent) continue;
        drawOnePin(ctx, pin, getPinVisual(pin, comp.pinStates[pinId]), comp);
      }
    }
  }

  function drawOnePin(ctx, pin, vis, comp) {
    if (!vis || !vis.color) return;
    const x = pin.x, y = pin.y;

    if (vis.glow) {
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = vis.glow;
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(x, y, 3.0, 0, Math.PI * 2);
    ctx.fillStyle = vis.color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }

  // ===================== ВСТРОЕННЫЕ СВЕТОДИОДЫ =====================

  function drawOnboardLeds(ctx, comp) {
    const st = comp.pinStates || {};

    const d13 = st['d13'] || null;
    const lOn = !!(d13 && d13.mode === 'OUTPUT' && d13.digital === 1);

    const now = performance.now();
    const txOn = (comp._txFlashUntil || 0) > now;
    const rxOn = (comp._rxFlashUntil || 0) > now;

    // ★ ON горит только когда реально работает скетч.
    //   При простом моделировании без скетча — не горит.
    const runtimeRunning = !!(window.ArduinoRuntime && window.ArduinoRuntime.running);
    const onOn = runtimeRunning;

    for (const led of ONBOARD_LEDS) {
      let isOn = false;
      if (led.id === 'L')  isOn = lOn;
      if (led.id === 'TX') isOn = txOn;
      if (led.id === 'RX') isOn = rxOn;
      if (led.id === 'ON') isOn = onOn;

      const loc = toLocal(led.x, led.y);
      const size = led.size * SCALE;

      if (isOn) {
        const g = ctx.createRadialGradient(loc.x, loc.y, 0, loc.x, loc.y, size * 1.4);
        g.addColorStop(0, hexToRgba(led.color, 0.6));
        g.addColorStop(1, hexToRgba(led.color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(loc.x, loc.y, size * 1.4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = isOn ? led.color : led.offColor;
      ctx.beginPath();
      ctx.rect(loc.x - size / 2, loc.y - size / 2, size, size);
      ctx.fill();

      ctx.fillStyle = isOn
        ? 'rgba(255,255,255,0.75)'
        : 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.rect(
        loc.x - size / 2 + size * 0.15,
        loc.y - size / 2 + size * 0.15,
        size * 0.28,
        size * 0.28
      );
      ctx.fill();
    }
  }

  function hexToRgba(hex, alpha) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // ===================== КОМПОНЕНТ =====================

  window.SchematicComponents.arduino = {
    w: W,
    h: H,

    hitPadX: 0,
    hitPadY: 0,

    defaults: {
      type: 'arduino',
      label: 'Arduino UNO',
      pinStates: {},
      powerVoltages: {},
      _txFlashUntil: 0,
      _rxFlashUntil: 0
    },

    pins: PINS,

    draw(ctx) {
      if (imgReady) {
        ctx.save();
        ctx.drawImage(img, X0, Y0, W, H);
        ctx.restore();
      } else {
        ctx.save();
        if (imgError) {
          ctx.fillStyle = 'rgba(200, 40, 40, 0.85)';
          ctx.strokeStyle = '#7a1010';
        } else {
          ctx.fillStyle = 'rgba(150, 150, 150, 0.6)';
          ctx.strokeStyle = '#444';
        }
        ctx.lineWidth = 2;
        ctx.fillRect(X0, Y0, W, H);
        ctx.strokeRect(X0, Y0, W, H);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(imgError ? '❌ img/Arduino.png не найден' : '⏳ Загрузка…', 0, 0);
        ctx.restore();
      }

      drawOnboardLeds(ctx, this);
      drawPinStates(ctx, this);
    },

    getPin,
    getPinVisual,
    drawPinTooltip: drawPinTooltipFn,
    POWER_VOLTAGES
  };

  function drawPinTooltipFn(ctx, comp, pinId) {
    const pin = getPin(pinId);
    if (!pin) return;

    const st = (comp.pinStates && comp.pinStates[pinId]) || null;
    const vis = getPinVisual(pin, st);

    let realVoltageText = vis.voltage;
    if (pin.type === 'power' && comp.powerVoltages && comp.powerVoltages[pinId] !== undefined) {
      const rv = comp.powerVoltages[pinId];
      if (isFinite(rv)) realVoltageText = rv.toFixed(2) + ' В (под нагрузкой)';
    }

    const lines = [];
    lines.push(`Пин ${pin.label}`);
    if (pin.type === 'digital') lines.push(`Тип: цифровой${pin.pwm ? ' (PWM)' : ''}`);
    else if (pin.type === 'analog') lines.push(`Тип: аналоговый (A)`);
    else if (pin.type === 'power') lines.push(`Тип: питание`);

    if (vis.mode)         lines.push(`Режим: ${vis.mode}`);
    if (realVoltageText)  lines.push(`Напряжение: ${realVoltageText}`);

    const pad = 6;
    const lineH = 14;
    const font = '11px Consolas, monospace';
    ctx.save();
    ctx.font = font;

    let maxW = 0;
    for (const line of lines) {
      const w = ctx.measureText(line).width;
      if (w > maxW) maxW = w;
    }
    const boxW = maxW + pad * 2;
    const boxH = lines.length * lineH + pad * 2;

    let bx = pin.x + 10;
    let by = pin.y - boxH - 6;
    if (bx + boxW > W / 2) bx = pin.x - boxW - 10;
    if (by < -H / 2) by = pin.y + 10;

    ctx.fillStyle = 'rgba(20, 22, 28, 0.95)';
    ctx.strokeStyle = '#0e639c';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const r = 4;
    ctx.moveTo(bx + r, by);
    ctx.arcTo(bx + boxW, by,       bx + boxW, by + boxH, r);
    ctx.arcTo(bx + boxW, by + boxH, bx,       by + boxH, r);
    ctx.arcTo(bx,        by + boxH, bx,       by,       r);
    ctx.arcTo(bx,        by,        bx + boxW, by,       r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillStyle = i === 0 ? '#7dffb8' : '#d4d4d4';
      ctx.fillText(lines[i], bx + pad, by + pad + i * lineH);
    }
    ctx.restore();
  }
})();