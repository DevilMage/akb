/* Физика компонентов: свечение лампы/LED, обновление 7-сегментного
   дисплея, детекторы перегорания, мультиметр, обновление pinStates Arduino,
   реле (с звуком щелчка якоря), пьезодинамик.

   Публичный API:
     computeLit(ctx) — обновить физику всех компонентов схемы
     clearAllSevenSegments(ctx) — погасить все 7-сегментные дисплеи

   ctx = {
     components,
     getSpec,
     Geo,
     Const,
     simulateMode,
     getCircuitKey,
     lastCircuitKey,
     ArduinoPinVoltages,
     onRenderPropsRefresh
   }

   Регистрируется в window.SchematicApp.physics.
*/
(function () {
  'use strict';

  window.SchematicApp = window.SchematicApp || {};

  const Solver    = window.SchematicApp.solver;
  const Netlist   = window.SchematicApp.netlist;
  const Fmt       = window.SchematicApp.format;
  const Snd       = window.SchematicApp.audio;

  function isResistorLike(c) {
    return c.type === 'resistor' || c.type === 'potentiometer';
  }

  // ---------------------------------------------------------------------------
  //  7-сегментный дисплей
  // ---------------------------------------------------------------------------
  function updateSevenSegmentsFromSolution(ctx, sol, getNodeId) {
    const { components, getSpec, Geo, Const } = ctx;

    let hasSevenSeg = false;
    for (const c of components) {
      if (c.type === 'sevensegment') { hasSevenSeg = true; break; }
    }
    if (!hasSevenSeg) return;

    const segIds = ['a','b','c','d','e','f','g','dp'];
    const VTH   = Const.SEG_VTH;
    const VFULL = Const.SEG_VFULL;

    for (const seg of components) {
      if (seg.type !== 'sevensegment') continue;

      if (!seg.segments) seg.segments = { a:0, b:0, c:0, d:0, e:0, f:0, g:0, dp:0 };
      for (const id of segIds) seg.segments[id] = 0;

      const nCom = getNodeId(seg, 'com');
      if (nCom === undefined || sol[nCom] === undefined) continue;

      if (!Netlist.isPinConnected(components, seg, 'com', Geo, getSpec)) continue;

      const vCom = sol[nCom];

      for (const id of segIds) {
        const nSeg = getNodeId(seg, id);
        if (nSeg === undefined || sol[nSeg] === undefined) continue;
        if (!Netlist.isPinConnected(components, seg, id, Geo, getSpec)) continue;

        const vSeg = sol[nSeg];

        let vDiff;
        if (seg.commonType === 'anode') {
          vDiff = vCom - vSeg;
        } else {
          vDiff = vSeg - vCom;
        }

        if (vDiff <= VTH) continue;

        let k = (vDiff - VTH) / (VFULL - VTH);
        if (k < 0) k = 0;
        if (k > 1) k = 1;
        seg.segments[id] = k;
      }
    }
  }

  function clearAllSevenSegments(ctx) {
    const { components } = ctx;
    for (const c of components) {
      if (c.type !== 'sevensegment') continue;
      if (!c.segments) c.segments = { a:0, b:0, c:0, d:0, e:0, f:0, g:0, dp:0 };
      for (const id of ['a','b','c','d','e','f','g','dp']) {
        c.segments[id] = 0;
      }
    }
  }

  // ---------------------------------------------------------------------------
  //  Пьезодинамик — синхронизация отображаемой частоты
  // ---------------------------------------------------------------------------
  function syncBuzzers(ctx) {
    const { components } = ctx;
    for (const bz of components) {
      if (bz.type !== 'buzzer') continue;
      bz._freq = bz.buzzFreq || 0;
      bz._vol  = bz.buzzVol  || 0;

      // Автостоп по истечении duration (если BuzzerRuntime не остановил)
      if (bz.buzzFreq && bz.buzzUntil && performance.now() >= bz.buzzUntil) {
        bz.buzzFreq = 0;
        bz.buzzVol = 0;
        bz._freq = 0;
        if (window.BuzzerRuntime) window.BuzzerRuntime.noTone(bz);
      }
    }
  }

  // ---------------------------------------------------------------------------
  //  Главная функция: обновить физику
  // ---------------------------------------------------------------------------
  function computeLit(ctx) {
    const { components, getSpec, Geo, Const, simulateMode } = ctx;

    // ---- Моделирование выключено: всё гасим ----
    if (!simulateMode) {
      for (const c of components) {
        if (c.type === 'lamp' && !c.burned) { c.lit = false; c.brightness = 0; }
        if (c.type === 'multimeter') c.display = '— — —';
        if (c.type === 'led') { c.lit = false; c.reverse = false; }
        if (isResistorLike(c)) c.dissipatedPower = 0;

        if (c.type === 'sevensegment') {
          if (!c.segments) c.segments = { a:0, b:0, c:0, d:0, e:0, f:0, g:0, dp:0 };
          for (const id of ['a','b','c','d','e','f','g','dp']) {
            c.segments[id] = 0;
          }
        }
        if (c.type === 'relay') {
          c._Icoil = 0;
          if (!c._manual) {
            c._energized = false;
            c._contacts = 'nc';
          }
        }
        if (c.type === 'buzzer') {
          c._freq = c.buzzFreq || 0;
        }
      }
      ctx.lastCircuitKey.value = '';
      return;
    }

    // ---- Кэш по «ключу схемы» ----
    const now = performance.now();
    const circuitKey = ctx.getCircuitKey();
    if (circuitKey === ctx.lastCircuitKey.value &&
        now - ctx.lastCircuitKey.time < Const.CIRCUIT_MIN_INTERVAL) {
      // Даже если схема не пересчитана — синхронизируем визуализацию динамиков
      syncBuzzers(ctx);
      return;
    }
    ctx.lastCircuitKey.value = circuitKey;
    ctx.lastCircuitKey.time  = now;

    for (const c of components) {
      if (c.type === 'mosfet') { c._Vg = 0; c._Vs = 0; }
    }

    for (const c of components) {
      if (c.type === 'lamp' && !c.burned) { c.lit = false; c.brightness = 0; }
      if (c.type === 'multimeter') c.display = '— — —';
      if (c.type === 'led') { c.lit = false; c.reverse = false; }
      if (isResistorLike(c)) c.dissipatedPower = 0;
    }

    const result = Solver.solveCircuit(ctx);
    if (!result) {
      for (const mm of components) {
        if (mm.type === 'multimeter' && mm.mode === 'resistance') {
          const R = Solver.measureResistance(ctx, mm);
          mm.display = Fmt.resistance(R);
        }
      }
      clearAllSevenSegments(ctx);
      syncBuzzers(ctx);
      return;
    }

    const { sol, getNodeId } = result;

    try { updateSevenSegmentsFromSolution(ctx, sol, getNodeId); } catch (e) { /* ignore */ }

    // ---- Напряжения на пинах Arduino ----
    const arduinoNow = components.find(c => c.type === 'arduino');
    if (arduinoNow && arduinoNow.pinStates) {
      for (const pinId in arduinoNow.pinStates) {
        const st = arduinoNow.pinStates[pinId];
        const n = getNodeId(arduinoNow, pinId);
        if (n !== undefined && sol[n] !== undefined) st.voltage = sol[n];
      }
    }
    if (arduinoNow) {
      if (!arduinoNow.powerVoltages) arduinoNow.powerVoltages = {};
      const POWER_IDS = ['v5','v33','vin','gnd1','gnd2','gnd3','ioref','aref','reset'];
      for (const pid of POWER_IDS) {
        const n = getNodeId(arduinoNow, pid);
        if (n !== undefined && sol[n] !== undefined) arduinoNow.powerVoltages[pid] = sol[n];
      }
    }

    // ---- MOSFET: пересчёт токов и мощности, детектор перегорания ----
    for (const m of components) {
      if (m.type !== 'mosfet') continue;
      const nG = getNodeId(m, 'g');
      const nD = getNodeId(m, 'd');
      const nS = getNodeId(m, 's');
      const Vg = sol[nG];
      const Vd = sol[nD];
      const Vs = sol[nS];
      const Vgs = Vg - Vs;
      const Vds = Vd - Vs;

      m._Vg = Vg;
      m._Vs = Vs;

      const spec = getSpec(m);
      const Rds = spec.computeRds(m, Vg, Vs);

      m.Vgs = Vgs;
      m.Vds = Vds;
      m.Rds = Rds;
      m.Ids = Vds / Math.max(Rds, 1e-6);
      m.dissipatedPower = (Vds * Vds) / Math.max(Rds, 1e-6);

      if (!m.burned) {
        const Pmax = m.Pmax || 40;
        if (m.dissipatedPower > Pmax) {
          m.burned = true;
          m._smoke = m._smoke || [];
          m._smokeSpawnAcc = 0;
          Snd.playBurnSound();
        }
      }
    }

    // ---- Реле ----
    for (const r of components) {
      if (r.type !== 'relay') continue;
      const nA = getNodeId(r, 'coilA');
      const nB = getNodeId(r, 'coilB');
      if (nA === undefined || nB === undefined) continue;

      const Vcoil = Math.abs(sol[nA] - sol[nB]);
      const Rcoil = Math.max(r.Rcoil || 400, 1e-6);
      const I = r.burned ? 0 : Vcoil / Rcoil;
      r._Icoil = I;

      // перегорание обмотки
      const Imax = r.Imax || 0.08;
      if (!r.burned && I > Imax) {
        r.burned = true;
        r._energized = false;
        r._contacts = 'nc';
        r._manual = false;
        Snd.playBurnSound();
        continue;
      }

      // если обмотка сгорела — контакты всегда NC
      if (r.burned) {
        r._energized = false;
        r._contacts = 'nc';
        continue;
      }

      // ручной форсаж — не трогаем (звук играет main.js / props-panel.js при клике)
      if (r._manual) continue;

      // гистерезис + звук щелчка
      const Ipull = r.I_pull || 0.015;
      const Idrop = r.I_drop || 0.008;
      if (!r._energized && I >= Ipull) {
        r._energized = true;
        r._contacts = 'no';
        Snd.playRelayClick(true);   // ★ срабатывание
      } else if (r._energized && I <= Idrop) {
        r._energized = false;
        r._contacts = 'nc';
        Snd.playRelayClick(false);  // ★ отпускание
      }
    }

    // ---- Лампы ----
    for (const lamp of components) {
      if (lamp.type !== 'lamp') continue;
      if (lamp.burned) continue;
      const nA = getNodeId(lamp, 'a');
      const nB = getNodeId(lamp, 'b');
      const vDiff = Math.abs(sol[nA] - sol[nB]);
      const rated = lamp.ratedVoltage || 9;
      const b = vDiff / rated;
      if (b >= Const.LAMP_BURN_RATIO) {
        lamp.burned = true; lamp.lit = false; lamp.brightness = 0;
        Snd.playLampPopSound();
        continue;
      }
      lamp.brightness = b;
      lamp.lit = b >= 0.2;
    }

    // ---- Светодиоды ----
    for (const led of components) {
      if (led.type !== 'led') continue;
      const nA = getNodeId(led, 'anode');
      const nC = getNodeId(led, 'cathode');
      const vDiff = sol[nA] - sol[nC];
      if (vDiff > 0.5) { led.lit = true; led.reverse = false; }
      else if (vDiff < -0.5) { led.lit = false; led.reverse = true; }
    }

    // ---- Резисторы ----
    for (const res of components) {
      if (res.type !== 'resistor') continue;
      if (res.burned) continue;
      const nA = getNodeId(res, 'a');
      const nB = getNodeId(res, 'b');
      if (nA === undefined || nB === undefined) continue;
      const vDiff = Math.abs(sol[nA] - sol[nB]);
      const R = Math.max(res.resistance || 220, 1e-9);
      const P = (vDiff * vDiff) / R;
      res.dissipatedPower = P;
      const Pmax = res.power || 0.25;
      if (P > Pmax) {
        res.burned = true; res.dissipatedPower = P;
        Snd.playBurnSound();
      }
    }

    // ---- Потенциометры ----
    for (const pot of components) {
      if (pot.type !== 'potentiometer') continue;
      if (pot.burned) continue;
      const Rtot = pot.resistance || 10000;
      const w = Math.max(0, Math.min(1, pot.wiper !== undefined ? pot.wiper : 0.5));
      const Raw = Math.max(Rtot * w, 1e-3);
      const Rwb = Math.max(Rtot * (1 - w), 1e-3);
      const nA = getNodeId(pot, 'a');
      const nW = getNodeId(pot, 'w');
      const nB = getNodeId(pot, 'b');
      let Paw = 0, Pwb = 0;
      if (nA !== undefined && nW !== undefined) {
        const v = Math.abs(sol[nA] - sol[nW]); Paw = (v * v) / Raw;
      }
      if (nW !== undefined && nB !== undefined) {
        const v = Math.abs(sol[nW] - sol[nB]); Pwb = (v * v) / Rwb;
      }
      pot.dissipatedPower = Math.max(Paw, Pwb);
      const Pmax = pot.power || 0.25;
      if (pot.dissipatedPower > Pmax) { pot.burned = true; Snd.playBurnSound(); }
    }

    // ---- Мультиметры ----
    for (const mm of components) {
      if (mm.type !== 'multimeter') continue;
      if (mm.mode === 'resistance') {
        const R = Solver.measureResistance(ctx, mm);
        mm.display = Fmt.resistance(R);
        continue;
      }
      const nR = getNodeId(mm, 'red');
      const nB = getNodeId(mm, 'black');
      const vDiff = sol[nR] - sol[nB];
      if (mm.mode === 'voltage') {
        mm.display = Fmt.voltage(vDiff);
      } else if (mm.mode === 'current') {
        const current = vDiff / Const.MM_R_CURRENT;
        mm.display = Fmt.current(Math.abs(current));
      }
    }

    // ---- Пьезодинамики: синхронизация отображаемой частоты ----
    syncBuzzers(ctx);

    // ---- Обновление панели свойств ----
    if (typeof ctx.onRenderPropsRefresh === 'function') {
      ctx.onRenderPropsRefresh();
    }
  }

  window.SchematicApp.physics = {
    computeLit,
    clearAllSevenSegments,
    updateSevenSegmentsFromSolution,
    syncBuzzers
  };
})();