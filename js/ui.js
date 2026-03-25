/**
 * ui.js
 *
 * Responsável por toda a renderização da interface:
 *   - Gauge de RPM (canvas)
 *   - Indicadores de velocidade, marcha, estado do motor
 *   - Barras dos pedais
 *   - Marcadores de zona de fricção
 *   - Câmbio (destaque da marcha ativa)
 *   - Sugestão de marcha
 *   - Indicador de desempenho
 */

// ============================================================
//  REFERÊNCIAS DOM (preenchidas em initUI)
// ============================================================
const ui = (() => {
  let _canvas, _ctx;

  // ─────────────────────────────────────────────────────────
  //  INICIALIZAÇÃO
  // ─────────────────────────────────────────────────────────
  function init() {
    _canvas = document.getElementById('rpm-canvas');
    if (_canvas) _ctx = _canvas.getContext('2d');
  }

  // ─────────────────────────────────────────────────────────
  //  FRAME — atualiza toda a UI com o estado atual
  // ─────────────────────────────────────────────────────────
  function update() {
    _updateEngineStatus();
    _updateRpmGauge();
    _updateSpeedometer();
    _updateGearDisplay();
    _updatePedals();
    _updateShifter();
    _updateGearSuggestion();
    _updatePerfIndicator();
  }

  // ─────────────────────────────────────────────────────────
  //  STATUS DO MOTOR
  // ─────────────────────────────────────────────────────────
  function _updateEngineStatus() {
    const el = document.getElementById('engine-status');
    if (!el) return;
    if (state.stalled) {
      el.textContent = '⛔ MOTOR ESTANCADO';
      el.className = 'engine-status stalled';
    } else if (state.engineRunning) {
      el.textContent = '✅ MOTOR LIGADO';
      el.className = 'engine-status running';
    } else {
      el.textContent = '⭕ MOTOR DESLIGADO';
      el.className = 'engine-status off';
    }
  }

  // ─────────────────────────────────────────────────────────
  //  GAUGE DE RPM (canvas semicircular)
  // ─────────────────────────────────────────────────────────
  function _updateRpmGauge() {
    if (!_ctx) return;
    const w = _canvas.width;
    const h = _canvas.height;
    _ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h * 0.88;
    const r = h * 0.82;

    // Ângulos: de 210° (esquerda) até -30° (direita) no sentido horário
    const startAngle = (210 * Math.PI) / 180;
    const endAngle = (-30 * Math.PI) / 180;
    const totalAngle = (240 * Math.PI) / 180; // 240 graus de arco

    // ── Faixa de fundo (cinza escuro) ──
    _ctx.beginPath();
    _ctx.arc(cx, cy, r, startAngle, endAngle, false);
    _ctx.strokeStyle = '#2d3748';
    _ctx.lineWidth = 14;
    _ctx.stroke();

    // ── Faixas coloridas ──
    const rpmMax = SIM.MAX_RPM;
    const zones = [
      { from: 0,               to: SIM.IDLE_RPM * 1.2, color: '#4a5568' },
      { from: SIM.IDLE_RPM,    to: SIM.REDLINE_RPM,    color: '#48bb78' },
      { from: SIM.REDLINE_RPM, to: SIM.MAX_RPM,         color: '#fc8181' },
    ];
    zones.forEach(({ from, to, color }) => {
      const a1 = startAngle + (from / rpmMax) * totalAngle;
      const a2 = startAngle + (to / rpmMax) * totalAngle;
      _ctx.beginPath();
      _ctx.arc(cx, cy, r, a1, a2, false);
      _ctx.strokeStyle = color;
      _ctx.lineWidth = 14;
      _ctx.stroke();
    });

    // ── Marcadores de RPM ──
    const marks = [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000];
    _ctx.fillStyle = '#a0aec0';
    _ctx.font = `bold ${Math.round(h * 0.13)}px monospace`;
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    marks.forEach((rpm) => {
      const angle = startAngle + (rpm / rpmMax) * totalAngle;
      const mx = cx + (r - 22) * Math.cos(angle);
      const my = cy + (r - 22) * Math.sin(angle);
      // pequeno marcador
      const ix = cx + r * Math.cos(angle);
      const iy = cy + r * Math.sin(angle);
      const ox = cx + (r + 8) * Math.cos(angle);
      const oy = cy + (r + 8) * Math.sin(angle);
      _ctx.beginPath();
      _ctx.moveTo(ix, iy);
      _ctx.lineTo(ox, oy);
      _ctx.strokeStyle = '#a0aec0';
      _ctx.lineWidth = 2;
      _ctx.stroke();
      // rótulo (apenas múltiplos de 2000)
      if (rpm % 2000 === 0) {
        _ctx.fillText(rpm / 1000, mx, my);
      }
    });

    // ── Agulha ──
    const needleAngle = startAngle + (Math.min(state.rpm, SIM.MAX_RPM) / rpmMax) * totalAngle;
    const needleLen = r * 0.82;
    _ctx.beginPath();
    _ctx.moveTo(cx, cy);
    _ctx.lineTo(cx + needleLen * Math.cos(needleAngle), cy + needleLen * Math.sin(needleAngle));
    _ctx.strokeStyle = '#fc8181';
    _ctx.lineWidth = 3;
    _ctx.lineCap = 'round';
    _ctx.stroke();

    // Centro da agulha
    _ctx.beginPath();
    _ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    _ctx.fillStyle = '#fc8181';
    _ctx.fill();

    // ── Texto RPM abaixo do gauge ──
    const rpmEl = document.getElementById('rpm-value');
    if (rpmEl) rpmEl.textContent = Math.round(state.rpm).toLocaleString('pt-BR') + ' RPM';
  }

  // ─────────────────────────────────────────────────────────
  //  VELOCÍMETRO
  // ─────────────────────────────────────────────────────────
  function _updateSpeedometer() {
    const el = document.getElementById('speed-value');
    if (el) el.textContent = Math.round(state.speed);
  }

  // ─────────────────────────────────────────────────────────
  //  MARCHA ATUAL
  // ─────────────────────────────────────────────────────────
  function _updateGearDisplay() {
    const el = document.getElementById('gear-value');
    if (!el) return;
    const names = { '-1': 'R', 0: 'N', 1: '1', 2: '2', 3: '3', 4: '4', 5: '5' };
    el.textContent = names[state.gear] ?? 'N';
    el.style.color = state.gear === 0 ? '#a0aec0' : '#63b3ed';
  }

  // ─────────────────────────────────────────────────────────
  //  BARRAS DOS PEDAIS
  // ─────────────────────────────────────────────────────────
  function _updatePedals() {
    // Embreagem: quando position=0 (pressionada), barra está cheia
    _setPedalBar('bar-clutch', 1 - state.clutchPosition);

    // Zona de fricção: markers visuais
    _updateFrictionMarkers();

    // Acelerador e freio: direto
    _setPedalBar('bar-accel', state.acceleratorPosition);
    _setPedalBar('bar-brake', state.brakePosition);

    // Atualizar rótulos de percentagem
    const vc = document.getElementById('val-clutch');
    const va = document.getElementById('val-accel');
    const vb = document.getElementById('val-brake');
    if (vc) vc.textContent = Math.round((1 - state.clutchPosition) * 100) + '%';
    if (va) va.textContent = Math.round(state.acceleratorPosition * 100) + '%';
    if (vb) vb.textContent = Math.round(state.brakePosition * 100) + '%';

    // Colorir clutch conforme a zona
    const bar = document.getElementById('bar-clutch');
    if (bar) {
      if (state.atFrictionPoint) {
        bar.style.background = 'linear-gradient(to top, #f6e05e, #ed8936)';
      } else if (state.inFrictionZone) {
        bar.style.background = 'linear-gradient(to top, #68d391, #38a169)';
      } else {
        bar.style.background = 'linear-gradient(to top, #63b3ed, #4299e1)';
      }
    }
  }

  /** Define a altura de uma barra de pedal (0 a 1). */
  function _setPedalBar(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.height = `${Math.round(value * 100)}%`;
  }

  /** Posiciona os marcadores de zona de fricção na barra da embreagem. */
  function _updateFrictionMarkers() {
    // Os marcadores ficam na track; a barra cresce de baixo para cima.
    // clutchPosition=0 (pressionada) → barra cheia (100%)
    // clutchPosition=1 (solta)       → barra vazia (0%)
    // Zona de fricção: clutch de FRICTION_START a FRICTION_END
    // Em barra: (1 - FRICTION_END) a (1 - FRICTION_START) = 28% a 72%

    const markerStart = document.getElementById('marker-friction-start');
    const markerEnd   = document.getElementById('marker-friction-end');
    const markerPoint = document.getElementById('marker-friction-point');

    if (markerStart) markerStart.style.bottom = `${(1 - SIM.FRICTION_END) * 100}%`;
    if (markerEnd)   markerEnd.style.bottom   = `${(1 - SIM.FRICTION_START) * 100}%`;
    if (markerPoint) markerPoint.style.bottom = `${(1 - SIM.FRICTION_POINT) * 100}%`;

    // Destaque do marcador do ponto de fricção
    if (markerPoint) {
      markerPoint.classList.toggle('active', state.atFrictionPoint);
    }
  }

  // ─────────────────────────────────────────────────────────
  //  CÂMBIO (grade H)
  // ─────────────────────────────────────────────────────────
  function _updateShifter() {
    document.querySelectorAll('.gear-btn').forEach((btn) => {
      const g = parseInt(btn.dataset.gear, 10);
      btn.classList.toggle('active-gear', g === state.gear);
    });
  }

  // ─────────────────────────────────────────────────────────
  //  SUGESTÃO DE MARCHA
  // ─────────────────────────────────────────────────────────
  function _updateGearSuggestion() {
    const el = document.getElementById('gear-suggestion');
    if (!el) return;
    if (!state.engineRunning || state.speed < 3) {
      el.textContent = '';
      return;
    }
    const suggested = getSuggestedGear();
    const names = { 1: '1ª', 2: '2ª', 3: '3ª', 4: '4ª', 5: '5ª' };
    if (suggested !== state.gear && state.gear > 0) {
      el.textContent = `Marcha sugerida: ${names[suggested]}`;
      el.style.color = suggested < state.gear ? '#fc8181' : '#68d391';
    } else {
      el.textContent = '';
    }
  }

  // ─────────────────────────────────────────────────────────
  //  INDICADOR DE DESEMPENHO DA ARRANCADA
  // ─────────────────────────────────────────────────────────
  function _updatePerfIndicator() {
    if (!state.engineRunning) return;

    let perf = '';
    const accel = state.acceleratorPosition;
    const speed = state.speed;

    if (state.stalled) {
      perf = 'estancou';
    } else if (state.inFrictionZone && speed > 1 && speed < 20) {
      // Avaliar a qualidade da saída baseada na aceleração usada
      if (accel > 0.25) {
        perf = 'suave';
      } else if (accel > 0.08) {
        perf = 'razoavel';
      } else {
        perf = 'ruim';
      }
    }

    if (perf) feedback.setStartPerformance(perf);
  }

  return { init, update };
})();
