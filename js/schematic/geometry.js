/* Геометрия схемы: снап к сетке, повороты, преобразования координат,
   расстояния до отрезков.

   Чистые функции + доступ к CELL через конфиг (setCell).
   Регистрируется в window.SchematicApp.geometry.
*/
(function () {
  'use strict';

  window.SchematicApp = window.SchematicApp || {};

  let CELL = 20;

  function setCell(v) { CELL = v || 20; }
  function getCell() { return CELL; }

  function snap(v) { return Math.round(v / CELL) * CELL; }
  function roundPx(v) { return Math.round(v); }

  function getRotation(c) {
    const r = c && c.rotation;
    if (typeof r !== 'number' || !isFinite(r)) return 0;
    let n = Math.round(r / 90) * 90 % 360;
    if (n < 0) n += 360;
    return n;
  }

  function localToWorld(comp, lx, ly) {
    const rot = getRotation(comp);
    let x = lx, y = ly;
    if (rot === 90)       { x = -ly; y =  lx; }
    else if (rot === 180) { x = -lx; y = -ly; }
    else if (rot === 270) { x =  ly; y = -lx; }
    return { x: comp.x + x, y: comp.y + y };
  }

  function pinWorld(comp, pin) {
    if (!pin || !isFinite(pin.x) || !isFinite(pin.y)) {
      return { x: comp.x, y: comp.y };
    }
    return localToWorld(comp, pin.x, pin.y);
  }

  function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  window.SchematicApp.geometry = {
    setCell,
    getCell,
    snap,
    roundPx,
    getRotation,
    localToWorld,
    pinWorld,
    distToSegment
  };
})();