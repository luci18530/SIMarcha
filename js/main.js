/**
 * main.js
 *
 * Ponto de entrada da aplicação.
 *   - Inicializa todos os módulos
 *   - Configura botões da interface
 *   - Executa o loop principal (requestAnimationFrame)
 */

// ============================================================
//  INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Módulos de UI e controles
  ui.init();
  initPedalDrag();
  initShifterButtons();
  initActionButtons();
  initExerciseButtons();

  // Mensagem inicial
  feedback.addMessage('Bem-vindo! Ligue o motor clicando em "⚡ Ligar / Religar" ou pressionando Enter.', 'info');

  // Selecionar o modo livre ao iniciar
  training.selectExercise(0);

  // Iniciar o loop
  let lastTime = performance.now();
  function loop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05); // cap em 50 ms para evitar pulos
    lastTime = now;

    updateControls(dt);
    updateSimulation(dt);
    training.update(dt);
    ui.update();

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
});

// ============================================================
//  BOTÕES DE AÇÃO PRINCIPAIS
// ============================================================
function initActionButtons() {
  const btnIgnition = document.getElementById('btn-ignition');
  if (btnIgnition) btnIgnition.addEventListener('click', toggleIgnition);

  const btnReset = document.getElementById('btn-reset');
  if (btnReset) btnReset.addEventListener('click', resetSimulator);

  // Botão de tutorial
  const btnTutorial = document.getElementById('btn-tutorial');
  if (btnTutorial) {
    btnTutorial.addEventListener('click', () => {
      const overlay = document.getElementById('tutorial-overlay');
      if (overlay) overlay.classList.toggle('hidden');
    });
  }

  // Fechar tutorial
  const btnCloseTutorial = document.getElementById('btn-close-tutorial');
  if (btnCloseTutorial) {
    btnCloseTutorial.addEventListener('click', () => {
      const overlay = document.getElementById('tutorial-overlay');
      if (overlay) overlay.classList.add('hidden');
    });
  }
}

// ============================================================
//  BOTÕES DO MODO TREINO
// ============================================================
function initExerciseButtons() {
  document.querySelectorAll('.exercise-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.exercise, 10);
      training.selectExercise(id);
    });
  });
}
