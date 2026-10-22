/* Arduino IDE: редактор кода (Monaco), панель скетча, консоль,
   компиляция и запуск скетча в симуляторе.

   Все публичные функции принимают ctx первым аргументом.

   ctx = {
     panel, header, closeBtn, verifyBtn, runBtn, stopBtn,
     exampleBtn, clearConsoleBtn, boardSelect,
     editorContainer, codeTextarea, consoleEl, statusEl,
     fileNameEl, boardInfoEl,
     components,
     simulateModeGet, simulateModeSet,
     getAudioCtx, invalidateCache,
     onSimulationStart, onSimulationStop,
     syncToolUI, render,
     compiler, runtime,
     SKETCH_EXAMPLE
   }
*/
(function () {
  'use strict';

  window.SchematicApp = window.SchematicApp || {};

  let sketchEditor = null;
  let _lastLogLength = 0;

  // =========================================================================
  //  Код скетча
  // =========================================================================
  function getCode(ctx) {
    if (sketchEditor) return sketchEditor.getValue();
    if (ctx && ctx.codeTextarea) return ctx.codeTextarea.value;
    return '';
  }

  function setCode(ctx, text) {
    if (sketchEditor) sketchEditor.setValue(text || '');
    else if (ctx && ctx.codeTextarea) ctx.codeTextarea.value = text || '';
  }

  // =========================================================================
  //  Открытие / закрытие
  // =========================================================================
  function open(ctx) {
    if (ctx.panel) {
      ctx.panel.style.left = '';
      ctx.panel.style.top = '';
      ctx.panel.style.right = '';
      ctx.panel.style.transform = '';
      ctx.panel.classList.add('show');
    }
    if (sketchEditor && typeof sketchEditor.layout === 'function') {
      setTimeout(() => sketchEditor.layout(), 50);
    }
  }

  function close(ctx) {
    if (ctx.panel) ctx.panel.classList.remove('show');
  }

  function toggle(ctx) {
    if (ctx.panel.classList.contains('show')) close(ctx);
    else open(ctx);
  }

  function isOpen(ctx) {
    return ctx.panel.classList.contains('show');
  }

  // =========================================================================
  //  Консоль
  // =========================================================================
  function appendConsole(ctx, text, kind) {
    if (!ctx.consoleEl) return;
    const div = document.createElement('div');
    div.className = 'log-' + (kind || 'info');
    div.textContent = text;
    ctx.consoleEl.appendChild(div);
    ctx.consoleEl.scrollTop = ctx.consoleEl.scrollHeight;
  }

  function renderLog(ctx, log) {
    if (!ctx.consoleEl) return;
    if (log.length < _lastLogLength) {
      ctx.consoleEl.innerHTML = '';
      _lastLogLength = 0;
    }
    for (let i = _lastLogLength; i < log.length; i++) {
      const line = log[i];
      const div = document.createElement('div');
      div.className = 'log-' + (line.kind || 'info');
      div.textContent = line.text;
      ctx.consoleEl.appendChild(div);
    }
    while (ctx.consoleEl.children.length > 200) {
      ctx.consoleEl.removeChild(ctx.consoleEl.firstChild);
    }
    _lastLogLength = log.length;
    ctx.consoleEl.scrollTop = ctx.consoleEl.scrollHeight;
  }

  function setStatus(ctx, text) {
    if (ctx.statusEl) ctx.statusEl.textContent = text;
  }

  // =========================================================================
  //  Drag & resize панели
  // =========================================================================
  function initHeaderDrag(ctx) {
    if (!ctx.header) return;
    ctx.header.addEventListener('mousedown', (e) => {
      if (e.target === ctx.closeBtn || (ctx.closeBtn && ctx.closeBtn.contains(e.target))) return;
      e.preventDefault();
      e.stopPropagation();

      const rect = ctx.panel.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;

      document.body.classList.add('sketch-dragging');
      window._sketchPanelDragging = true;

      let rafId = null;
      let lastEv = null;

      function applyMove() {
        rafId = null;
        if (!lastEv) return;
        const ev = lastEv;
        const panelW = ctx.panel.offsetWidth || rect.width;
        const panelH = ctx.panel.offsetHeight || rect.height;

        let newLeft = ev.clientX - offsetX;
        let newTop  = ev.clientY - offsetY;
        const MAX_TOP = window.innerHeight - 60;

        newLeft = Math.max(-panelW + 80, Math.min(window.innerWidth - 80, newLeft));
        newTop  = Math.max(0, Math.min(MAX_TOP, newTop));

        ctx.panel.style.left = newLeft + 'px';
        ctx.panel.style.top = newTop + 'px';
        ctx.panel.style.right = 'auto';
      }

      function onMove(ev) {
        lastEv = ev;
        if (rafId === null) rafId = requestAnimationFrame(applyMove);
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
        document.body.classList.remove('sketch-dragging');
        window._sketchPanelDragging = false;
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  function initResizeHandle(ctx) {
    if (!ctx.panel) return;
    ctx.panel.addEventListener('mousedown', (e) => {
      const rect = ctx.panel.getBoundingClientRect();
      const RESIZE_PAD = 16;
      const inRightBottom =
        (e.clientX >= rect.right - RESIZE_PAD) &&
        (e.clientY >= rect.bottom - RESIZE_PAD);
      if (!inRightBottom) return;

      e.preventDefault();
      e.stopPropagation();

      const startW = rect.width;
      const startH = rect.height;
      const startX = e.clientX;
      const startY = e.clientY;
      const startLeft = rect.left;
      const startTop = rect.top;

      ctx.panel.classList.add('resize-h');
      let rafId = null;
      let lastEv = null;

      function applyResize() {
        rafId = null;
        if (!lastEv) return;
        const ev = lastEv;
        let newW = startW + (ev.clientX - startX);
        let newH = startH + (ev.clientY - startY);
        newW = Math.max(320, Math.min(window.innerWidth - startLeft - 10, newW));
        newH = Math.max(240, Math.min(window.innerHeight - startTop - 10, newH));
        ctx.panel.style.width = newW + 'px';
        ctx.panel.style.height = newH + 'px';
        if (sketchEditor && typeof sketchEditor.layout === 'function') {
          sketchEditor.layout();
        }
      }
      function onMove(ev) {
        lastEv = ev;
        if (rafId === null) rafId = requestAnimationFrame(applyResize);
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
        ctx.panel.classList.remove('resize-h');
        if (sketchEditor && typeof sketchEditor.layout === 'function') {
          sketchEditor.layout();
        }
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  // =========================================================================
  //  Monaco
  // =========================================================================
  function initMonaco(ctx) {
    if (typeof window.monaco === 'undefined') {
      console.warn('[IDE] Monaco не загружен — используется textarea');
      if (ctx.codeTextarea) ctx.codeTextarea.style.display = '';
      return;
    }

    const monaco = window.monaco;
    monaco.languages.register({ id: 'arduino' });
    monaco.languages.setMonarchTokensProvider('arduino', {
      tokenizer: {
        root: [
          [/\b(void|int|float|double|char|bool|byte|word|long|unsigned|const|if|else|for|while|do|switch|case|break|continue|return)\b/, 'keyword'],
          [/\b(HIGH|LOW|INPUT|OUTPUT|INPUT_PULLUP|LED_BUILTIN|true|false)\b/, 'constant'],
          [/\b(delay|pinMode|digitalWrite|digitalRead|analogRead|analogWrite|millis|micros|setup|loop)\b/, 'function'],
          [/\b(Serial|Serial1|Serial2|Serial3)\b/, 'type.identifier'],
          [/\b(begin|print|println|read|write|available)\b/, 'identifier'],
          [/\d+/, 'number'],
          [/"[^"]*"/, 'string'],
          [/\/\/.*$/, 'comment'],
          [/\/\*/, 'comment', '@comment'],
          [/[{}()\[\]]/, 'delimiter'],
          [/[a-zA-Z_]\w*/, 'identifier'],
        ],
        comment: [
          [/[^\/*]+/, 'comment'],
          [/\*\//, 'comment', '@pop'],
          [/[\/*]/, 'comment']
        ]
      }
    });

    monaco.languages.setLanguageConfiguration('arduino', {
      comments: { lineComment: '//', blockComment: ['/*', '*/'] },
      brackets: [['{', '}'], ['[', ']'], ['(', ')']],
      autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: "'", close: "'" }
      ]
    });

    sketchEditor = monaco.editor.create(ctx.editorContainer, {
      value: (ctx.codeTextarea && ctx.codeTextarea.value) ? ctx.codeTextarea.value : ctx.SKETCH_EXAMPLE,
      language: 'arduino',
      theme: 'vs-dark',
      automaticLayout: false,
      fontSize: 14,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      tabSize: 2,
      insertSpaces: true,
      renderWhitespace: 'selection',
      fontFamily: 'Consolas, "Courier New", monospace',
      lineNumbers: 'on',
      selectOnLineNumbers: true,
      lineNumbersMinChars: 3,
      folding: true,
      foldingStrategy: 'indentation',
      showFoldingControls: 'always',
      renderLineHighlight: 'all',
      glyphMargin: false,
      lineDecorationsWidth: 12
    });

    sketchEditor.onDidChangeModelContent(() => {
      if (ctx.codeTextarea) ctx.codeTextarea.value = sketchEditor.getValue();
    });

    window.__sketchEditor = sketchEditor;
  }

  // =========================================================================
  //  Инициализация
  // =========================================================================
  function init(ctx) {
    if (ctx.codeTextarea && !ctx.codeTextarea.value.trim()) {
      ctx.codeTextarea.value = ctx.SKETCH_EXAMPLE;
    }

    if (ctx.runtime && ctx.runtime.api && ctx.runtime.api.LED_BUILTIN === undefined) {
      ctx.runtime.api.LED_BUILTIN = 13;
    }

    // Кнопка «Скетч» в тулбаре — теперь вне модуля; main.js повесит сам
    if (ctx.closeBtn) ctx.closeBtn.addEventListener('click', () => close(ctx));

    if (ctx.panel) {
      const stopBubble = (e) => e.stopPropagation();
      ctx.panel.addEventListener('mousedown', stopBubble);
      ctx.panel.addEventListener('mousemove', stopBubble);
      ctx.panel.addEventListener('mouseup', stopBubble);
      ctx.panel.addEventListener('wheel', stopBubble, { passive: true });
      ctx.panel.addEventListener('contextmenu', (e) => e.preventDefault());
      ctx.panel.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });
    }

    initHeaderDrag(ctx);
    initResizeHandle(ctx);

    if (ctx.runtime) {
      ctx.runtime.onLog = (log) => {
        renderLog(ctx, log);
        const last = log[log.length - 1];
        if (last && last.kind === 'serial') {
          const ard = ctx.components.find(c => c.type === 'arduino');
          if (ard) ard._txFlashUntil = performance.now() + 80;
        }
      };
      ctx.runtime.onStop = () => {
        if (ctx.runBtn)  ctx.runBtn.disabled = false;
        if (ctx.stopBtn) ctx.stopBtn.disabled = true;
        setStatus(ctx, 'Готов');
      };
    }

    // Проверить
    if (ctx.verifyBtn) {
      ctx.verifyBtn.addEventListener('click', () => {
        const src = getCode(ctx);
        if (!src.trim()) { appendConsole(ctx, 'Ошибка: пустой скетч', 'error'); setStatus(ctx, 'Ошибка'); return; }
        if (!ctx.compiler) { appendConsole(ctx, 'Компилятор не загружен', 'error'); return; }
        appendConsole(ctx, 'Компиляция...', 'info');
        setStatus(ctx, 'Компиляция...');
        const result = ctx.compiler.parse(src);
        if (!result.ok) {
          const er = result.error;
          appendConsole(ctx, `Ошибка (строка ${er.line}, столбец ${er.col}): ${er.message}`, 'error');
          setStatus(ctx, 'Ошибка компиляции');
          return;
        }
        appendConsole(ctx, 'Компиляция успешна!', 'success');
        appendConsole(ctx, `Скетч содержит ${src.length} символов`, 'info');
        setStatus(ctx, 'Компиляция успешна');
      });
    }

    // Загрузить
    if (ctx.runBtn) {
      ctx.runBtn.addEventListener('click', () => {
        if (!ctx.runtime) {
          appendConsole(ctx, 'Модуль ArduinoRuntime не загружен.', 'error');
          return;
        }
        const src = getCode(ctx);
        if (!src.trim()) { appendConsole(ctx, 'Ошибка: пустой скетч', 'error'); return; }

        const ard = ctx.components.find(c => c.type === 'arduino');
        if (!ard) { appendConsole(ctx, 'На схеме нет Arduino.', 'error'); setStatus(ctx, 'Нет Arduino'); return; }

        if (!ctx.simulateModeGet()) {
          ctx.simulateModeSet(true);
          ctx.onSimulationStart();
        }

        ctx.runBtn.disabled = true;
        ctx.stopBtn.disabled = false;

        if (ctx.runtime.api && ctx.runtime.api.LED_BUILTIN === undefined) {
          ctx.runtime.api.LED_BUILTIN = 13;
        }

        ctx.invalidateCache();
        _lastLogLength = 0;
        if (ctx.consoleEl) ctx.consoleEl.innerHTML = '';

        try {
          ctx.runtime.start(ard, src);
          appendConsole(ctx, 'Скетч загружен, выполняется...', 'success');
        } catch (e) {
          appendConsole(ctx, 'Ошибка запуска: ' + (e.message || e), 'error');
          ctx.runBtn.disabled = false;
          ctx.stopBtn.disabled = true;
        }
        ctx.render();
      });
    }

    // Стоп
    if (ctx.stopBtn) {
      ctx.stopBtn.addEventListener('click', () => {
        if (ctx.runtime) ctx.runtime.stop();

        if (ctx.simulateModeGet()) {
          ctx.simulateModeSet(false);
          ctx.onSimulationStop();
        }

        ctx.runBtn.disabled = false;
        ctx.stopBtn.disabled = true;
        setStatus(ctx, 'Остановлено');
        ctx.render();
      });
    }

    // Пример
    if (ctx.exampleBtn) {
      ctx.exampleBtn.addEventListener('click', () => {
        if (confirm('Заменить текущий скетч примером?')) {
          setCode(ctx, ctx.SKETCH_EXAMPLE);
          if (ctx.fileNameEl) ctx.fileNameEl.textContent = 'sketch.ino';
          appendConsole(ctx, 'Загружен пример Blink', 'info');
        }
      });
    }

    // Очистить консоль
    if (ctx.clearConsoleBtn) {
      ctx.clearConsoleBtn.addEventListener('click', () => {
        if (ctx.consoleEl) ctx.consoleEl.innerHTML = '';
        _lastLogLength = 0;
        appendConsole(ctx, 'Консоль очищена', 'info');
      });
    }

    // Плата
    if (ctx.boardSelect) {
      ctx.boardSelect.addEventListener('change', () => {
        const b = ctx.boardSelect.value;
        if (ctx.boardInfoEl) ctx.boardInfoEl.textContent = 'Плата: ' + b;
        appendConsole(ctx, 'Выбрана плата: ' + b, 'info');
      });
    }

    // Monaco
    if (typeof window.require !== 'undefined') {
      window.require.config({
        paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.34.1/min/vs' }
      });
      window.require(['vs/editor/editor.main'], function () {
        window.monaco = window.monaco || monaco;
        initMonaco(ctx);
      });
    } else {
      console.warn('[IDE] require.js не найден — Monaco не загружен');
      if (ctx.codeTextarea) ctx.codeTextarea.style.display = '';
    }
  }

  // =========================================================================
  //  API
  // =========================================================================
  window.SchematicApp.sketchPanel = {
    init,
    open,
    close,
    toggle,
    isOpen,
    getCode,
    setCode,
    appendConsole,
    setStatus
  };
})();