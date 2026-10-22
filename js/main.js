(() => {
  'use strict';

  // =========================================================================
  //  МОДУЛИ
  // =========================================================================
  const App     = window.SchematicApp;
  const Fmt     = App.format;
  const Geo     = App.geometry;
  const Snd     = App.audio;
  const Const   = App.constants;
  const Netlist = App.netlist;
  const Solver  = App.solver;
  const Physics = App.physics;
  const History = App.history;
  const FileIO  = App.fileIO;
  const Render  = App.render;
  const PropsPanel  = App.propsPanel;
  const SketchPanel = App.sketchPanel;

  const formatCurrent    = Fmt.current;
  const formatResistance = Fmt.resistance;
  const formatPower      = Fmt.power;

  const roundPx       = Geo.roundPx;
  const getRotation   = Geo.getRotation;
  const pinWorld      = Geo.pinWorld;
  const distToSegment = Geo.distToSegment;

  const getAudioCtx = Snd.getAudioCtx;

  // =========================================================================
  //  DOM-ССЫЛКИ
  // =========================================================================
  const workspace = document.querySelector('.canvas-wrap');
  const canvas    = document.getElementById('canvas');
  const ctx       = canvas.getContext('2d');
  const status    = document.getElementById('status');

  const btnBattery        = document.getElementById('btnBattery');
  const btnBattery15      = document.getElementById('btnBattery15');
  const btnLamp           = document.getElementById('btnLamp');
  const btnArduino        = document.getElementById('btnArduino');
  const btnResistor       = document.getElementById('btnResistor');
  const btnPotentiometer  = document.getElementById('btnPotentiometer');
  const btnSwitch         = document.getElementById('btnSwitch');
  const btnMultimeter     = document.getElementById('btnMultimeter');
  const btnMosfet         = document.getElementById('btnMosfet');
  const btnSevenSegment   = document.getElementById('btnSevenSegment');
  const btnRelay          = document.getElementById('btnRelay');
  const btnBuzzer         = document.getElementById('btnBuzzer');

  const btnNew    = document.getElementById('btnNew');
  const btnOpen   = document.getElementById('btnOpen');
  const btnSave   = document.getElementById('btnSave');
  const btnSaveAs = document.getElementById('btnSaveAs');
  const fileInput = document.getElementById('fileInput');

  const btnClear = document.getElementById('btnClear');
  const btnGrid  = document.getElementById('btnGrid');
  const btnSim   = document.getElementById('btnSim');

  const btnOrtho = document.getElementById('btnOrtho');
  const btnSnap  = document.getElementById('btnSnap');

  // IDE-панель
  const btnSketch          = document.getElementById('btnSketch');
  const sketchPanel        = document.getElementById('sketchPanel');
  const sketchHeader       = document.getElementById('sketchHeader');
  const sketchClose        = document.getElementById('sketchClose');
  const sketchVerify       = document.getElementById('sketchVerify');
  const sketchRun          = document.getElementById('sketchRun');
  const sketchStop         = document.getElementById('sketchStop');
  const sketchExample      = document.getElementById('sketchExample');
  const sketchClearConsole = document.getElementById('sketchClearConsole');
  const sketchBoard        = document.getElementById('sketchBoard');
  const sketchCode         = document.getElementById('sketchCode');
  const sketchConsole      = document.getElementById('sketchConsole');
  const sketchFileName     = document.getElementById('sketchFileName');
  const sketchBoardInfo    = document.getElementById('sketchBoardInfo');
  const sketchStatus       = document.getElementById('sketchStatus');
  const sketchEditorContainer = document.getElementById('sketchEditor');

  // Панель свойств
  const propsPanel   = document.getElementById('propsPanel');
  const propsHeader  = document.getElementById('propsHeader');
  const propsTitle   = document.getElementById('propsTitle');
  const propsBody    = document.getElementById('propsBody');
  const propsClose   = document.getElementById('propsClose');
  const modalOverlay = document.getElementById('modalOverlay');

  // =========================================================================
  //  СОСТОЯНИЕ
  // =========================================================================
  const CELL = 20;
  Geo.setCell(CELL);

  const registry = window.SchematicComponents || {};

  let gridVisible  = true;
  let activeTool   = null;
  const mouse      = { x: -100, y: -100, inside: false };
  let simulateMode = false;

  Object.defineProperty(window, '__simulateMode', {
    get() { return simulateMode; },
    set(v) { simulateMode = !!v; },
    configurable: true
  });

  window._sketchPanelDragging = false;

  let orthoWires = false;
  let snapNodes = false;
  const SNAP_RADIUS = 10;

  let zoom = 1;
  let panX = 0;
  let panY = 0;
  const ZOOM_MIN = 0.2, ZOOM_MAX = 5, ZOOM_STEP = 0.1;

  let isPanning = false;
  let panStart = { x: 0, y: 0 };
  let panStartPan = { x: 0, y: 0 };

  const components = [];
  const selection  = new Set();

  // ★ делаем массив компонентов доступным для arduino-runtime / buzzer-runtime
  window.__schematicComponents = components;
  // ★ геттер для BuzzerRuntime.stopAll()
  App.getComponents = () => components;

  let hoveredPin = null;
  let wireDraft = null;

  let isDraggingSelection = false;
  const dragStart = new Map();
  let dragStartMouse = { x: 0, y: 0 };

  let lasso = null;
  let lassoAdditive = false;
  let lassoBaseSelection = null;

  const history = { past: [], future: [], limit: 100, transaction: null };

  let clipboard = [];
  let pasteMode = false;
  let pasteOrigin = { x: 0, y: 0 };

  const selectedNodes = new Set();
  let activeNode = null;

  let draggingWireNode = null;
  let draggingWireSegment = null;
  let draggingWireEndpoint = null;
  let draggingPotWiper = null;

  let currentFileHandle = null;
  let currentFileName = null;

  const WIRE_COLORS = ['#e74c3c', '#3498db', '#27ae60', '#f39c12', '#9b59b6', '#16a085', '#e67e22'];
  const WIRE_COLOR_POS = '#e74c3c';
  const WIRE_COLOR_NEG = '#3498db';

  const NODE_HIT = 12;
  const SEGMENT_HIT = 5;
  const AXIS_EPS = 0.5;

  const _lastRenderTime = { value: 0 };
  let lastMouseEvent = null;

  const _circuitCache = { value: '', time: 0 };
  window.__schematicResetCache = () => { _circuitCache.value = ''; };

  const ARDUINO_PIN_VOLTAGES = {
    v5: 5.0, v33: 3.3, vin: 0.0,
    gnd1: 0.0, gnd2: 0.0, gnd3: 0.0,
    ioref: 5.0, aref: 5.0, reset: 5.0
  };

  let lastClickTime = 0;
  let lastClickPos = { x: 0, y: 0 };

  // =========================================================================
  //  УТИЛИТЫ
  // =========================================================================
  function getSpec(c) { return registry[c.type] || null; }
  function isWire(c) { return c.type === 'wire'; }
  function isBattery(c) { return c.type === 'battery' || c.type === 'battery15'; }
  function isResistorLike(c) { return c.type === 'resistor' || c.type === 'potentiometer'; }
  function findPinById(comp, pinId) {
    const spec = getSpec(comp);
    if (!spec || !spec.pins) return null;
    return spec.pins.find(p => p.id === pinId) || null;
  }

  // =========================================================================
  //  КЛЮЧ СХЕМЫ + КОНТЕКСТ РЕШАТЕЛЯ
  // =========================================================================
  function getCircuitKey() {
    let k = '';
    const ard = components.find(c => c.type === 'arduino');
    if (ard && ard.pinStates) {
      for (const pinId in ard.pinStates) {
        const st = ard.pinStates[pinId];
        if (st.mode !== 'OUTPUT') continue;
        k += pinId + ':' + (st.digital ? 1 : 0) + ':' + (st.pwm || 0) + '|';
      }
    }
    for (const c of components) {
      if (c.type === 'switch')             k += 'S' + (c.closed ? 1 : 0) + '|';
      else if (c.type === 'potentiometer') k += 'P' + (c.wiper !== undefined ? c.wiper.toFixed(3) : '0.500') + '|';
      else if (c.type === 'resistor')      k += 'R' + (c.burned ? 'B' : (c.resistance || 220)) + '|';
      else if (c.type === 'lamp')          k += 'L' + (c.burned ? 'B' : 0) + '|';
      else if (c.type === 'led')           k += 'D' + (c.reverse ? 'R' : 'F') + '|';
      else if (c.type === 'mosfet')        k += 'M' + (c.burned ? 'B' : 'A') + ':' + (c.Ron || 0.044) + '|';
      else if (c.type === 'sevensegment')  k += 'D7' + (c.commonType === 'anode' ? 'A' : 'C') + '|';
      else if (c.type === 'relay')         k += 'K' + (c.burned ? 'B' : (c._contacts || 'nc')) + '|';
      else if (c.type === 'buzzer')        k += 'BZ' + (c.buzzFreq || 0) + ':' + (c.buzzVol || 0) + '|';
      else if (c.type === 'battery' || c.type === 'battery15')
                                           k += 'B' + (c.voltage || 9) + ':' + (c.charge !== undefined ? c.charge : 1) + '|';
    }
    let wires = 0;
    for (const c of components) if (c.type === 'wire') wires++;
    k += 'W' + wires;
    return k;
  }

  function solverContext() {
    return {
      components,
      getSpec,
      Geo,
      Const,
      simulateMode,
      getCircuitKey,
      lastCircuitKey: _circuitCache,
      ArduinoPinVoltages: ARDUINO_PIN_VOLTAGES,
      onRenderPropsRefresh: () => {
        if (PropsPanel.isOpen(propsContext())) {
          const cur = PropsPanel.getCurrent();
          if (cur && (isBattery(cur) || cur.type === 'resistor' ||
                      cur.type === 'potentiometer' || cur.type === 'mosfet' ||
                      cur.type === 'sevensegment' || cur.type === 'relay' ||
                      cur.type === 'buzzer')) {
            PropsPanel.refresh(propsContext());
          }
        }
      }
    };
  }

  // =========================================================================
  //  КОНТЕКСТЫ ДЛЯ МОДУЛЕЙ
  // =========================================================================
  function historyContext() {
    return {
      components,
      history,
      cache: _circuitCache,
      resetSelectionState: resetSelectionStateBeforeLoad,
      onPropsRefresh: () => {
        if (PropsPanel.isOpen(propsContext())) {
          const cur = PropsPanel.getCurrent();
          if (cur && components.indexOf(cur) === -1) closePropsPanel();
          else PropsPanel.refresh(propsContext());
        }
      }
    };
  }

  function fileIOContext() {
    return {
      components,
      cache: _circuitCache,
      history,
      orthoWires: { get: () => orthoWires, set: v => { orthoWires = v; } },
      snapNodes:  { get: () => snapNodes,  set: v => { snapNodes = v; } },
      getSketchCode: () => SketchPanel.getCode(sketchContext()),
      setSketchCode: (t) => SketchPanel.setCode(sketchContext(), t),
      getCurrentFile: () => ({ handle: currentFileHandle, name: currentFileName }),
      setCurrentFile: (handle, name) => { currentFileHandle = handle; currentFileName = name; },
      status,
      fileInput,
      pushHistoryFn: pushHistory,
      resetAfterLoad: resetSelectionStateBeforeLoad,
      syncOrthoUI,
      syncSnapUI,
      closePropsPanel,
      render
    };
  }

  function renderContext() {
    return {
      canvas, ctx, workspace,
      components, selection,
      zoomGet: () => zoom,
      panXGet: () => panX,
      panYGet: () => panY,
      gridVisibleGet: () => gridVisible,
      orthoWiresGet: () => orthoWires,
      simulateMode,
      mouse, activeTool,
      hoveredPin, wireDraft, lastMouseEvent,
      clipboard, pasteMode, pasteOrigin,
      lasso, draggingWireSegment, draggingPotWiper,
      selectedNodes, activeNode,
      CELL,
      registry, getSpec, isWire,
      pinWorld, getRotation, distToSegment,
      lastRenderTime: _lastRenderTime,
      solverContext,
      drawWireNodes
    };
  }

  function propsContext() {
    return {
      panel: propsPanel,
      header: propsHeader,
      title: propsTitle,
      body: propsBody,
      close: propsClose,
      overlay: modalOverlay,
      components,
      pushHistory,
      render,
      invalidateCache: () => { _circuitCache.value = ''; },
      getRotation,
      formatCurrent,
      formatResistance,
      formatPower,
      runtime: window.ArduinoRuntime
    };
  }

  function sketchContext() {
    return {
      panel: sketchPanel,
      header: sketchHeader,
      closeBtn: sketchClose,
      verifyBtn: sketchVerify,
      runBtn: sketchRun,
      stopBtn: sketchStop,
      exampleBtn: sketchExample,
      clearConsoleBtn: sketchClearConsole,
      boardSelect: sketchBoard,
      editorContainer: sketchEditorContainer,
      codeTextarea: sketchCode,
      consoleEl: sketchConsole,
      statusEl: sketchStatus,
      fileNameEl: sketchFileName,
      boardInfoEl: sketchBoardInfo,

      components,
      simulateModeGet: () => simulateMode,
      simulateModeSet: v => { simulateMode = !!v; },
      getAudioCtx,
      invalidateCache: () => { _circuitCache.value = ''; },
      onSimulationStart: startSimulation,
      onSimulationStop:  stopSimulation,
      syncToolUI,
      render,

      compiler: window.ArduinoCompiler,
      runtime: window.ArduinoRuntime,
      SKETCH_EXAMPLE: `// Blink — мигание встроенным светодиодом
void setup() {
  pinMode(13, OUTPUT);
  Serial.begin(9600);
  Serial.println("Start!");
}

void loop() {
  digitalWrite(13, HIGH);
  Serial.println("LED ON");
  delay(1000);

  digitalWrite(13, LOW);
  Serial.println("LED OFF");
  delay(1000);
}
`
    };
  }

  function render() { Render.render(renderContext()); }

  // =========================================================================
  //  СБРОС СОСТОЯНИЯ
  // =========================================================================
  function resetSelectionStateBeforeLoad() {
    selection.clear();
    isDraggingSelection = false;
    dragStart.clear();
    lasso = null;
    lassoBaseSelection = null;
    pasteMode = false;
    hoveredPin = null;
    wireDraft = null;
    draggingWireNode = null;
    draggingWireSegment = null;
    draggingWireEndpoint = null;
    draggingPotWiper = null;
    clearNodeSelection();
  }

  // =========================================================================
  //  ПРОВОДА: обёртки над Render
  // =========================================================================
  function buildOrthoPath(a, b, mode) { return Render.buildOrthoPath(a, b, mode); }
  function refreshWireGeometry() { Render.refreshWireGeometry(renderContext()); }
  function getWirePoints(wire) { return Render.getWirePoints(wire); }

  function applyNodeSnap(wire, x, y, ignoreIndex, extraExclude) {
    if (!snapNodes) return { x, y, snappedX: false, snappedY: false };
    const pts = Render.getWirePoints(wire);
    let bestX = null, bestXd = SNAP_RADIUS;
    let bestY = null, bestYd = SNAP_RADIUS;
    for (let i = 0; i < pts.length; i++) {
      if (i === ignoreIndex) continue;
      if (extraExclude && extraExclude.has(i)) continue;
      const p = pts[i];
      const dx = Math.abs(p.x - x), dy = Math.abs(p.y - y);
      if (dx < bestXd) { bestXd = dx; bestX = p.x; }
      if (dy < bestYd) { bestYd = dy; bestY = p.y; }
    }
    for (const c of components) {
      if (isWire(c)) continue;
      const spec = getSpec(c);
      if (!spec || !spec.pins) continue;
      for (const pin of spec.pins) {
        const w = pinWorld(c, pin);
        const dx = Math.abs(w.x - x), dy = Math.abs(w.y - y);
        if (dx < bestXd) { bestXd = dx; bestX = w.x; }
        if (dy < bestYd) { bestYd = dy; bestY = w.y; }
      }
    }
    const result = { x, y, snappedX: false, snappedY: false };
    if (bestX !== null) { result.x = bestX; result.snappedX = true; }
    if (bestY !== null) { result.y = bestY; result.snappedY = true; }
    return result;
  }

  // =========================================================================
  //  ПРОВОДА: интерактив
  // =========================================================================
  function isMouseOverNode(wire, nodeIndex) {
    if (!mouse.inside) return false;
    const pts = getWirePoints(wire);
    const p = pts[nodeIndex];
    return Math.hypot(mouse.x - p.x, mouse.y - p.y) <= NODE_HIT;
  }

  function findWireNodeAt(x, y) {
    for (let i = components.length - 1; i >= 0; i--) {
      const wire = components[i];
      if (!isWire(wire) || !selection.has(wire)) continue;
      const pts = getWirePoints(wire);
      for (let idx = 1; idx < pts.length - 1; idx++) {
        const p = pts[idx];
        if (Math.hypot(x - p.x, y - p.y) <= NODE_HIT) return { wire, nodeIndex: idx };
      }
    }
    return null;
  }

  function findWireEndpointAt(x, y) {
    for (let i = components.length - 1; i >= 0; i--) {
      const wire = components[i];
      if (!isWire(wire) || !selection.has(wire)) continue;
      const pts = getWirePoints(wire);
      if (pts.length < 2) continue;
      const first = pts[0];
      if (Math.hypot(x - first.x, y - first.y) <= NODE_HIT) return { wire, endpoint: 'A' };
      const last = pts[pts.length - 1];
      if (Math.hypot(x - last.x, y - last.y) <= NODE_HIT) return { wire, endpoint: 'B' };
    }
    return null;
  }

  function isSegmentParallelMovable(pts, j) {
    if (j < 1) return false;
    if (j + 2 > pts.length - 1) return false;
    const a = pts[j], b = pts[j + 1];
    const prev = pts[j - 1], next = pts[j + 2];
    const segH = Math.abs(a.y - b.y) < AXIS_EPS;
    const segV = Math.abs(a.x - b.x) < AXIS_EPS;
    if (!segH && !segV) return false;
    const prevH = Math.abs(prev.y - a.y) < AXIS_EPS;
    const prevV = Math.abs(prev.x - a.x) < AXIS_EPS;
    const nextH = Math.abs(b.y - next.y) < AXIS_EPS;
    const nextV = Math.abs(b.x - next.x) < AXIS_EPS;
    if (segH) { if (!prevV || !nextV) return false; if (prevH || nextH) return false; }
    else      { if (!prevH || !nextH) return false; if (prevV || nextV) return false; }
    return true;
  }

  function findMovableSegmentAt(x, y) {
    for (let i = components.length - 1; i >= 0; i--) {
      const wire = components[i];
      if (!isWire(wire) || !selection.has(wire)) continue;
      const pts = getWirePoints(wire);
      if (pts.length < 4) continue;
      for (let j = 1; j <= pts.length - 3; j++) {
        const a = pts[j], b = pts[j + 1];
        if (distToSegment(x, y, a.x, a.y, b.x, b.y) > SEGMENT_HIT) continue;
        if (!isSegmentParallelMovable(pts, j)) continue;
        return { wire, segIndex: j, isHorizontal: Math.abs(a.y - b.y) < AXIS_EPS };
      }
    }
    return null;
  }

  function isNodeSelected(wire, idx) {
    for (const n of selectedNodes) if (n.wire === wire && n.nodeIndex === idx) return true;
    return false;
  }
  function addNodeToSelection(wire, idx) {
    if (isNodeSelected(wire, idx)) return;
    selectedNodes.add({ wire, nodeIndex: idx });
  }
  function clearNodeSelection() { selectedNodes.clear(); activeNode = null; }

  function drawWireNodes(wire) {
    if (!selection.has(wire)) return;
    const pts = getWirePoints(wire);
    const g = ctx;

    g.save();
    if (pts.length >= 2) {
      const drawEndpoint = (idx, connected) => {
        const p = pts[idx];
        const hovered = mouse.inside && Math.hypot(mouse.x - p.x, mouse.y - p.y) <= NODE_HIT;
        g.beginPath();
        g.arc(p.x, p.y, hovered ? 9 : 7, 0, Math.PI * 2);
        g.fillStyle = connected
          ? (hovered ? 'rgba(39, 174, 96, 0.55)' : 'rgba(39, 174, 96, 0.30)')
          : (hovered ? 'rgba(150, 150, 150, 0.55)' : 'rgba(150, 150, 150, 0.25)');
        g.fill();
        g.beginPath();
        g.arc(p.x, p.y, 4, 0, Math.PI * 2);
        g.fillStyle = connected ? '#27ae60' : '#95a5a6';
        g.fill();
        g.strokeStyle = connected ? '#1e8449' : '#7f8c8d';
        g.lineWidth = 1.5;
        g.stroke();
      };
      drawEndpoint(0, !!wire.endA);
      drawEndpoint(pts.length - 1, !!wire.endB);
    }

    if (pts.length >= 3) {
      for (let idx = 1; idx < pts.length - 1; idx++) {
        const p = pts[idx];
        const isHovered = isMouseOverNode(wire, idx);
        const isSelected = isNodeSelected(wire, idx);
        const isActive = activeNode && activeNode.wire === wire && activeNode.nodeIndex === idx;

        g.beginPath();
        g.arc(p.x, p.y, (isActive || isSelected) ? 13 : (isHovered ? 12 : 9), 0, Math.PI * 2);
        g.fillStyle = isActive ? 'rgba(0, 120, 215, 0.55)'
                      : isSelected ? 'rgba(0, 120, 215, 0.4)'
                      : isHovered  ? 'rgba(74, 144, 226, 0.4)'
                                   : 'rgba(74, 144, 226, 0.25)';
        g.fill();
        g.beginPath();
        g.arc(p.x, p.y, 6.5, 0, Math.PI * 2);
        g.fillStyle = '#ffffff';
        g.fill();
        g.beginPath();
        g.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
        g.fillStyle = (isActive || isSelected) ? '#0078d7' : '#4a90e2';
        g.fill();
        g.strokeStyle = (isActive || isSelected) ? '#005fa3' : '#2c3e50';
        g.lineWidth = isSelected ? 2 : 1.5;
        g.stroke();
      }
    }
    g.restore();
  }

  function addNodeOnWireAt(wire, x, y) {
    if (!wire.points || wire.points.length < 2) {
      wire.points = [
        { x: wire.ax || 0, y: wire.ay || 0 },
        { x: wire.bx || 0, y: wire.by || 0 }
      ];
    }
    const pts = wire.points;
    let bestSeg = -1, bestDist = 20, bestT = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      if (len2 === 0) continue;
      let t = ((x - a.x) * dx + (y - a.y) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const px = a.x + t * dx, py = a.y + t * dy;
      const d = Math.hypot(x - px, y - py);
      if (d < bestDist) { bestDist = d; bestSeg = i; bestT = t; }
    }
    if (bestSeg === -1) return null;
    const a = pts[bestSeg], b = pts[bestSeg + 1];
    let nx = a.x + bestT * (b.x - a.x);
    let ny = a.y + bestT * (b.y - a.y);
    for (const p of pts) if (Math.hypot(p.x - nx, p.y - ny) < 6) return null;
    if (snapNodes) {
      const snapped = applyNodeSnap(wire, nx, ny, -1, null);
      nx = snapped.x; ny = snapped.y;
    }
    pushHistory();
    const newIdx = bestSeg + 1;
    wire.points.splice(newIdx, 0, { x: nx, y: ny });
    clearNodeSelection();
    addNodeToSelection(wire, newIdx);
    activeNode = { wire, nodeIndex: newIdx };
    selection.clear();
    selection.add(wire);
    return newIdx;
  }

  function deleteSelectedNodes() {
    if (selectedNodes.size === 0) return false;
    const byWire = new Map();
    for (const n of selectedNodes) {
      if (!byWire.has(n.wire)) byWire.set(n.wire, []);
      byWire.get(n.wire).push(n.nodeIndex);
    }
    let anyDeleted = false;
    for (const [wire, indices] of byWire) {
      if (!wire || !isWire(wire)) continue;
      const pts = getWirePoints(wire);
      const idxs = [...new Set(indices)].sort((a, b) => b - a);
      for (const idx of idxs) {
        if (idx > 0 && idx < pts.length - 1) { pts.splice(idx, 1); anyDeleted = true; }
      }
    }
    clearNodeSelection();
    if (anyDeleted) {
      pushHistory();
      _circuitCache.value = '';
      status.textContent = 'Узлы удалены.';
      render();
    }
    return anyDeleted;
  }

  function wiperFromMouse(comp, mx, my) {
    const rot = getRotation(comp);
    let dx = mx - comp.x, dy = my - comp.y;
    if (rot === 90)       { const t = dx; dx = dy; dy = -t; }
    else if (rot === 180) { dx = -dx; dy = -dy; }
    else if (rot === 270) { const t = dx; dx = -dy; dy = t; }
    let ang = Math.atan2(-dy, dx);
    let t;
    if (ang < 0) t = (dx >= 0) ? 1 : 0;
    else t = 1 - ang / Math.PI;
    return Math.max(0, Math.min(1, t));
  }

  // =========================================================================
  //  ЦВЕТА ПРОВОДОВ
  // =========================================================================
  function isPositivePowerPin(comp, pin) {
    if (!comp || !pin) return false;
    if (isBattery(comp) && pin.id === 'pos') return true;
    if (comp.type === 'arduino' && (pin.id === 'v5' || pin.id === 'v33')) return true;
    return false;
  }
  function isNegativePowerPin(comp, pin) {
    if (!comp || !pin) return false;
    if (isBattery(comp) && pin.id === 'neg') return true;
    if (comp.type === 'arduino' &&
        (pin.id === 'gnd1' || pin.id === 'gnd2' || pin.id === 'gnd3' || pin.id === 'vin')) return true;
    return false;
  }
  function findFirstWireAtPin(comp, pinId) {
    for (const w of components) {
      if (!isWire(w)) continue;
      if (w.endA && w.endA.comp === comp && w.endA.pinId === pinId) return w;
      if (w.endB && w.endB.comp === comp && w.endB.pinId === pinId) return w;
    }
    return null;
  }
  function pickWireColor(fromComp, fromPin) {
    if (isPositivePowerPin(fromComp, fromPin)) return WIRE_COLOR_POS;
    if (isNegativePowerPin(fromComp, fromPin)) return WIRE_COLOR_NEG;
    const existing = findFirstWireAtPin(fromComp, fromPin.id);
    if (existing && existing.color) return existing.color;
    const wireCount = components.filter(isWire).length;
    return WIRE_COLORS[wireCount % WIRE_COLORS.length];
  }

  // =========================================================================
  //  ОБЁРТКИ HISTORY / FILEIO / PROPS
  // =========================================================================
  function pushHistory() { History.push(historyContext()); }
  function undo() { if (History.undo(historyContext())) render(); }
  function redo() { if (History.redo(historyContext())) render(); }

  function saveToFile(forceDialog = false) { return FileIO.save(fileIOContext(), forceDialog); }
  function openFile() { return FileIO.open(fileIOContext()); }
  function newDocument() { FileIO.newDocument(fileIOContext()); }
  function applyDocumentFromJSON(text) { FileIO.applyDocumentFromJSON(fileIOContext(), text); }

  function openPropsPanel(comp)  { PropsPanel.open(propsContext(), comp); }
  function closePropsPanel()     { PropsPanel.close(propsContext()); }
  function refreshPropsPanel()   { PropsPanel.refresh(propsContext()); }

  // =========================================================================
  //  СИМУЛЯЦИЯ: вкл / выкл
  // =========================================================================
  function startSimulation() {
    simulateMode = true;
    activeTool = null;
    wireDraft = null;
    cancelPasteMode();
    closePropsPanel();
    clearNodeSelection();
    getAudioCtx();
    btnSim.innerHTML = '<span class="icon">⏹</span> Остановить';
    status.textContent = 'Моделирование запущено.';
    syncToolUI();
  }

  function stopSimulation() {
    simulateMode = false;
    for (const c of components) {
      if (c.type === 'lamp' && !c.burned) { c.lit = false; c.brightness = 0; }
      if (c.type === 'multimeter') c.display = '— — —';
      if (c.type === 'led') { c.lit = false; c.reverse = false; }
      if (isResistorLike(c)) c.dissipatedPower = 0;
      if (c.type === 'mosfet') c.dissipatedPower = 0;
      if (c.type === 'sevensegment') {
        if (!c.segments) c.segments = { a:0,b:0,c:0,d:0,e:0,f:0,g:0,dp:0 };
        for (const id of ['a','b','c','d','e','f','g','dp']) c.segments[id] = 0;
      }
      if (c.type === 'relay') {
        c._Icoil = 0;
        c._energized = false;
        c._contacts = 'nc';
        c._manual = false;
      }
      if (c.type === 'buzzer') {
        c.buzzFreq = 0;
        c.buzzVol = 0;
        if (window.BuzzerRuntime) window.BuzzerRuntime.noTone(c);
      }
    }
    if (window.ArduinoRuntime && window.ArduinoRuntime.running) window.ArduinoRuntime.stop();
    if (window.BuzzerRuntime) window.BuzzerRuntime.stopAll();

    btnSim.innerHTML = '<span class="icon">▶</span> Запустить моделирование';
    status.textContent = 'Моделирование остановлено.';
    _circuitCache.value = '';
    syncToolUI();
  }

  // =========================================================================
  //  ВЫДЕЛЕНИЕ / КОПИРОВАНИЕ / ВСТАВКА
  // =========================================================================
  function clearSelection() {
    clearNodeSelection();
    if (selection.size === 0) return;
    selection.clear();
    updateSelectionStatus();
    render();
  }
  function selectOnly(c) {
    selection.clear();
    selection.add(c);
    updateSelectionStatus();
    render();
  }
  function toggleSelection(c) {
    if (selection.has(c)) selection.delete(c);
    else selection.add(c);
    updateSelectionStatus();
    render();
  }
  function updateSelectionStatus() {
    if (activeTool) return;
    if (pasteMode) return;
    if (selectedNodes.size > 0) { status.textContent = `Выделено узлов: ${selectedNodes.size}`; return; }
    if (selection.size === 0) return;
    status.textContent = `Выделено: ${selection.size}`;
  }

  function copySelection() {
    if (simulateMode) return;
    if (selection.size === 0) return;
    const selectedArr = components.filter(c => selection.has(c));
    if (selectedArr.length === 0) return;

    const indexMap = new Map();
    selectedArr.forEach((c, i) => indexMap.set(c, i));

    clipboard = selectedArr.map(c => {
      const copy = {};
      for (const k of Object.keys(c)) {
        if (k === 'endA' || k === 'endB') {
          const ref = c[k];
          if (ref && ref.comp && indexMap.has(ref.comp)) {
            copy[k] = { compIndex: indexMap.get(ref.comp), pinId: ref.pinId };
          } else copy[k] = null;
        } else if (k === 'points') {
          copy[k] = c[k].map(p => ({ x: p.x, y: p.y }));
        } else if (k.startsWith('_')) continue;
        else copy[k] = c[k];
      }
      return copy;
    });

    if (clipboard.length === 0) return;

    let minX = Infinity, minY = Infinity;
    for (const c of clipboard) {
      if (isWire(c)) {
        if (c.points) for (const p of c.points) {
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
        }
      } else {
        if (c.x < minX) minX = c.x;
        if (c.y < minY) minY = c.y;
      }
    }
    if (!isFinite(minX)) minX = 0;
    if (!isFinite(minY)) minY = 0;
    pasteOrigin = { x: minX, y: minY };

    pasteMode = true;
    if (activeTool) { activeTool = null; syncToolUI(); }
    status.textContent = `Скопировано: ${clipboard.length} объект(ов).`;
    render();
  }

  function cutSelection() {
    if (simulateMode) return;
    if (selection.size === 0) return;
    copySelection();
    if (clipboard.length === 0) return;
    pushHistory();

    const toDelete = new Set(selection);
    for (const c of [...toDelete]) {
      const i = components.indexOf(c);
      if (i !== -1) components.splice(i, 1);
    }
    for (let i = components.length - 1; i >= 0; i--) {
      const c = components[i];
      if (!isWire(c)) continue;
      if ((c.endA && toDelete.has(c.endA.comp)) ||
          (c.endB && toDelete.has(c.endB.comp))) components.splice(i, 1);
    }

    selection.clear();
    clearNodeSelection();
    _circuitCache.value = '';
    status.textContent = `Вырезано: ${clipboard.length} объект(ов).`;
    render();
  }

  function cancelPasteMode() {
    if (!pasteMode) return;
    pasteMode = false;
    syncToolUI();
    render();
  }

  function pasteAt(px, py) {
    if (simulateMode) return;
    if (clipboard.length === 0) return;
    pushHistory();
    const shiftX = px - pasteOrigin.x;
    const shiftY = py - pasteOrigin.y;

    const newComps = clipboard.map(src => {
      const copy = {};
      for (const k of Object.keys(src)) {
        if (k === 'endA' || k === 'endB') continue;
        if (k === 'points') copy[k] = src[k].map(p => ({ x: p.x + shiftX, y: p.y + shiftY }));
        else if (k === 'x') copy[k] = roundPx(src[k] + shiftX);
        else if (k === 'y') copy[k] = roundPx(src[k] + shiftY);
        else if (k.startsWith('_')) continue;
        else copy[k] = src[k];
      }
      copy.endA = null; copy.endB = null;

      if (copy.type === 'lamp') { copy.lit = false; copy.brightness = 0; copy.burned = false; }
      if (copy.type === 'resistor' || copy.type === 'potentiometer' || copy.type === 'mosfet') {
        copy.burned = false; copy.dissipatedPower = 0;
        copy._smoke = []; copy._smokeSpawnAcc = 0;
      }
      if (copy.type === 'mosfet') { copy._Vg = 0; copy._Vs = 0; }
      if (copy.type === 'relay') {
        copy.burned = false;
        copy._Icoil = 0;
        copy._energized = false;
        copy._contacts = 'nc';
        copy._manual = false;
      }
      if (copy.type === 'buzzer') {
        copy.buzzFreq = 0;
        copy.buzzVol = 0;
      }
      if (copy.type === 'sevensegment') {
        if (!copy.segments) copy.segments = { a:0,b:0,c:0,d:0,e:0,f:0,g:0,dp:0 };
      }
      if (copy.type === 'multimeter') copy.display = '— — —';
      if (copy.type === 'wire') {
        copy.ax = copy.points[0].x; copy.ay = copy.points[0].y;
        const last = copy.points.length - 1;
        copy.bx = copy.points[last].x; copy.by = copy.points[last].y;
      }
      return copy;
    });

    clipboard.forEach((src, i) => {
      for (const k of ['endA', 'endB']) {
        const ref = src[k];
        if (ref && typeof ref.compIndex === 'number' &&
            ref.compIndex >= 0 && ref.compIndex < newComps.length) {
          newComps[i][k] = { comp: newComps[ref.compIndex], pinId: ref.pinId };
        }
      }
    });

    for (const c of newComps) components.push(c);
    selection.clear();
    for (const c of newComps) selection.add(c);
    _circuitCache.value = '';
    status.textContent = `Вставлено: ${newComps.length} объект(ов).`;
    render();
  }

  function rotateSelection(deltaDeg) {
    if (simulateMode) return;
    if (selection.size === 0) return;
    const rotatables = [...selection].filter(c => !isWire(c));
    if (rotatables.length === 0) return;
    pushHistory();
    for (const c of rotatables) {
      const cur = getRotation(c);
      let next = (cur + deltaDeg) % 360;
      if (next < 0) next += 360;
      c.rotation = next;
    }
    render();
    status.textContent = `Повёрнуто на ${deltaDeg > 0 ? '+' : ''}${deltaDeg}°: ${rotatables.length} объект(ов)`;
  }

  // =========================================================================
  //  ОБЩИЕ ФУНКЦИИ
  // =========================================================================
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = workspace.clientWidth;
    const h = workspace.clientHeight;
    canvas.width  = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render();
    if (window.__sketchEditor && typeof window.__sketchEditor.layout === 'function') {
      try { window.__sketchEditor.layout(); } catch (e) {}
    }
  }

  function setTool(tool) {
    if (simulateMode) return;
    activeTool = (activeTool === tool) ? null : tool;
    wireDraft = null;
    clearNodeSelection();
    if (activeTool) {
      clearSelection();
      cancelPasteMode();
      closePropsPanel();
    }
    syncToolUI();
    render();
  }

  function clearTool() {
    if (activeTool === null) return;
    activeTool = null;
    syncToolUI();
    render();
  }

  function syncOrthoUI() {
    if (btnOrtho) {
      btnOrtho.classList.toggle('active', orthoWires);
      btnOrtho.innerHTML = '<span class="icon">∠</span> Ортогональные: ' + (orthoWires ? 'вкл' : 'выкл');
    }
  }
  function syncSnapUI() {
    if (btnSnap) {
      btnSnap.classList.toggle('active', snapNodes);
      btnSnap.innerHTML = '<span class="icon">⌖</span> Магнит узлов: ' + (snapNodes ? 'вкл' : 'выкл');
    }
  }
  function toggleOrthoWires() {
    orthoWires = !orthoWires;
    syncOrthoUI();
    status.textContent = orthoWires ? 'Ортогональные провода: ВКЛ' : 'Ортогональные провода: выкл';
    render();
  }
  function toggleSnapNodes() {
    snapNodes = !snapNodes;
    syncSnapUI();
    status.textContent = snapNodes ? 'Магнитное выравнивание узлов: ВКЛ' : 'Магнитное выравнивание узлов: выкл';
    render();
  }

  function syncToolUI() {
    btnBattery.classList.toggle('active',       activeTool === 'battery' && !simulateMode);
    btnBattery15.classList.toggle('active',     activeTool === 'battery15' && !simulateMode);
    btnLamp.classList.toggle('active',          activeTool === 'lamp' && !simulateMode);
    if (btnArduino) btnArduino.classList.toggle('active', activeTool === 'arduino' && !simulateMode);
    btnResistor.classList.toggle('active',      activeTool === 'resistor' && !simulateMode);
    btnPotentiometer.classList.toggle('active', activeTool === 'potentiometer' && !simulateMode);
    btnSwitch.classList.toggle('active',        activeTool === 'switch' && !simulateMode);
    btnMultimeter.classList.toggle('active',    activeTool === 'multimeter' && !simulateMode);
    if (btnMosfet) btnMosfet.classList.toggle('active', activeTool === 'mosfet' && !simulateMode);
    if (btnSevenSegment) btnSevenSegment.classList.toggle('active', activeTool === 'sevensegment' && !simulateMode);
    if (btnRelay) btnRelay.classList.toggle('active', activeTool === 'relay' && !simulateMode);
    if (btnBuzzer) btnBuzzer.classList.toggle('active', activeTool === 'buzzer' && !simulateMode);
    btnSim.classList.toggle('active',           simulateMode);

    if (simulateMode) { workspace.style.cursor = 'default'; return; }
    if (isPanning) { workspace.style.cursor = 'grabbing'; return; }
    if (!isDraggingSelection && !lasso && !draggingWireNode && !draggingWireSegment &&
        !draggingWireEndpoint && !draggingPotWiper) {
      if (pasteMode) workspace.style.cursor = 'copy';
      else if (activeTool) workspace.style.cursor = 'crosshair';
      else workspace.style.cursor = 'default';
    }
  }

  function createComponent(type, x, y) {
    const spec = registry[type];
    if (!spec) return null;
    const base = Object.assign({}, spec.defaults || {});
    base.x = roundPx(x);
    base.y = roundPx(y);
    base.rotation = 0;
    if (type === 'wire') base.points = [{ x: base.x, y: base.y }, { x: base.x, y: base.y }];
    if (type === 'mosfet') { if (base._Vg === undefined) base._Vg = 0; if (base._Vs === undefined) base._Vs = 0; }
    if (type === 'sevensegment') {
      if (!base.segments) base.segments = { a:0,b:0,c:0,d:0,e:0,f:0,g:0,dp:0 };
    }
    if (type === 'relay') {
      if (base._Icoil === undefined) base._Icoil = 0;
      if (base._energized === undefined) base._energized = false;
      if (base._contacts === undefined) base._contacts = 'nc';
      if (base._manual === undefined) base._manual = false;
    }
    if (type === 'buzzer') {
      if (base.buzzFreq === undefined) base.buzzFreq = 0;
      if (base.buzzVol === undefined) base.buzzVol = 0;
    }
    return base;
  }

  function cancelAllModes() {
    if (isDraggingSelection) { isDraggingSelection = false; dragStart.clear(); history.transaction = null; }
    if (draggingWireNode) draggingWireNode = null;
    if (draggingWireSegment) draggingWireSegment = null;
    if (draggingWireEndpoint) draggingWireEndpoint = null;
    if (draggingPotWiper) draggingPotWiper = null;
    if (isPanning) { isPanning = false; syncToolUI(); }
    lasso = null; lassoBaseSelection = null;
    wireDraft = null;
    cancelPasteMode();
    clearTool();
    clearSelection();
    clearNodeSelection();
    syncToolUI();
    render();
  }

  function toLocal(e) {
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    return { x: screenX / zoom + panX, y: screenY / zoom + panY };
  }

  function onWheelZoom(e) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldX = screenX / zoom + panX;
    const worldY = screenY / zoom + panY;
    const delta = -Math.sign(e.deltaY);
    const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * (1 + delta * ZOOM_STEP)));
    if (newZoom === zoom) return;
    zoom = newZoom;
    panX = worldX - screenX / zoom;
    panY = worldY - screenY / zoom;
    render();
    status.textContent = `Масштаб: ${(zoom * 100).toFixed(0)}%`;
  }

  canvas.addEventListener('wheel', onWheelZoom, { passive: false });
  workspace.addEventListener('wheel', onWheelZoom, { passive: false });
  workspace.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });

  // =========================================================================
  //  МЫШЬ — mousemove
  // =========================================================================
  workspace.addEventListener('mousemove', (e) => {
    if (window._sketchPanelDragging) return;
    lastMouseEvent = e;
    const p = toLocal(e);
    mouse.x = p.x; mouse.y = p.y; mouse.inside = true;

    if (isPanning) {
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      panX = panStartPan.x - (screenX - panStart.x) / zoom;
      panY = panStartPan.y - (screenY - panStart.y) / zoom;
      status.textContent = `Панорамирование: panX=${panX.toFixed(0)}, panY=${panY.toFixed(0)}`;
      render();
      return;
    }

    if (draggingPotWiper) {
      draggingPotWiper.comp.wiper = wiperFromMouse(draggingPotWiper.comp, p.x, p.y);
      _circuitCache.value = '';
      render();
      return;
    }

    if (draggingWireSegment) {
      const wire = draggingWireSegment.wire;
      const j = draggingWireSegment.segIndex;
      const pts = getWirePoints(wire);
      const a = pts[j], b = pts[j + 1];
      if (draggingWireSegment.isHorizontal) {
        const dY = (p.y - draggingWireSegment.offsetY) - draggingWireSegment.startY;
        a.y = draggingWireSegment.aStartY + dY;
        b.y = draggingWireSegment.bStartY + dY;
      } else {
        const dX = (p.x - draggingWireSegment.offsetX) - draggingWireSegment.startX;
        a.x = draggingWireSegment.aStartX + dX;
        b.x = draggingWireSegment.bStartX + dX;
      }
      _circuitCache.value = '';
      render();
      return;
    }

    if (draggingWireEndpoint) {
      const wire = draggingWireEndpoint.wire;
      const pts = getWirePoints(wire);
      const isA = draggingWireEndpoint.endpoint === 'A';
      const pinHit = Render.findPinAt(renderContext(), p.x, p.y);
      let endX = p.x, endY = p.y;
      if (pinHit) {
        const w = pinWorld(pinHit.comp, pinHit.pin);
        endX = w.x; endY = w.y;
        hoveredPin = pinHit;
      } else hoveredPin = null;

      if (isA) { pts[0].x = endX; pts[0].y = endY; wire.ax = endX; wire.ay = endY; }
      else { const last = pts.length - 1; pts[last].x = endX; pts[last].y = endY; wire.bx = endX; wire.by = endY; }
      _circuitCache.value = '';
      render();
      return;
    }

    if (draggingWireNode) {
      const wire = draggingWireNode.wire;
      const idx = draggingWireNode.nodeIndex;
      const pts = getWirePoints(wire);
      if (pts[idx]) {
        let rawX = p.x - draggingWireNode.offsetX;
        let rawY = p.y - draggingWireNode.offsetY;
        const invert = e.shiftKey;
        const effectiveSnap = snapNodes !== invert;
        if (effectiveSnap) {
          const snapped = applyNodeSnap(wire, rawX, rawY, idx, null);
          rawX = snapped.x; rawY = snapped.y;
        }
        const dx = rawX - draggingWireNode.startX;
        const dy = rawY - draggingWireNode.startY;
        pts[idx].x = rawX; pts[idx].y = rawY;
        for (const n of draggingWireNode.multiNodes || []) {
          if (n.wire === wire && n.nodeIndex === idx) continue;
          const p2 = getWirePoints(n.wire);
          if (p2[n.nodeIndex]) {
            p2[n.nodeIndex].x = n.startX + dx;
            p2[n.nodeIndex].y = n.startY + dy;
          }
        }
      }
      _circuitCache.value = '';
      render();
      return;
    }

    if (isDraggingSelection) {
      const dx = p.x - dragStartMouse.x;
      const dy = p.y - dragStartMouse.y;
      for (const [c, start] of dragStart) {
        if (start.kind === 'wire') {
          const pts = getWirePoints(c);
          for (let i = 0; i < pts.length; i++) {
            pts[i].x = start.points[i].x + dx;
            pts[i].y = start.points[i].y + dy;
          }
          c.ax = pts[0].x; c.ay = pts[0].y;
          const last = pts.length - 1;
          c.bx = pts[last].x; c.by = pts[last].y;
        } else {
          c.x = roundPx(start.x + dx);
          c.y = roundPx(start.y + dy);
        }
      }
      hoveredPin = null;
      _circuitCache.value = '';
      status.textContent = `Перетаскивание: ${selection.size} объект(ов)`;
      render();
      return;
    }

    if (lasso) {
      lasso.x1 = p.x; lasso.y1 = p.y;
      applyLasso();
      hoveredPin = null;
      status.textContent = `Рамка: ${selection.size} объект(ов)`;
      render();
      return;
    }

    if (pasteMode) {
      hoveredPin = null;
      status.textContent = `Режим вставки: ${clipboard.length} объект(ов). ЛКМ — вставить`;
      render();
      return;
    }

    if (simulateMode) {
      hoveredPin = Render.findPinAt(renderContext(), p.x, p.y);
      status.textContent = 'Моделирование (клик — выделить, Esc — выход, СКМ — панорамирование)';
      render();
      return;
    }

    hoveredPin = Render.findPinAt(renderContext(), p.x, p.y);

    if (wireDraft) {
      let hint = 'Провод: ведите курсор к другому выводу';
      if (hoveredPin && !(hoveredPin.comp === wireDraft.from.comp && hoveredPin.pin.id === wireDraft.from.pinId)) {
        hint = 'Провод: отпустите ЛКМ на этом выводе, чтобы соединить';
      }
      status.textContent = hint;
    } else {
      status.textContent =
        `Курсор: ${Math.round(p.x)}, ${Math.round(p.y)}` +
        ` | Масштаб: ${(zoom * 100).toFixed(0)}%` +
        (orthoWires ? ' | Ортогональные: ВКЛ' : '') +
        (snapNodes ? ' | Магнит узлов: ВКЛ' : '') +
        (selection.size > 0 ? ` | Выделено: ${selection.size}` : '');
    }
    render();
  });

  workspace.addEventListener('mouseleave', () => {
    mouse.inside = false;
    hoveredPin = null;
    render();
  });

  // =========================================================================
  //  МЫШЬ — mousedown
  // =========================================================================
  workspace.addEventListener('mousedown', (e) => {
    if (window._sketchPanelDragging) return;
    const p = toLocal(e);
    const RC = renderContext();

    if (e.button === 1) {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      isPanning = true;
      panStart.x = e.clientX - rect.left;
      panStart.y = e.clientY - rect.top;
      panStartPan.x = panX; panStartPan.y = panY;
      workspace.style.cursor = 'grabbing';
      return;
    }

    if (e.button === 2) {
      e.preventDefault();
      if (selectedNodes.size > 0 && !simulateMode) {
        for (const n of selectedNodes) {
          const pts = getWirePoints(n.wire);
          const p0 = pts[n.nodeIndex];
          if (p0 && Math.hypot(p.x - p0.x, p.y - p0.y) <= NODE_HIT) {
            deleteSelectedNodes();
            return;
          }
        }
      }
      const noActiveModes = !activeTool && !pasteMode && !wireDraft && !isDraggingSelection &&
                            !draggingWireNode && !draggingWireSegment && !draggingWireEndpoint &&
                            !draggingPotWiper && !lasso && !isPanning;
      if (noActiveModes && !simulateMode) {
        const comp = Render.hitTestComponent(RC, p.x, p.y);
        if (comp) {
          pushHistory();
          comp.rotation = (getRotation(comp) + 90) % 360;
          selectOnly(comp);
          return;
        }
      }
      cancelAllModes();
      return;
    }

    if (e.button !== 0) return;

    if (simulateMode) {
      const hit = Render.hitTest(RC, p.x, p.y);
      const additive = e.shiftKey || e.ctrlKey || e.metaKey;
      if (!hit) {
        if (!additive) selection.clear();
        lassoBaseSelection = new Set(selection);
        lassoAdditive = additive;
        lasso = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
        workspace.style.cursor = 'crosshair';
        render();
        return;
      }
      if (hit.type === 'multimeter') {
        const spec = getSpec(hit);
        if (spec && typeof spec.hitButton === 'function') {
          const btn = spec.hitButton.call(spec, p.x - hit.x, p.y - hit.y);
          if (btn) { hit.mode = btn; render(); return; }
        }
      }
      if (hit.type === 'switch') {
        hit.closed = !hit.closed;
        _circuitCache.value = '';
        render();
        return;
      }
      if (hit.type === 'relay' && e.altKey) {
        const wasOn = !!hit._energized;
        hit._manual = !hit._manual;
        hit._energized = hit._manual;
        hit._contacts = hit._manual ? 'no' : 'nc';
        if (hit._energized !== wasOn && !hit.burned) {
          window.SchematicApp.audio.playRelayClick(hit._energized);
        }
        _circuitCache.value = '';
        render();
        return;
      }
      if (hit.type === 'potentiometer') {
        pushHistory();
        hit.wiper = wiperFromMouse(hit, p.x, p.y);
        _circuitCache.value = '';
        draggingPotWiper = { comp: hit };
        workspace.style.cursor = 'grabbing';
        render();
        return;
      }
      if (additive) { toggleSelection(hit); return; }
      if (!selection.has(hit)) selectOnly(hit);
      return;
    }

    if (pasteMode) { pasteAt(p.x, p.y); return; }

    if (activeTool) {
      const c = createComponent(activeTool, p.x, p.y);
      if (c) { pushHistory(); components.push(c); _circuitCache.value = ''; render(); }
      return;
    }

    {
      const nodeUnderCursor = findWireNodeAt(p.x, p.y);
      if (!nodeUnderCursor) {
        const segHit = findMovableSegmentAt(p.x, p.y);
        if (segHit) {
          const wire = segHit.wire;
          const j = segHit.segIndex;
          const pts = getWirePoints(wire);
          const a = pts[j], b = pts[j + 1];
          draggingWireSegment = {
            wire, segIndex: j, startX: p.x, startY: p.y,
            offsetX: p.x - (a.x + b.x) / 2,
            offsetY: p.y - (a.y + b.y) / 2,
            aStartX: a.x, aStartY: a.y, bStartX: b.x, bStartY: b.y,
            isHorizontal: segHit.isHorizontal,
          };
          pushHistory();
          workspace.style.cursor = segHit.isHorizontal ? 'ns-resize' : 'ew-resize';
          render();
          return;
        }
      }
    }

    {
      const ep = findWireEndpointAt(p.x, p.y);
      if (ep) {
        const wire = ep.wire;
        const pts = getWirePoints(wire);
        const isA = ep.endpoint === 'A';
        const anchorPt = isA ? pts[0] : pts[pts.length - 1];
        pushHistory();
        if (isA) wire.endA = null; else wire.endB = null;
        draggingWireEndpoint = { wire, endpoint: ep.endpoint, anchorPt };
        workspace.style.cursor = 'crosshair';
        render();
        return;
      }
    }

    const nodeHit = findWireNodeAt(p.x, p.y);
    if (nodeHit) {
      const pts = getWirePoints(nodeHit.wire);
      const additive = e.shiftKey || e.ctrlKey || e.metaKey;
      if (additive) {
        if (isNodeSelected(nodeHit.wire, nodeHit.nodeIndex)) {
          for (const n of [...selectedNodes]) {
            if (n.wire === nodeHit.wire && n.nodeIndex === nodeHit.nodeIndex) { selectedNodes.delete(n); break; }
          }
        } else addNodeToSelection(nodeHit.wire, nodeHit.nodeIndex);
        activeNode = { wire: nodeHit.wire, nodeIndex: nodeHit.nodeIndex };
        render();
        return;
      }
      if (!isNodeSelected(nodeHit.wire, nodeHit.nodeIndex)) {
        clearNodeSelection();
        addNodeToSelection(nodeHit.wire, nodeHit.nodeIndex);
      }
      activeNode = { wire: nodeHit.wire, nodeIndex: nodeHit.nodeIndex };
      const startX = pts[nodeHit.nodeIndex].x;
      const startY = pts[nodeHit.nodeIndex].y;
      const multiNodes = [];
      for (const n of selectedNodes) {
        const p2 = getWirePoints(n.wire);
        const q = p2[n.nodeIndex];
        if (q) multiNodes.push({ wire: n.wire, nodeIndex: n.nodeIndex, startX: q.x, startY: q.y });
      }
      draggingWireNode = {
        wire: nodeHit.wire, nodeIndex: nodeHit.nodeIndex,
        offsetX: p.x - startX, offsetY: p.y - startY,
        startX, startY, multiNodes,
      };
      pushHistory();
      workspace.style.cursor = 'move';
      render();
      return;
    } else clearNodeSelection();

    {
      const now = performance.now();
      const isDouble = (now - lastClickTime) < 350 &&
                       Math.hypot(p.x - lastClickPos.x, p.y - lastClickPos.y) < 12;
      lastClickTime = now;
      lastClickPos = { x: p.x, y: p.y };
      if (isDouble) {
        const comp = Render.hitTestComponent(RC, p.x, p.y);
        if (comp) {
          if (comp.type === 'arduino') { SketchPanel.open(sketchContext()); return; }
          openPropsPanel(comp);
          selectOnly(comp);
          return;
        }
        const wireHit = Render.hitTestWire(RC, p.x, p.y);
        if (wireHit) { addNodeOnWireAt(wireHit, p.x, p.y); render(); return; }
      }
    }

    {
      const mc = Render.hitTestComponent(RC, p.x, p.y);
      if (mc && mc.type === 'multimeter') {
        const spec = getSpec(mc);
        if (spec && typeof spec.hitButton === 'function') {
          const btn = spec.hitButton.call(spec, p.x - mc.x, p.y - mc.y);
          if (btn) { pushHistory(); mc.mode = btn; render(); return; }
        }
      }
    }

    {
      const comp = Render.hitTestComponent(RC, p.x, p.y);
      if (comp && comp.type === 'potentiometer') {
        const spec = getSpec(comp);
        const isShaft = spec && typeof spec.hitShaft === 'function' &&
                        spec.hitShaft.call(spec, p.x - comp.x, p.y - comp.y);
        const pinHere = Render.findPinAt(RC, p.x, p.y);
        if (isShaft && !pinHere) {
          pushHistory();
          comp.wiper = wiperFromMouse(comp, p.x, p.y);
          _circuitCache.value = '';
          draggingPotWiper = { comp };
          workspace.style.cursor = 'grabbing';
          render();
          return;
        }
      }
    }

    const pinHit = Render.findPinAt(RC, p.x, p.y);
    if (pinHit) {
      wireDraft = { from: { comp: pinHit.comp, pinId: pinHit.pin.id } };
      render();
      return;
    }

    const hit = Render.hitTest(RC, p.x, p.y);
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;

    if (!hit) {
      if (!additive) selection.clear();
      lassoBaseSelection = new Set(selection);
      lassoAdditive = additive;
      lasso = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
      workspace.style.cursor = 'crosshair';
      render();
      return;
    }

    if (additive) { toggleSelection(hit); return; }
    if (!selection.has(hit)) selectOnly(hit);

    const anyComp = [...selection].some(c => !isWire(c));
    if (!anyComp) {
      status.textContent = 'Переместить провод можно за сегмент между двумя перпендикулярными проводами.';
      render();
      return;
    }

    isDraggingSelection = true;
    dragStartMouse.x = p.x;
    dragStartMouse.y = p.y;
    dragStart.clear();
    for (const c of selection) {
      if (isWire(c)) {
        const pts = getWirePoints(c);
        dragStart.set(c, { kind: 'wire', points: pts.map(q => ({ x: q.x, y: q.y })) });
      } else {
        dragStart.set(c, { kind: 'comp', x: c.x, y: c.y });
      }
    }
    History.beginTransaction(historyContext());
    workspace.style.cursor = 'move';
  });

  // =========================================================================
  //  МЫШЬ — mouseup
  // =========================================================================
  window.addEventListener('mouseup', (e) => {
    if (window._sketchPanelDragging) return;

    if (isPanning && (e.button === 1 || e.button === 0)) {
      isPanning = false;
      workspace.style.cursor = 'default';
      syncToolUI();
      render();
      return;
    }
    if (draggingPotWiper) {
      draggingPotWiper = null;
      workspace.style.cursor = 'default';
      syncToolUI();
      render();
      return;
    }
    if (draggingWireSegment) {
      draggingWireSegment = null;
      workspace.style.cursor = 'default';
      syncToolUI();
      render();
      return;
    }

    if (draggingWireEndpoint) {
      const wire = draggingWireEndpoint.wire;
      const pts = getWirePoints(wire);
      const isA = draggingWireEndpoint.endpoint === 'A';
      const pinHit = mouse.inside ? Render.findPinAt(renderContext(), mouse.x, mouse.y) : null;
      if (pinHit) {
        const w = pinWorld(pinHit.comp, pinHit.pin);
        if (isA) {
          wire.endA = { comp: pinHit.comp, pinId: pinHit.pin.id };
          pts[0].x = w.x; pts[0].y = w.y;
          wire.ax = w.x; wire.ay = w.y;
        } else {
          const last = pts.length - 1;
          wire.endB = { comp: pinHit.comp, pinId: pinHit.pin.id };
          pts[last].x = w.x; pts[last].y = w.y;
          wire.bx = w.x; wire.by = w.y;
        }
      }
      draggingWireEndpoint = null;
      hoveredPin = null;
      workspace.style.cursor = 'default';
      _circuitCache.value = '';
      syncToolUI();
      render();
      return;
    }

    if (draggingWireNode) {
      draggingWireNode = null;
      workspace.style.cursor = 'default';
      syncToolUI();
      render();
      return;
    }
    if (wireDraft) {
      const p = mouse.inside ? { x: mouse.x, y: mouse.y } : null;
      const hit = p ? Render.findPinAt(renderContext(), p.x, p.y) : null;
      if (hit && !(hit.comp === wireDraft.from.comp && hit.pin.id === wireDraft.from.pinId)) {
        pushHistory();
        const from = wireDraft.from;
        const to   = { comp: hit.comp, pinId: hit.pin.id };
        const pinFrom = findPinById(from.comp, from.pinId);
        const wFrom = pinWorld(from.comp, pinFrom);
        const pinTo = findPinById(to.comp, to.pinId);
        const wTo = pinWorld(to.comp, pinTo);

        const color = pickWireColor(from.comp, pinFrom);
        let pts;
        if (orthoWires) {
          pts = buildOrthoPath(wFrom, wTo, e.shiftKey ? 'vh' : 'hv');
        } else {
          pts = [{ x: wFrom.x, y: wFrom.y }, { x: wTo.x, y: wTo.y }];
        }
        components.push({
          type: 'wire',
          endA: { comp: from.comp, pinId: from.pinId },
          endB: { comp: to.comp, pinId: to.pinId },
          points: pts.map(q => ({ x: q.x, y: q.y })),
          ax: wFrom.x, ay: wFrom.y, bx: wTo.x, by: wTo.y,
          color: color
        });
        _circuitCache.value = '';
      }
      wireDraft = null;
      render();
      return;
    }
    if (isDraggingSelection) {
      isDraggingSelection = false;
      History.commitTransaction(historyContext());
      dragStart.clear();
      syncToolUI();
      render();
    }
    if (lasso) {
      lasso = null;
      lassoBaseSelection = null;
      syncToolUI();
      render();
    }
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  function applyLasso() {
    if (!lasso) return;
    const x = Math.min(lasso.x0, lasso.x1);
    const y = Math.min(lasso.y0, lasso.y1);
    const w = Math.abs(lasso.x1 - lasso.x0);
    const h = Math.abs(lasso.y1 - lasso.y0);
    selection.clear();
    if (lassoAdditive && lassoBaseSelection) {
      for (const c of lassoBaseSelection) selection.add(c);
    }
    const RC = renderContext();
    for (const c of components) {
      if (Render.componentInRect(RC, c, x, y, w, h)) selection.add(c);
    }
    updateSelectionStatus();
  }

  // =========================================================================
  //  КЛАВИАТУРА
  // =========================================================================
  function isEditableFocused() {
    const el = document.activeElement;
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = (el.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (sketchPanel && sketchPanel.contains(el)) return true;
    return false;
  }

  window.addEventListener('keydown', (e) => {
    if (isEditableFocused() && e.key !== 'Escape') return;

    const ctrl = e.ctrlKey || e.metaKey;
    const key  = e.key;

    if (ctrl && !e.shiftKey && (key === 's' || key === 'S' || key === 'ы' || key === 'Ы')) { e.preventDefault(); saveToFile(false); return; }
    if (ctrl && e.shiftKey && (key === 's' || key === 'S' || key === 'ы' || key === 'Ы')) { e.preventDefault(); saveToFile(true); return; }
    if (ctrl && !e.shiftKey && (key === 'o' || key === 'O' || key === 'щ' || key === 'Щ')) { e.preventDefault(); openFile(); return; }
    if (ctrl && !e.shiftKey && (key === 'n' || key === 'N' || key === 'т' || key === 'Т')) { e.preventDefault(); newDocument(); return; }
    if (ctrl && (key === '0' || key === ')' || key === '}')) { e.preventDefault(); zoom = 1; panX = 0; panY = 0; render(); return; }

    if (key === 'Escape') {
      if (SketchPanel.isOpen(sketchContext())) { e.preventDefault(); SketchPanel.close(sketchContext()); return; }
      if (PropsPanel.isOpen(propsContext()))   { e.preventDefault(); closePropsPanel();          return; }
      e.preventDefault(); cancelAllModes(); return;
    }
    if (!ctrl && !simulateMode && (key === 'o' || key === 'O' || key === 'щ' || key === 'Щ')) { e.preventDefault(); toggleOrthoWires(); return; }
    if (!ctrl && !simulateMode && (key === 'm' || key === 'M' || key === 'ь' || key === 'Ь')) { e.preventDefault(); toggleSnapNodes(); return; }
    if (!ctrl && !simulateMode && (key === 'r' || key === 'R' || key === 'к' || key === 'К')) {
      if (selection.size > 0) { e.preventDefault(); rotateSelection(e.shiftKey ? -90 : 90); return; }
    }
    if (ctrl && !e.shiftKey && (key === 'c' || key === 'C' || key === 'с' || key === 'С')) {
      if (simulateMode || activeTool) return;
      if (selectedNodes.size > 0) return;
      e.preventDefault(); copySelection(); return;
    }
    if (ctrl && !e.shiftKey && (key === 'x' || key === 'X' || key === 'ч' || key === 'Ч')) {
      if (simulateMode || activeTool) return;
      if (selectedNodes.size > 0) return;
      e.preventDefault(); cutSelection(); return;
    }
    if (ctrl && !e.shiftKey && (key === 'v' || key === 'V' || key === 'м' || key === 'М')) {
      if (simulateMode || activeTool) return;
      if (selectedNodes.size > 0) return;
      e.preventDefault();
      if (clipboard.length > 0) {
        pasteMode = true;
        status.textContent = `Режим вставки: ${clipboard.length} объект(ов).`;
        syncToolUI(); render();
      }
      return;
    }
    if (ctrl && !e.shiftKey && (key === 'z' || key === 'Z' || key === 'я' || key === 'Я')) {
      if (activeTool) return;
      e.preventDefault(); cancelPasteMode(); undo(); return;
    }
    if (ctrl && e.shiftKey && (key === 'z' || key === 'Z' || key === 'я' || key === 'Я')) {
      if (activeTool) return;
      e.preventDefault(); cancelPasteMode(); redo(); return;
    }
    if (ctrl && (key === 'a' || key === 'A' || key === 'ф' || key === 'Ф')) {
      if (activeTool) return;
      e.preventDefault(); cancelPasteMode();
      clearNodeSelection();
      selection.clear();
      for (const c of components) selection.add(c);
      updateSelectionStatus();
      render();
      return;
    }
    if (key === 'Delete' || key === 'Backspace') {
      if (simulateMode) return;
      if (selectedNodes.size > 0) { e.preventDefault(); deleteSelectedNodes(); return; }
      if (selection.size > 0) {
        e.preventDefault(); pushHistory();
        const toDelete = new Set(selection);
        for (const c of components) {
          if (!isWire(c)) continue;
          if ((c.endA && toDelete.has(c.endA.comp)) ||
              (c.endB && toDelete.has(c.endB.comp))) toDelete.add(c);
        }
        for (const c of toDelete) {
          const i = components.indexOf(c);
          if (i !== -1) components.splice(i, 1);
        }
        selection.clear();
        _circuitCache.value = '';
        render();
      }
    }
  });

  // =========================================================================
  //  ТУЛБАР
  // =========================================================================
  btnBattery.addEventListener('click',       () => setTool('battery'));
  btnBattery15.addEventListener('click',     () => setTool('battery15'));
  btnLamp.addEventListener('click',          () => setTool('lamp'));
  if (btnArduino) btnArduino.addEventListener('click', () => setTool('arduino'));
  btnResistor.addEventListener('click',      () => setTool('resistor'));
  btnPotentiometer.addEventListener('click', () => setTool('potentiometer'));
  btnSwitch.addEventListener('click',        () => setTool('switch'));
  btnMultimeter.addEventListener('click',    () => setTool('multimeter'));
  if (btnMosfet) btnMosfet.addEventListener('click', () => setTool('mosfet'));
  if (btnSevenSegment) btnSevenSegment.addEventListener('click', () => setTool('sevensegment'));
  if (btnRelay) btnRelay.addEventListener('click', () => setTool('relay'));
  if (btnBuzzer) btnBuzzer.addEventListener('click', () => setTool('buzzer'));
  if (btnOrtho) btnOrtho.addEventListener('click', () => toggleOrthoWires());
  if (btnSnap)  btnSnap.addEventListener('click',  () => toggleSnapNodes());

  btnNew.addEventListener('click',    () => newDocument());
  btnOpen.addEventListener('click',   () => openFile());
  btnSave.addEventListener('click',   () => saveToFile(false));
  btnSaveAs.addEventListener('click', () => saveToFile(true));

  fileInput.addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      const text = await f.text();
      applyDocumentFromJSON(text);
      currentFileHandle = null;
      currentFileName = f.name || null;
      status.textContent = `📂 Открыт файл: ${currentFileName}`;
    } catch (err) {
      status.textContent = `❌ Ошибка: ${err.message}`;
      alert('Не удалось прочитать файл: ' + err.message);
    } finally { fileInput.value = ''; }
  });

  btnClear.addEventListener('click', () => {
    if (components.length === 0) return;
    pushHistory();
    components.length = 0;
    resetSelectionStateBeforeLoad();
    closePropsPanel();
    _circuitCache.value = '';
    render();
  });

  btnGrid.addEventListener('click', () => {
    gridVisible = !gridVisible;
    btnGrid.innerHTML = '<span class="icon">▦</span> Сетка: ' + (gridVisible ? 'вкл' : 'выкл');
    render();
  });

  btnSim.addEventListener('click', () => {
    if (!simulateMode) startSimulation();
    else stopSimulation();
    render();
  });

  syncOrthoUI();
  syncSnapUI();

  // =========================================================================
  //  ИНИЦИАЛИЗАЦИЯ ПАНЕЛЕЙ
  // =========================================================================
  PropsPanel.init(propsContext());
  SketchPanel.init(sketchContext());

  btnSketch.addEventListener('click', () => {
    SketchPanel.toggle(sketchContext());
  });

  resize();
})();