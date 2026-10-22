/* Решатель линейных схем методом узловых потенциалов (MNA).

   Публичный API:
     gauss(A, rhs, n)                     — решение СЛАУ
     solveCircuitOnce(ctx)                — один проход MNA
     solveCircuit(ctx)                    — итерации с MOSFET
     measureResistance(ctx, mm)           — измерение Ω мультиметром
     hasConductivePath(A, start, end, n)  — есть ли путь

   ctx = {
     components,        // массив компонентов
     getSpec,           // (c) => spec
     Geo,               // geometry
     Const,             // constants
     ArduinoPinVoltages // карта фиксированных напряжений пинов Arduino
   }

   Регистрируется в window.SchematicApp.solver.
*/
(function () {
  'use strict';

  window.SchematicApp = window.SchematicApp || {};

  const Netlist = window.SchematicApp.netlist;

  // ---------------------------------------------------------------------------
  //  Гаусс с частичным выбором ведущего элемента
  // ---------------------------------------------------------------------------
  function gauss(A, rhs, n) {
    const M = A.map(row => Float64Array.from(row));
    const v = Float64Array.from(rhs);

    for (let col = 0; col < n; col++) {
      let maxRow = col;
      let maxVal = Math.abs(M[col][col]);
      for (let r = col + 1; r < n; r++) {
        if (Math.abs(M[r][col]) > maxVal) { maxVal = Math.abs(M[r][col]); maxRow = r; }
      }
      if (maxVal < 1e-12) {
        for (let k = 0; k < n; k++) M[col][k] = 0;
        M[col][col] = 1; v[col] = 0;
        continue;
      }
      if (maxRow !== col) {
        const t = M[col]; M[col] = M[maxRow]; M[maxRow] = t;
        const tv = v[col]; v[col] = v[maxRow]; v[maxRow] = tv;
      }
      for (let r = col + 1; r < n; r++) {
        const f = M[r][col] / M[col][col];
        if (f === 0) continue;
        for (let k = col; k < n; k++) M[r][k] -= f * M[col][k];
        v[r] -= f * v[col];
      }
    }

    const x = new Float64Array(n);
    for (let i = n - 1; i >= 0; i--) {
      let s = v[i];
      for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
      x[i] = s / M[i][i];
    }
    return x;
  }

  function hasConductivePath(A, start, end, n) {
    const visited = new Uint8Array(n);
    const queue = [start];
    visited[start] = 1;
    while (queue.length > 0) {
      const v = queue.shift();
      if (v === end) return true;
      for (let u = 0; u < n; u++) {
        if (visited[u]) continue;
        if (A[v][u] !== 0) { visited[u] = 1; queue.push(u); }
      }
    }
    return visited[end] === 1;
  }

  // ---------------------------------------------------------------------------
  //  Один проход MNA
  // ---------------------------------------------------------------------------
  function solveCircuitOnce(ctx) {
    const { components, getSpec, Geo, Const, ArduinoPinVoltages } = ctx;
    const Netlist = window.SchematicApp.netlist;

    const isBattery = c => c.type === 'battery' || c.type === 'battery15';

    const batteries = components.filter(isBattery);
    const arduinoComp = components.find(c => c.type === 'arduino');
    const activeSources = [];

    if (arduinoComp) {
      const spec = getSpec(arduinoComp);
      const pinList = spec && spec.pins ? spec.pins : [];

      // Фиксированные источники (5V, 3.3V, GND, IOREF, AREF, Reset)
      for (const pinId in ArduinoPinVoltages) {
        if (!pinList.find(p => p.id === pinId)) continue;
        activeSources.push({
          comp: arduinoComp,
          pinId,
          voltage: ArduinoPinVoltages[pinId],
          rint: 0.1
        });
      }

      // Активные выходы пинов (OUTPUT, PWM)
      if (arduinoComp.pinStates) {
        for (const pinId in arduinoComp.pinStates) {
          const st = arduinoComp.pinStates[pinId];
          if (st.mode !== 'OUTPUT') continue;
          const pinSpec = pinList.find(p => p.id === pinId);
          if (pinSpec && pinSpec.type === 'power') continue;

          let voltage;
          if (st.pwm !== undefined && st.pwm > 0 && st.pwm < 255) {
            voltage = 5 * (st.pwm / 255);
          } else if (st.digital) {
            voltage = 5;
          } else {
            voltage = 0;
          }
          activeSources.push({
            comp: arduinoComp, pinId, voltage, rint: Const.PIN_RINT
          });
        }
      }
    }

    if (batteries.length === 0 && activeSources.length === 0) return null;

    const dsu = Netlist.makeDSU();
    Netlist.buildNodes(components, dsu, Geo, getSpec);
    const { getNodeId, N } = Netlist.indexNodes(components, dsu, getSpec);

    const NB = batteries.length;
    const NS = activeSources.length;
    const size = N + NB + NS;
    const A = Array.from({ length: size }, () => new Float64Array(size));
    const rhs = new Float64Array(size);

    function addResistor(n1, n2, R) {
      if (n1 === undefined || n2 === undefined || n1 === n2) return;
      const g = 1 / Math.max(R, 1e-9);
      A[n1][n1] += g;
      A[n2][n2] += g;
      A[n1][n2] -= g;
      A[n2][n1] -= g;
    }

    batteries.forEach((bat, i) => {
      const nP = getNodeId(bat, 'pos');
      const nN = getNodeId(bat, 'neg');
      addResistor(nP, nN, Const.BATT_RINT);
      const col = N + i;
      if (nP !== undefined) { A[nP][col] += 1; A[col][nP] += 1; }
      if (nN !== undefined) { A[nN][col] -= 1; A[col][nN] -= 1; }
      const charge = (bat.charge !== undefined) ? bat.charge : (bat.capacity || 500);
      rhs[col] = charge > 0 ? (bat.voltage || (bat.type === 'battery15' ? 1.5 : 9)) : 0;
    });

    activeSources.forEach((src, i) => {
      const nP = getNodeId(src.comp, src.pinId);
      const col = N + NB + i;
      if (nP === undefined) return;
      A[nP][col] += 1;
      A[col][nP] += 1;
      A[col][col] -= src.rint;
      rhs[col] = src.voltage;
    });

    for (const c of components) {
      if (c.type === 'lamp') {
        const R = c.burned ? 1e12 : Const.LAMP_R;
        addResistor(getNodeId(c, 'a'), getNodeId(c, 'b'), R);
      } else if (c.type === 'resistor') {
        const R = c.burned ? 1e12 : (c.resistance || 220);
        addResistor(getNodeId(c, 'a'), getNodeId(c, 'b'), R);
      } else if (c.type === 'potentiometer') {
        if (c.burned) {
          addResistor(getNodeId(c, 'a'), getNodeId(c, 'w'), 1e12);
          addResistor(getNodeId(c, 'w'), getNodeId(c, 'b'), 1e12);
        } else {
          const Rtot = c.resistance || 10000;
          const w = Math.max(0, Math.min(1, c.wiper !== undefined ? c.wiper : 0.5));
          addResistor(getNodeId(c, 'a'), getNodeId(c, 'w'), Math.max(Rtot * w, 1e-3));
          addResistor(getNodeId(c, 'w'), getNodeId(c, 'b'), Math.max(Rtot * (1 - w), 1e-3));
        }
      } else if (c.type === 'switch') {
        const R = c.closed ? Const.SWITCH_R_CLOSED : Const.SWITCH_R_OPEN;
        addResistor(getNodeId(c, 'a'), getNodeId(c, 'b'), R);
      } else if (c.type === 'multimeter') {
        const R = (c.mode === 'current') ? Const.MM_R_CURRENT :
                  (c.mode === 'resistance') ? Const.MM_R_RESISTANCE : Const.MM_R_VOLTAGE;
        addResistor(getNodeId(c, 'red'), getNodeId(c, 'black'), R);
      } else if (c.type === 'led') {
        const R = c.reverse ? 1e9 : (c.forwardResistance || 50);
        addResistor(getNodeId(c, 'anode'), getNodeId(c, 'cathode'), R);
      } else if (c.type === 'mosfet') {
        const spec = getSpec(c);
        const Vg = (c._Vg !== undefined) ? c._Vg : 0;
        const Vs = (c._Vs !== undefined) ? c._Vs : 0;
        const Rds = spec.computeRds(c, Vg, Vs);
        c._Rds = Rds;
        addResistor(getNodeId(c, 'd'), getNodeId(c, 's'), Rds);
      } else if (c.type === 'sevensegment') {
        const segIds = ['a','b','c','d','e','f','g','dp'];
        const nCom = getNodeId(c, 'com');
        for (const id of segIds) {
          const nSeg = getNodeId(c, id);
          addResistor(nSeg, nCom, Const.SEG_RINT);
        }
      } else if (c.type === 'relay') {
        // Обмотка — обычный резистор
        const Rcoil = c.burned ? 1e12 : (c.Rcoil || 400);
        addResistor(getNodeId(c, 'coilA'), getNodeId(c, 'coilB'), Rcoil);

        // Контакты: COM–NC и COM–NO
        const Ron  = c.Ron  || 0.05;
        const Roff = c.Roff || 1e9;
        const closedNC = (c._contacts || 'nc') === 'nc' && !c.burned;
        const closedNO = (c._contacts || 'nc') === 'no' && !c.burned;

        addResistor(getNodeId(c, 'com'), getNodeId(c, 'nc'),
                    closedNC ? Ron : Roff);
        addResistor(getNodeId(c, 'com'), getNodeId(c, 'no'),
                    closedNO ? Ron : Roff);
      }
    }

    // Опорный узел (земля)
    let groundNode = null;
    if (batteries.length > 0) groundNode = getNodeId(batteries[0], 'neg');
    if (groundNode === null && arduinoComp) {
      const spec = getSpec(arduinoComp);
      const gndPin = spec && spec.pins
        ? spec.pins.find(p => p.id === 'gnd1' || p.id === 'gnd2' || p.id === 'gnd3')
        : null;
      if (gndPin) groundNode = getNodeId(arduinoComp, gndPin.id);
    }
    if (groundNode === null) {
      const low = activeSources.find(s => s.voltage === 0);
      if (low) groundNode = getNodeId(low.comp, low.pinId);
    }

    if (groundNode !== null && groundNode !== undefined) {
      for (let j = 0; j < size; j++) A[groundNode][j] = 0;
      A[groundNode][groundNode] = 1;
      rhs[groundNode] = 0;
    }

    const sol = gauss(A, rhs, size);
    if (!sol) return null;
    return { sol, getNodeId };
  }

  // ---------------------------------------------------------------------------
  //  Итерации с MOSFET (нелинейный элемент — сходится за 2-3 прохода)
  // ---------------------------------------------------------------------------
  function solveCircuit(ctx) {
    const { components } = ctx;
    let result = null;
    const ITER = 20;

    for (let it = 0; it < ITER; it++) {
      result = solveCircuitOnce(ctx);
      if (!result) return null;

      const { sol, getNodeId } = result;
      let changed = false;
      for (const c of components) {
        if (c.type !== 'mosfet') continue;
        const nG = getNodeId(c, 'g');
        const nS = getNodeId(c, 's');
        if (nG === undefined || nS === undefined) continue;
        const Vg = sol[nG];
        const Vs = sol[nS];
        if (c._Vg === undefined || Math.abs(c._Vg - Vg) > 1e-3) changed = true;
        if (c._Vs === undefined || Math.abs(c._Vs - Vs) > 1e-3) changed = true;
        c._Vg = Vg;
        c._Vs = Vs;
      }
      if (!changed) break;
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  //  Измерение сопротивления мультиметром
  // ---------------------------------------------------------------------------
  function measureResistance(ctx, mm) {
    const { components, getSpec, Geo, Const } = ctx;
    const Netlist = window.SchematicApp.netlist;
    const isBattery = c => c.type === 'battery' || c.type === 'battery15';

    try {
      const dsu = Netlist.makeDSU();
      Netlist.buildNodes(components, dsu, Geo, getSpec);
      const { getNodeId, N } = Netlist.indexNodes(components, dsu, getSpec);
      const A = Array.from({ length: N }, () => new Float64Array(N));
      const I = new Float64Array(N);

      function addResistor(n1, n2, R) {
        if (n1 === undefined || n2 === undefined || n1 === n2) return;
        const g = 1 / Math.max(R, 1e-9);
        A[n1][n1] += g; A[n2][n2] += g;
        A[n1][n2] -= g; A[n2][n1] -= g;
      }

      for (const c of components) {
        if (c === mm) continue;
        if (isBattery(c)) continue;
        if (c.type === 'arduino') continue;

        if (c.type === 'multimeter') {
          addResistor(getNodeId(c, 'red'), getNodeId(c, 'black'), 1e12);
        } else if (c.type === 'lamp') {
          const R = c.burned ? 1e12 : Const.LAMP_R;
          addResistor(getNodeId(c, 'a'), getNodeId(c, 'b'), R);
        } else if (c.type === 'resistor') {
          const R = c.burned ? 1e12 : (c.resistance || 220);
          addResistor(getNodeId(c, 'a'), getNodeId(c, 'b'), R);
        } else if (c.type === 'potentiometer') {
          if (c.burned) {
            addResistor(getNodeId(c, 'a'), getNodeId(c, 'w'), 1e12);
            addResistor(getNodeId(c, 'w'), getNodeId(c, 'b'), 1e12);
          } else {
            const Rtot = c.resistance || 10000;
            const w = Math.max(0, Math.min(1, c.wiper !== undefined ? c.wiper : 0.5));
            addResistor(getNodeId(c, 'a'), getNodeId(c, 'w'), Math.max(Rtot * w, 1e-3));
            addResistor(getNodeId(c, 'w'), getNodeId(c, 'b'), Math.max(Rtot * (1 - w), 1e-3));
          }
        } else if (c.type === 'switch') {
          const R = c.closed ? Const.SWITCH_R_CLOSED : 1e12;
          addResistor(getNodeId(c, 'a'), getNodeId(c, 'b'), R);
        } else if (c.type === 'led') {
          addResistor(getNodeId(c, 'anode'), getNodeId(c, 'cathode'), 1e9);
        } else if (c.type === 'mosfet') {
          addResistor(getNodeId(c, 'd'), getNodeId(c, 's'), 1e9);
        } else if (c.type === 'sevensegment') {
          const segIds = ['a','b','c','d','e','f','g','dp'];
          const nCom = getNodeId(c, 'com');
          for (const id of segIds) {
            const nSeg = getNodeId(c, id);
            addResistor(nSeg, nCom, Const.SEG_RINT);
          }
        } else if (c.type === 'relay') {
          // при измерении сопротивления контакты разомкнуты, обмотка не мешает
          addResistor(getNodeId(c, 'coilA'), getNodeId(c, 'coilB'), 1e12);
          addResistor(getNodeId(c, 'com'),   getNodeId(c, 'nc'),   1e12);
          addResistor(getNodeId(c, 'com'),   getNodeId(c, 'no'),   1e12);
        }
      }

      const nR = getNodeId(mm, 'red');
      const nB = getNodeId(mm, 'black');
      if (nR === nB) return 0;
      if (!hasConductivePath(A, nR, nB, N)) return Infinity;
      for (let j = 0; j < N; j++) A[nB][j] = 0;
      A[nB][nB] = 1; I[nB] = 0;
      I[nR] += 1;
      const sol = gauss(A, I, N);
      if (!sol) return Infinity;
      const R = Math.abs(sol[nR] - sol[nB]);
      if (!isFinite(R) || isNaN(R)) return Infinity;
      return R;
    } catch (err) {
      console.warn('measureResistance error:', err);
      return NaN;
    }
  }

  window.SchematicApp.solver = {
    gauss,
    hasConductivePath,
    solveCircuitOnce,
    solveCircuit,
    measureResistance
  };
})();