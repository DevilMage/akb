/* Топология схемы: DSU по пинам и проводам, индексация узлов.

   Публичный API:
     makeDSU()                       — система непересекающихся множеств
     buildNodes(components, dsu, Geo, getSpec)  — объединить пины
     indexNodes(components, dsu, getSpec)       — пронумеровать узлы
     isPinConnected(components, comp, pinId, Geo, getSpec) — есть ли контакт

   Все данные о компонентах передаются снаружи.
   Регистрируется в window.SchematicApp.netlist.
*/
(function () {
  'use strict';

  window.SchematicApp = window.SchematicApp || {};

  function makeDSU() {
    const parent = new Map();
    function find(x) {
      if (!parent.has(x)) parent.set(x, x);
      if (parent.get(x) !== x) parent.set(x, find(parent.get(x)));
      return parent.get(x);
    }
    function union(a, b) {
      const ra = find(a), rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    }
    return { find, union };
  }

  function buildNodes(components, dsu, Geo, getSpec) {
    const { find, union } = dsu;
    const keyOf = (comp, pinId) => components.indexOf(comp) + ':' + pinId;

    for (const c of components) {
      const spec = getSpec(c);
      if (!spec || !spec.pins) continue;
      for (const p of spec.pins) find(keyOf(c, p.id));
    }

    for (const w of components) {
      if (w.type !== 'wire') continue;
      if (!w.endA || !w.endB) continue;
      if (!w.endA.comp || !w.endB.comp) continue;
      union(keyOf(w.endA.comp, w.endA.pinId),
            keyOf(w.endB.comp, w.endB.pinId));
    }

    // Геометрическое объединение совпадающих пинов
    const geo = [];
    for (const c of components) {
      const spec = getSpec(c);
      if (!spec || !spec.pins) continue;
      for (const p of spec.pins) {
        const w = Geo.pinWorld(c, p);
        geo.push({ id: keyOf(c, p.id), x: w.x, y: w.y });
      }
    }
    for (let i = 0; i < geo.length; i++) {
      for (let j = i + 1; j < geo.length; j++) {
        if (Math.hypot(geo[i].x - geo[j].x, geo[i].y - geo[j].y) < 3.5) {
          union(geo[i].id, geo[j].id);
        }
      }
    }
  }

  function indexNodes(components, dsu, getSpec) {
    const { find } = dsu;
    const keyOf = (comp, pinId) => components.indexOf(comp) + ':' + pinId;
    const nodeMap = new Map();
    const nodeList = [];

    function getNodeId(comp, pinId) {
      const root = find(keyOf(comp, pinId));
      if (!nodeMap.has(root)) {
        nodeMap.set(root, nodeList.length);
        nodeList.push(root);
      }
      return nodeMap.get(root);
    }

    for (const c of components) {
      const spec = getSpec(c);
      if (!spec || !spec.pins) continue;
      for (const p of spec.pins) getNodeId(c, p.id);
    }
    return { getNodeId, N: nodeList.length };
  }

  // Проверяет, подключён ли пин к чему-либо:
  //   либо проводом, либо совпадает с пином другого компонента.
  function isPinConnected(components, comp, pinId, Geo, getSpec) {
    for (const w of components) {
      if (w.type !== 'wire') continue;
      if (w.endA && w.endA.comp === comp && w.endA.pinId === pinId) return true;
      if (w.endB && w.endB.comp === comp && w.endB.pinId === pinId) return true;
    }

    const spec = getSpec(comp);
    if (!spec || !spec.pins) return false;
    const pin = spec.pins.find(p => p.id === pinId);
    if (!pin) return false;
    const w1 = Geo.pinWorld(comp, pin);

    for (const other of components) {
      if (other === comp) continue;
      if (other.type === 'wire') continue;
      const s2 = getSpec(other);
      if (!s2 || !s2.pins) continue;
      for (const p of s2.pins) {
        const w2 = Geo.pinWorld(other, p);
        if (Math.hypot(w1.x - w2.x, w1.y - w2.y) < 0.5) return true;
      }
    }
    return false;
  }

  window.SchematicApp.netlist = {
    makeDSU,
    buildNodes,
    indexNodes,
    isPinConnected
  };
})();