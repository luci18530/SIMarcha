/**
 * simulation.js
 *
 * Núcleo da simulação do carro manual.
 * Contém constantes físicas, estado do veículo e toda a lógica de
 * embreagem, motor, marchas e dinâmica de velocidade.
 *
 * Convenção dos pedais:
 *   clutchPosition   0 = totalmente pressionada (embreagem desacoplada)
 *                    1 = totalmente solta       (embreagem acoplada)
 *   acceleratorPosition  0 = sem gás  /  1 = fundo
 *   brakePosition        0 = sem freio / 1 = fundo
 */

// ============================================================
//  CONSTANTES DA SIMULAÇÃO
// ============================================================
const SIM = {
  // RPM do motor
  IDLE_RPM: 850,      // RPM em marcha lenta
  STALL_RPM: 420,     // RPM mínima antes de estancar
  MAX_RPM: 7200,      // Limite físico
  REDLINE_RPM: 6200,  // Zona vermelha (aviso)

  // Zona de fricção da embreagem (0 = pressionada, 1 = solta)
  FRICTION_START: 0.28,  // Início da zona de atrito
  FRICTION_POINT: 0.50,  // Ponto de fricção (carro começa a mover)
  FRICTION_END: 0.72,    // Fim da zona — totalmente acoplado

  // RPM por km/h em cada marcha (quando totalmente acoplado)
  GEAR_RPM_FACTOR: { '-1': 180, 0: 0, 1: 175, 2: 108, 3: 72, 4: 50, 5: 36 },

  // Velocidade máxima ideal em cada marcha (km/h)
  GEAR_MAX_SPEED: { '-1': 20, 0: 0, 1: 30, 2: 55, 3: 85, 4: 120, 5: 160 },

  // Física de velocidade
  FRICTION_ACCEL: 14,   // Aceleração máxima na zona de fricção (km/h/s)
  DRIVE_ACCEL: 28,      // Aceleração máxima com embreagem totalmente solta (km/h/s)
  ENGINE_BRAKE: 4.5,    // Freio motor (km/h/s)
  BRAKE_DECEL: 38,      // Desaceleração máxima do freio (km/h/s)
  ROAD_FRICTION: 0.6,   // Atrito de rolagem (km/h/s)
  DRAG_COEF: 0.016,     // Resistência aerodinâmica (por (km/h)²/s)

  // Resposta do motor ao acelerador
  RPM_RESPONSE_FREE: 9,    // Quão rápido o RPM sobe (motor livre)
  RPM_RESPONSE_COUPLED: 8, // Quão rápido o RPM se ajusta (motor acoplado)

  // Limiares para detecção de abuso / qualidade de arrancada
  CLUTCH_FAST_RELEASE: 1.8,   // Velocidade de soltura considerada brusca (pos/s)
  CLUTCH_ABUSE_SPEED: 1.5,    // Velocidade de soltura para aviso de abuso (pos/s)
  CLUTCH_ABUSE_MIN_ENG: 0.25, // Engagement mínimo para o aviso ser relevante
  LOW_ACCEL_THRESHOLD: 0.15,  // Acelerador abaixo disto é considerado "insuficiente"
  ACCEL_RPM_BOOST: 400,       // Boost de RPM do acelerador no modo acoplado

  // Efetividade do motor (curva de torque simplificada)
  IDLE_OFFSET_FACTOR: 0.4,    // Fator do RPM idle na curva de torque
  TORQUE_RPM_RANGE: 2000,     // Faixa de RPM para atingir efetividade máxima

  // Condições de estancamento ao parar
  STALL_STOP_SPEED: 1.0,      // Velocidade abaixo da qual o carro pode estancar ao parar (km/h)
  BRAKE_STALL_THRESHOLD: 0.3, // Pressão de freio que inicia a verificação de estancamento
  CLUTCH_STALL_FACTOR: 0.8,   // Clutch acima de END * FACTOR = embreagem não pressionada

  // Condições de boa arrancada (para detecção de arranque suave)
  GOOD_START_ENG_MIN: 0.15,   // Engagement mínimo na fricção
  GOOD_START_ENG_MAX: 0.85,   // Engagement máximo na fricção
  GOOD_START_ACCEL_MIN: 0.05, // Acelerador mínimo para contar como boa saída
  GOOD_START_SPEED_MIN: 1.0,  // Velocidade mínima para detectar arrancada (km/h)
  GOOD_START_SPEED_MAX: 20.0, // Velocidade máxima para detectar arrancada (km/h)
};

// ============================================================
//  ESTADO DA SIMULAÇÃO
// ============================================================
const state = {
  // Motor
  engineRunning: false,
  rpm: 0,
  stalled: false,

  // Pedais (alterados pelo controls.js)
  clutchPosition: 0,      // 0 = pressionada, 1 = solta
  acceleratorPosition: 0,
  brakePosition: 0,

  // Câmbio
  gear: 0,   // 0 = neutro, 1-5, -1 = ré

  // Movimento
  speed: 0,  // km/h

  // Diagnósticos de fricção (para feedback e treino)
  inFrictionZone: false,
  atFrictionPoint: false,

  // Histórico / estatísticas
  stallCount: 0,
  clutchAbuseCount: 0,
  goodStartCount: 0,
};

// ============================================================
//  FUNÇÕES DE CONTROLE DO MOTOR
// ============================================================

/**
 * Liga o motor. Retorna false se não for possível.
 * Exige embreagem pressionada (ou neutro) para ligar.
 */
function startEngine() {
  if (state.engineRunning) return false;

  if (state.gear !== 0 && state.clutchPosition > SIM.FRICTION_END) {
    feedback.addMessage('Pressione a embreagem antes de ligar o motor fora do neutro.', 'warning');
    return false;
  }

  state.engineRunning = true;
  state.stalled = false;
  state.rpm = SIM.IDLE_RPM;
  feedback.addMessage('✅ Motor ligado! Engate a 1ª marcha e tente arrancar.', 'success');
  return true;
}

/** Desliga o motor. */
function stopEngine() {
  state.engineRunning = false;
  state.rpm = 0;
  feedback.addMessage('Motor desligado.', 'info');
}

/** Liga/desliga (ignição). */
function toggleIgnition() {
  if (state.stalled) {
    // Religar após estancar
    state.stalled = false;
    startEngine();
  } else if (state.engineRunning) {
    stopEngine();
  } else {
    startEngine();
  }
}

/**
 * Troca de marcha.
 * @param {number} newGear  0=neutro, 1-5, -1=ré
 * @returns {boolean} true se a troca foi aceita
 */
function shiftGear(newGear) {
  // Verificar embreagem
  if (state.engineRunning && state.clutchPosition > SIM.FRICTION_END) {
    feedback.addMessage('⚠️ Pise na embreagem antes de trocar marcha!', 'error');
    return false;
  }

  // Ré proibida em movimento
  if (newGear === -1 && state.speed > 5) {
    feedback.addMessage('⚠️ Não engate a ré com o carro em movimento!', 'error');
    return false;
  }

  const prevGear = state.gear;
  state.gear = newGear;

  const names = { '-1': 'Ré', 0: 'Neutro', 1: '1ª', 2: '2ª', 3: '3ª', 4: '4ª', 5: '5ª' };
  if (newGear !== 0) {
    feedback.addMessage(`Marcha ${names[newGear]} engatada. ✓`, 'success');
    // Notificar o módulo de treino
    if (typeof training !== 'undefined') training.onGearShift(prevGear, newGear);
  } else {
    feedback.addMessage('Neutro engatado.', 'info');
  }
  return true;
}

/** Provoca o estancamento do motor com uma razão. */
function triggerStall(reason) {
  if (!state.engineRunning) return;

  state.engineRunning = false;
  state.stalled = true;
  state.rpm = 0;
  state.stallCount++;

  const msgs = {
    clutch_fast: 'Você soltou a embreagem rápido demais!',
    low_rpm: 'Faltou aceleração — o motor não aguentou!',
    wrong_gear: 'A marcha estava muito alta para a velocidade!',
    stop_no_clutch: 'O carro parou sem a embreagem pressionada!',
  };
  feedback.addMessage(`🔴 ESTANCOU! ${msgs[reason] || 'O motor morreu.'}`, 'stall');

  setTimeout(() => {
    feedback.addMessage('💡 Pressione a embreagem e clique em "Ligar / Religar".', 'tip');
  }, 1200);

  if (typeof training !== 'undefined') training.onStall(reason);
}

/** Reinicia todos os valores ao estado inicial. */
function resetSimulator() {
  state.engineRunning = false;
  state.rpm = 0;
  state.stalled = false;
  state.clutchPosition = 0;
  state.acceleratorPosition = 0;
  state.brakePosition = 0;
  state.gear = 0;
  state.speed = 0;
  state.inFrictionZone = false;
  state.atFrictionPoint = false;
  state.stallCount = 0;
  state.clutchAbuseCount = 0;
  state.goodStartCount = 0;

  feedback.clearMessages();
  feedback.addMessage('Simulador reiniciado. Ligue o motor para começar!', 'info');
  if (typeof training !== 'undefined') training.reset();
}

// ============================================================
//  LOOP DE ATUALIZAÇÃO DA FÍSICA
// ============================================================

// Rastreamento para detecção de gestos bruscos
let _prevClutch = 0;
let _frictionNotified = false;
let _gearWarnCooldown = 0;
let _goodStartTimer = 0;   // frames em boa saída para detectar arranque suave
let _inGoodStart = false;

/**
 * Atualiza a simulação para um frame.
 * @param {number} dt  Delta time em segundos (tipicamente ~0.016 para 60 fps)
 */
function updateSimulation(dt) {
  const clutch = state.clutchPosition;
  const accel = state.acceleratorPosition;
  const brake = state.brakePosition;
  const gear = state.gear;

  // Velocidade de movimento da embreagem (positivo = soltando)
  const clutchSpeed = (clutch - _prevClutch) / dt;
  _prevClutch = clutch;

  if (!state.engineRunning) {
    // Motor desligado: carro desacelera naturalmente
    if (state.speed > 0) {
      state.speed = Math.max(0, state.speed - SIM.ROAD_FRICTION * 2 * dt);
    }
    state.rpm = 0;
    return;
  }

  // RPM alvo do motor livre (somente pelo acelerador)
  const targetFreeRPM = SIM.IDLE_RPM + accel * (SIM.REDLINE_RPM - SIM.IDLE_RPM);

  // RPM correspondente à velocidade atual nesta marcha
  const wheelRPM = (gear !== 0) ? Math.abs(state.speed) * SIM.GEAR_RPM_FACTOR[gear] : 0;

  // Determinar zona da embreagem
  const prevFriction = state.inFrictionZone;
  state.inFrictionZone = (clutch >= SIM.FRICTION_START && clutch <= SIM.FRICTION_END && gear !== 0);
  state.atFrictionPoint = state.inFrictionZone && Math.abs(clutch - SIM.FRICTION_POINT) < 0.08;

  // Notificar ponto de fricção (apenas uma vez por soltura)
  if (!prevFriction && state.inFrictionZone) {
    _frictionNotified = false; // resetar ao entrar na zona
  }
  if (!_frictionNotified && state.atFrictionPoint && gear !== 0 && state.speed < 1) {
    _frictionNotified = true;
    feedback.addMessage('⭐ Ponto de fricção! Adicione um pouco de gás agora.', 'info');
    if (typeof training !== 'undefined') training.onFrictionPoint();
  }

  const fullyDisengaged = (clutch < SIM.FRICTION_START) || (gear === 0);
  const fullyEngaged = (clutch > SIM.FRICTION_END) && (gear !== 0);

  // ----------------------------------------------------------
  //  EMBREAGEM TOTALMENTE PRESSIONADA OU NEUTRO
  // ----------------------------------------------------------
  if (fullyDisengaged) {
    _advanceRPM(targetFreeRPM, SIM.RPM_RESPONSE_FREE, dt);
    _applyDeceleration(dt, brake);
    _inGoodStart = false;

  // ----------------------------------------------------------
  //  ZONA DE FRICÇÃO
  // ----------------------------------------------------------
  } else if (state.inFrictionZone) {
    const engagement = (clutch - SIM.FRICTION_START) / (SIM.FRICTION_END - SIM.FRICTION_START);
    // engagement: 0 = início da fricção, 1 = totalmente acoplado

    // RPM é "puxado" em direção ao RPM das rodas conforme o acoplamento
    const mixedTarget = targetFreeRPM * (1 - engagement) + wheelRPM * engagement;
    _advanceRPM(mixedTarget, 5, dt);

    // Verificar estancamento
    if (state.rpm < SIM.STALL_RPM) {
      triggerStall(clutchSpeed > SIM.CLUTCH_FAST_RELEASE ? 'clutch_fast' : 'low_rpm');
      return;
    }

    // Aviso de soltura brusca
    if (clutchSpeed > SIM.CLUTCH_ABUSE_SPEED && engagement > SIM.CLUTCH_ABUSE_MIN_ENG && accel < SIM.LOW_ACCEL_THRESHOLD) {
      state.clutchAbuseCount++;
      feedback.addMessage('⚠️ Soltando a embreagem rápido demais! Vai mais devagar.', 'warning');
    }

    // Impulso proporcional ao acoplamento e ao excesso de RPM sobre as rodas
    const rpmExcess = Math.max(0, state.rpm - wheelRPM);
    const driveFraction = engagement * Math.min(1, rpmExcess / (SIM.IDLE_RPM + 100));
    state.speed += driveFraction * SIM.FRICTION_ACCEL * dt;

    // Detectar arranque suave
    _trackGoodStart(engagement, accel, dt);

    _applyDeceleration(dt, brake);

  // ----------------------------------------------------------
  //  EMBREAGEM TOTALMENTE SOLTA — MOTOR ACOPLADO
  // ----------------------------------------------------------
  } else if (fullyEngaged) {
    const targetRPM = wheelRPM + accel * SIM.ACCEL_RPM_BOOST;
    _advanceRPM(targetRPM, SIM.RPM_RESPONSE_COUPLED, dt);

    // Estancamento por velocidade muito baixa sem aceleração
    if (state.rpm < SIM.STALL_RPM && state.speed < 4) {
      triggerStall('low_rpm');
      return;
    }

    // Freio motor
    if (accel < 0.05) {
      state.speed = Math.max(0, state.speed - SIM.ENGINE_BRAKE * dt);
    }

    // Força propulsora
    const effectiveness = Math.min(1, (state.rpm - SIM.IDLE_RPM * SIM.IDLE_OFFSET_FACTOR) / SIM.TORQUE_RPM_RANGE);
    const maxSpeed = SIM.GEAR_MAX_SPEED[gear];
    const speedRatio = maxSpeed > 0 ? state.speed / maxSpeed : 0;
    const availAccel = SIM.DRIVE_ACCEL * Math.max(0, 1 - speedRatio * 0.75);
    state.speed += accel * effectiveness * availAccel * dt;

    // Aviso de marcha inadequada
    _checkGearAdequacy();
    _applyDeceleration(dt, brake);

    // Parar sem embreagem → estancar
    if (state.speed < SIM.STALL_STOP_SPEED && brake > SIM.BRAKE_STALL_THRESHOLD && clutch < SIM.FRICTION_END * SIM.CLUTCH_STALL_FACTOR) {
      if (state.speed < 0.5) {
        triggerStall('stop_no_clutch');
        return;
      }
    }
    _inGoodStart = false;
  }

  // Resistência aerodinâmica e atrito de rolagem
  state.speed = Math.max(0, state.speed - SIM.ROAD_FRICTION * dt);
  state.speed = Math.max(0, state.speed - SIM.DRAG_COEF * state.speed * state.speed * dt);

  // Limites de RPM
  state.rpm = Math.max(0, Math.min(SIM.MAX_RPM, state.rpm));
  if (state.engineRunning && fullyDisengaged) {
    state.rpm = Math.max(SIM.IDLE_RPM, state.rpm); // Não cai abaixo da marcha lenta quando livre
  }

  // RPM máximo — aviso de zona vermelha
  if (state.rpm > SIM.REDLINE_RPM && _gearWarnCooldown <= 0) {
    feedback.addMessage('⚠️ RPM na zona vermelha! Troque para uma marcha mais alta.', 'warning');
    _gearWarnCooldown = 180;
  }

  if (_gearWarnCooldown > 0) _gearWarnCooldown--;

  // Velocidade nunca negativa (exceto ré, simplificado)
  if (gear !== -1) state.speed = Math.max(0, state.speed);
}

// ============================================================
//  AUXILIARES INTERNOS
// ============================================================

/** Avança o RPM suavemente em direção ao alvo. */
function _advanceRPM(target, speed, dt) {
  const diff = target - state.rpm;
  state.rpm += diff * Math.min(1, speed * dt);
}

/** Aplica freio e atrito de pista. */
function _applyDeceleration(dt, brake) {
  if (brake > 0) {
    state.speed = Math.max(0, state.speed - brake * SIM.BRAKE_DECEL * dt);
  }
}

/** Verifica se a marcha é adequada para a velocidade e sugere trocas. */
let _gearAdequacyCooldown = 0;
function _checkGearAdequacy() {
  if (_gearAdequacyCooldown > 0) { _gearAdequacyCooldown--; return; }
  const g = state.gear;
  if (g <= 0) return;
  const speed = state.speed;
  const max = SIM.GEAR_MAX_SPEED[g];

  if (g > 1 && speed < max * 0.18) {
    feedback.addMessage(`⚠️ ${g}ª marcha muito alta para esta velocidade. Use a ${g - 1}ª.`, 'warning');
    _gearAdequacyCooldown = 300;
  } else if (g < 5 && speed > SIM.GEAR_MAX_SPEED[g + 1] * 0.45) {
    feedback.addMessage(`💡 Hora de subir para a ${g + 1}ª marcha.`, 'tip');
    _gearAdequacyCooldown = 300;
  }
}

/** Detecta arranque suave e parabeniza o usuário. */
function _trackGoodStart(engagement, accel, dt) {
  if (
    engagement > SIM.GOOD_START_ENG_MIN &&
    engagement < SIM.GOOD_START_ENG_MAX &&
    accel > SIM.GOOD_START_ACCEL_MIN &&
    state.speed > SIM.GOOD_START_SPEED_MIN &&
    state.speed < SIM.GOOD_START_SPEED_MAX
  ) {
    _goodStartTimer += dt;
    _inGoodStart = true;
    if (_goodStartTimer > 2.0 && !_feedbackGoodStart) {
      _feedbackGoodStart = true;
      state.goodStartCount++;
      feedback.addMessage('🟢 Boa saída! Você controlou bem a embreagem.', 'success');
      if (typeof training !== 'undefined') training.onGoodStart();
    }
  } else if (!state.inFrictionZone) {
    _goodStartTimer = 0;
    _feedbackGoodStart = false;
    _inGoodStart = false;
  }
}
let _feedbackGoodStart = false;

/**
 * Retorna a marcha sugerida para a velocidade atual.
 * @returns {number}
 */
function getSuggestedGear() {
  const s = state.speed;
  if (s < 22) return 1;
  if (s < 42) return 2;
  if (s < 68) return 3;
  if (s < 98) return 4;
  return 5;
}
