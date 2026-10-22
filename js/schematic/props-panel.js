/* Панель свойств компонента.
   Все функции принимают ctx первым аргументом — никаких глобалов.

   Публичный API:
     init(ctx)             — повесить глобальные обработчики (закрытие, drag)
     open(ctx, comp)       — открыть для компонента
     close(ctx)            — закрыть
     refresh(ctx)          — перерисовать содержимое
     isOpen(ctx)           — открыта ли
     getCurrent()          — текущий компонент или null

   ctx = {
     panel, header, title, body, close, overlay,
     components,
     pushHistory, render, invalidateCache,
     getRotation,
     formatCurrent, formatResistance, formatPower,
     runtime
   }
*/
(function () {
  'use strict';

  window.SchematicApp = window.SchematicApp || {};

  // Текущий открытый компонент — единственное состояние модуля
  let currentComponent = null;
  let panelDragging = null;

  // =========================================================================
  //  Открытие / закрытие
  // =========================================================================
  function open(ctx, comp) {
    currentComponent = comp;
    ctx.overlay.classList.add('show');
    ctx.panel.classList.add('show');
    refresh(ctx);
  }

  function close(ctx) {
    currentComponent = null;
    ctx.overlay.classList.remove('show');
    ctx.panel.classList.remove('show');
  }

  function isOpen(ctx) {
    return ctx.panel.classList.contains('show');
  }

  function getCurrent() {
    return currentComponent;
  }

  function refresh(ctx) {
    if (!currentComponent) return;
    const comp = currentComponent;
    if (ctx.components.indexOf(comp) === -1) { close(ctx); return; }

    switch (comp.type) {
      case 'battery':       renderBattery(ctx, comp, '🔋 Крона 9V');          break;
      case 'battery15':     renderBattery(ctx, comp, '🔋 Батарейка AA 1.5V'); break;
      case 'lamp':          renderLamp(ctx, comp);            break;
      case 'resistor':      renderResistor(ctx, comp);        break;
      case 'potentiometer': renderPotentiometer(ctx, comp);   break;
      case 'multimeter':    renderMultimeter(ctx, comp);      break;
      case 'switch':        renderSwitch(ctx, comp);          break;
      case 'led':           renderLED(ctx, comp);             break;
      case 'mosfet':        renderMosfet(ctx, comp);          break;
      case 'sevensegment':  renderSevenSegment(ctx, comp);    break;
      case 'relay':         renderRelay(ctx, comp);           break;
      case 'buzzer':        renderBuzzer(ctx, comp);          break;
      case 'arduino':       renderArduino(ctx, comp);         break;
      default:
        ctx.title.textContent = 'Свойства';
        ctx.body.innerHTML = '<div class="props-hint">Нет настраиваемых параметров</div>';
    }
  }

  // =========================================================================
  //  Хелперы
  // =========================================================================
  function appendRotateButtons(ctx, comp) {
    const wrap = document.createElement('div');
    wrap.className = 'props-row';
    wrap.style.flexDirection = 'row';
    wrap.style.gap = '6px';

    const lbl = document.createElement('label');
    lbl.textContent = 'Поворот';
    lbl.style.flex = '1';
    wrap.appendChild(lbl);

    [['↺ 90°', -90], ['↻ 90°', 90], ['180°', 180]].forEach(([txt, deg]) => {
      const b = document.createElement('button');
      b.className = 'props-action-btn';
      b.style.flex = '1';
      b.style.padding = '6px 4px';
      b.style.fontSize = '0.78rem';
      b.style.borderColor = '#4a90e2';
      b.style.color = '#4a90e2';
      b.textContent = txt;
      b.addEventListener('click', () => {
        ctx.pushHistory();
        let next = (ctx.getRotation(comp) + deg) % 360;
        if (next < 0) next += 360;
        comp.rotation = next;
        refresh(ctx);
        ctx.render();
      });
      wrap.appendChild(b);
    });
    ctx.body.appendChild(wrap);
  }

  function appendNumberInput(ctx, comp, prop, labelText, min, max, step, defaultVal, invalidates) {
    const row = document.createElement('div');
    row.className = 'props-row';
    const lbl = document.createElement('label');
    lbl.textContent = labelText;
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.min = String(min);
    inp.max = String(max);
    inp.step = String(step);
    inp.value = comp[prop] !== undefined ? comp[prop] : defaultVal;
    inp.addEventListener('input', () => {
      const val = parseFloat(inp.value);
      if (!isNaN(val) && val >= min && val <= max) {
        comp[prop] = val;
        if (invalidates) ctx.invalidateCache();
        ctx.render();
      }
    });
    inp.addEventListener('change', () => ctx.pushHistory());
    row.appendChild(lbl); row.appendChild(inp);
    ctx.body.appendChild(row);
  }

  // =========================================================================
  //  Рендеры компонентов
  // =========================================================================
  function renderSevenSegment(ctx, comp) {
    ctx.title.textContent = '🔢 7-сегментный дисплей';
    ctx.body.innerHTML = '';

    const typeRow = document.createElement('div');
    typeRow.className = 'props-row';
    const typeLabel = document.createElement('label');
    typeLabel.textContent = 'Тип общего вывода';
    const typeSelect = document.createElement('select');
    typeSelect.innerHTML =
      '<option value="cathode">Общий катод (HIGH — горит)</option>' +
      '<option value="anode">Общий анод (LOW — горит)</option>';
    typeSelect.value = comp.commonType || 'cathode';
    typeSelect.addEventListener('change', () => {
      ctx.pushHistory();
      comp.commonType = typeSelect.value;
      ctx.invalidateCache();
      ctx.render();
    });
    typeRow.appendChild(typeLabel); typeRow.appendChild(typeSelect);
    ctx.body.appendChild(typeRow);

    const hint = document.createElement('div');
    hint.className = 'props-hint';
    hint.textContent =
      'Сегменты загораются при напряжении на пине относительно com. ' +
      'Источником может быть Arduino, батарейка, делитель и т.д. ' +
      'Если com не подключён — дисплей не светится.';
    ctx.body.appendChild(hint);

    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(4, 1fr)';
    grid.style.gap = '4px';
    ['a','b','c','d','e','f','g','dp'].forEach(id => {
      const btn = document.createElement('button');
      btn.className = 'props-action-btn';
      const val = comp.segments && comp.segments[id] > 0.5;
      btn.style.borderColor = val ? '#27ae60' : '#c0392b';
      btn.style.color = val ? '#27ae60' : '#c0392b';
      btn.textContent = id;
      btn.addEventListener('click', () => {
        ctx.pushHistory();
        if (!comp.segments) comp.segments = { a:0,b:0,c:0,d:0,e:0,f:0,g:0,dp:0 };
        comp.segments[id] = comp.segments[id] > 0.5 ? 0 : 1;
        refresh(ctx);
        ctx.render();
      });
      grid.appendChild(btn);
    });
    ctx.body.appendChild(grid);
  }

  function renderMosfet(ctx, comp) {
    ctx.title.textContent = '⚡ IRF540N (N-MOSFET)';
    ctx.body.innerHTML = '';

    if (comp.burned) {
      const warn = document.createElement('div');
      warn.className = 'props-hint';
      warn.style.color = '#e74c3c';
      warn.style.fontStyle = 'normal';
      warn.style.fontWeight = '700';
      warn.textContent = '💥 Транзистор перегорел';
      ctx.body.appendChild(warn);
    }

    appendNumberInput(ctx, comp, 'Vth',  'Vgs(th) — порог открытия (В)', 0, 10, 0.1, 2.0, true);
    appendNumberInput(ctx, comp, 'Vov',  'Vov — Vgs для полного открытия (В)', 0.1, 20, 0.1, 5.0, true);
    appendNumberInput(ctx, comp, 'Ron',  'Ron — сопротивление открытого канала (Ом)', 0.001, 100, 0.001, 0.044, true);
    appendNumberInput(ctx, comp, 'Pmax', 'Макс. мощность (Вт)', 0.1, 1000, 1, 40, false);

    const info = document.createElement('div');
    info.className = 'props-hint';
    info.style.fontStyle = 'normal';
    const Vgs = comp.Vgs || 0;
    const Vds = comp.Vds || 0;
    const Ids = comp.Ids || 0;
    const Rds = comp.Rds !== undefined ? comp.Rds : 1e9;
    info.innerHTML =
      `Vgs = ${Vgs.toFixed(2)} В<br>` +
      `Vds = ${Vds.toFixed(2)} В<br>` +
      `Id  = ${ctx.formatCurrent(Ids)}<br>` +
      `Rds = ${ctx.formatResistance(Rds)}<br>` +
      `P   = ${ctx.formatPower(comp.dissipatedPower || 0)}`;
    ctx.body.appendChild(info);

    appendRotateButtons(ctx, comp);

    if (comp.burned) {
      const replaceBtn = document.createElement('button');
      replaceBtn.className = 'props-action-btn replace';
      replaceBtn.textContent = '🔧 Заменить транзистор';
      replaceBtn.addEventListener('click', () => {
        ctx.pushHistory();
        comp.burned = false;
        comp.dissipatedPower = 0;
        comp._smoke = [];
        comp._smokeSpawnAcc = 0;
        ctx.invalidateCache();
        refresh(ctx);
        ctx.render();
      });
      ctx.body.appendChild(replaceBtn);
    }
  }

  function renderRelay(ctx, comp) {
    ctx.title.textContent = '🔌 Реле';
    ctx.body.innerHTML = '';

    if (comp.burned) {
      const warn = document.createElement('div');
      warn.className = 'props-hint';
      warn.style.color = '#e74c3c';
      warn.style.fontStyle = 'normal';
      warn.style.fontWeight = '700';
      warn.textContent = '💥 Обмотка реле перегорела';
      ctx.body.appendChild(warn);
    }

    appendNumberInput(ctx, comp, 'Rcoil',  'Сопротивление обмотки (Ом)', 1, 1e6, 10, 400, true);
    appendNumberInput(ctx, comp, 'I_pull', 'Ток срабатывания (А)',       0.0001, 5, 0.001, 0.015, false);
    appendNumberInput(ctx, comp, 'I_drop', 'Ток отпускания (А)',         0.0001, 5, 0.001, 0.008, false);
    appendNumberInput(ctx, comp, 'Ron',    'R замкнутого контакта (Ом)', 0.001, 100, 0.001, 0.05, true);
    appendNumberInput(ctx, comp, 'Imax',   'Макс. ток обмотки (А)',      0.001, 5, 0.001, 0.08, false);

    const info = document.createElement('div');
    info.className = 'props-hint';
    info.style.fontStyle = 'normal';
    const I = comp._Icoil || 0;
    info.innerHTML =
      `I обмотки = ${ctx.formatCurrent(I)}<br>` +
      `Состояние: ${comp.burned ? '💥 обрыв' : (comp._energized ? 'ON (NO замкнут)' : 'OFF (NC замкнут)')}<br>` +
      `Ручной форсаж: ${comp._manual ? 'да' : 'нет'}`;
    ctx.body.appendChild(info);

    const btn = document.createElement('button');
    btn.className = 'props-action-btn';
    btn.style.borderColor = comp._manual ? '#e67e22' : '#4a90e2';
    btn.style.color      = comp._manual ? '#e67e22' : '#4a90e2';
    btn.textContent = comp._manual ? '⏹ Снять форсаж' : '⚡ Форсировать ON';
    btn.addEventListener('click', () => {
      ctx.pushHistory();
      const wasOn = !!comp._energized;
      comp._manual = !comp._manual;
      comp._energized = comp._manual;
      comp._contacts = comp._manual ? 'no' : 'nc';
      if (comp._energized !== wasOn && !comp.burned) {
        window.SchematicApp.audio.playRelayClick(comp._energized);
      }
      ctx.invalidateCache();
      refresh(ctx);
      ctx.render();
    });
    ctx.body.appendChild(btn);

    appendRotateButtons(ctx, comp);

    if (comp.burned) {
      const replaceBtn = document.createElement('button');
      replaceBtn.className = 'props-action-btn replace';
      replaceBtn.textContent = '🔧 Заменить реле';
      replaceBtn.addEventListener('click', () => {
        ctx.pushHistory();
        comp.burned = false;
        comp._energized = false;
        comp._contacts = 'nc';
        comp._manual = false;
        comp._Icoil = 0;
        ctx.invalidateCache();
        refresh(ctx);
        ctx.render();
      });
      ctx.body.appendChild(replaceBtn);
    }
  }

  // ★ Новый: свойства пьезодинамика
  function renderBuzzer(ctx, comp) {
    ctx.title.textContent = '🔔 Пьезодинамик';
    ctx.body.innerHTML = '';

    const info = document.createElement('div');
    info.className = 'props-hint';
    info.style.fontStyle = 'normal';
    const f = comp.buzzFreq || 0;
    const isOn = f > 0;
    info.innerHTML =
      `Частота: <b>${isOn ? f.toFixed(0) + ' Гц' : '—'}</b><br>` +
      `Состояние: <b style="color:${isOn ? '#27ae60' : '#7f8c8d'}">${isOn ? '🔊 звук' : '🔇 молчит'}</b><br>` +
      `<span style="opacity:0.7">Управляется через tone() / noTone() / playMelody() в скетче</span>`;
    ctx.body.appendChild(info);

    // Ручной тест — 1000 Гц на 500 мс
    const testBtn = document.createElement('button');
    testBtn.className = 'props-action-btn';
    testBtn.style.borderColor = '#4a90e2';
    testBtn.style.color = '#4a90e2';
    testBtn.textContent = '🔊 Тест 1000 Гц (0.5 с)';
    testBtn.addEventListener('click', () => {
      if (window.BuzzerRuntime) window.BuzzerRuntime.setTone(comp, 1000, 500);
      refresh(ctx);
      ctx.render();
    });
    ctx.body.appendChild(testBtn);

    const stopBtn = document.createElement('button');
    stopBtn.className = 'props-action-btn';
    stopBtn.style.borderColor = '#c0392b';
    stopBtn.style.color = '#c0392b';
    stopBtn.textContent = '⏹ Стоп';
    stopBtn.addEventListener('click', () => {
      if (window.BuzzerRuntime) window.BuzzerRuntime.noTone(comp);
      refresh(ctx);
      ctx.render();
    });
    ctx.body.appendChild(stopBtn);

    appendRotateButtons(ctx, comp);
  }

  function renderBattery(ctx, comp, title) {
    ctx.title.textContent = title;
    ctx.body.innerHTML = '';
    const isAA = comp.type === 'battery15';

    const vRow = document.createElement('div');
    vRow.className = 'props-row';
    const vLabel = document.createElement('label');
    vLabel.textContent = 'Напряжение (В)';
    const vInput = document.createElement('input');
    vInput.type = 'number';
    vInput.min = '0.1'; vInput.max = '220'; vInput.step = '0.1';
    vInput.value = comp.voltage || (isAA ? 1.5 : 9);
    vInput.addEventListener('input', () => {
      const val = parseFloat(vInput.value);
      if (!isNaN(val) && val > 0) { comp.voltage = val; ctx.invalidateCache(); ctx.render(); }
    });
    vInput.addEventListener('change', () => ctx.pushHistory());
    vRow.appendChild(vLabel); vRow.appendChild(vInput);
    ctx.body.appendChild(vRow);

    const cRow = document.createElement('div');
    cRow.className = 'props-row';
    const cLabel = document.createElement('label');
    cLabel.textContent = 'Ёмкость (мА·ч)';
    const cInput = document.createElement('input');
    cInput.type = 'number';
    cInput.min = '1'; cInput.max = '100000'; cInput.step = '10';
    cInput.value = comp.capacity || (isAA ? 2500 : 500);
    cInput.addEventListener('input', () => {
      const val = parseFloat(cInput.value);
      if (!isNaN(val) && val > 0) {
        comp.capacity = val;
        if (comp.charge === undefined || comp.charge > val) comp.charge = val;
        ctx.invalidateCache();
        refresh(ctx);
        ctx.render();
      }
    });
    cInput.addEventListener('change', () => ctx.pushHistory());
    cRow.appendChild(cLabel); cRow.appendChild(cInput);
    ctx.body.appendChild(cRow);

    const capacity = comp.capacity || (isAA ? 2500 : 500);
    const charge = comp.charge !== undefined ? comp.charge : capacity;
    const pct = Math.max(0, Math.min(100, (charge / capacity) * 100));

    const levelWrap = document.createElement('div');
    levelWrap.className = 'props-row';
    const levelLabel = document.createElement('label');
    levelLabel.textContent = 'Заряд';
    levelWrap.appendChild(levelLabel);
    const levelBar = document.createElement('div');
    levelBar.className = 'battery-level';
    const levelFill = document.createElement('div');
    levelFill.className = 'battery-level-fill';
    levelFill.style.width = pct + '%';
    levelBar.appendChild(levelFill);
    levelWrap.appendChild(levelBar);
    const levelStatus = document.createElement('div');
    levelStatus.className = 'battery-status';
    levelStatus.textContent = `${charge.toFixed(1)} / ${capacity} мА·ч (${pct.toFixed(1)}%)`;
    levelWrap.appendChild(levelStatus);
    ctx.body.appendChild(levelWrap);

    const chargeBtn = document.createElement('button');
    chargeBtn.className = 'props-action-btn charge';
    chargeBtn.textContent = '⚡ Зарядить';
    chargeBtn.addEventListener('click', () => {
      ctx.pushHistory();
      comp.charge = comp.capacity || (isAA ? 2500 : 500);
      ctx.invalidateCache();
      refresh(ctx);
      ctx.render();
    });
    ctx.body.appendChild(chargeBtn);

    appendRotateButtons(ctx, comp);
  }

  function renderLamp(ctx, comp) {
    ctx.title.textContent = '💡 Лампа накаливания';
    ctx.body.innerHTML = '';

    if (comp.burned) {
      const warn = document.createElement('div');
      warn.className = 'props-hint';
      warn.style.color = '#e74c3c';
      warn.style.fontStyle = 'normal';
      warn.style.fontWeight = '700';
      warn.textContent = '💥 Лампа перегорела';
      ctx.body.appendChild(warn);
    }

    appendNumberInput(ctx, comp, 'ratedVoltage', 'Номинальное напряжение (В)', 0.5, 220, 0.5, 9, false);

    const hint = document.createElement('div');
    hint.className = 'props-hint';
    hint.textContent = 'Перегорает при напряжении ≥ 2× номинала';
    ctx.body.appendChild(hint);

    if (comp.burned) {
      const replaceBtn = document.createElement('button');
      replaceBtn.className = 'props-action-btn replace';
      replaceBtn.textContent = '🔧 Заменить лампу';
      replaceBtn.addEventListener('click', () => {
        ctx.pushHistory();
        comp.burned = false; comp.lit = false; comp.brightness = 0;
        ctx.invalidateCache();
        refresh(ctx); ctx.render();
      });
      ctx.body.appendChild(replaceBtn);
    }
  }

  function renderResistor(ctx, comp) {
    ctx.title.textContent = '🟫 Резистор';
    ctx.body.innerHTML = '';

    if (comp.burned) {
      const warn = document.createElement('div');
      warn.className = 'props-hint';
      warn.style.color = '#e74c3c';
      warn.style.fontStyle = 'normal';
      warn.style.fontWeight = '700';
      warn.textContent = '💥 Резистор перегорел';
      ctx.body.appendChild(warn);
    }

    appendNumberInput(ctx, comp, 'resistance', 'Сопротивление (Ом)', 1, 1e7, 1, 220, true);
    appendNumberInput(ctx, comp, 'power', 'Номинальная мощность (Вт)', 0.001, 1000, 0.25, 0.25, false);

    if (comp.burned) {
      const replaceBtn = document.createElement('button');
      replaceBtn.className = 'props-action-btn replace';
      replaceBtn.textContent = '🔧 Заменить резистор';
      replaceBtn.addEventListener('click', () => {
        ctx.pushHistory();
        comp.burned = false; comp.dissipatedPower = 0;
        comp._smoke = []; comp._smokeSpawnAcc = 0;
        ctx.invalidateCache();
        refresh(ctx); ctx.render();
      });
      ctx.body.appendChild(replaceBtn);
    }
  }

  function renderPotentiometer(ctx, comp) {
    ctx.title.textContent = '🎛 Потенциометр';
    ctx.body.innerHTML = '';

    appendNumberInput(ctx, comp, 'resistance', 'Полное сопротивление (Ом)', 1, 1e7, 100, 10000, true);
    appendNumberInput(ctx, comp, 'wiper', 'Положение движка (0…1)', 0, 1, 0.01,
      comp.wiper !== undefined ? comp.wiper : 0.5, true);
  }

  function renderMultimeter(ctx) {
    ctx.title.textContent = '🔬 Мультиметр';
    ctx.body.innerHTML = '<div class="props-hint">Режим переключается кликом по кнопкам V / A / Ω на корпусе.</div>';
  }

  function renderSwitch(ctx, comp) {
    ctx.title.textContent = '🔘 Ключ';
    ctx.body.innerHTML = '';
    const btn = document.createElement('button');
    btn.className = 'props-action-btn';
    btn.style.borderColor = comp.closed ? '#c0392b' : '#27ae60';
    btn.style.color = comp.closed ? '#c0392b' : '#27ae60';
    btn.textContent = comp.closed ? '⏹ Разомкнуть' : '▶ Замкнуть';
    btn.addEventListener('click', () => {
      ctx.pushHistory();
      comp.closed = !comp.closed;
      ctx.invalidateCache();
      refresh(ctx); ctx.render();
    });
    ctx.body.appendChild(btn);
  }

  function renderLED(ctx) {
    ctx.title.textContent = '💡 Светодиод';
    ctx.body.innerHTML = '<div class="props-hint">Горит при прямом включении.</div>';
  }

  function renderArduino(ctx) {
    ctx.title.textContent = '🧩 Arduino UNO';
    ctx.body.innerHTML = '<div class="props-hint">Программируйте через <b>📝 Скетч</b>.</div>';
  }

  // =========================================================================
  //  Перетаскивание панели
  // =========================================================================
  let dragCtx = null;

  function onDragMove(e) {
    if (!panelDragging || !dragCtx) return;
    let newLeft = e.clientX - panelDragging.wrapLeft - panelDragging.offsetX;
    let newTop  = e.clientY - panelDragging.wrapTop  - panelDragging.offsetY;
    newLeft = Math.max(0, Math.min(panelDragging.wrapWidth - panelDragging.panelWidth, newLeft));
    newTop  = Math.max(0, Math.min(panelDragging.wrapHeight - panelDragging.panelHeight, newTop));
    dragCtx.panel.style.right = 'auto';
    dragCtx.panel.style.left = newLeft + 'px';
    dragCtx.panel.style.top = newTop + 'px';
  }

  function onDragEnd() {
    panelDragging = null;
    dragCtx = null;
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
  }

  function init(ctx) {
    ctx.close.addEventListener('click', () => close(ctx));
    ctx.overlay.addEventListener('click', () => close(ctx));

    ctx.header.addEventListener('mousedown', (e) => {
      if (e.target === ctx.close || ctx.close.contains(e.target)) return;
      e.preventDefault();
      const rect = ctx.panel.getBoundingClientRect();
      const wrapRect = ctx.panel.parentElement.getBoundingClientRect();
      panelDragging = {
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        wrapLeft: wrapRect.left,
        wrapTop: wrapRect.top,
        wrapWidth: wrapRect.width,
        wrapHeight: wrapRect.height,
        panelWidth: rect.width,
        panelHeight: rect.height,
      };
      dragCtx = ctx;
      document.addEventListener('mousemove', onDragMove);
      document.addEventListener('mouseup', onDragEnd);
    });
  }

  // =========================================================================
  //  API
  // =========================================================================
  window.SchematicApp.propsPanel = {
    init,
    open,
    close,
    refresh,
    isOpen,
    getCurrent
  };
})();