/* Виртуальная Arduino-плата — связывает пины компонента Arduino
   с физическими компонентами схемы (резисторы, потенциометры, LED, ключи).

   Использование:
     ArduinoBoard.attach(components);  // вызывается в главном цикле
     ArduinoBoard.readAnalog(pinId);   // вернуть 0..1023
     ArduinoBoard.readDigital(pinId);  // вернуть 0 или 1
     ArduinoBoard.applyOutput(pinId, state); // применить выход

   Работает поверх window.SchematicComponents и window.components.

   ВАЖНО: applyOutput() НЕ выставляет lit/brightness/reverse у лампы и
   светодиода. Эти поля вычисляет решатель схемы в main.js (computeLit)
   на основе фактической разности потенциалов между выводами компонента.
   Иначе лампа/светодиод зажигались бы даже при «висящем в воздухе»
   втором выводе — ток через компонент при этом не течёт.
*/
(function () {
  'use strict';

  const board = {
    _arduino: null,
    _components: null,
    _graph: null
  };

  // Найти компонент Arduino в схеме
  function findArduino(components) {
    return components.find(c => c.type === 'arduino') || null;
  }

  // Для каждого пина — список подключённых компонентов
  // (через соединения в window.components — массив проводов).
  function buildPinGraph(components, arduino) {
    const graph = {};   // pinId → [ компонент, ... ]

    // Находим все провода, которые ведут к пинам Arduino
    for (const c of components) {
      if (c.type !== 'wire') continue;
      if (!c.endA || !c.endB) continue;

      const endA = c.endA;
      const endB = c.endB;

      // Если один из концов — Arduino, запоминаем второй
      let pinId = null;
      let otherComp = null;

      if (endA.comp === arduino && endB.comp !== arduino) {
        pinId = endA.pinId;
        otherComp = endB.comp;
      } else if (endB.comp === arduino && endA.comp !== arduino) {
        pinId = endB.pinId;
        otherComp = endA.comp;
      } else {
        continue;
      }

      if (!pinId || !otherComp) continue;
      if (!graph[pinId]) graph[pinId] = [];
      if (graph[pinId].indexOf(otherComp) === -1) graph[pinId].push(otherComp);
    }

    return graph;
  }

  // Обновить граф (вызывается перед чтением)
  function refresh(components) {
    board._components = components;
    board._arduino = findArduino(components);
    if (!board._arduino) {
      board._graph = null;
      return null;
    }
    board._graph = buildPinGraph(components, board._arduino);
    return board._graph;
  }

  // Чтение аналогового сигнала (0..1023):
  //   - если к пину подключён потенциометр — берём его wiper;
  //   - если это делитель напряжения — считаем по формуле;
  //   - если ничего — 0.
  function readAnalog(pinId) {
    const graph = board._graph;
    if (!graph || !graph[pinId]) return 0;

    for (const comp of graph[pinId]) {
      if (comp.type === 'potentiometer') {
        const w = (comp.wiper !== undefined) ? comp.wiper : 0.5;
        // 0..1 → 0..1023
        return Math.round(Math.max(0, Math.min(1, w)) * 1023);
      }
      // Можно добавить другие датчики
    }
    return 0;
  }

  // Чтение цифрового сигнала (0 или 1):
  //   - если к пину подключён ключ — берём его состояние;
  //   - если кнопка — то же;
  //   - если ничего — 0.
  function readDigital(pinId) {
    const graph = board._graph;
    if (!graph || !graph[pinId]) return 0;

    for (const comp of graph[pinId]) {
      if (comp.type === 'switch') {
        return comp.closed ? 1 : 0;
      }
      if (comp.type === 'potentiometer') {
        // Потенциометр в цифровом режиме — считаем как HIGH, если wiper > 0.5
        return ((comp.wiper || 0) > 0.5) ? 1 : 0;
      }
    }
    return 0;
  }

  // Применить выход Arduino на компоненты схемы.
  //
  // ВАЖНО: lit / brightness / reverse здесь НЕ выставляем.
  // Их вычисляет решатель схемы в main.js (computeLit) на основе
  // фактического напряжения между выводами компонента.
  // Иначе лампа/светодиод зажигались бы даже когда второй вывод
  // «висит в воздухе» — ток через компонент при этом не течёт.
  function applyOutput(pinId, state) {
    // Состояние пина уже сохранено в comp.pinStates вызывающей стороной
    // (arduino-runtime.js). Здесь специально ничего не делаем.
    return;
  }

  // Проверка: подключён ли к пину хотя бы один входной компонент
  function hasInput(pinId) {
    const graph = board._graph;
    if (!graph || !graph[pinId]) return false;
    return graph[pinId].some(c =>
      c.type === 'switch' || c.type === 'potentiometer' || c.type === 'led' || c.type === 'lamp'
    );
  }

  board.refresh     = refresh;
  board.readAnalog  = readAnalog;
  board.readDigital = readDigital;
  board.applyOutput = applyOutput;
  board.hasInput    = hasInput;

  window.ArduinoBoard = board;
})();