(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CodeAnalyzer = api;
  if (typeof window !== 'undefined') window.CodeAnalyzer = api;
  if (typeof globalThis !== 'undefined') globalThis.CodeAnalyzer = api;
})(typeof window === 'undefined' ? this : window, function () {
  'use strict';

  const KEYWORDS = {
    python: new Set(['def', 'class', 'if', 'elif', 'else', 'for', 'while', 'in', 'is', 'not', 'and', 'or', 'return', 'import', 'from', 'as', 'try', 'except', 'finally', 'raise', 'with', 'lambda', 'pass', 'break', 'continue', 'True', 'False', 'None', 'print']),
    java: new Set(['public', 'private', 'protected', 'class', 'interface', 'extends', 'implements', 'static', 'final', 'void', 'return', 'new', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'default', 'try', 'catch', 'finally', 'throw', 'throws', 'import', 'package', 'int', 'double', 'float', 'boolean', 'char', 'byte', 'short', 'long', 'String', 'System', 'out', 'println', 'print', 'true', 'false', 'null']),
    sql: new Set(['select', 'from', 'where', 'insert', 'into', 'values', 'update', 'set', 'delete', 'create', 'table', 'drop', 'alter', 'join', 'inner', 'left', 'right', 'full', 'on', 'group', 'by', 'order', 'having', 'limit', 'offset', 'and', 'or', 'not', 'in', 'like', 'is', 'null', 'as', 'distinct', 'count', 'sum', 'avg', 'min', 'max', 'asc', 'desc', 'integer', 'text', 'real', 'blob', 'primary', 'key']),
    javascript: new Set(['function', 'return', 'var', 'let', 'const', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'default', 'try', 'catch', 'finally', 'throw', 'new', 'class', 'extends', 'import', 'export', 'from', 'as', 'default', 'async', 'await', 'typeof', 'instanceof', 'true', 'false', 'null', 'undefined', 'NaN', 'console', 'log']),
    typescript: new Set(['function', 'return', 'var', 'let', 'const', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'default', 'try', 'catch', 'finally', 'throw', 'new', 'class', 'extends', 'import', 'export', 'from', 'as', 'default', 'async', 'await', 'typeof', 'instanceof', 'true', 'false', 'null', 'undefined', 'NaN', 'console', 'log', 'interface', 'type', 'string', 'number', 'boolean', 'any', 'void']),
    kotlin: new Set(['fun', 'val', 'var', 'class', 'interface', 'object', 'if', 'else', 'when', 'for', 'while', 'return', 'package', 'import', 'is', 'in', 'as', 'true', 'false', 'null', 'println', 'print', 'Int', 'Double', 'String', 'Boolean']),
    c: new Set(['int', 'float', 'double', 'char', 'void', 'long', 'short', 'unsigned', 'signed', 'struct', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'default', 'printf', 'scanf', 'include', 'true', 'false', 'NULL']),
    cpp: new Set(['int', 'float', 'double', 'char', 'void', 'long', 'short', 'unsigned', 'signed', 'struct', 'class', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'default', 'printf', 'scanf', 'include', 'cout', 'cin', 'endl', 'std', 'using', 'namespace', 'true', 'false', 'NULL', 'nullptr']),
    csharp: new Set(['int', 'string', 'double', 'float', 'bool', 'void', 'class', 'namespace', 'using', 'public', 'private', 'static', 'return', 'if', 'else', 'for', 'foreach', 'while', 'switch', 'case', 'break', 'default', 'new', 'true', 'false', 'null', 'Console', 'WriteLine', 'Write']),
    php: new Set(['echo', 'print', 'function', 'class', 'return', 'if', 'else', 'elseif', 'for', 'foreach', 'while', 'switch', 'case', 'break', 'default', 'new', 'public', 'private', 'protected', 'true', 'false', 'null']),
    swift: new Set(['let', 'var', 'func', 'class', 'struct', 'enum', 'if', 'else', 'guard', 'for', 'in', 'while', 'switch', 'case', 'default', 'break', 'return', 'print', 'true', 'false', 'nil', 'Int', 'Double', 'String', 'Bool']),
    web: new Set(['div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'img', 'input', 'button', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'form', 'label', 'header', 'footer', 'nav', 'section', 'article', 'main', 'aside', 'style', 'script', 'meta', 'link'])
  };

  const CSS_PROPERTIES = new Set([
    'color', 'background', 'background-color', 'font-size', 'font-weight', 'font-family',
    'margin', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
    'padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
    'border', 'border-radius', 'display', 'flex', 'grid', 'justify-content', 'align-items',
    'width', 'height', 'max-width', 'min-height', 'position', 'top', 'bottom', 'left', 'right',
    'gap', 'opacity', 'overflow', 'cursor', 'z-index', 'box-shadow', 'line-height', 'text-align'
  ]);

  function getOperators(language) {
    if (language === 'python') {
      return ['**=', '//=', '<<=', '>>=', ':=', '==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '**', '//', '<<', '>>', '->'];
    }
    if (language === 'java') {
      return ['>>>=', '>>>', '>>=', '<<=', '>>', '<<', '==', '!=', '<=', '>=', '&&', '||', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '->', '::', '...'];
    }
    if (language === 'sql') {
      return ['->>', '->', '==', '!=', '<>', '<=', '>=', '||', '<<', '>>'];
    }
    if (language === 'javascript' || language === 'typescript') {
      return ['===', '!==', '??=', '&&=', '||=', '**=', '<<=', '>>>=', '>>=', '=>', '?.', '??', '**', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '==', '!=', '<=', '>=', '&&', '||', '<<', '>>', '>>>', '...'];
    }
    if (language === 'kotlin') {
      return ['===', '!==', '?:', '?.', '!!', '->', '::', '..', '+=', '-=', '*=', '/=', '%=', '==', '!=', '<=', '>=', '&&', '||', '++', '--'];
    }
    if (language === 'c') {
      return ['->', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=', '==', '!=', '<=', '>=', '&&', '||', '<<', '>>'];
    }
    if (language === 'cpp') {
      return ['::', '<<=', '>>=', '<=>', '<<', '>>', '->*', '->', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '==', '!=', '<=', '>=', '&&', '||'];
    }
    if (language === 'csharp') {
      return ['=>', '??=', '?.', '??', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=', '==', '!=', '<=', '>=', '&&', '||', '<<', '>>'];
    }
    if (language === 'php') {
      return ['===', '!==', '<=>', '??=', '??', '?->', '->', '=>', '::', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '==', '!=', '<=', '>=', '&&', '||', '**=', '**'];
    }
    if (language === 'swift') {
      return ['...', '..<', '->', '??', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '==', '!=', '<=', '>=', '&&', '||', '++', '--'];
    }
    if (language === 'web') {
      return ['<!--', '-->', '</', '/>', '~=', '|=', '^=', '$=', '*=', '::', '>=', '<=', '==', '!='];
    }
    return ['==', '!=', '<=', '>=', '+=', '-=', '*=', '/='];
  }

  function tokenizeWithSpans(source, language) {
    const tokens = [];
    const syntaxErrors = [];
    let i = 0;
    let line = 1;
    let col = 1;

    function advance(n = 1) {
      for (let k = 0; k < n; k++) {
        if (source[i + k] === '\n') {
          line++;
          col = 1;
        } else {
          col++;
        }
      }
      i += n;
    }

    const operators = getOperators(language);
    const delimiterStack = [];
    let inCssSelector = language === 'web' && !source.trim().startsWith('<');
    let sawSpace = false;

    while (i < source.length) {
      const rest = source.slice(i);
      const ch = source[i];
      const startOffset = i;
      const startLine = line;
      const startCol = col;

      // Whitespace
      if (/[ \t\f\r]/.test(ch)) {
        sawSpace = true;
        advance(1);
        continue;
      }

      // Newlines
      if (ch === '\n') {
        advance(1);
        continue;
      }

      // CSS descendant space check
      if (sawSpace && inCssSelector && delimiterStack.length === 0 && tokens.length > 0) {
        const lastToken = tokens[tokens.length - 1];
        const canPrecede = ['name', 'number', 'string', 'literal', 'tag', 'keyword', 'property'].includes(lastToken.type) ||
          (lastToken.type === 'symbol' && [']', ')', '*', '%'].includes(lastToken.value));
        const canFollow = /[A-Za-z0-9_.*#:[A-Za-z]/.test(ch) && !['>', '+', '~', ',', '{', '}', ';'].includes(ch);
        if (canPrecede && canFollow) {
          tokens.push({ type: 'combinator', value: ' ', raw: ' ', start: startOffset - 1, end: startOffset, line: startLine, col: startCol - 1 });
        }
      }
      sawSpace = false;

      // Comments check
      if ((language === 'python' && ch === '#') ||
          (language === 'php' && (rest.startsWith('//') || rest.startsWith('/*') || ch === '#')) ||
          (language === 'sql' && (rest.startsWith('--') || rest.startsWith('/*'))) ||
          (language === 'web' && (rest.startsWith('<!--') || rest.startsWith('/*'))) ||
          (!['python', 'sql', 'web', 'php'].includes(language) && (rest.startsWith('//') || rest.startsWith('/*')))) {
        syntaxErrors.push({
          id: 'unexpected-comment',
          category: 'syntax',
          severity: 'error',
          message: 'Comentários não são necessários nesta resposta.',
          hint: 'Remova o comentário e escreva apenas a instrução solicitada.',
          range: { start: startOffset, end: source.length },
          line: startLine,
          column: startCol
        });
        break;
      }

      // String literals
      if (ch === '"' || ch === "'") {
        const quote = ch;
        let value = '';
        let closed = false;
        let escaped = false;
        advance(1);

        while (i < source.length) {
          const c = source[i];
          if (c === quote) {
            if (language === 'sql' && source[i + 1] === quote) {
              value += quote;
              advance(2);
              continue;
            }
            closed = true;
            advance(1);
            break;
          }
          if (c === '\\' && language !== 'sql') {
            escaped = true;
            if (i + 1 >= source.length) break;
            value += c + source[i + 1];
            advance(2);
          } else if (c === '\n') {
            break;
          } else {
            value += c;
            advance(1);
          }
        }

        const endOffset = i;
        const raw = source.slice(startOffset, endOffset);
        if (!closed) {
          syntaxErrors.push({
            id: 'unclosed-string',
            category: 'syntax',
            severity: 'error',
            message: `Texto (string) não foi fechado com aspas (${quote}).`,
            hint: `Insira ${quote} para fechar o texto antes de continuar o comando.`,
            range: { start: endOffset, end: endOffset },
            line: startLine,
            column: startCol
          });
        }
        tokens.push({
          type: 'string',
          value,
          raw,
          quote,
          escaped,
          closed,
          start: startOffset,
          end: endOffset,
          line: startLine,
          col: startCol
        });
        continue;
      }

      // HTML closing and self-closing tags
      if (language === 'web') {
        if (rest.startsWith('</')) {
          tokens.push({ type: 'symbol', value: '</', raw: '</', start: startOffset, end: startOffset + 2, line: startLine, col: startCol });
          advance(2);
          continue;
        }
        if (rest.startsWith('/>')) {
          tokens.push({ type: 'symbol', value: '/>', raw: '/>', start: startOffset, end: startOffset + 2, line: startLine, col: startCol });
          advance(2);
          continue;
        }
      }

      // Delimiters stack tracking for (), [], {}
      if (ch === '(' || ch === '[' || ch === '{') {
        delimiterStack.push({ ch, start: startOffset, line: startLine, col: startCol });
        if (language === 'web' && ch === '{') inCssSelector = false;
      } else if (ch === ')' || ch === ']' || ch === '}') {
        if (language === 'web' && ch === '}') inCssSelector = true;
        const expectedPair = { ')': '(', ']': '[', '}': '{' }[ch];
        if (delimiterStack.length > 0 && delimiterStack[delimiterStack.length - 1].ch === expectedPair) {
          delimiterStack.pop();
        } else {
          syntaxErrors.push({
            id: 'unexpected-closing-delimiter',
            category: 'syntax',
            severity: 'error',
            message: `Delimitador '${ch}' de fechamento inesperado.`,
            hint: `Verifique se há um '${expectedPair}' correspondente aberto anteriormente.`,
            range: { start: startOffset, end: startOffset + 1 },
            line: startLine,
            column: startCol
          });
        }
      }

      // Multi-char operators
      const op = operators.find(x => rest.startsWith(x));
      if (op) {
        tokens.push({
          type: 'symbol',
          value: op,
          raw: op,
          start: startOffset,
          end: startOffset + op.length,
          line: startLine,
          col: startCol
        });
        advance(op.length);
        continue;
      }

      // Names / Identifiers
      const namePattern = language === 'web'
        ? /^(?:--[a-zA-Z0-9_-]+|[A-Za-z_$][A-Za-z0-9_$-]*)/
        : language === 'php'
        ? /^(?:\$[A-Za-z_][A-Za-z0-9_]*|[A-Za-z_][A-Za-z0-9_]*)/
        : /^[A-Za-z_$][A-Za-z0-9_$]*/;
      const nameMatch = namePattern.exec(rest);
      if (nameMatch) {
        const name = nameMatch[0];
        const kwSet = KEYWORDS[language];
        let tokenType = 'name';

        if (language === 'web') {
          if (CSS_PROPERTIES.has(name.toLowerCase())) {
            tokenType = 'property';
          } else if (KEYWORDS.web.has(name.toLowerCase())) {
            tokenType = 'tag';
          }
        } else if (kwSet && (kwSet.has(name) || (language === 'sql' && kwSet.has(name.toLowerCase())))) {
          tokenType = 'keyword';
        }

        tokens.push({
          type: tokenType,
          value: language === 'sql' ? name.toLowerCase() : name,
          raw: name,
          start: startOffset,
          end: startOffset + name.length,
          line: startLine,
          col: startCol
        });
        advance(name.length);
        continue;
      }

      // Hex colors in CSS
      if (language === 'web' && ch === '#') {
        const hexMatch = /^#[0-9a-fA-F]{3,8}\b/.exec(rest);
        if (hexMatch) {
          tokens.push({
            type: 'color',
            value: hexMatch[0].toLowerCase(),
            raw: hexMatch[0],
            start: startOffset,
            end: startOffset + hexMatch[0].length,
            line: startLine,
            col: startCol
          });
          advance(hexMatch[0].length);
          continue;
        }
      }

      // Numbers
      const numPattern = language === 'web'
        ? /^(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em|ms|s|fr|%|deg|vh|vw)?/i
        : /^(?:0[xX][0-9a-fA-F_]+|(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d[\d_]*)?)[lLfFdD]?/;
      const numMatch = numPattern.exec(rest);
      if (numMatch) {
        tokens.push({
          type: 'number',
          value: numMatch[0],
          raw: numMatch[0],
          start: startOffset,
          end: startOffset + numMatch[0].length,
          line: startLine,
          col: startCol
        });
        advance(numMatch[0].length);
        continue;
      }

      // Single-char symbols
      if (/[()[\]{},.;:+\-*/%<>=!&|^~?@#]/.test(ch)) {
        tokens.push({
          type: 'symbol',
          value: ch,
          raw: ch,
          start: startOffset,
          end: startOffset + 1,
          line: startLine,
          col: startCol
        });
        advance(1);
        continue;
      }

      // Web HTML text
      if (language === 'web') {
        const textMatch = /^[^<>{}\n]+/.exec(rest);
        if (textMatch) {
          const text = textMatch[0];
          tokens.push({
            type: 'text',
            value: text.trim(),
            raw: text,
            start: startOffset,
            end: startOffset + text.length,
            line: startLine,
            col: startCol
          });
          advance(text.length);
          continue;
        }
      }

      // Unrecognized character
      syntaxErrors.push({
        id: 'unexpected-character',
        category: 'syntax',
        severity: 'error',
        message: `Caractere inesperado '${ch}'.`,
        hint: 'Remova ou substitua este caractere pela sintaxe válida da linguagem.',
        range: { start: startOffset, end: startOffset + 1 },
        line: startLine,
        column: startCol
      });
      advance(1);
    }

    // Check unclosed opening delimiters at EOF
    while (delimiterStack.length > 0) {
      const unclosed = delimiterStack.pop();
      const expectedClosing = { '(': ')', '[': ']', '{': '}' }[unclosed.ch];
      syntaxErrors.push({
        id: 'unclosed-delimiter',
        category: 'syntax',
        severity: 'error',
        message: `Fechamento de '${expectedClosing}' ausente para o '${unclosed.ch}' aberto.`,
        hint: `Insira '${expectedClosing}' para fechar o bloco ou expressão correspondente.`,
        range: { start: source.length, end: source.length },
        line: line,
        column: col
      });
    }

    return { tokens, syntaxErrors };
  }

  function tokenMatches(t1, t2, language) {
    if (!t1 || !t2) return false;
    const isName1 = ['name', 'keyword', 'tag', 'property'].includes(t1.type);
    const isName2 = ['name', 'keyword', 'tag', 'property'].includes(t2.type);
    if (t1.type !== t2.type && !(isName1 && isName2)) return false;

    if (t1.type === 'string') {
      const norm = ['python', 'javascript', 'typescript', 'web'].includes(language);
      return norm ? t1.value === t2.value : t1.raw === t2.raw;
    }
    if (language === 'sql' && (isName1 || isName2)) {
      return t1.value.toLowerCase() === t2.value.toLowerCase();
    }
    return t1.value === t2.value;
  }

  function diagnoseTokenDiff(source, sTokens, tTokens, language, question) {
    const diagnostics = [];

    // 1. HTML mismatched tags: <p> ... </div>
    if (language === 'web' && source.includes('<') && source.includes('</')) {
      const openTagMatch = /<([a-zA-Z0-9]+)[^>]*>/.exec(source);
      const closeTagMatch = /<\/([a-zA-Z0-9]+)>/.exec(source);
      if (openTagMatch && closeTagMatch) {
        const openName = openTagMatch[1].toLowerCase();
        const closeName = closeTagMatch[1].toLowerCase();
        const voidTags = ['img', 'input', 'br', 'hr', 'meta', 'link'];
        if (!voidTags.includes(openName) && openName !== closeName) {
          const closeIdx = closeTagMatch.index;
          return [{
            id: 'mismatched-closing-tag',
            category: 'syntax',
            severity: 'error',
            message: `Tag de fechamento '</${closeName}>' não corresponde à tag de abertura '<${openName}>'.`,
            hint: `Substitua '</${closeName}>' por '</${openName}>' para fechar o elemento corretamente.`,
            range: { start: closeIdx, end: closeIdx + closeTagMatch[0].length },
            line: 1,
            column: closeIdx + 1
          }];
        }
      }
    }

    // 2. CSS missing colon: 'color blue;'
    if (language === 'web') {
      const colonInTarget = tTokens.some(t => t.type === 'symbol' && t.value === ':');
      const colonInStudent = sTokens.some(t => t.type === 'symbol' && t.value === ':');
      if (colonInTarget && !colonInStudent) {
        const propToken = sTokens.find(t => t.type === 'property' || t.type === 'name');
        if (propToken) {
          const pos = propToken.end;
          return [{
            id: 'missing-colon',
            category: 'syntax',
            severity: 'error',
            message: `Dois-pontos ':' ausente após a propriedade CSS '${propToken.value}'.`,
            hint: `Em CSS, separe a propriedade do valor usando dois-pontos ':'. Exemplo: '${propToken.value}: ...;'`,
            range: { start: pos, end: pos },
            line: propToken.line,
            column: propToken.col + propToken.raw.length
          }];
        }
      }
    }

    let sIdx = 0;
    let tIdx = 0;

    while (sIdx < sTokens.length && tIdx < tTokens.length) {
      const sTok = sTokens[sIdx];
      const tTok = tTokens[tIdx];

      if (tokenMatches(sTok, tTok, language)) {
        sIdx++;
        tIdx++;
        continue;
      }

      // Comparison vs Assignment: student has '==' but target has '='
      if (sTok.value === '==' && tTok.value === '=') {
        return [{
          id: 'comparison-instead-of-assignment',
          category: 'divergence',
          severity: 'error',
          message: "Você usou o operador de comparação '=='. Para atribuir o valor solicitado, use '='.",
          hint: "Substitua '==' por '=' para realizar uma atribuição de variável.",
          range: { start: sTok.start, end: sTok.end },
          line: sTok.line,
          column: sTok.col
        }];
      }
      if (sTok.value === '=' && tTok.value === '==') {
        return [{
          id: 'assignment-instead-of-comparison',
          category: 'divergence',
          severity: 'error',
          message: "Você usou o operador de atribuição '='. Para comparar igualdade, use '=='.",
          hint: "Substitua '=' por '==' para comparar valores.",
          range: { start: sTok.start, end: sTok.end },
          line: sTok.line,
          column: sTok.col
        }];
      }

      // Number divergence
      if (sTok.type === 'number' && tTok.type === 'number') {
        return [{
          id: 'divergent-number',
          category: 'divergence',
          severity: 'error',
          message: `O enunciado pede o valor ${tTok.value}. Confira o número digitado.`,
          hint: `Altere o valor '${sTok.value}' para '${tTok.value}'.`,
          range: { start: sTok.start, end: sTok.end },
          line: sTok.line,
          column: sTok.col
        }];
      }

      // Typo in keyword (e.g. FORM vs FROM in SQL)
      const isWord1 = ['name', 'keyword', 'tag', 'property'].includes(sTok.type);
      const isWord2 = ['name', 'keyword', 'tag', 'property'].includes(tTok.type);
      if (isWord1 && isWord2) {
        const sVal = sTok.value.toUpperCase();
        const tVal = tTok.value.toUpperCase();
        if (sVal === 'FORM' && tVal === 'FROM') {
          return [{
            id: 'keyword-typo',
            category: 'syntax',
            severity: 'error',
            message: "Palavra-chave incorreta 'FORM'. O comando SQL esperado é 'FROM'.",
            hint: "Corrija 'FORM' para 'FROM' para indicar a tabela da consulta.",
            range: { start: sTok.start, end: sTok.end },
            line: sTok.line,
            column: sTok.col
          }];
        }
        return [{
          id: 'divergent-identifier',
          category: 'divergence',
          severity: 'error',
          message: `Identificador ou palavra '${sTok.raw}' diverge do esperado ('${tTok.raw}').`,
          hint: `Confira o nome solicitado no enunciado e substitua '${sTok.raw}' por '${tTok.raw}'.`,
          range: { start: sTok.start, end: sTok.end },
          line: sTok.line,
          column: sTok.col
        }];
      }

      // Missing token in student code (extra token in student)
      if (sIdx + 1 < sTokens.length && tokenMatches(sTokens[sIdx + 1], tTok, language)) {
        return [{
          id: 'unexpected-token',
          category: 'divergence',
          severity: 'error',
          message: `Elemento inesperado '${sTok.raw}' no código.`,
          hint: `Remova '${sTok.raw}'.`,
          range: { start: sTok.start, end: sTok.end },
          line: sTok.line,
          column: sTok.col
        }];
      }

      // Token missing from student code
      if (tIdx + 1 < tTokens.length && tokenMatches(sTok, tTokens[tIdx + 1], language)) {
        return [{
          id: 'missing-token',
          category: tTok.type === 'symbol' ? 'syntax' : 'divergence',
          severity: 'error',
          message: `Elemento '${tTok.raw}' ausente na sua resposta.`,
          hint: `Insira '${tTok.raw}' antes de '${sTok.raw}'.`,
          range: { start: sTok.start, end: sTok.start },
          line: sTok.line,
          column: sTok.col
        }];
      }

      // Generic divergence
      return [{
        id: 'divergent-token',
        category: 'divergence',
        severity: 'error',
        message: `Trecho '${sTok.raw}' não confere com o esperado.`,
        hint: `Verifique o enunciado e ajuste o trecho '${sTok.raw}'.`,
        range: { start: sTok.start, end: sTok.end },
        line: sTok.line,
        column: sTok.col
      }];
    }

    // Student code ended early, missing tokens from target
    if (sIdx >= sTokens.length && tIdx < tTokens.length) {
      const missing = tTokens.slice(tIdx);
      if (missing.length === 1 && missing[0].value === ';') {
        const langName = { java: 'Java', c: 'C', cpp: 'C++', csharp: 'C#', php: 'PHP', javascript: 'JavaScript' }[language] || 'nesta linguagem';
        return [{
          id: 'missing-semicolon',
          category: 'syntax',
          severity: 'error',
          message: "Ponto e vírgula ';' ausente ao final da instrução.",
          hint: `Em ${langName}, instruções devem terminar com ponto e vírgula ';'.`,
          range: { start: source.length, end: source.length },
          line: 1,
          column: source.length + 1
        }];
      }
      if (missing.length === 1 && missing[0].value === ':') {
        return [{
          id: 'missing-colon',
          category: 'syntax',
          severity: 'error',
          message: "Dois-pontos ':' ausente ao final do cabeçalho.",
          hint: "Em Python, cabeçalhos de if, for, while, def e class terminam com dois-pontos ':'.",
          range: { start: source.length, end: source.length },
          line: 1,
          column: source.length + 1
        }];
      }
      const missingStr = missing.map(m => m.raw).join(' ');
      return [{
        id: 'incomplete-code',
        category: 'divergence',
        severity: 'error',
        message: `A instrução está incompleta. Falta adicionar: '${missingStr}'.`,
        hint: `Complete a linha inserindo '${missingStr}' ao final.`,
        range: { start: source.length, end: source.length },
        line: 1,
        column: source.length + 1
      }];
    }

    // Student code has trailing extra tokens
    if (sIdx < sTokens.length && tIdx >= tTokens.length) {
      const extraTok = sTokens[sIdx];
      return [{
        id: 'extra-tokens',
        category: 'divergence',
        severity: 'error',
        message: `Trecho excedente '${extraTok.raw}' ao final da instrução.`,
        hint: `Remova '${source.slice(extraTok.start)}'.`,
        range: { start: extraTok.start, end: source.length },
        line: extraTok.line,
        column: extraTok.col
      }];
    }

    return diagnostics;
  }

  function analyzeCode(question, source, options = { phase: 'submit' }) {
    const lang = question.language || 'python';
    const raw = String(source || '');

    // 1. Empty source
    if (!raw.trim()) {
      if (options.phase === 'live') {
        return { status: 'complete', isMatch: false, diagnostics: [] };
      }
      return {
        status: 'complete',
        isMatch: false,
        diagnostics: [{
          id: 'empty-code',
          category: 'divergence',
          severity: 'error',
          message: 'Nenhum código foi digitado.',
          hint: 'Escreva a linha de código solicitada pelo enunciado.',
          range: { start: 0, end: 0 },
          line: 1,
          column: 1
        }]
      };
    }

    // 2. Multiline check (single line writing exercises)
    if (raw.includes('\n')) {
      const firstNl = raw.indexOf('\n');
      return {
        status: 'complete',
        isMatch: false,
        diagnostics: [{
          id: 'multiple-lines',
          category: 'divergence',
          severity: 'error',
          message: 'O exercício solicita apenas uma linha de código.',
          hint: 'Remova as quebras de linha adicionais para manter todo o comando em uma única linha.',
          range: { start: firstNl, end: raw.length },
          line: 2,
          column: 1
        }]
      };
    }

    // 3. Tokenize
    const { tokens: sTokens, syntaxErrors } = tokenizeWithSpans(raw, lang);

    // If syntax errors found in tokenization, report immediately
    if (syntaxErrors.length > 0) {
      return {
        status: 'complete',
        isMatch: false,
        diagnostics: syntaxErrors.slice(0, 1)
      };
    }

    // 4. In 'live' phase, do not perform deep divergence comparison to avoid spoiling solutions
    if (options.phase === 'live') {
      return {
        status: 'complete',
        isMatch: false,
        diagnostics: []
      };
    }

    // 5. Compare with all accepted answers and alternatives
    const answers = (question.answers || []).concat(question.alternatives || []);
    for (const ans of answers) {
      const { tokens: tTokens } = tokenizeWithSpans(ans, lang);
      if (sTokens.length === tTokens.length && sTokens.every((s, i) => tokenMatches(s, tTokens[i], lang))) {
        return { status: 'complete', isMatch: true, diagnostics: [] };
      }
    }

    // 6. Find best matching target answer for diagnosing differences
    let bestTokens = null;
    let bestMatchScore = -1;
    for (const ans of answers) {
      const { tokens: tTokens } = tokenizeWithSpans(ans, lang);
      let matches = 0;
      for (const st of sTokens) {
        if (tTokens.some(tt => tokenMatches(st, tt, lang))) matches++;
      }
      if (matches > bestMatchScore) {
        bestMatchScore = matches;
        bestTokens = tTokens;
      }
    }

    if (!bestTokens && answers.length > 0) {
      const { tokens: tTokens } = tokenizeWithSpans(answers[0], lang);
      bestTokens = tTokens;
    }

    if (!bestTokens) {
      return {
        status: 'complete',
        isMatch: false,
        diagnostics: [{
          id: 'unsupported-construct',
          category: 'limitation',
          severity: 'warning',
          message: 'Não foi possível comparar a resposta com um gabarito estruturado.',
          hint: 'Verifique se o formato solicitado está de acordo com os exemplos da lição.',
          range: { start: 0, end: raw.length },
          line: 1,
          column: 1
        }]
      };
    }

    const diffs = diagnoseTokenDiff(raw, sTokens, bestTokens, lang, question);
    return {
      status: 'complete',
      isMatch: false,
      diagnostics: diffs
    };
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderHighlightedHtml(source, language, diagnostics = []) {
    const raw = String(source || '');
    if (!raw) return '';

    const { tokens } = tokenizeWithSpans(raw, language);
    const diag = diagnostics && diagnostics[0];
    const diagStart = diag ? diag.range.start : -1;
    const diagEnd = diag ? diag.range.end : -1;
    const isInsertion = diag && diagStart === diagEnd;

    let result = '';
    let curr = 0;

    function wrapSquiggle(sliceText, isInsert = false) {
      if (isInsert) {
        return '<span class="insertion-marker" title="' + escapeHtml(diag.message) + '"></span>';
      }
      return '<span class="squiggle-error" title="' + escapeHtml(diag.message) + '">' + escapeHtml(sliceText) + '</span>';
    }

    for (let t = 0; t < tokens.length; t++) {
      const tok = tokens[t];
      // Untokenized space/chars before tok
      if (tok.start > curr) {
        const gap = raw.slice(curr, tok.start);
        if (isInsertion && curr <= diagStart && diagStart <= tok.start) {
          const before = raw.slice(curr, diagStart);
          const after = raw.slice(diagStart, tok.start);
          result += escapeHtml(before) + wrapSquiggle('', true) + escapeHtml(after);
        } else {
          result += escapeHtml(gap);
        }
      }

      // Check if token intersects diagnostic range
      const tokText = raw.slice(tok.start, tok.end);
      let renderedTok = '';

      if (diag && !isInsertion && tok.start < diagEnd && tok.end > diagStart) {
        // Tok overlaps error span
        const overlapStart = Math.max(tok.start, diagStart);
        const overlapEnd = Math.min(tok.end, diagEnd);
        const pre = tokText.slice(0, overlapStart - tok.start);
        const mid = tokText.slice(overlapStart - tok.start, overlapEnd - tok.start);
        const post = tokText.slice(overlapEnd - tok.start);

        renderedTok = '<span class="token token-' + tok.type + '">' +
          escapeHtml(pre) +
          wrapSquiggle(mid) +
          escapeHtml(post) +
          '</span>';
      } else {
        renderedTok = '<span class="token token-' + tok.type + '">' + escapeHtml(tokText) + '</span>';
        if (isInsertion && diagStart >= tok.start && diagStart <= tok.end) {
          const splitIdx = diagStart - tok.start;
          const pre = tokText.slice(0, splitIdx);
          const post = tokText.slice(splitIdx);
          renderedTok = '<span class="token token-' + tok.type + '">' +
            escapeHtml(pre) +
            wrapSquiggle('', true) +
            escapeHtml(post) +
            '</span>';
        }
      }

      result += renderedTok;
      curr = tok.end;
    }

    if (curr < raw.length) {
      const remaining = raw.slice(curr);
      if (isInsertion && diagStart >= curr) {
        const splitIdx = diagStart - curr;
        const pre = remaining.slice(0, splitIdx);
        const post = remaining.slice(splitIdx);
        result += escapeHtml(pre) + wrapSquiggle('', true) + escapeHtml(post);
      } else {
        result += escapeHtml(remaining);
      }
    } else if (isInsertion && diagStart >= raw.length) {
      result += wrapSquiggle('', true);
    }

    return result;
  }

  return {
    tokenizeWithSpans,
    diagnoseTokenDiff,
    analyzeCode,
    renderHighlightedHtml
  };
});
