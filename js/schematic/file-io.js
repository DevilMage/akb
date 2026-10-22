/* Файловые операции: сохранение, открытие, новый документ.

   Публичный API:
     buildDocument(ctx)             — сериализовать схему в объект
     documentToJSON(ctx)            — JSON-строка
     save(ctx, forceDialog)         — сохранить
     open(ctx)                      — открыть
     applyDocumentFromJSON(ctx, text) — применить загруженный JSON
     newDocument(ctx)               — новая схема

   ctx = {
     components, orthoWires: {get,set}, snapNodes: {get,set},
     getSketchCode, setSketchCode,
     history, cache,
     getCurrentFile,               // () => { handle, name }
     setCurrentFile,               // (handle, name) => void
     status,                       // HTMLElement | { textContent }
     fileInput,                    // HTMLInputElement
     pushHistoryFn,                // () => void (обычно History.push(ctx))
     resetAfterLoad,               // () => void (очистить выделение и т.п.)
     syncOrthoUI, syncSnapUI,      // () => void
     closePropsPanel,
     render
   }
*/
(function () {
  'use strict';

  window.SchematicApp = window.SchematicApp || {};

  const FSA_SUPPORTED =
    typeof window !== 'undefined' &&
    typeof window.showSaveFilePicker === 'function' &&
    typeof window.showOpenFilePicker === 'function';

  function buildDocument(ctx) {
    return {
      format: 'schematic-sim',
      version: 1,
      savedAt: new Date().toISOString(),
      orthoWires: ctx.orthoWires.get(),
      snapNodes: ctx.snapNodes.get(),
      sketch: ctx.getSketchCode(),
      components: ctx.components.map(c => {
        const copy = {};
        for (const k of Object.keys(c)) {
          if (k === 'endA' || k === 'endB') {
            const ref = c[k];
            copy[k] = ref
              ? { compIndex: ctx.components.indexOf(ref.comp), pinId: ref.pinId }
              : null;
          } else if (k === 'points') {
            copy[k] = c[k].map(p => ({ x: p.x, y: p.y }));
          } else if (k.startsWith('_')) continue;
          else copy[k] = c[k];
        }
        return copy;
      })
    };
  }

  function documentToJSON(ctx) {
    return JSON.stringify(buildDocument(ctx), null, 2);
  }

  function defaultFileName() {
    const ts = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `schematic_${ts.getFullYear()}-${pad(ts.getMonth() + 1)}-${pad(ts.getDate())}` +
           `_${pad(ts.getHours())}-${pad(ts.getMinutes())}-${pad(ts.getSeconds())}.json`;
  }

  function downloadFallback(text, name) {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function save(ctx, forceDialog) {
    if (ctx.components.length === 0) {
      ctx.status.textContent = '💾 Нечего сохранять: схема пуста.';
      return;
    }
    const json = documentToJSON(ctx);
    const current = ctx.getCurrentFile();

    if (current.handle && !forceDialog) {
      try {
        const writable = await current.handle.createWritable();
        await writable.write(json);
        await writable.close();
        ctx.status.textContent = `💾 Сохранено: ${current.name}`;
        return;
      } catch (err) { console.warn('Не удалось записать в файл:', err); }
    }

    if (FSA_SUPPORTED) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: current.name || defaultFileName(),
          types: [{ description: 'Схема (JSON)', accept: { 'application/json': ['.json'] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
        ctx.setCurrentFile(handle, handle.name || defaultFileName());
        ctx.status.textContent = `💾 Сохранено: ${handle.name}`;
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') {
          ctx.status.textContent = '💾 Сохранение отменено.';
          return;
        }
        console.warn('showSaveFilePicker не сработал:', err);
      }
    }

    const name = current.name || defaultFileName();
    downloadFallback(json, name);
    ctx.setCurrentFile(null, name);
    ctx.status.textContent = `💾 Скачано: ${name}`;
  }

  async function open(ctx) {
    if (FSA_SUPPORTED) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{ description: 'Схема (JSON)', accept: { 'application/json': ['.json'] } }],
          multiple: false
        });
        const file = await handle.getFile();
        const text = await file.text();
        applyDocumentFromJSON(ctx, text);
        ctx.setCurrentFile(handle, handle.name || null);
        ctx.status.textContent = `📂 Открыт файл: ${handle.name} (${ctx.components.length} объект(ов))`;
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') {
          ctx.status.textContent = '📂 Открытие отменено.';
          return;
        }
        console.warn('showOpenFilePicker не сработал:', err);
      }
    }
    ctx.fileInput.value = '';
    ctx.fileInput.click();
  }

  function applyDocumentFromJSON(ctx, text) {
    let doc;
    try { doc = JSON.parse(text); }
    catch (err) {
      ctx.status.textContent = `❌ Неверный JSON: ${err.message}`;
      alert('Не удалось открыть файл: ' + err.message);
      return;
    }
    if (!doc || !Array.isArray(doc.components)) {
      ctx.status.textContent = '❌ Неверный формат файла (нет components).';
      alert('Неверный формат файла.');
      return;
    }

    if (typeof ctx.pushHistoryFn === 'function') ctx.pushHistoryFn();

    const newComps = doc.components.map(src => {
      const copy = {};
      for (const k of Object.keys(src)) {
        if (k === 'endA' || k === 'endB') continue;
        if (k === 'points') copy[k] = src[k].map(p => ({ x: p.x, y: p.y }));
        else copy[k] = src[k];
      }
      copy.endA = null; copy.endB = null;
      return copy;
    });

    doc.components.forEach((src, i) => {
      for (const k of ['endA', 'endB']) {
        const ref = src[k];
        if (ref && typeof ref.compIndex === 'number' &&
            ref.compIndex >= 0 && ref.compIndex < newComps.length) {
          newComps[i][k] = { comp: newComps[ref.compIndex], pinId: ref.pinId };
        }
      }
    });

    ctx.components.length = 0;
    for (const c of newComps) ctx.components.push(c);

    for (const c of ctx.components) {
      if (c.type === 'lamp') {
        c.lit = false; c.brightness = 0;
        if (c.burned === undefined) c.burned = false;
      }
      if (c.type === 'led') { c.lit = false; c.reverse = false; }
      if (c.type === 'resistor' || c.type === 'potentiometer' || c.type === 'mosfet') {
        c.dissipatedPower = 0; c._smoke = []; c._smokeSpawnAcc = 0;
      }
      if (c.type === 'mosfet') {
        if (c._Vg === undefined) c._Vg = 0;
        if (c._Vs === undefined) c._Vs = 0;
        if (c.Vth  === undefined) c.Vth  = 2.0;
        if (c.Vov  === undefined) c.Vov  = 5.0;
        if (c.Ron  === undefined) c.Ron  = 0.044;
        if (c.Roff === undefined) c.Roff = 1e9;
        if (c.Pmax === undefined) c.Pmax = 40;
      }
      if (c.type === 'sevensegment') {
        if (c.commonType === undefined) c.commonType = 'cathode';
        if (!c.segments) c.segments = { a:0,b:0,c:0,d:0,e:0,f:0,g:0,dp:0 };
      }
      if (c.type === 'multimeter') c.display = '— — —';

      if (c.type === 'wire') {
        if (!c.points || c.points.length < 2) {
          c.points = [
            { x: c.ax || 0, y: c.ay || 0 },
            { x: c.bx || 0, y: c.by || 0 }
          ];
        }
      }
    }

    if (typeof doc.orthoWires === 'boolean') {
      ctx.orthoWires.set(doc.orthoWires);
      if (ctx.syncOrthoUI) ctx.syncOrthoUI();
    }
    if (typeof doc.snapNodes === 'boolean') {
      ctx.snapNodes.set(doc.snapNodes);
      if (ctx.syncSnapUI) ctx.syncSnapUI();
    }
    if (typeof doc.sketch === 'string') ctx.setSketchCode(doc.sketch);

    if (typeof ctx.resetAfterLoad === 'function') ctx.resetAfterLoad();

    if (ctx.cache) ctx.cache.value = '';
    if (ctx.render) ctx.render();
  }

  function newDocument(ctx) {
    if (ctx.components.length > 0) {
      if (!confirm('Очистить текущую схему и создать новую?')) return;
    }
    if (typeof ctx.pushHistoryFn === 'function') ctx.pushHistoryFn();
    ctx.components.length = 0;
    if (typeof ctx.resetAfterLoad === 'function') ctx.resetAfterLoad();
    ctx.setCurrentFile(null, null);
    if (ctx.cache) ctx.cache.value = '';
    ctx.status.textContent = '📄 Новая схема.';
    if (ctx.render) ctx.render();
  }

  window.SchematicApp.fileIO = {
    FSA_SUPPORTED,
    buildDocument,
    documentToJSON,
    defaultFileName,
    save,
    open,
    applyDocumentFromJSON,
    newDocument
  };
})();