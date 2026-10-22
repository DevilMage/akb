/* Runtime для Arduino-скетчей на C++ — с НЕБЛОКИРУЮЩИМ delay().

   Алиасы пинов:
     TX  → d1   (пин 1)
     RX  → d0   (пин 0)
     LED_BUILTIN → d13
     A0…A5 — как строковые константы ('A0'…'A5'),
             они корректно распознаются в findArduinoPinId → 'a0'…'a5'.

   Звук:
     tone(pin, freq, duration)  — включить тон на пьезодинамике;
     noTone(pin)                — выключить;
     playMelody(pin, notes, beats, tempo) — проиграть мелодию.

   Регистрируется в window.ArduinoRuntime.
*/
(function () {
  'use strict';

  const runtime = {
    running: false,
    arduinoComp: null,
    startTime: 0,
    log: [],
    maxLogLines: 500,

    onLog: null,
    onStop: null,

    _interpreter: null,
    _rafId: null,
    _lastLoopTime: 0,
    _pauseUntil: 0
  };

  const MIN_LOOP_INTERVAL = 20;

  const POWER_PIN_IDS = ['v5','v33','vin','gnd1','gnd2','gnd3','ioref','aref','reset'];
  const POWER_PIN_VOLTAGES = {
    v5: 5.0, v33: 3.3, vin: 0.0,
    gnd1: 0.0, gnd2: 0.0, gnd3: 0.0,
    ioref: 5.0, aref: 5.0, reset: 5.0
  };

  function isPowerPin(pinId) {
    return POWER_PIN_IDS.includes(pinId);
  }

  // ★ Сообщаем главному модулю: состояние пинов изменилось,
  //   следующий computeLit() должен пересчитать схему, даже если
  //   «ключ схемы» совпадает.
  function invalidateCircuitCache() {
    if (typeof window.__schematicResetCache === 'function') {
      window.__schematicResetCache();
    }
  }

  function runtimeLog(msg, kind) {
    const t = ((performance.now() - runtime.startTime) / 1000).toFixed(2);
    const text = `[${t}s] ${msg}`;
    runtime.log.push({ text, kind: kind || 'info' });
    if (runtime.log.length > runtime.maxLogLines) runtime.log.shift();
    if (typeof runtime.onLog === 'function') runtime.onLog(runtime.log);
  }

  function ensurePinState(pinId) {
    const comp = runtime.arduinoComp;
    if (!comp) return null;
    if (!comp.pinStates) comp.pinStates = {};
    if (!comp.pinStates[pinId]) {
      comp.pinStates[pinId] = { mode: 'INPUT', digital: 0, analog: 0, pwm: 0 };
    }
    return comp.pinStates[pinId];
  }

  function getPinSpec(pinId) {
    const spec = window.SchematicComponents && window.SchematicComponents.arduino;
    if (!spec || !spec.pins) return null;
    return spec.pins.find(p => p.id === pinId) || null;
  }

  function findArduinoPinId(pinName) {
    const spec = window.SchematicComponents && window.SchematicComponents.arduino;
    if (!spec || !spec.pins) return null;
    const name = String(pinName).toUpperCase().trim();

    for (const p of spec.pins) {
      if (p.id.toUpperCase() === name) return p.id;
    }

    if (/^\d+$/.test(name)) {
      const id = 'd' + name;
      if (spec.pins.find(p => p.id === id)) return id;
    }

    if (/^A\d+$/.test(name)) {
      const id = name.toLowerCase();
      if (spec.pins.find(p => p.id === id)) return id;
    }

    const aliases = {
      'TX':   'd1',  'TX1':  'd1',
      'RX':   'd0',  'RX0':  'd0',
      '5V':   'v5',  '3.3V': 'v33',  'VIN': 'vin',
      'GND':  'gnd1',
      'IOREF':'ioref','AREF': 'aref', 'RESET':'reset',
      'LED_BUILTIN': 'd13'
    };
    if (aliases[name]) return aliases[name];

    return null;
  }

  // =========================================================================
  //  ПОИСК ПОДКЛЮЧЁННЫХ КОМПОНЕНТОВ (для динамика)
  // =========================================================================
  function findConnectedToPin(pinId) {
    const result = [];
    const ard = runtime.arduinoComp;
    if (!ard || !window.__schematicComponents) return result;

    for (const w of window.__schematicComponents) {
      if (w.type !== 'wire') continue;
      if (!w.endA || !w.endB) continue;

      let other = null;
      if (w.endA.comp === ard && w.endA.pinId === pinId) other = w.endB.comp;
      else if (w.endB.comp === ard && w.endB.pinId === pinId) other = w.endA.comp;

      if (other && result.indexOf(other) === -1) result.push(other);
    }
    return result;
  }

  function getBuzzersOnPin(pinId) {
    return findConnectedToPin(pinId).filter(c => c.type === 'buzzer');
  }

  // =========================================================================
  //  API
  // =========================================================================
  const api = {
    HIGH: 1, LOW: 0,
    INPUT: 'INPUT', OUTPUT: 'OUTPUT', INPUT_PULLUP: 'INPUT_PULLUP',
    LED_BUILTIN: 13,
    true: true, false: false,

    A0: 'A0', A1: 'A1', A2: 'A2', A3: 'A3', A4: 'A4', A5: 'A5',

    pinMode(pin, mode) {
      const id = findArduinoPinId(pin);
      if (!id) { runtimeLog(`pinMode: неизвестный пин «${pin}»`, 'warn'); return; }
      if (isPowerPin(id)) {
        runtimeLog(`pinMode: пин «${pin}» — питающий, режим менять нельзя`, 'warn');
        return;
      }
      const st = ensurePinState(id);
      const m = String(mode).toUpperCase();
      st.mode = (m === 'OUTPUT') ? 'OUTPUT'
              : (m === 'INPUT_PULLUP') ? 'INPUT_PULLUP'
              : 'INPUT';
      invalidateCircuitCache();
    },

    digitalWrite(pin, value) {
      const id = findArduinoPinId(pin);
      if (!id) { runtimeLog(`digitalWrite: неизвестный пин «${pin}»`, 'warn'); return; }
      if (isPowerPin(id)) {
        runtimeLog(`digitalWrite: пин «${pin}» — питающий, значение изменить нельзя`, 'warn');
        return;
      }
      const st = ensurePinState(id);
      const newDigital = value ? 1 : 0;
      const newPwm = value ? 255 : 0;
      if (st.digital !== newDigital || st.pwm !== newPwm) {
        st.digital = newDigital;
        st.pwm = newPwm;
        invalidateCircuitCache();
      }
    },

    digitalRead(pin) {
      const id = findArduinoPinId(pin);
      if (!id) { runtimeLog(`digitalRead: неизвестный пин «${pin}»`, 'warn'); return 0; }

      if (id === 'gnd1' || id === 'gnd2' || id === 'gnd3' || id === 'vin') return 0;
      if (id === 'v5' || id === 'v33' || id === 'ioref' || id === 'aref' || id === 'reset') return 1;

      if (window.ArduinoBoard && window.ArduinoBoard.hasInput(id)) {
        const v = window.ArduinoBoard.readDigital(id);
        ensurePinState(id).digital = v;
        return v;
      }
      const st = ensurePinState(id);
      return st.digital ? 1 : 0;
    },

    analogRead(pin) {
      const id = findArduinoPinId(pin);
      if (!id) { runtimeLog(`analogRead: неизвестный пин «${pin}»`, 'warn'); return 0; }

      const pinSpec = getPinSpec(id);
      if (pinSpec && pinSpec.type === 'power') {
        const v = POWER_PIN_VOLTAGES[id];
        if (v === undefined) return 0;
        return Math.round((v / 5) * 1023);
      }

      if (window.ArduinoBoard && window.ArduinoBoard.hasInput(id)) {
        const v = window.ArduinoBoard.readAnalog(id);
        ensurePinState(id).analog = v;
        return v;
      }

      const st = ensurePinState(id);
      if (st.analog) return Math.max(0, Math.min(1023, Math.round(st.analog)));
      return st.digital ? 1023 : 0;
    },

    analogWrite(pin, value) {
      const id = findArduinoPinId(pin);
      if (!id) { runtimeLog(`analogWrite: неизвестный пин «${pin}»`, 'warn'); return; }
      if (isPowerPin(id)) {
        runtimeLog(`analogWrite: пин «${pin}» — питающий, ШИМ недоступен`, 'warn');
        return;
      }
      const pinSpec = getPinSpec(id);
      if (pinSpec && !pinSpec.pwm) {
        runtimeLog(`analogWrite: пин «${pin}» не поддерживает ШИМ (нет ~ в названии)`, 'warn');
      }
      const st = ensurePinState(id);
      const v = Math.max(0, Math.min(255, Math.round(value)));
      const newDigital = v > 127 ? 1 : 0;
      if (st.pwm !== v || st.digital !== newDigital) {
        st.pwm = v;
        st.digital = newDigital;
        invalidateCircuitCache();
      }
    },

    delay(ms) {
      // обрабатывается интерпретатором через yield
    },

    millis() {
      return Math.floor(performance.now() - runtime.startTime);
    },

    micros() {
      return Math.floor((performance.now() - runtime.startTime) * 1000);
    },

    // =======================================================================
    //  ЗВУК — tone / noTone / playMelody
    // =======================================================================
    tone(pin, frequency, duration) {
      const id = findArduinoPinId(pin);
      if (!id) { runtimeLog(`tone: неизвестный пин «${pin}»`, 'warn'); return; }
      if (isPowerPin(id)) { runtimeLog(`tone: пин «${pin}» — питающий`, 'warn'); return; }

      const f = Number(frequency) || 0;
      if (f <= 0) { api.noTone(pin); return; }

      const d = (duration === undefined || duration === null)
        ? 0
        : Math.max(0, Number(duration) || 0);

      const buzzers = getBuzzersOnPin(id);
      if (buzzers.length === 0) {
        runtimeLog(`tone: к пину «${pin}» не подключён пьезодинамик`, 'warn');
        return;
      }

      for (const b of buzzers) {
        if (window.BuzzerRuntime) window.BuzzerRuntime.setTone(b, f, d);
        else { b.buzzFreq = f; b.buzzVol = 1; }
      }
      invalidateCircuitCache();
    },

    noTone(pin) {
      const id = findArduinoPinId(pin);
      if (!id) return;
      const buzzers = getBuzzersOnPin(id);
      for (const b of buzzers) {
        if (window.BuzzerRuntime) window.BuzzerRuntime.noTone(b);
        else { b.buzzFreq = 0; b.buzzVol = 0; }
      }
      invalidateCircuitCache();
    },

    /* playMelody(pin, notes[], beats[], tempo)
       - notes — массив частот (0 — пауза);
       - beats — массив длительностей в долях (0.25, 0.5, 1 …);
       - tempo — BPM (по умолчанию 120).

       Функция неблокирующая: планирует все ноты через таймауты,
       а общая длительность возвращается как число (мс), чтобы
       скетч мог сделать delay() на всё время мелодии, если нужно.
    */
    playMelody(pin, notes, beats, tempo) {
      const id = findArduinoPinId(pin);
      if (!id) { runtimeLog(`playMelody: неизвестный пин «${pin}»`, 'warn'); return 0; }

      const bpm = Math.max(30, Number(tempo) || 120);
      const beatMs = 60000 / bpm;

      if (!Array.isArray(notes) || !Array.isArray(beats)) {
        runtimeLog('playMelody: notes и beats должны быть массивами', 'warn');
        return 0;
      }

      const buzzers = getBuzzersOnPin(id);
      if (buzzers.length === 0) {
        runtimeLog(`playMelody: к пину «${pin}» не подключён пьезодинамик`, 'warn');
        return 0;
      }

      const schedule = [];
      let t = 0;
      for (let i = 0; i < notes.length; i++) {
        const f = Number(notes[i]) || 0;
        const b = Number(beats[i]) || 1;
        const dur = Math.max(1, b * beatMs * 0.9);
        schedule.push({ at: t, freq: f, dur });
        t += b * beatMs;
      }

      for (const b of buzzers) {
        for (const ev of schedule) {
          setTimeout(() => {
            if (!runtime.running) return;
            if (ev.freq <= 0) {
              if (window.BuzzerRuntime) window.BuzzerRuntime.noTone(b);
            } else {
              if (window.BuzzerRuntime) window.BuzzerRuntime.setTone(b, ev.freq, ev.dur);
            }
          }, ev.at);
        }
        // финальная пауза — выключить
        setTimeout(() => {
          if (!runtime.running) return;
          if (window.BuzzerRuntime) window.BuzzerRuntime.noTone(b);
        }, t + 50);
      }

      invalidateCircuitCache();
      runtimeLog(`playMelody: ${notes.length} нот, ${Math.round(t)} мс`);
      return Math.round(t);
    },

    Serial: {
      _buf: '',
      begin(baud) { runtimeLog(`Serial.begin(${baud})`, 'info'); },
      print(s) { this._buf += String(s === undefined ? '' : s); },
      println(s) {
        this._buf += String(s === undefined ? '' : s);
        runtimeLog('Serial: ' + this._buf, 'serial');
        this._buf = '';
      },
      write(s) { this._buf += String(s); },
      available() { return 0; },
      read() { return -1; }
    },

    log(msg) { runtimeLog(String(msg), 'info'); }
  };

  // =========================================================================
  //  ЗАПУСК / ОСТАНОВКА
  // =========================================================================
  function start(arduinoComp, src) {
    if (runtime.running) stop();

    runtime.arduinoComp = arduinoComp;
    runtime.log = [];
    runtime.startTime = performance.now();
    runtime.running = true;
    runtime._lastLoopTime = 0;
    runtime._pauseUntil = 0;

    if (arduinoComp) {
      arduinoComp.pinStates = {};
      arduinoComp.powerVoltages = {};
    }

    // ★ гарантируем, что динамики знают о запуске
    if (window.BuzzerRuntime && arduinoComp) {
      const comps = window.__schematicComponents || [];
      for (const c of comps) {
        if (c.type === 'buzzer') {
          c.buzzFreq = 0;
          c.buzzVol = 0;
          window.BuzzerRuntime.attach(c);
        }
      }
    }

    invalidateCircuitCache();

    runtimeLog('▶ Компиляция...');

    if (!window.ArduinoCompiler || !window.ArduinoInterpreter) {
      runtimeLog('❌ Не загружены модули компилятора или интерпретатора', 'error');
      runtime.running = false;
      if (typeof runtime.onStop === 'function') runtime.onStop();
      return;
    }

    const result = window.ArduinoCompiler.parse(src);
    if (!result.ok) {
      const err = result.error;
      runtimeLog(`❌ Ошибка компиляции (строка ${err.line}, столбец ${err.col}): ${err.message}`, 'error');
      runtime.running = false;
      if (typeof runtime.onStop === 'function') runtime.onStop();
      return;
    }

    runtimeLog('✔ Компиляция успешна');

    const interp = window.ArduinoInterpreter.createInterpreter();
    runtime._interpreter = interp;

    const runResult = interp.run(result.ast, api);
    if (!runResult.ok) {
      runtimeLog('❌ Ошибка исполнения: ' + runResult.error, 'error');
      runtime.running = false;
      if (typeof runtime.onStop === 'function') runtime.onStop();
      return;
    }

    runtimeLog('✔ Скетч готов');
    runtimeLog('▶ Скетч запущен');

    scheduleNextLoop();
  }

  function scheduleNextLoop() {
    if (!runtime.running) return;

    runtime._rafId = requestAnimationFrame(() => {
      if (!runtime.running) return;

      const now = performance.now();

      if (runtime._pauseUntil && now < runtime._pauseUntil) {
        scheduleNextLoop();
        return;
      }
      runtime._pauseUntil = 0;

      const hasPending = runtime._interpreter &&
                         typeof runtime._interpreter.hasPending === 'function' &&
                         runtime._interpreter.hasPending();

      if (!hasPending && now - runtime._lastLoopTime < MIN_LOOP_INTERVAL) {
        scheduleNextLoop();
        return;
      }
      runtime._lastLoopTime = now;

      try {
        const result = runtime._interpreter.stepLoop();

        if (result && result.__delay !== undefined) {
          runtime._pauseUntil = performance.now() + result.__delay;
        }
      } catch (e) {
        if (!(e && e.message === '__STOPPED__')) {
          runtimeLog('❌ Ошибка в loop(): ' + (e.message || String(e)), 'error');
        }
      }

      scheduleNextLoop();
    });
  }

  function stop() {
    if (!runtime.running) return;
    runtime.running = false;

    if (runtime._interpreter) {
      try { runtime._interpreter.stop(); } catch (e) {}
      runtime._interpreter = null;
    }
    if (runtime._rafId) {
      cancelAnimationFrame(runtime._rafId);
      runtime._rafId = null;
    }
    runtime._pauseUntil = 0;

    // ★ выключаем все динамики
    if (window.BuzzerRuntime) {
      try { window.BuzzerRuntime.stopAll(); } catch (e) {}
    }

    invalidateCircuitCache();

    runtimeLog('⏹ Скетч остановлен');
    if (typeof runtime.onStop === 'function') runtime.onStop();
  }

  runtime.start = start;
  runtime.stop  = stop;
  runtime.api   = api;
  runtime.isPowerPin = isPowerPin;
  runtime.POWER_PIN_VOLTAGES = POWER_PIN_VOLTAGES;

  window.ArduinoRuntime = runtime;
})();