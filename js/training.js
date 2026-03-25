/**
 * training.js
 *
 * Modo Treino — exercícios guiados para iniciantes.
 *
 * Exercícios disponíveis:
 *   0 → Modo Livre (sem guia)
 *   1 → Encontrar o Ponto de Fricção
 *   2 → Arrancar sem Estancar
 *   3 → Trocar da 1ª para a 2ª
 *   4 → Parar e Sair Novamente
 */

const training = (() => {
  let _currentExercise = 0;
  let _phase = 0;          // fase interna de cada exercício
  let _stallsInExercise = 0;
  let _frictionHit = false;
  let _shiftDoneCorrect = false;
  let _goodStartDone = false;
  let _stoppedSuccessfully = false;
  let _restartedSuccessfully = false;

  // ─────────────────────────────────────────────────────────
  //  DEFINIÇÕES DOS EXERCÍCIOS
  // ─────────────────────────────────────────────────────────
  const EXERCISES = [
    {
      id: 0,
      title: '🚗 Modo Livre',
      description:
        'Explore o simulador sem restrições. Use os pedais e o câmbio à vontade.',
    },
    {
      id: 1,
      title: '🎯 Exercício 1 — Encontrar o Ponto de Fricção',
      description:
        'Ligue o motor, engate a 1ª marcha, pise completamente na embreagem e vá ' +
        'soltando-a <strong>muito devagar</strong> até o carro começar a se mover levemente. ' +
        'Esse é o <em>ponto de fricção</em>. Mantenha-o por 2 segundos sem estancar.',
    },
    {
      id: 2,
      title: '🚀 Exercício 2 — Arrancar sem Estancar',
      description:
        'Parta do zero: ligue o motor, engate a 1ª marcha. Pise na embreagem, ' +
        'dê um pouco de gás (não precisa ser muito) e vá soltando a embreagem suavemente ' +
        'até atingir 15 km/h sem estancar.',
    },
    {
      id: 3,
      title: '🔄 Exercício 3 — Trocar da 1ª para a 2ª',
      description:
        'Comece em 1ª e acelere até ~20 km/h. Então pise na embreagem, ' +
        'engate a 2ª marcha e solte a embreagem suavemente. ' +
        'Faça isso sem estancar e sem soltar a embreagem com pressa.',
    },
    {
      id: 4,
      title: '⏸️ Exercício 4 — Parar e Sair Novamente',
      description:
        'Em 1ª marcha, acelere até ~15 km/h. Então pare completamente ' +
        '(pise freio + embreagem), depois parta novamente sem estancar.',
    },
  ];

  // ─────────────────────────────────────────────────────────
  //  API PÚBLICA
  // ─────────────────────────────────────────────────────────

  /** Seleciona e inicia um exercício. */
  function selectExercise(id) {
    _currentExercise = id;
    _resetFlags();
    _renderExercise();

    if (id === 0) {
      _setResult('');
    } else {
      feedback.addMessage(`Exercício iniciado: ${EXERCISES[id].title}`, 'info');
    }
  }

  /** Chamado pela simulação quando o carro estanca. */
  function onStall(reason) {
    if (_currentExercise === 0) return;
    _stallsInExercise++;
    _setResult(`❌ Estancou (${_stallsInExercise}x neste exercício). Religue e tente novamente.`);
  }

  /** Chamado pela simulação quando o ponto de fricção é atingido. */
  function onFrictionPoint() {
    if (_currentExercise === 1 && !_frictionHit) {
      _frictionHit = true;
      _setResult('✅ Ponto de fricção encontrado! Mantenha por mais 2 segundos sem estancar.');
    }
  }

  /** Chamado pela simulação em arranque suave. */
  function onGoodStart() {
    if (_currentExercise === 2 && !_goodStartDone) {
      _goodStartDone = true;
      _setResult('🎉 Parabéns! Você arrancou sem estancar. Exercício 2 concluído!');
    }

    if (_currentExercise === 4 && _stoppedSuccessfully && !_restartedSuccessfully) {
      _restartedSuccessfully = true;
      _setResult('🎉 Perfeito! Você parou e saiu novamente. Exercício 4 concluído!');
    }
  }

  /** Chamado quando o usuário troca de marcha. */
  function onGearShift(from, to) {
    // Exercício 3: detectar troca de 1→2 bem feita (clutch pressionada)
    if (_currentExercise === 3 && from === 1 && to === 2 && state.speed > 15) {
      if (state.clutchPosition < SIM.FRICTION_START + 0.05) {
        _shiftDoneCorrect = true;
        _setResult('✅ Troca da 1ª para a 2ª feita corretamente! Solte a embreagem suavemente.');
      }
    }

    // Exercício 4: detectar parada (velocidade chegou a zero)
    if (_currentExercise === 4 && to === 0 && state.speed < 2) {
      _stoppedSuccessfully = true;
      _setResult('✅ Parado! Agora ligue e saia novamente.');
    }
  }

  /**
   * Chamado a cada frame para verificar condições de sucesso contínuas.
   * @param {number} dt
   */
  function update(dt) {
    if (_currentExercise === 0) return;

    // Exercício 1: manter no ponto de fricção por 2 s sem estancar
    if (_currentExercise === 1 && _frictionHit && !_stallsInExercise) {
      if (state.inFrictionZone && state.atFrictionPoint && state.speed > 0.2) {
        _phase += dt;
        if (_phase >= 2.0) {
          _setResult('🎉 Excelente! Você manteve o ponto de fricção por 2 segundos. Exercício 1 concluído!');
          _frictionHit = false; // evitar re-notificação
          _phase = 9999;        // congelar o contador
        }
      } else {
        if (_phase < 9999) _phase = Math.max(0, _phase - dt * 0.5);
      }
    }

    // Exercício 2: chegar a 15 km/h sem estancar
    if (_currentExercise === 2 && !_goodStartDone && state.speed >= 15 && state.engineRunning) {
      _goodStartDone = true;
      _setResult('🎉 Você chegou a 15 km/h sem estancar! Exercício 2 concluído!');
    }

    // Exercício 3: completar a troca e continuar andando
    if (_currentExercise === 3 && _shiftDoneCorrect && state.gear === 2 && state.speed > 10 && state.engineRunning) {
      _setResult('🎉 Perfeito! Troca de marcha bem-sucedida. Exercício 3 concluído!');
      _shiftDoneCorrect = false; // uma única notificação
    }
  }

  /** Reinicia o estado do treino. */
  function reset() {
    _currentExercise = 0;
    _resetFlags();
    _renderExercise();
    _setResult('');
  }

  // ─────────────────────────────────────────────────────────
  //  AUXILIARES INTERNOS
  // ─────────────────────────────────────────────────────────

  function _resetFlags() {
    _phase = 0;
    _stallsInExercise = 0;
    _frictionHit = false;
    _shiftDoneCorrect = false;
    _goodStartDone = false;
    _stoppedSuccessfully = false;
    _restartedSuccessfully = false;
  }

  function _renderExercise() {
    const ex = EXERCISES[_currentExercise];
    const titleEl = document.getElementById('exercise-title');
    const descEl = document.getElementById('exercise-desc');
    if (titleEl) titleEl.textContent = ex.title;
    if (descEl) descEl.innerHTML = ex.description;

    // Destacar botão ativo
    document.querySelectorAll('.exercise-btn').forEach((btn) => {
      btn.classList.toggle('active', parseInt(btn.dataset.exercise, 10) === _currentExercise);
    });
  }

  function _setResult(text) {
    const el = document.getElementById('exercise-result');
    if (!el) return;
    el.innerHTML = text;
    if (text.startsWith('🎉')) el.className = 'result-success';
    else if (text.startsWith('❌')) el.className = 'result-fail';
    else el.className = 'result-info';
  }

  return { selectExercise, onStall, onFrictionPoint, onGoodStart, onGearShift, update, reset };
})();
