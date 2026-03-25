/**
 * feedback.js
 *
 * Sistema de feedback didático:
 *   - Fila de mensagens com diferentes severidades
 *   - Histórico das últimas mensagens
 *   - Indicador de desempenho da arrancada
 */

// ============================================================
//  MÓDULO DE FEEDBACK
// ============================================================
const feedback = (() => {
  const MAX_HISTORY = 6;
  let _history = [];
  let _currentTimeout = null;

  // Severidades: 'info' | 'success' | 'warning' | 'error' | 'stall' | 'tip'
  const COLORS = {
    info:    '#82cfff',
    success: '#42be65',
    warning: '#f1c21b',
    error:   '#fa4d56',
    stall:   '#ff6b6b',
    tip:     '#be95ff',
  };

  const ICONS = {
    info:    'ℹ️',
    success: '✅',
    warning: '⚠️',
    error:   '❌',
    stall:   '🔴',
    tip:     '💡',
  };

  /**
   * Adiciona uma mensagem de feedback.
   * @param {string} text     - Texto da mensagem
   * @param {string} severity - info | success | warning | error | stall | tip
   */
  function addMessage(text, severity = 'info') {
    const el = document.getElementById('feedback-message');
    if (!el) return;

    const color = COLORS[severity] || COLORS.info;
    el.textContent = text;
    el.style.color = color;
    el.style.borderColor = color;

    // Adicionar ao histórico
    _history.unshift({ text, severity, time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) });
    if (_history.length > MAX_HISTORY) _history.pop();
    _renderHistory();
  }

  /** Limpa a mensagem principal e o histórico. */
  function clearMessages() {
    const el = document.getElementById('feedback-message');
    if (el) {
      el.textContent = 'Ligue o motor para começar!';
      el.style.color = COLORS.info;
      el.style.borderColor = COLORS.info;
    }
    _history = [];
    _renderHistory();
  }

  /** Renderiza o histórico na lista. */
  function _renderHistory() {
    const list = document.getElementById('history-list');
    if (!list) return;
    list.innerHTML = '';
    _history.forEach(({ text, severity, time }) => {
      const li = document.createElement('li');
      li.style.color = COLORS[severity] || COLORS.info;
      li.textContent = `[${time}] ${text}`;
      list.appendChild(li);
    });
  }

  /**
   * Atualiza o indicador de desempenho da arrancada.
   * @param {'suave'|'razoavel'|'ruim'|'estancou'|''} perf
   */
  function setStartPerformance(perf) {
    const el = document.getElementById('perf-indicator');
    if (!el) return;
    const labels = {
      suave:    { text: '🟢 Arrancada: SUAVE',    color: '#42be65' },
      razoavel: { text: '🟡 Arrancada: RAZOÁVEL', color: '#f1c21b' },
      ruim:     { text: '🟠 Arrancada: RUIM',     color: '#ff832b' },
      estancou: { text: '🔴 ESTANCOU',            color: '#fa4d56' },
      '':       { text: '',                        color: 'transparent' },
    };
    const entry = labels[perf] || labels[''];
    el.textContent = entry.text;
    el.style.color = entry.color;
  }

  return { addMessage, clearMessages, setStartPerformance };
})();
