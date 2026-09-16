(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CodeEditor = api;
  if (typeof window !== 'undefined') window.CodeEditor = api;
  if (typeof globalThis !== 'undefined') globalThis.CodeEditor = api;
})(typeof window === 'undefined' ? this : window, function () {
  'use strict';

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getLineCol(text, pos) {
    let line = 1;
    let col = 1;
    for (let i = 0; i < pos && i < text.length; i++) {
      if (text[i] === '\n') {
        line++;
        col = 1;
      } else {
        col++;
      }
    }
    return { line, col };
  }

  function create(container, options = {}) {
    const question = options.question || {};
    const language = question.language || 'python';
    let currentDiagnostics = options.diagnostics || [];
    let isReadOnly = options.readOnly || false;
    let debounceTimer = null;
    let isComposing = false;

    const langLabels = {
      python: 'Python',
      java: 'Java',
      sql: 'SQL',
      javascript: 'JavaScript',
      typescript: 'TypeScript',
      kotlin: 'Kotlin',
      c: 'C',
      cpp: 'C++',
      csharp: 'C#',
      php: 'PHP',
      swift: 'Swift',
      web: 'HTML & CSS'
    };

    const rootEl = typeof container === 'string' ? document.querySelector(container) : container;
    if (!rootEl) throw new Error('Container do editor não encontrado.');

    rootEl.innerHTML = `
      <div class="code-editor-container" role="region" aria-label="Editor educacional de código">
        <div class="editor-header">
          <div class="editor-title-group">
            <span class="editor-lang-badge">${escapeHtml(langLabels[language] || language)}</span>
            <span class="editor-mode-tag">Escreva a linha inteira</span>
          </div>
          <div class="editor-meta">
            <span class="editor-cursor-pos" aria-live="polite">Ln 1, Col 1</span>
            <span class="editor-problem-count" aria-live="polite">0 problemas</span>
          </div>
        </div>

        <div class="code-editor-wrap">
          <div class="editor-gutter" aria-hidden="true">1</div>
          <div class="editor-canvas">
            <div class="editor-backdrop" aria-hidden="true"></div>
            <textarea
              class="editor-input"
              id="code-editor-textarea"
              spellcheck="false"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              rows="3"
              aria-label="Área de digitação de código"
              ${isReadOnly ? 'disabled' : ''}
            >${escapeHtml(options.initialValue || '')}</textarea>
          </div>
        </div>

        <div class="editor-problems-panel" role="region" aria-label="Painel de problemas">
          <div class="problems-header">
            <span class="problems-title">
              <svg class="icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              Problemas (<span class="prob-count-badge">0</span>)
            </span>
          </div>
          <div class="problems-list" role="list"></div>
        </div>
      </div>
    `;

    const textarea = rootEl.querySelector('.editor-input');
    const backdrop = rootEl.querySelector('.editor-backdrop');
    const gutter = rootEl.querySelector('.editor-gutter');
    const cursorPosEl = rootEl.querySelector('.editor-cursor-pos');
    const problemCountEl = rootEl.querySelector('.editor-problem-count');
    const probCountBadge = rootEl.querySelector('.prob-count-badge');
    const problemsList = rootEl.querySelector('.problems-list');

    function updateGutter() {
      const lines = textarea.value.split('\n').length;
      let gutterHtml = '';
      for (let i = 1; i <= lines; i++) {
        gutterHtml += `<div>${i}</div>`;
      }
      gutter.innerHTML = gutterHtml;
    }

    function updateCursorPos() {
      const pos = textarea.selectionStart || 0;
      const { line, col } = getLineCol(textarea.value, pos);
      cursorPosEl.textContent = `Ln ${line}, Col ${col}`;
    }

    function syncBackdrop() {
      if (typeof CodeAnalyzer !== 'undefined') {
        backdrop.innerHTML = CodeAnalyzer.renderHighlightedHtml(textarea.value, language, currentDiagnostics);
      } else {
        backdrop.textContent = textarea.value;
      }
    }

    function renderProblems(diagnostics) {
      currentDiagnostics = diagnostics || [];
      const count = currentDiagnostics.length;
      problemCountEl.textContent = `${count} ${count === 1 ? 'problema' : 'problemas'}`;
      probCountBadge.textContent = String(count);

      if (count === 0) {
        problemsList.innerHTML = `
          <div class="problem-empty-state">
            <span>Nenhum problema encontrado no código digitado.</span>
          </div>
        `;
        return;
      }

      const categoryLabels = {
        syntax: 'Erro de sintaxe',
        divergence: 'Divergência do exercício',
        limitation: 'Limitação da análise',
        warning: 'Aviso'
      };

      problemsList.innerHTML = currentDiagnostics.map((d, idx) => `
        <div class="problem-card" role="listitem">
          <div class="problem-top">
            <span class="problem-badge ${escapeHtml(d.category)}">${escapeHtml(categoryLabels[d.category] || d.category)}</span>
            <span class="problem-location">Linha ${d.line}, Coluna ${d.column}</span>
          </div>
          <div class="problem-msg">${escapeHtml(d.message)}</div>
          ${d.hint ? `<div class="problem-hint">${escapeHtml(d.hint)}</div>` : ''}
          <button class="locate-btn" type="button" data-problem-index="${idx}">
            <svg class="icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2">
              <circle cx="11" cy="11" r="8"></line>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            Localizar e corrigir
          </button>
        </div>
      `).join('');

      // Add click listeners to locate buttons
      problemsList.querySelectorAll('.locate-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.dataset.problemIndex);
          const diag = currentDiagnostics[idx];
          if (diag) {
            if (options.onUnlock && isReadOnly) {
              options.onUnlock();
            }
            focusAndSelect(diag.range.start, diag.range.end);
          }
        });
      });
    }

    function focusAndSelect(start, end) {
      if (isReadOnly) {
        setReadOnly(false);
      }
      textarea.focus();
      try {
        textarea.setSelectionRange(start, end);
      } catch (ignored) {}
      updateCursorPos();

      // Scroll textarea to selection if needed
      textarea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function setReadOnly(ro) {
      isReadOnly = !!ro;
      textarea.disabled = isReadOnly;
    }

    function handleInput() {
      if (isComposing) return;
      const val = textarea.value;
      updateGutter();
      updateCursorPos();
      syncBackdrop();

      if (options.onChange) {
        options.onChange(val);
      }

      // Debounce live check
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (typeof CodeAnalyzer !== 'undefined') {
          const liveRes = CodeAnalyzer.analyzeCode(question, textarea.value, { phase: 'live' });
          currentDiagnostics = liveRes.diagnostics || [];
          renderProblems(currentDiagnostics);
          syncBackdrop();
        }
      }, 400);
    }

    textarea.addEventListener('input', handleInput);

    textarea.addEventListener('compositionstart', () => {
      isComposing = true;
    });

    textarea.addEventListener('compositionend', () => {
      isComposing = false;
      handleInput();
    });

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const spaces = '  ';
        textarea.value = textarea.value.substring(0, start) + spaces + textarea.value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + spaces.length;
        handleInput();
      }
    });

    textarea.addEventListener('scroll', () => {
      backdrop.scrollTop = textarea.scrollTop;
      backdrop.scrollLeft = textarea.scrollLeft;
      gutter.scrollTop = textarea.scrollTop;
    });

    ['keyup', 'click', 'focus', 'select'].forEach(ev => {
      textarea.addEventListener(ev, updateCursorPos);
    });

    // Initial render
    updateGutter();
    updateCursorPos();
    renderProblems(currentDiagnostics);
    syncBackdrop();

    return {
      getValue() {
        return textarea.value;
      },
      setValue(val) {
        textarea.value = String(val || '');
        updateGutter();
        updateCursorPos();
        syncBackdrop();
      },
      setDiagnostics(diags) {
        renderProblems(diags);
        syncBackdrop();
      },
      focusAndSelect,
      setReadOnly,
      destroy() {
        clearTimeout(debounceTimer);
        textarea.removeEventListener('input', handleInput);
        rootEl.innerHTML = '';
      }
    };
  }

  return { create };
});
