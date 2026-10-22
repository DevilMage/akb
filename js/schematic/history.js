/* История схемы: снимки, undo/redo, сохранение транзакций.

   Публичный API:
     snapshot(ctx)               — сериализовать текущее состояние
     push(ctx)                   — сохранить снапшот в историю
     restore(ctx, snap)          — восстановить состояние
     undo(ctx) / redo(ctx)       — откат/повтор
     sameState(a, b)             — сравнить два снапшота
     beginTransaction(ctx)       — начать транзакцию (для drag)
     commitTransaction(ctx)      — завершить транзакцию
     cancelTransaction(ctx)      — отменить транзакцию

   ctx = {
     components,           // массив компонентов
     history,              // { past:[], future:[], limit, transaction }
     onRestore,            // () => void  (колбэк после restore — сброс кэшей)
     onPropsRefresh,       // () => void  (обновить панель свойств)
     resetSelectionState,  // () => void  (очистить selection, dragging и т.п.)
     cache                 // { value, time } — объект кэша решателя
   }
*/
(function () {
  'use strict';

  window.SchematicApp = window.SchematicApp || {};

  function snapshot(ctx) {
    const { components } = ctx;
    return components.map(c => {
      const copy = {};
      for (const k of Object.keys(c)) {
        if (k === 'endA' || k === 'endB') {
          const ref = c[k];
          copy[k] = ref ? { compIndex: components.indexOf(ref.comp), pinId: ref.pinId } : null;
        } else if (k === 'points') {
          copy[k] = c[k].map(p => ({ x: p.x, y: p.y }));
        } else {
          copy[k] = c[k];
        }
      }
      return copy;
    });
  }

  function push(ctx) {
    const snap = snapshot(ctx);
    ctx.history.past.push(snap);
    if (ctx.history.past.length > ctx.history.limit) ctx.history.past.shift();
    ctx.history.future.length = 0;
  }

  function restore(ctx, snap) {
    const { components } = ctx;

    if (typeof ctx.resetSelectionState === 'function') {
      ctx.resetSelectionState();
    }

    const newComps = snap.map(src => {
      const copy = {};
      for (const k of Object.keys(src)) {
        if (k === 'endA' || k === 'endB') continue;
        if (k === 'points') copy[k] = src[k].map(p => ({ x: p.x, y: p.y }));
        else copy[k] = src[k];
      }
      copy.endA = null; copy.endB = null;
      return copy;
    });

    snap.forEach((src, i) => {
      for (const k of ['endA', 'endB']) {
        const ref = src[k];
        if (ref && ref.compIndex >= 0 && ref.compIndex < newComps.length) {
          newComps[i][k] = { comp: newComps[ref.compIndex], pinId: ref.pinId };
        }
      }
    });

    components.length = 0;
    for (const c of newComps) components.push(c);

    if (ctx.cache) ctx.cache.value = '';

    if (typeof ctx.onPropsRefresh === 'function') ctx.onPropsRefresh();
    if (typeof ctx.onRestore === 'function') ctx.onRestore();
  }

  function undo(ctx) {
    if (ctx.history.past.length === 0) return false;
    const current = snapshot(ctx);
    const prev = ctx.history.past.pop();
    ctx.history.future.push(current);
    restore(ctx, prev);
    return true;
  }

  function redo(ctx) {
    if (ctx.history.future.length === 0) return false;
    const current = snapshot(ctx);
    const next = ctx.history.future.pop();
    ctx.history.past.push(current);
    restore(ctx, next);
    return true;
  }

  function sameState(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      const x = a[i], y = b[i];
      const kx = Object.keys(x), ky = Object.keys(y);
      if (kx.length !== ky.length) return false;
      for (const k of kx) {
        if (k === 'endA' || k === 'endB') {
          const aRef = x[k], bRef = y[k];
          if (aRef === null && bRef === null) continue;
          if (!aRef || !bRef) return false;
          if (aRef.pinId !== bRef.pinId) return false;
          if (aRef.comp !== bRef.comp) return false;
        } else if (k === 'points') {
          if (x[k].length !== y[k].length) return false;
          for (let j = 0; j < x[k].length; j++) {
            if (x[k][j].x !== y[k][j].x || x[k][j].y !== y[k][j].y) return false;
          }
        } else if (x[k] !== y[k]) return false;
      }
    }
    return true;
  }

  function beginTransaction(ctx) {
    ctx.history.transaction = snapshot(ctx);
  }

  function commitTransaction(ctx) {
    if (!ctx.history.transaction) return;
    const before = ctx.history.transaction;
    const after = snapshot(ctx);
    if (!sameState(before, after)) {
      ctx.history.past.push(before);
      if (ctx.history.past.length > ctx.history.limit) ctx.history.past.shift();
      ctx.history.future.length = 0;
    }
    ctx.history.transaction = null;
  }

  function cancelTransaction(ctx) {
    ctx.history.transaction = null;
  }

  window.SchematicApp.history = {
    snapshot,
    push,
    restore,
    undo,
    redo,
    sameState,
    beginTransaction,
    commitTransaction,
    cancelTransaction
  };
})();