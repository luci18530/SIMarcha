# SIMarcha — Simulador de Carro Manual para Iniciantes

> **SIMarcha** é um simulador educativo de direção com câmbio manual, construído em HTML, CSS e JavaScript puros. O foco é ensinar iniciantes a coordenar embreagem, acelerador e troca de marcha — especialmente a evitar que o carro morra.

---

## 🚀 Como executar

Nenhuma instalação necessária. Abra o arquivo `index.html` em qualquer navegador moderno:

```bash
# Opção 1: abrir diretamente
open index.html          # macOS
xdg-open index.html      # Linux
start index.html         # Windows

# Opção 2: servidor local simples (Python)
python3 -m http.server 8080
# depois acesse http://localhost:8080
```

---

## 🎮 Controles

| Tecla          | Função                        |
|----------------|-------------------------------|
| **Shift / C**  | Embreagem (segure para pisar) |
| **W / ↑**      | Acelerador                    |
| **S / ↓**      | Freio                         |
| **1 – 5**      | Engatar marcha                |
| **N**          | Neutro                        |
| **R**          | Ré                            |
| **Enter / I**  | Ligar / Desligar motor        |
| **F5**         | Reiniciar                     |

Os pedais também podem ser arrastados com o mouse.

---

## 📚 Como arrancar (passo a passo)

1. Ligue o motor (**Enter** ou botão "Ligar / Religar").
2. Pise na embreagem (**Shift**).
3. Engate a **1ª marcha** (tecla **1**).
4. Dê um pouco de gás (**W** — ~30%).
5. Solte a embreagem **devagar** até o marcador **★ ponto** na barra da embreagem.
6. Continue soltando suavemente enquanto mantém o gás.

---

## 🎓 Modo Treino

Quatro exercícios guiados:

| # | Exercício                  | Objetivo                                                |
|---|----------------------------|---------------------------------------------------------|
| 1 | Ponto da Embreagem         | Encontrar e manter a zona de fricção por 2 s            |
| 2 | Arrancar sem Estancar      | Partir do zero e chegar a 15 km/h sem matar o motor     |
| 3 | Trocar 1ª → 2ª             | Fazer a primeira troca de marcha corretamente           |
| 4 | Parar e Sair Novamente     | Parar completamente e voltar a andar                    |

---

## 🗂️ Estrutura do projeto

```
SIMarcha/
├── index.html          ← Página principal
├── css/
│   └── style.css       ← Estilo (tema escuro de painel automotivo)
├── js/
│   ├── simulation.js   ← Lógica de motor, embreagem, marchas e física
│   ├── controls.js     ← Entrada de teclado e mouse
│   ├── feedback.js     ← Sistema de mensagens didáticas
│   ├── training.js     ← Exercícios do modo treino
│   ├── ui.js           ← Renderização (gauge RPM, pedais, câmbio)
│   └── main.js         ← Loop principal e inicialização
└── README.md
```

---

## ⚙️ Lógica da simulação

### Embreagem
- `clutchPosition 0` = pedal pressionado (motor desacoplado)
- `clutchPosition 1` = pedal solto (motor acoplado)
- **Zona de fricção** (~30% a ~72% de soltura): acoplamento parcial — o RPM cai se não houver gás suficiente
- **Ponto de fricção** (~50%): carro começa a se mover

### Estancamento
O motor estanca quando:
- A embreagem é solta rápido demais sem aceleração suficiente
- O RPM cai abaixo de ~420 RPM na zona de fricção
- O carro para completamente sem a embreagem pressionada

### Marchas
- Cada marcha tem uma faixa de velocidade ideal
- Trocar sem embreagem gera aviso de erro
- O painel sugere a marcha adequada para a velocidade atual

---

## 🛠️ Tecnologias

- **HTML5** — estrutura
- **CSS3** — estilo (grid, variáveis CSS, animações)
- **JavaScript ES6+** — lógica e interação (sem frameworks, sem build)
- **Canvas API** — gauge de RPM
