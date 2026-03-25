/**
 * controls.js
 *
 * Gerencia todos os inputs do usuário:
 *   - Teclado (hold para pedais graduais, teclas para marchas/ignição)
 *   - Mouse (arrastar pedais)
 *   - Botões do câmbio na interface
 *
 * Controles de teclado:
 *   Shift        → Embreagem (segure para pisar)
 *   W            → Acelerador (segure para acelerar)
 *   S            → Freio (segure para frear)
 *   1 a 5        → Engatar marcha correspondente
 *   N            → Neutro
 *   R            → Ré
 *   I ou Enter   → Ignição (ligar/desligar)
 *   F5           → Reset
 */

// ============================================================
//  ESTADO DOS CONTROLES
// ============================================================
const controls = {
  keys: {}, // teclas pressionadas no momento

  // Velocidade de movimento dos pedais pelo teclado (unidades por segundo)
  CLUTCH_PRESS_SPEED: 3.5,   // velocidade de pressionar a embreagem
  CLUTCH_RELEASE_SPEED: 0.8, // velocidade de soltar a embreagem (mais devagar = mais didático)
  ACCEL_SPEED: 2.5,
  BRAKE_SPEED: 3.0,
  PEDAL_RETURN_SPEED: 4.0,   // velocidade de retorno quando a tecla é solta

  // Arrastar pedal com mouse
  dragging: null, // { pedal: 'clutch'|'accel'|'brake', startY, startVal }
};

// ============================================================
//  TECLADO
// ============================================================
document.addEventListener('keydown', (e) => {
  // Ignorar repetição automática de tecla pressionada
  if (e.repeat) return;
  controls.keys[e.code] = true;

  // Ações que disparam uma única vez ao pressionar
  switch (e.code) {
    case 'Digit1': shiftGear(1); break;
    case 'Digit2': shiftGear(2); break;
    case 'Digit3': shiftGear(3); break;
    case 'Digit4': shiftGear(4); break;
    case 'Digit5': shiftGear(5); break;
    case 'KeyN':   shiftGear(0); break;
    case 'KeyR':   shiftGear(-1); break;
    case 'KeyI':
    case 'Enter':
      toggleIgnition();
      break;
    case 'F5':
      e.preventDefault();
      resetSimulator();
      break;
  }
});

document.addEventListener('keyup', (e) => {
  controls.keys[e.code] = false;
});

// ============================================================
//  ATUALIZAÇÃO DOS PEDAIS (chamada a cada frame)
// ============================================================

/**
 * Lê as teclas pressionadas e ajusta as posições dos pedais gradualmente.
 * @param {number} dt  Delta time em segundos
 */
function updateControls(dt) {
  const keys = controls.keys;

  // ── Embreagem (ShiftLeft / ShiftRight / KeyC) ──────────────
  if (keys['ShiftLeft'] || keys['ShiftRight'] || keys['KeyC']) {
    // Pedal pressionado → position vai a 0 (desacoplada)
    state.clutchPosition = Math.max(0, state.clutchPosition - controls.CLUTCH_PRESS_SPEED * dt);
  } else {
    // Pedal solto → position volta a 1 (acoplada) — MAIS DEVAGAR para ser didático
    state.clutchPosition = Math.min(1, state.clutchPosition + controls.CLUTCH_RELEASE_SPEED * dt);
  }

  // ── Acelerador (W / ArrowUp) ────────────────────────────────
  if (keys['KeyW'] || keys['ArrowUp']) {
    state.acceleratorPosition = Math.min(1, state.acceleratorPosition + controls.ACCEL_SPEED * dt);
  } else {
    state.acceleratorPosition = Math.max(0, state.acceleratorPosition - controls.PEDAL_RETURN_SPEED * dt);
  }

  // ── Freio (S / ArrowDown) ───────────────────────────────────
  if (keys['KeyS'] || keys['ArrowDown']) {
    state.brakePosition = Math.min(1, state.brakePosition + controls.BRAKE_SPEED * dt);
  } else {
    state.brakePosition = Math.max(0, state.brakePosition - controls.PEDAL_RETURN_SPEED * dt);
  }

  // Garantir intervalo [0, 1]
  state.clutchPosition = clamp(state.clutchPosition, 0, 1);
  state.acceleratorPosition = clamp(state.acceleratorPosition, 0, 1);
  state.brakePosition = clamp(state.brakePosition, 0, 1);
}

// ============================================================
//  CONTROLE DOS PEDAIS POR MOUSE / TOUCH
// ============================================================

/**
 * Configura o arrastar de pedal com o mouse.
 * Chamado após o DOM ser criado (em main.js).
 */
function initPedalDrag() {
  const pedals = [
    { id: 'pedal-clutch', key: 'clutchPosition', inverted: true },
    { id: 'pedal-accel',  key: 'acceleratorPosition', inverted: false },
    { id: 'pedal-brake',  key: 'brakePosition', inverted: false },
  ];

  pedals.forEach(({ id, key, inverted }) => {
    const el = document.getElementById(id);
    if (!el) return;

    const startDrag = (clientY) => {
      controls.dragging = { key, inverted, startY: clientY, startVal: state[key] };
    };

    el.addEventListener('mousedown', (e) => { e.preventDefault(); startDrag(e.clientY); });
    el.addEventListener('touchstart', (e) => { e.preventDefault(); startDrag(e.touches[0].clientY); }, { passive: false });
  });

  document.addEventListener('mousemove', (e) => {
    if (!controls.dragging) return;
    applyDrag(e.clientY);
  });

  document.addEventListener('touchmove', (e) => {
    if (!controls.dragging) return;
    e.preventDefault();
    applyDrag(e.touches[0].clientY);
  }, { passive: false });

  const endDrag = () => { controls.dragging = null; };
  document.addEventListener('mouseup', endDrag);
  document.addEventListener('touchend', endDrag);
}

/** Aplica o deslocamento do mouse/touch ao valor do pedal. */
function applyDrag(clientY) {
  const { key, inverted, startY, startVal } = controls.dragging;
  // Mapear chave de estado para ID do elemento pedal
  const pedalIdMap = { clutchPosition: 'pedal-clutch', acceleratorPosition: 'pedal-accel', brakePosition: 'pedal-brake' };
  const pedalEl = document.getElementById(pedalIdMap[key] || '');
  const trackHeight = pedalEl ? pedalEl.clientHeight || 150 : 150;

  const deltaY = clientY - startY;
  // Arrastar para baixo aumenta a pressão (valor aumenta = mais gás/freio)
  // Para embreagem: inverted = true (arrastar para baixo = embreagem pressionada = position diminui)
  const delta = (inverted ? -1 : 1) * (-deltaY / trackHeight);
  state[key] = clamp(startVal + delta, 0, 1);
}

// ============================================================
//  BOTÕES DO CÂMBIO (cliques na grade H)
// ============================================================

/** Configura os botões do câmbio para responder a cliques. */
function initShifterButtons() {
  document.querySelectorAll('.gear-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const gear = parseInt(btn.dataset.gear, 10);
      shiftGear(gear);
    });
  });
}

// ============================================================
//  UTILITÁRIO
// ============================================================
function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}
