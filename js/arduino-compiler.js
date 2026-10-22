/* Компилятор C++-подобного скетча Arduino в AST. */
(function () {
  'use strict';

  const KEYWORDS = new Set([
    'const', 'if','else','while','for','return','true','false','break','continue'
  ]);
  const TYPES = new Set(['int','float','bool','char','long','byte','void']);
  const ID_START = /[A-Za-z_\u0400-\u04FF]/;
  const ID_CONT  = /[A-Za-z0-9_\u0400-\u04FF]/;

  function tokenize(src) {
    const tokens = [];
    let i = 0, line = 1, col = 1;
    const len = src.length;

    function push(type, value) {
      tokens.push({ type, value, line, col });
    }

    function advance(n) {
      for (let k = 0; k < n; k++) {
        if (src[i] === '\n') { line++; col = 1; }
        else { col++; }
        i++;
      }
    }

    while (i < len) {
      const c = src[i];
      if (c === ' ' || c === '\t' || c === '\r' || c === '\n') { advance(1); continue; }
      if (c === '/' && src[i + 1] === '/') { while (i < len && src[i] !== '\n') advance(1); continue; }
      if (c === '/' && src[i + 1] === '*') {
        advance(2);
        while (i < len && !(src[i] === '*' && src[i + 1] === '/')) advance(1);
        if (i < len) advance(2);
        continue;
      }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1]))) {
        const startLine = line, startCol = col;
        let num = '';
        let isFloat = false;
        while (i < len && /[0-9.]/.test(src[i])) {
          if (src[i] === '.') isFloat = true;
          num += src[i]; advance(1);
        }
        while (i < len && /[fFlLuU]/.test(src[i])) advance(1);
        tokens.push({ type: 'number', value: isFloat ? parseFloat(num) : parseInt(num, 10), isFloat, line: startLine, col: startCol });
        continue;
      }
      if (c === '"') {
        const startLine = line, startCol = col;
        advance(1); let s = '';
        while (i < len && src[i] !== '"') {
          if (src[i] === '\\' && i + 1 < len) {
            const esc = src[i + 1];
            s += esc === 'n' ? '\n' : esc === 't' ? '\t' : esc === '\\' ? '\\' : esc === '"' ? '"' : esc;
            advance(2);
          } else { s += src[i]; advance(1); }
        }
        if (i >= len) throw { line: startLine, col: startCol, message: 'незакрытая строка' };
        advance(1);
        tokens.push({ type: 'string', value: s, line: startLine, col: startCol });
        continue;
      }
      if (c === ';' || c === ',' || c === '(' || c === ')' || c === '{' || c === '}' || c === '[' || c === ']' || c === '.') {
        push(c, c); advance(1); continue;
      }
      const two = src.substr(i, 2);
      if (['==','!=','<=','>=','&&','||','+=','-=','*=','/=','++','--'].includes(two)) {
        push('op', two); advance(2); continue;
      }
      if ('+-*/%<>=!&|^'.includes(c)) { push('op', c); advance(1); continue; }
      if (ID_START.test(c)) {
        const startLine = line, startCol = col;
        let id = '';
        while (i < len && ID_CONT.test(src[i])) { id += src[i]; advance(1); }
        if (TYPES.has(id)) push('type', id);
        else if (KEYWORDS.has(id)) push('kw', id);
        else push('id', id);
        tokens[tokens.length - 1].line = startLine;
        tokens[tokens.length - 1].col = startCol;
        continue;
      }
      throw { line, col, message: `неожиданный символ «${c}»` };
    }
    push('eof', null);
    return tokens;
  }

  function parse(src) {
    let tokens;
    try { tokens = tokenize(src); }
    catch (e) { return { ok: false, error: { line: e.line, col: e.col, message: e.message } }; }

    let pos = 0;
    const peek = (k = 0) => tokens[pos + k];
    const next = () => tokens[pos++];

    function expect(type, value) {
      const t = peek();
      if (t.type !== type || (value !== undefined && t.value !== value)) {
        throw { line: t.line, col: t.col, message: `ожидалось ${value !== undefined ? `«${value}»` : type}, получено «${t.value}»` };
      }
      return next();
    }

    function parseExpression() { return parseLogicalOr(); }

    function parseLogicalOr() {
      let left = parseLogicalAnd();
      while (peek().type === 'op' && peek().value === '||') {
        next(); const right = parseLogicalAnd(); left = { type: 'binop', op: '||', left, right };
      }
      return left;
    }
    function parseLogicalAnd() {
      let left = parseEquality();
      while (peek().type === 'op' && peek().value === '&&') {
        next(); const right = parseEquality(); left = { type: 'binop', op: '&&', left, right };
      }
      return left;
    }
    function parseEquality() {
      let left = parseRelational();
      while (peek().type === 'op' && (peek().value === '==' || peek().value === '!=')) {
        const op = next().value; const right = parseRelational(); left = { type: 'binop', op, left, right };
      }
      return left;
    }
    function parseRelational() {
      let left = parseAdditive();
      while (peek().type === 'op' && ['<','>','<=','>='].includes(peek().value)) {
        const op = next().value; const right = parseAdditive(); left = { type: 'binop', op, left, right };
      }
      return left;
    }
    function parseAdditive() {
      let left = parseMultiplicative();
      while (peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
        const op = next().value; const right = parseMultiplicative(); left = { type: 'binop', op, left, right };
      }
      return left;
    }
    function parseMultiplicative() {
      let left = parseUnary();
      while (peek().type === 'op' && ['*','/','%'].includes(peek().value)) {
        const op = next().value; const right = parseUnary(); left = { type: 'binop', op, left, right };
      }
      return left;
    }
    function parseUnary() {
      const t = peek();
      if (t.type === 'op' && (t.value === '!' || t.value === '-' || t.value === '+')) {
        next(); const operand = parseUnary(); return { type: 'unop', op: t.value, operand };
      }
      return parsePostfix();
    }
    function parsePostfix() {
      let expr = parseAtom();
      while (true) {
        const t = peek();
        if (t.type === '.') {
          next(); const propTok = peek();
          if (propTok.type !== 'id') throw { line: propTok.line, col: propTok.col, message: `после «.» ожидалось имя, получено «${propTok.value}»` };
          next(); expr = { type: 'member', object: expr, property: propTok.value }; continue;
        }
        if (t.type === '(') {
          next(); const args = [];
          if (peek().type !== ')') {
            args.push(parseExpression());
            while (peek().type === ',') { next(); args.push(parseExpression()); }
          }
          expect(')'); expr = { type: 'call', callee: expr, args };
        } else if (t.type === '[') {
          next(); const index = parseExpression(); expect(']'); expr = { type: 'index', object: expr, index };
        } else if (t.type === 'op' && (t.value === '++' || t.value === '--')) {
          const op = next().value; expr = { type: 'incdec', op, target: expr, prefix: false };
        } else break;
      }
      return expr;
    }
    function parseAtom() {
      const t = peek();
      if (t.type === 'number') { next(); return { type: 'number', value: t.value, isFloat: t.isFloat }; }
      if (t.type === 'string') { next(); return { type: 'string', value: t.value }; }
      if (t.type === 'kw' && (t.value === 'true' || t.value === 'false')) { next(); return { type: 'bool', value: t.value === 'true' }; }
      if (t.type === 'id') { next(); return { type: 'id', name: t.value }; }
      if (t.type === '(') { next(); const e = parseExpression(); expect(')'); return e; }
      throw { line: t.line, col: t.col, message: `неожиданный токен «${t.value}»` };
    }

    function parseBlock() {
      expect('{'); const body = [];
      while (peek().type !== '}') body.push(parseStatement());
      expect('}'); return { type: 'block', body };
    }

    function parseType() {
      let isConst = false;
      if (peek().type === 'kw' && peek().value === 'const') { next(); isConst = true; }
      const t = peek();
      if (t.type !== 'type') throw { line: t.line, col: t.col, message: `ожидался тип, получено «${t.value}»` };
      next(); return { baseType: t.value, isConst };
    }

    function parseStatement() {
      const t = peek();
      if (t.type === '{') return parseBlock();
      if (t.type === 'kw' && t.value === 'if') {
        next(); expect('('); const cond = parseExpression(); expect(')');
        const then = parseStatement();
        let els = null;
        if (peek().type === 'kw' && peek().value === 'else') { next(); els = parseStatement(); }
        return { type: 'if', cond, then, else: els };
      }
      if (t.type === 'kw' && t.value === 'while') {
        next(); expect('('); const cond = parseExpression(); expect(')');
        const body = parseStatement(); return { type: 'while', cond, body };
      }
      if (t.type === 'kw' && t.value === 'for') {
        next(); expect('(');
        let init = null;
        if (peek().type !== ';') {
          if (peek().type === 'type' || (peek().type === 'kw' && peek().value === 'const')) {
            const { baseType, isConst } = parseType();
            const nameTok = expect('id');
            let initExpr = null;
            if (peek().type === 'op' && peek().value === '=') { next(); initExpr = parseExpression(); }
            expect(';');
            init = { type: 'vardecl', varType: baseType, isConst, name: nameTok.value, init: initExpr };
          } else {
            const expr = parseExpression(); expect(';'); init = { type: 'exprstmt', expr };
          }
        } else next();
        let cond = null;
        if (peek().type !== ';') cond = parseExpression();
        expect(';');
        let update = null;
        if (peek().type !== ')') update = parseExpression();
        expect(')');
        const body = parseStatement();
        return { type: 'for', init, cond, update, body };
      }
      if (t.type === 'kw' && t.value === 'return') {
        next(); let arg = null;
        if (peek().type !== ';') arg = parseExpression();
        expect(';'); return { type: 'return', arg };
      }
      if (t.type === 'kw' && (t.value === 'break' || t.value === 'continue')) { next(); expect(';'); return { type: t.value }; }
      
      if (t.type === 'type' || (t.type === 'kw' && t.value === 'const')) {
        const save = pos;
        try {
          const { baseType, isConst } = parseType();
          const nameTok = peek();
          if (nameTok.type !== 'id') throw { line: nameTok.line, col: nameTok.col, message: 'ожидалось имя' };
          const name = nameTok.value; next();

          if (peek().type === '(') {
            next(); const params = [];
            if (peek().type !== ')') {
              while (true) {
                const pType = parseType();
                const pName = expect('id');
                let pIsArray = false;
                if (peek().type === '[') { next(); expect(']'); pIsArray = true; }
                params.push({ type: pType.baseType, name: pName.value, isArray: pIsArray });
                if (peek().type === ',') { next(); continue; }
                break;
              }
            }
            expect(')'); const body = parseBlock();
            return { type: 'funcdecl', name, params, body, returnType: baseType };
          }

          let isArray = false; let arraySize = null;
          if (peek().type === '[') {
            next(); isArray = true;
            if (peek().type !== ']') arraySize = parseExpression();
            expect(']');
          }

          let init = null;
          if (peek().type === 'op' && peek().value === '=') {
            next();
            if (peek().type === '{') {
              next(); const elements = [];
              if (peek().type !== '}') {
                elements.push(parseExpression());
                while (peek().type === ',') {
                  next();
                  if (peek().type === '}') break;
                  elements.push(parseExpression());
                }
              }
              expect('}'); init = { type: 'array', elements };
            } else {
              init = parseExpression();
            }
          }
          expect(';');
          return { type: 'vardecl', varType: baseType, isConst, name, init, isArray, arraySize };
        } catch (err) {
          if (err && err.line !== undefined) throw err;
          pos = save;
        }
      }

      const expr = parseExpression();
      if (peek().type === 'op' && ['=','+=','-=','*=','/='].includes(peek().value)) {
        const op = next().value; const value = parseExpression();
        expect(';'); return { type: 'assign', op, target: expr, value };
      }
      expect(';'); return { type: 'exprstmt', expr };
    }

    const program = { type: 'program', body: [] };
    try {
      while (peek().type !== 'eof') program.body.push(parseStatement());
    } catch (e) {
      return { ok: false, error: { line: e.line, col: e.col, message: e.message } };
    }
    return { ok: true, ast: program };
  }

  window.ArduinoCompiler = { parse };
})();