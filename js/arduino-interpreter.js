/* Интерпретатор AST C++-подобного скетча Arduino — НЕБЛОКИРУЮЩИЙ. */
(function () {
  'use strict';

  function createInterpreter() {
    const state = {
      running: false, stopped: false, functions: {}, api: null,
      setupDone: false, loopFn: null, stepBudget: 1e6, stepCounter: 0, _pendingGen: null
    };

    const scopes = [];
    function pushScope() { scopes.push(Object.create(scopes[scopes.length - 1] || null)); }
    function popScope() { scopes.pop(); }
    function defineVar(name, value, isConst) {
      const scope = scopes[scopes.length - 1];
      if (!scope) throw { message: 'нет области видимости' };
      scope[name] = { value, isConst: !!isConst };
    }
    function lookupVar(name) {
      for (let i = scopes.length - 1; i >= 0; i--) {
        if (Object.prototype.hasOwnProperty.call(scopes[i], name)) return scopes[i][name];
      }
      return null;
    }
    function defaultFor(t) {
      if (t === 'int' || t === 'long' || t === 'byte' || t === 'char') return 0;
      if (t === 'float') return 0;
      if (t === 'bool') return false;
      return null;
    }
    function isTruthy(v) {
      if (v === null || v === undefined || v === false || v === 0 || v === '') return false;
      return true;
    }

    function* execBlock(node) {
      for (const stmt of node.body) {
        yield* execStatement(stmt);
        if (state.stopped) return;
      }
    }

    function* execStatement(node) {
      if (state.stopped) return;
      state.stepCounter++;
      if (state.stepCounter > state.stepBudget) throw { message: 'превышен лимит шагов — возможно, бесконечный цикл' };

      switch (node.type) {
        case 'block':
          pushScope(); try { yield* execBlock(node); } finally { popScope(); } return;
        case 'exprstmt':
          yield* evalExpr(node.expr); return;
        case 'vardecl': {
          let value;
          if (node.init) value = yield* evalExpr(node.init);
          else if (node.isArray) {
            let size = 0;
            if (node.arraySize) size = Number(yield* evalExpr(node.arraySize)) || 0;
            value = new Array(size).fill(defaultFor(node.varType));
          } else value = defaultFor(node.varType);
          defineVar(node.name, value, node.isConst);
          return;
        }
        case 'assign': {
          const target = node.target;
          if (target.type !== 'id' && target.type !== 'index') throw { message: 'слева от «=» должна быть переменная или элемент массива' };
          if (target.type === 'index') {
            const arrVal = yield* evalExpr(target.object);
            const idx = yield* evalExpr(target.index);
            const rhs = yield* evalExpr(node.value);
            if (!Array.isArray(arrVal)) throw { message: 'индексация только для массива' };
            if (node.op === '=') arrVal[idx] = rhs;
            else if (node.op === '+=') arrVal[idx] = arrVal[idx] + rhs;
            else if (node.op === '-=') arrVal[idx] = arrVal[idx] - rhs;
            else if (node.op === '*=') arrVal[idx] = arrVal[idx] * rhs;
            else if (node.op === '/=') arrVal[idx] = arrVal[idx] / rhs;
            return;
          }
          const cur = lookupVar(target.name);
          if (!cur) throw { message: `переменная «${target.name}» не объявлена` };
          const rhs = yield* evalExpr(node.value);
          if (node.op === '=') cur.value = rhs;
          else if (node.op === '+=') cur.value = cur.value + rhs;
          else if (node.op === '-=') cur.value = cur.value - rhs;
          else if (node.op === '*=') cur.value = cur.value * rhs;
          else if (node.op === '/=') cur.value = cur.value / rhs;
          return;
        }
        case 'if': {
          const cond = yield* evalExpr(node.cond);
          if (isTruthy(cond)) yield* execStatement(node.then);
          else if (node.else) yield* execStatement(node.else);
          return;
        }
        case 'while': {
          while (isTruthy(yield* evalExpr(node.cond))) {
            if (state.stopped) return;
            try { yield* execStatement(node.body); }
            catch (e) { if (e && e.__break) break; if (e && e.__continue) continue; throw e; }
            state.stepCounter++;
            if (state.stepCounter > state.stepBudget) throw { message: 'превышен лимит шагов' };
          }
          return;
        }
        case 'for': {
          pushScope();
          try {
            if (node.init) yield* execStatement(node.init);
            while (node.cond ? isTruthy(yield* evalExpr(node.cond)) : true) {
              if (state.stopped) return;
              try { yield* execStatement(node.body); }
              catch (e) { if (e && e.__break) break; if (e && e.__continue) { } else throw e; }
              if (node.update) yield* evalExpr(node.update);
              state.stepCounter++;
              if (state.stepCounter > state.stepBudget) throw { message: 'превышен лимит шагов' };
            }
          } finally { popScope(); }
          return;
        }
        case 'return': {
          const val = node.arg ? (yield* evalExpr(node.arg)) : null;
          throw { __return: true, value: val };
        }
        case 'break': throw { __break: true };
        case 'continue': throw { __continue: true };
        case 'funcdecl': state.functions[node.name] = node; return;
        default: throw { message: `неизвестный тип инструкции: ${node.type}` };
      }
    }

    function* evalExpr(node) {
      if (state.stopped) return null;
      switch (node.type) {
        case 'number': return node.value;
        case 'string': return node.value;
        case 'bool': return node.value;
        case 'array': {
          const arr = [];
          for (const el of node.elements) arr.push(yield* evalExpr(el));
          return arr;
        }
        case 'id': {
          const v = lookupVar(node.name);
          if (v) return v.value;
          if (state.api && Object.prototype.hasOwnProperty.call(state.api, node.name)) return state.api[node.name];
          throw { message: `переменная «${node.name}» не объявлена` };
        }
        case 'unop': {
          const operandVal = yield* evalExpr(node.operand);
          if (node.op === '!') return !isTruthy(operandVal);
          if (node.op === '-') return -operandVal;
          if (node.op === '+') return +operandVal;
          throw { message: `неизвестный унарный оператор: ${node.op}` };
        }
        case 'binop': {
          const op = node.op;
          if (op === '&&') { const l = yield* evalExpr(node.left); return isTruthy(l) ? (yield* evalExpr(node.right)) : l; }
          if (op === '||') { const l = yield* evalExpr(node.left); return isTruthy(l) ? l : (yield* evalExpr(node.right)); }
          const a = yield* evalExpr(node.left);
          const b = yield* evalExpr(node.right);
          switch (op) {
            case '+': return a + b;
            case '-': return a - b;
            case '*': return a * b;
            case '/': return b === 0 ? 0 : a / b;
            case '%': return b === 0 ? 0 : a % b;
            case '==': return a == b;
            case '!=': return a != b;
            case '<': return a < b;
            case '>': return a > b;
            case '<=': return a <= b;
            case '>=': return a >= b;
            default: throw { message: `неизвестный оператор: ${op}` };
          }
        }
        case 'member': {
          const obj = yield* evalExpr(node.object);
          if (obj == null) throw { message: `обращение к «${node.property}» у неопределённого объекта` };
          return obj[node.property];
        }
        case 'call': {
          if (node.callee.type === 'id' && node.callee.name === 'delay') {
            const args = [];
            for (const argNode of node.args) args.push(yield* evalExpr(argNode));
            const ms = Math.max(0, Math.min(60000, Number(args[0]) || 0));
            yield { __delay: ms }; return null;
          }
          const args = [];
          for (const argNode of node.args) args.push(yield* evalExpr(argNode));
          if (node.callee.type === 'id') {
            const name = node.callee.name;
            if (state.functions[name]) return yield* callUserFunction(name, args);
            if (state.api && typeof state.api[name] === 'function') return state.api[name].apply(state.api, args);
            throw { message: `функция «${name}» не определена` };
          }
          if (node.callee.type === 'member') {
            const obj = yield* evalExpr(node.callee.object);
            const prop = node.callee.property;
            if (obj == null) throw { message: `обращение к «${prop}» у неопределённого объекта` };
            if (typeof obj[prop] === 'function') return obj[prop].apply(obj, args);
            throw { message: `у объекта нет метода «${prop}»` };
          }
          throw { message: 'вызов должен быть по имени функции или методу объекта' };
        }
        case 'index': {
          const obj = yield* evalExpr(node.object);
          const idx = yield* evalExpr(node.index);
          if (!Array.isArray(obj)) throw { message: 'индексация применима только к массивам' };
          return obj[idx];
        }
        case 'incdec': {
          const target = node.target;
          if (target.type !== 'id' && target.type !== 'index') throw { message: 'инкремент/декремент только к переменной или элементу массива' };
          const delta = node.op === '++' ? 1 : -1;
          if (target.type === 'index') {
            const arrVal = yield* evalExpr(target.object);
            const idx = yield* evalExpr(target.index);
            if (!Array.isArray(arrVal)) throw { message: 'индексация только для массива' };
            if (node.prefix) { arrVal[idx] += delta; return arrVal[idx]; }
            else { const old = arrVal[idx]; arrVal[idx] += delta; return old; }
          }
          const cur = lookupVar(target.name);
          if (!cur) throw { message: `переменная «${target.name}» не объявлена` };
          if (node.prefix) { cur.value += delta; return cur.value; }
          else { const old = cur.value; cur.value += delta; return old; }
        }
        default: throw { message: `неизвестный тип выражения: ${node.type}` };
      }
    }

    function* callUserFunction(name, args) {
      const fn = state.functions[name];
      pushScope();
      try {
        for (let i = 0; i < fn.params.length; i++) {
          defineVar(fn.params[i].name, args[i] !== undefined ? args[i] : defaultFor(fn.params[i].type), false);
        }
        try { yield* execBlock(fn.body); }
        catch (e) { if (e && e.__return) return e.value; throw e; }
        return null;
      } finally { popScope(); }
    }

    function driveGenerator(gen) {
      let next = gen.next();
      while (!next.done) {
        const val = next.value;
        if (val && typeof val.__delay === 'number') { state._pendingGen = gen; return { __delay: val.__delay }; }
        next = gen.next();
      }
      state._pendingGen = null; return null;
    }

    function run(ast, api) {
      state.running = true; state.stopped = false; state.functions = {}; state.api = api;
      state.setupDone = false; state.loopFn = null; state.stepCounter = 0; state._pendingGen = null;
      scopes.length = 0; pushScope();

      for (const stmt of ast.body) if (stmt.type === 'funcdecl') state.functions[stmt.name] = stmt;

      try {
        for (const stmt of ast.body) {
          if (stmt.type === 'vardecl') {
            const gen = execStatement(stmt);
            let next = gen.next();
            while (!next.done) next = gen.next();
          }
        }
      } catch (e) {
        state.running = false;
        return { ok: false, error: 'ошибка в глобальных переменных: ' + (e.message || String(e)) };
      }

      const loopFn = state.functions['loop'];
      if (!loopFn) { state.running = false; return { ok: false, error: 'в скетче нет функции loop()' }; }
      state.loopFn = loopFn;
      return { ok: true };
    }

    function stepLoop() {
      if (!state.running || state.stopped) return { __stopped: true };
      if (state._pendingGen) return driveGenerator(state._pendingGen);
      if (!state.setupDone) {
        state.setupDone = true;
        if (state.functions['setup']) {
          const gen = callUserFunction('setup', []);
          const result = driveGenerator(gen);
          if (result && result.__stopped) return result;
          if (result && result.__delay !== undefined) return result;
        }
      }
      const gen = callUserFunction('loop', []);
      return driveGenerator(gen);
    }

    function hasPending() { return !!state._pendingGen; }
    function stop() { state.running = false; state.stopped = true; state._pendingGen = null; }
    function isRunning() { return state.running && !state.stopped; }

    return { run, stepLoop, hasPending, stop, isRunning };
  }

  window.ArduinoInterpreter = { createInterpreter };
})();