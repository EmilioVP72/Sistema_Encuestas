// Survey Portal Client Logic
document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const viewWelcome = document.getElementById('view-welcome');
  const viewSurvey = document.getElementById('view-survey');
  const viewFarewell = document.getElementById('view-farewell');

  const btnStartSurvey = document.getElementById('btn-start-survey');
  const respondentNameInput = document.getElementById('respondent-name');
  const questionsContainer = document.getElementById('questions-container');
  const surveyForm = document.getElementById('survey-form');
  const surveyErrorAlert = document.getElementById('survey-error-alert');
  const btnSubmitSurvey = document.getElementById('btn-submit-survey');
  const btnSubmitText = document.getElementById('btn-submit-text');

  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  const progressPercent = document.getElementById('progress-percent');

  const btnCloseWindow = document.getElementById('btn-close-window');
  const btnRestartSurvey = document.getElementById('btn-restart-survey');
  const closeHelperText = document.getElementById('close-helper-text');

  // State
  let questions = [];
  let userAnswers = {};
  let respondentName = '';

  // 1. Navigation: Start survey
  btnStartSurvey.addEventListener('click', () => {
    respondentName = respondentNameInput.value.trim();
    switchView('survey');
    loadQuestions();
  });

  function switchView(viewName) {
    viewWelcome.classList.remove('active');
    viewSurvey.classList.remove('active');
    viewFarewell.classList.remove('active');

    if (viewName === 'welcome') viewWelcome.classList.add('active');
    if (viewName === 'survey') viewSurvey.classList.add('active');
    if (viewName === 'farewell') viewFarewell.classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // 2. Fetch and render questions
  async function loadQuestions() {
    try {
      const res = await fetch('/api/survey/questions');
      const data = await res.json();

      if (!data.success || !data.questions || data.questions.length === 0) {
        questionsContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📝</div>
            <h3>No hay preguntas activas en este momento</h3>
            <p>El administrador aún no ha configurado preguntas para esta encuesta.</p>
          </div>
        `;
        return;
      }

      questions = data.questions;
      renderQuestionsList();
      updateProgressBar();
    } catch (err) {
      console.error('Error al cargar preguntas:', err);
      questionsContainer.innerHTML = `
        <div style="text-align: center; color: var(--accent-rose); padding: 2rem;">
          <p>⚠️ Ocurrió un error al contactar el servidor. Por favor intenta recargar la página.</p>
        </div>
      `;
    }
  }

  function renderQuestionsList() {
    questionsContainer.innerHTML = '';

    questions.forEach((q, index) => {
      const card = document.createElement('div');
      card.className = 'question-card';
      card.id = `card-question-${q.id}`;

      // Card Header
      const header = document.createElement('div');
      header.className = 'question-header';
      header.innerHTML = `
        <div class="question-title-row">
          <span class="question-number">${index + 1}</span>
          <h3 class="question-title">
            ${escapeHtml(q.title)}
            ${q.required ? '<span class="required-dot" title="Obligatoria">*</span>' : ''}
          </h3>
        </div>
        ${q.description ? `<p class="question-desc">${escapeHtml(q.description)}</p>` : ''}
      `;
      card.appendChild(header);

      // Question body by type
      const body = document.createElement('div');
      body.className = 'question-body';

      if (q.type === 'rating') {
        renderRatingInput(body, q);
      } else if (q.type === 'nps') {
        renderNpsInput(body, q);
      } else if (q.type === 'single_choice') {
        renderChoiceInput(body, q, false);
      } else if (q.type === 'multiple_choice') {
        renderChoiceInput(body, q, true);
      } else if (q.type === 'text') {
        renderTextInput(body, q);
      }

      card.appendChild(body);
      questionsContainer.appendChild(card);
    });
  }

  // Question renderers
  function renderRatingInput(container, question) {
    const wrapper = document.createElement('div');
    wrapper.className = 'rating-container';

    const starsWrapper = document.createElement('div');
    starsWrapper.className = 'rating-stars-wrapper';

    const labels = question.options && question.options.length === 5 
      ? question.options 
      : ['Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente'];

    const feedbackText = document.createElement('div');
    feedbackText.className = 'rating-feedback-text';

    for (let i = 1; i <= 5; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rating-btn';
      btn.innerHTML = `<span>★</span><span class="star-label">${i}</span>`;
      btn.title = labels[i - 1];

      btn.addEventListener('click', () => {
        userAnswers[question.id] = i;
        starsWrapper.querySelectorAll('.rating-btn').forEach((b, idx) => {
          if (idx + 1 === i) {
            b.classList.add('active');
          } else {
            b.classList.remove('active');
          }
        });
        feedbackText.textContent = `${i} de 5: "${labels[i - 1]}"`;
        clearCardError(question.id);
        updateProgressBar();
      });

      starsWrapper.appendChild(btn);
    }

    wrapper.appendChild(starsWrapper);
    wrapper.appendChild(feedbackText);
    container.appendChild(wrapper);
  }

  function renderNpsInput(container, question) {
    const wrapper = document.createElement('div');
    wrapper.className = 'nps-container';

    const scaleWrapper = document.createElement('div');
    scaleWrapper.className = 'nps-scale-wrapper';

    for (let i = 0; i <= 10; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'nps-btn';
      if (i <= 6) btn.classList.add('detractor');
      else if (i <= 8) btn.classList.add('passive');
      else btn.classList.add('promoter');

      btn.textContent = i;

      btn.addEventListener('click', () => {
        userAnswers[question.id] = i;
        scaleWrapper.querySelectorAll('.nps-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        clearCardError(question.id);
        updateProgressBar();
      });

      scaleWrapper.appendChild(btn);
    }

    const legend = document.createElement('div');
    legend.className = 'nps-legend';
    legend.innerHTML = `
      <span>0 = Nada probable</span>
      <span>5 = Neutral</span>
      <span>10 = Muy probable</span>
    `;

    wrapper.appendChild(scaleWrapper);
    wrapper.appendChild(legend);
    container.appendChild(wrapper);
  }

  function renderChoiceInput(container, question, isMultiple) {
    const grid = document.createElement('div');
    grid.className = 'options-grid';

    const options = Array.isArray(question.options) ? question.options : [];

    options.forEach(opt => {
      const optCard = document.createElement('div');
      optCard.className = `option-choice-card ${isMultiple ? 'multiple' : 'single'}`;
      optCard.innerHTML = `
        <div class="choice-marker">
          <div class="choice-marker-inner"></div>
        </div>
        <span class="choice-text">${escapeHtml(opt)}</span>
      `;

      optCard.addEventListener('click', () => {
        if (isMultiple) {
          if (!Array.isArray(userAnswers[question.id])) {
            userAnswers[question.id] = [];
          }
          const index = userAnswers[question.id].indexOf(opt);
          if (index > -1) {
            userAnswers[question.id].splice(index, 1);
            optCard.classList.remove('selected');
          } else {
            userAnswers[question.id].push(opt);
            optCard.classList.add('selected');
          }
        } else {
          userAnswers[question.id] = opt;
          grid.querySelectorAll('.option-choice-card').forEach(c => c.classList.remove('selected'));
          optCard.classList.add('selected');
        }

        clearCardError(question.id);
        updateProgressBar();
      });

      grid.appendChild(optCard);
    });

    container.appendChild(grid);
  }

  function renderTextInput(container, question) {
    const wrapper = document.createElement('div');
    wrapper.className = 'textarea-wrapper';

    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Escribe aquí tu opinión sincera o sugerencia...';
    textarea.maxLength = 1000;

    const footer = document.createElement('div');
    footer.className = 'textarea-footer';
    footer.innerHTML = '<span class="char-count">0 / 1000</span>';

    textarea.addEventListener('input', () => {
      const val = textarea.value;
      userAnswers[question.id] = val.trim();
      footer.querySelector('.char-count').textContent = `${val.length} / 1000`;
      clearCardError(question.id);
      updateProgressBar();
    });

    wrapper.appendChild(textarea);
    wrapper.appendChild(footer);
    container.appendChild(wrapper);
  }

  // 3. Progress bar computation
  function updateProgressBar() {
    if (questions.length === 0) return;

    let answeredCount = 0;
    questions.forEach(q => {
      const ans = userAnswers[q.id];
      if (ans !== undefined && ans !== null && ans !== '' && !(Array.isArray(ans) && ans.length === 0)) {
        answeredCount++;
      }
    });

    const percent = Math.round((answeredCount / questions.length) * 100);
    progressFill.style.width = `${percent}%`;
    progressText.textContent = `Preguntas respondidas: ${answeredCount} de ${questions.length}`;
    progressPercent.textContent = `${percent}%`;
  }

  function clearCardError(qId) {
    const card = document.getElementById(`card-question-${qId}`);
    if (card) card.classList.remove('error');
    surveyErrorAlert.style.display = 'none';
  }

  // 4. Form submission & Validation
  surveyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    surveyErrorAlert.style.display = 'none';

    let hasErrors = false;
    let firstErrorCard = null;

    // Validate required questions
    questions.forEach(q => {
      const card = document.getElementById(`card-question-${q.id}`);
      const val = userAnswers[q.id];

      if (q.required) {
        const isMissing = val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0);
        if (isMissing) {
          hasErrors = true;
          if (card) {
            card.classList.add('error');
            if (!firstErrorCard) firstErrorCard = card;
          }
        } else {
          if (card) card.classList.remove('error');
        }
      }
    });

    if (hasErrors) {
      surveyErrorAlert.style.display = 'block';
      if (firstErrorCard) {
        firstErrorCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    // Submit payload to backend API
    btnSubmitSurvey.disabled = true;
    btnSubmitText.textContent = 'Enviando respuestas...';

    try {
      const res = await fetch('/api/survey/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          respondentName: respondentName,
          answers: userAnswers,
        }),
      });

      const result = await res.json();

      if (result.success) {
        // Switch to farewell view
        switchView('farewell');
        triggerCelebrationConfetti();
      } else {
        alert(result.message || 'Error al guardar la encuesta');
      }
    } catch (err) {
      console.error('Error al enviar formulario:', err);
      alert('Error de conexión al enviar tus respuestas. Por favor verifica tu conexión.');
    } finally {
      btnSubmitSurvey.disabled = false;
      btnSubmitText.textContent = 'Enviar Encuesta';
    }
  });

  // 5. Celebration confetti effect
  function triggerCelebrationConfetti() {
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0 }
        });
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1 }
        });
      }, 300);
    }
  }

  // 6. Farewell actions: Close window & Restart
  btnCloseWindow.addEventListener('click', () => {
    window.close();
    // In case browser prevents script closing
    setTimeout(() => {
      closeHelperText.style.display = 'block';
    }, 400);
  });

  if (btnRestartSurvey) {
    btnRestartSurvey.addEventListener('click', () => {
      userAnswers = {};
      respondentNameInput.value = '';
      closeHelperText.style.display = 'none';
      switchView('welcome');
    });
  }

  // Helper
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});
