/* Рендер схемы: главная функция render + все вспомогательные рисовалки.

   Публичный API:
     render(ctx)                  — полная перерисовка
     hitTestComponent(ctx, x, y)  — найти компонент
     hitTestWire(ctx, x, y)       — найти провод
     hitTest(ctx, x, y)           — общий тест
     findPinAt(ctx, x, y)         — найти пин
     componentInRect(ctx, ...)    — попадание в прямоугольник
     getWirePoints(wire)          — точки ломаной
     getBounds(ctx, c)            — bbox компонента

   ctx = {
     canvas, ctx: canvas2dCtx, workspace,
     components, selection,
     zoom, panX, panY, gridVisible,
     simulateMode, mouse, activeTool,
     hoveredPin, wireDraft, lastMouseEvent,
     clipboard, pasteMode, pasteOrigin,
     lasso, draggingWireSegment, draggingPotWiper,
     selectedNodes, activeNode,
     CELL,
     registry, getSpec, isWire,
     pinWorld, getRotation, distToSegment,
     drawWireNodes,   // <-- из interaction.js (нужна для оверлеев)
     drawSelectionBox
   }
*/
(function () {
  'use strict';

  window.SchematicApp = window.SchematicApp || {};

  const App = window.SchematicApp;
  const Geo = App.geometry;
  const Snd = App.audio;
  const Physics = App.physics;

  const WIRE_COLORS = ['#e74c3c', '#3498db', '#27ae60', '#f39c12', '#9b59b6', '#16a085', '#e67e22'];
  const ORTHO_COLOR = '#0078d7';

  // ---------------------------------------------------------------------------
  //  Утилиты геометрии
  // ---------------------------------------------------------------------------
  function getWirePoints(wire) {
    if (wire.points && wire.points.length >= 2) return wire.points;
    return [{ x: wire.ax || 0, y: wire.ay || 0 }, { x: wire.bx || 0, y: wire.by || 0 }];
  }

  function getBounds(ctx, c) {
    const spec = ctx.getSpec(c);
    if (!spec) return null;
    if (ctx.isWire(c)) {
      const pts = getWirePoints(c);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const p of pts) {
        x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
        x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
      }
      return { x0, y0, x1, y1 };
    }
    const rot = ctx.getRotation(c);
    const halfW = spec.w / 2 + (spec.hitPadX || 0);
    const halfH = spec.h / 2 + (spec.hitPadY || 0);
    const hw = (rot === 90 || rot === 270) ? halfH : halfW;
    const hh = (rot === 90 || rot === 270) ? halfW : halfH;
    return { x0: c.x - hw, y0: c.y - hh, x1: c.x + hw, y1: c.y + hh };
  }

  function hitTestComponent(ctx, x, y) {
    const { components, getSpec } = ctx;
    for (let i = components.length - 1; i >= 0; i--) {
      const c = components[i];
      if (ctx.isWire(c)) continue;
      const spec = getSpec(c);
      if (!spec) continue;
      const rot = ctx.getRotation(c);
      let dx = x - c.x, dy = y - c.y;
      if (rot === 90)       { const t = dx; dx = dy; dy = -t; }
      else if (rot === 180) { dx = -dx; dy = -dy; }
      else if (rot === 270) { const t = dx; dx = -dy; dy = t; }
      const halfW = spec.w / 2;
      const halfH = spec.h / 2;
      if (Math.abs(dx) <= halfW && Math.abs(dy) <= halfH) return c;
    }
    return null;
  }

  function hitTestWire(ctx, x, y) {
    const { components } = ctx;
    for (let i = components.length - 1; i >= 0; i--) {
      const c = components[i];
      if (!ctx.isWire(c)) continue;
      const pts = getWirePoints(c);
      for (let j = 0; j < pts.length - 1; j++) {
        const a = pts[j], b = pts[j + 1];
        if (ctx.distToSegment(x, y, a.x, a.y, b.x, b.y) <= 4) return c;
      }
    }
    return null;
  }

  function hitTest(ctx, x, y) {
    const comp = hitTestComponent(ctx, x, y);
    if (comp) return comp;
    return hitTestWire(ctx, x, y);
  }

  function findPinAt(ctx, x, y) {
    const { components, getSpec, pinWorld } = ctx;
    const R = 4;
    for (let i = components.length - 1; i >= 0; i--) {
      const c = components[i];
      if (ctx.isWire(c)) continue;
      const spec = getSpec(c);
      if (!spec || !spec.pins) continue;
      for (const pin of spec.pins) {
        const w = pinWorld(c, pin);
        if (Math.hypot(x - w.x, y - w.y) <= R) return { comp: c, pin };
      }
    }
    return null;
  }

  function componentInRect(ctx, c, rx, ry, rw, rh) {
    const b = getBounds(ctx, c);
    if (!b) return false;
    return !(b.x1 < rx || b.x0 > rx + rw || b.y1 < ry || b.y0 > ry + rh);
  }

  // ---------------------------------------------------------------------------
  //  Внутренние рисовалки
  // ---------------------------------------------------------------------------
  function drawComponent(ctx, c) {
    const spec = ctx.getSpec(c);
    if (!spec) return;
    const g = ctx.ctx;
    if (ctx.isWire(c)) {
      g.save(); spec.draw.call(c, g); g.restore();
    } else {
      g.save();
      g.translate(c.x, c.y);
      const rot = ctx.getRotation(c);
      if (rot) g.rotate(rot * Math.PI / 180);
      spec.draw.call(c, g);
      g.restore();
    }
  }

  function pinColor(comp, pin) {
    if (pin && pin.id === 'pos') return { fill: '#d92b2b', glow: 'rgba(217, 43, 43, 0.25)' };
    if (pin && pin.id === 'red') return { fill: '#d92b2b', glow: 'rgba(217, 43, 43, 0.25)' };
    if (pin && pin.id === 'com') return { fill: '#2c3e50', glow: 'rgba(44, 62, 80, 0.25)' };
    return { fill: '#0078d7', glow: 'rgba(0, 120, 215, 0.25)' };
  }

  function drawPinSmall(ctx, comp, pin) {
    const g = ctx.ctx;
    const w = ctx.pinWorld(comp, pin);
    const col = pinColor(comp, pin);
    g.save();
    g.fillStyle = col.fill;
    g.strokeStyle = '#ffffff';
    g.lineWidth = 1;
    g.beginPath();
    g.arc(w.x, w.y, 2.5, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.restore();
  }

  function drawPinHover(ctx, comp, pin) {
    const g = ctx.ctx;
    const w = ctx.pinWorld(comp, pin);
    const col = pinColor(comp, pin);
    g.save();
    g.fillStyle = col.glow;
    g.beginPath();
    g.arc(w.x, w.y, 9, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = col.fill;
    g.strokeStyle = '#ffffff';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(w.x, w.y, 4.5, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.restore();
  }

  function drawToolPreview(ctx) {
    if (!ctx.activeTool || !ctx.mouse.inside) return;
    const spec = ctx.registry[ctx.activeTool];
    if (!spec) return;
    const g = ctx.ctx;
    g.save();
    g.globalAlpha = 0.45;
    g.translate(ctx.mouse.x, ctx.mouse.y);
    spec.draw.call(spec, g);
    g.restore();
  }

  function buildOrthoPath(a, b, mode) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (Math.abs(dx) < 0.5 || Math.abs(dy) < 0.5) {
      return [{ x: a.x, y: a.y }, { x: b.x, y: b.y }];
    }
    if (mode === 'hv') return [{ x: a.x, y: a.y }, { x: b.x, y: a.y }, { x: b.x, y: b.y }];
    return [{ x: a.x, y: a.y }, { x: a.x, y: b.y }, { x: b.x, y: b.y }];
  }

  function drawWireDraft(ctx, e) {
    if (!ctx.wireDraft || !ctx.mouse.inside) return;
    const from = ctx.wireDraft.from;
    const pin = (ctx.getSpec(from.comp)?.pins || []).find(p => p.id === from.pinId);
    if (!pin) return;
    const start = ctx.pinWorld(from.comp, pin);
    const end = { x: ctx.mouse.x, y: ctx.mouse.y };
    const g = ctx.ctx;

    g.save();
    g.strokeStyle = ORTHO_COLOR;
    g.lineWidth = 2;
    g.lineCap = 'round';
    g.setLineDash([6, 4]);
    g.beginPath();

    let previewPts;
    if (ctx.orthoWiresGet()) {
      const shift = !!(e && e.shiftKey);
      previewPts = buildOrthoPath(start, end, shift ? 'vh' : 'hv');
    } else {
      previewPts = [start, end];
    }
    g.moveTo(previewPts[0].x, previewPts[0].y);
    for (let i = 1; i < previewPts.length; i++) g.lineTo(previewPts[i].x, previewPts[i].y);
    g.stroke();
    g.setLineDash([]);

    if (ctx.hoveredPin &&
        !(ctx.hoveredPin.comp === from.comp && ctx.hoveredPin.pin.id === from.pinId)) {
      const p = ctx.pinWorld(ctx.hoveredPin.comp, ctx.hoveredPin.pin);
      const col = pinColor(ctx.hoveredPin.comp, ctx.hoveredPin.pin);
      g.fillStyle = col.fill;
      g.strokeStyle = '#ffffff';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    g.restore();
  }

  function drawPastePreview(ctx) {
    if (!ctx.pasteMode || !ctx.mouse.inside || ctx.clipboard.length === 0) return;
    const g = ctx.ctx;
    const shiftX = ctx.mouse.x - ctx.pasteOrigin.x;
    const shiftY = ctx.mouse.y - ctx.pasteOrigin.y;

    g.save();
    g.globalAlpha = 0.45;
    for (const src of ctx.clipboard) {
      if (src.type === 'wire') continue;
      const spec = ctx.registry[src.type];
      if (!spec) continue;
      g.save();
      g.translate(src.x + shiftX, src.y + shiftY);
      const rot = ctx.getRotation(src);
      if (rot) g.rotate(rot * Math.PI / 180);
      spec.draw.call(src, g);
      g.restore();
    }
    for (const src of ctx.clipboard) {
      if (src.type !== 'wire') continue;
      if (!src.points || src.points.length < 2) continue;
      g.save();
      g.strokeStyle = src.color || WIRE_COLORS[0];
      g.lineWidth = 3;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(src.points[0].x + shiftX, src.points[0].y + shiftY);
      for (let i = 1; i < src.points.length; i++) {
        g.lineTo(src.points[i].x + shiftX, src.points[i].y + shiftY);
      }
      g.stroke();
      g.restore();
    }
    g.restore();

    g.fillStyle = 'rgba(0, 160, 60, 0.9)';
    g.beginPath();
    g.arc(ctx.mouse.x, ctx.mouse.y, 3, 0, Math.PI * 2);
    g.fill();
  }

  function drawSelectionBox(ctx, c) {
    const b = getBounds(ctx, c);
    if (!b) return;
    const g = ctx.ctx;
    const pad = 4;
    const x = b.x0 - pad, y = b.y0 - pad;
    const w = (b.x1 - b.x0) + pad * 2;
    const h = (b.y1 - b.y0) + pad * 2;
    g.save();
    g.strokeStyle = 'rgba(0, 120, 215, 0.9)';
    g.lineWidth = 1;
    g.setLineDash([5, 4]);
    g.strokeRect(x + 0.5, y + 0.5, w, h);
    g.setLineDash([]);
    const l = 6;
    g.strokeStyle = '#0078d7';
    g.lineWidth = 2;
    const corners = [
      [x, y, 1, 1], [x + w, y, -1, 1],
      [x, y + h, 1, -1], [x + w, y + h, -1, -1]
    ];
    for (const [cx, cy, sx, sy] of corners) {
      g.beginPath();
      g.moveTo(cx + sx * l, cy);
      g.lineTo(cx, cy);
      g.lineTo(cx, cy + sy * l);
      g.stroke();
    }
    g.restore();
  }

  function drawLasso(ctx) {
    if (!ctx.lasso) return;
    const g = ctx.ctx;
    const x = Math.min(ctx.lasso.x0, ctx.lasso.x1);
    const y = Math.min(ctx.lasso.y0, ctx.lasso.y1);
    const w = Math.abs(ctx.lasso.x1 - ctx.lasso.x0);
    const h = Math.abs(ctx.lasso.y1 - ctx.lasso.y0);
    g.save();
    g.fillStyle = 'rgba(0, 120, 215, 0.08)';
    g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(0, 120, 215, 0.9)';
    g.lineWidth = 1;
    g.setLineDash([6, 4]);
    g.strokeRect(x + 0.5, y + 0.5, w, h);
    g.setLineDash([]);
    g.restore();
  }

  function drawDraggingWireSegment(ctx) {
    if (!ctx.draggingWireSegment) return;
    const wire = ctx.draggingWireSegment.wire;
    const j = ctx.draggingWireSegment.segIndex;
    const pts = getWirePoints(wire);
    if (!pts[j] || !pts[j + 1]) return;
    const g = ctx.ctx;
    g.save();
    g.strokeStyle = 'rgba(0, 120, 215, 0.5)';
    g.lineWidth = 12;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(pts[j].x, pts[j].y);
    g.lineTo(pts[j + 1].x, pts[j + 1].y);
    g.stroke();
    g.restore();
  }

  function refreshWireGeometry(ctx) {
    const { components, getSpec, pinWorld } = ctx;
    for (const c of components) {
      if (!ctx.isWire(c)) continue;
      if (!c.points || c.points.length < 2) {
        c.points = [
          { x: c.ax || 0, y: c.ay || 0 },
          { x: c.bx || 0, y: c.by || 0 }
        ];
      }
      if (c.endA && c.endA.comp) {
        const spec = getSpec(c.endA.comp);
        const pin = spec && spec.pins
          ? spec.pins.find(p => p.id === c.endA.pinId) : null;
        if (pin) {
          const w = pinWorld(c.endA.comp, pin);
          c.points[0].x = w.x; c.points[0].y = w.y;
          c.ax = w.x; c.ay = w.y;
        }
      }
      if (c.endB && c.endB.comp) {
        const spec = getSpec(c.endB.comp);
        const pin = spec && spec.pins
          ? spec.pins.find(p => p.id === c.endB.pinId) : null;
        if (pin) {
          const w = pinWorld(c.endB.comp, pin);
          const last = c.points.length - 1;
          c.points[last].x = w.x; c.points[last].y = w.y;
          c.bx = w.x; c.by = w.y;
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  //  Главный render
  // ---------------------------------------------------------------------------
  function render(ctx) {
    const now = performance.now();
    const dt = ctx.lastRenderTime.value
      ? Math.min(0.05, (now - ctx.lastRenderTime.value) / 1000)
      : 0.016;
    ctx.lastRenderTime.value = now;

    if (window.ArduinoBoard) window.ArduinoBoard.refresh(ctx.components);

    const g = ctx.ctx;
    const w = ctx.workspace.clientWidth;
    const h = ctx.workspace.clientHeight;
    g.clearRect(0, 0, w, h);

    ctx.workspace.style.backgroundImage = ctx.gridVisibleGet() ? '' : 'none';

    g.save();
    g.scale(ctx.zoomGet(), ctx.zoomGet());
    g.translate(-ctx.panXGet(), -ctx.panYGet());

    refreshWireGeometry(ctx);
    Physics.computeLit(ctx.solverContext());

    const arduinoComp = ctx.components.find(c => c.type === 'arduino');
    if (arduinoComp && arduinoComp.pinStates && window.ArduinoBoard) {
      for (const pinId in arduinoComp.pinStates) {
        const st = arduinoComp.pinStates[pinId];
        if (st.mode === 'OUTPUT') window.ArduinoBoard.applyOutput(pinId, st);
      }
    }

    let smokeActive = false;
    for (const c of ctx.components) {
      if ((c.type === 'resistor' || c.type === 'potentiometer' || c.type === 'mosfet') && c.burned) {
        const spec = ctx.registry[c.type];
        if (spec && typeof spec.updateSmoke === 'function') {
          spec.updateSmoke.call(c, dt);
          if (c._smoke && c._smoke.length > 0) smokeActive = true;
        }
      }
    }

    for (const c of ctx.components) {
      if (ctx.isWire(c)) {
        c._selected = ctx.selection.has(c);
        c._color = c.color || WIRE_COLORS[0];
      }
    }

    for (const c of ctx.components) if (!ctx.isWire(c) && c.type === 'arduino') drawComponent(ctx, c);
    for (const c of ctx.components) if (ctx.isWire(c)) drawComponent(ctx, c);
    for (const c of ctx.components) if (!ctx.isWire(c) && c.type !== 'arduino') drawComponent(ctx, c);

    for (const c of ctx.components) {
      if (!ctx.isWire(c)) continue;
      for (const ref of [c.endA, c.endB]) {
        if (!ref || !ref.comp) continue;
        if (ref.comp.type === 'arduino') continue;
        const spec = ctx.getSpec(ref.comp);
        const pin = spec && spec.pins
          ? spec.pins.find(p => p.id === ref.pinId) : null;
        if (!pin) continue;
        drawPinSmall(ctx, ref.comp, pin);
      }
    }

    drawDraggingWireSegment(ctx);

    for (const c of ctx.components) if (ctx.isWire(c)) ctx.drawWireNodes(c);
    for (const c of ctx.selection) if (!ctx.isWire(c)) drawSelectionBox(ctx, c);

    if (ctx.hoveredPin) {
      drawPinHover(ctx, ctx.hoveredPin.comp, ctx.hoveredPin.pin);
      if (ctx.hoveredPin.comp.type === 'arduino') {
        const spec = ctx.registry.arduino;
        if (spec && typeof spec.drawPinTooltip === 'function') {
          g.save();
          g.translate(ctx.hoveredPin.comp.x, ctx.hoveredPin.comp.y);
          const rot = ctx.getRotation(ctx.hoveredPin.comp);
          if (rot) g.rotate(rot * Math.PI / 180);
          spec.drawPinTooltip.call(spec, g, ctx.hoveredPin.comp, ctx.hoveredPin.pin.id);
          g.restore();
        }
      }
    }

    if (ctx.mouse.inside && ctx.activeTool) {
      const sx = ctx.mouse.x, sy = ctx.mouse.y;
      g.fillStyle = 'rgba(0, 120, 215, 0.9)';
      g.beginPath();
      g.arc(sx, sy, 3, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(0, 120, 215, 0.35)';
      g.lineWidth = 1;
      g.strokeRect(sx - ctx.CELL / 2, sy - ctx.CELL / 2, ctx.CELL, ctx.CELL);
    }

    drawToolPreview(ctx);
    drawWireDraft(ctx, ctx.lastMouseEvent);
    drawPastePreview(ctx);
    drawLasso(ctx);

    for (const c of ctx.components) {
      if ((c.type === 'resistor' || c.type === 'potentiometer' || c.type === 'mosfet') && c.burned) {
        const spec = ctx.registry[c.type];
        if (spec && typeof spec.drawSmoke === 'function') spec.drawSmoke.call(c, g);
      }
    }

    g.restore();

    const arduinoRunning = window.ArduinoRuntime && window.ArduinoRuntime.running;
    if (smokeActive || arduinoRunning) {
      requestAnimationFrame(() => render(ctx));
    }
  }

  window.SchematicApp.render = {
    render,
    hitTestComponent,
    hitTestWire,
    hitTest,
    findPinAt,
    componentInRect,
    getWirePoints,
    getBounds,
    buildOrthoPath,
    drawSelectionBox,
    drawLasso,
    refreshWireGeometry
  };
})();