// Admin Dashboard & Authentication Logic
document.addEventListener('DOMContentLoaded', () => {
  // Views
  const viewLogin = document.getElementById('view-login');
  const viewDashboard = document.getElementById('view-dashboard');

  // Login elements
  const loginForm = document.getElementById('admin-login-form');
  const loginUsername = document.getElementById('login-username');
  const loginPassword = document.getElementById('login-password');
  const loginError = document.getElementById('login-error');
  const btnLoginSubmit = document.getElementById('btn-login-submit');

  // Header & User elements
  const adminUserName = document.getElementById('admin-user-name');
  const btnAdminLogout = document.getElementById('btn-admin-logout');
  const btnRefresh = document.getElementById('btn-refresh-metrics');
  const btnExportCsv = document.getElementById('btn-export-csv');

  // Tabs
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.admin-tab-pane');

  // KPI elements
  const kpiTotalResponses = document.getElementById('kpi-total-responses');
  const kpiCsatAvg = document.getElementById('kpi-csat-avg');
  const kpiNpsScore = document.getElementById('kpi-nps-score');
  const kpiPromotersRate = document.getElementById('kpi-promoters-rate');
  const questionsBreakdownContainer = document.getElementById('questions-breakdown-container');

  // Open feedback elements
  const feedbackListContainer = document.getElementById('feedback-list-container');
  const feedbackSearchInput = document.getElementById('feedback-search-input');
  const feedbackCounterBadge = document.getElementById('feedback-counter-badge');
  let openFeedbackData = [];

  // Question manager elements
  const questionsTableBody = document.getElementById('questions-table-body');
  const btnOpenCreateModal = document.getElementById('btn-open-create-modal');
  const questionModal = document.getElementById('question-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCancelModal = document.getElementById('btn-cancel-modal');
  const questionForm = document.getElementById('question-form');
  const modalTitle = document.getElementById('modal-title');

  const formQuestionId = document.getElementById('form-question-id');
  const formTitle = document.getElementById('form-title');
  const formDescription = document.getElementById('form-description');
  const formType = document.getElementById('form-type');
  const formOrder = document.getElementById('form-order');
  const formRequired = document.getElementById('form-required');
  const formOptionsWrapper = document.getElementById('form-options-wrapper');
  const optionsInputsList = document.getElementById('options-inputs-list');
  const btnAddOption = document.getElementById('btn-add-option');

  // Chart instances
  let csatChartInstance = null;
  let npsChartInstance = null;

  // 1. AUTHENTICATION LIFECYCLE
  function checkAuth() {
    const token = localStorage.getItem('survey_admin_token');
    const userStr = localStorage.getItem('survey_admin_user');

    if (!token) {
      showLoginView();
      return;
    }

    try {
      if (userStr) {
        const user = JSON.parse(userStr);
        if (adminUserName && user.name) {
          adminUserName.textContent = user.name;
        }
      }
    } catch {
      // Ignored
    }

    showDashboardView();
    loadAllData();
  }

  function showLoginView() {
    viewLogin.style.display = 'flex';
    viewDashboard.style.display = 'none';
    loginError.style.display = 'none';
    loginPassword.value = '';
  }

  function showDashboardView() {
    viewLogin.style.display = 'none';
    viewDashboard.style.display = 'block';
  }

  function logout() {
    localStorage.removeItem('survey_admin_token');
    localStorage.removeItem('survey_admin_user');
    showLoginView();
  }

  btnAdminLogout.addEventListener('click', () => {
    logout();
  });

  // Handle Login Submission
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.style.display = 'none';

    const username = loginUsername.value.trim();
    const password = loginPassword.value;

    btnLoginSubmit.disabled = true;
    btnLoginSubmit.querySelector('span').textContent = 'Verificando...';

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (data.success && data.token) {
        localStorage.setItem('survey_admin_token', data.token);
        localStorage.setItem('survey_admin_user', JSON.stringify(data.user || { name: username }));
        if (adminUserName && data.user) {
          adminUserName.textContent = data.user.name || data.user.username;
        }
        showDashboardView();
        loadAllData();
      } else {
        loginError.textContent = data.message || 'Credenciales incorrectas';
        loginError.style.display = 'block';
      }
    } catch (err) {
      console.error('Error al iniciar sesión:', err);
      loginError.textContent = 'Error de conexión con el servidor.';
      loginError.style.display = 'block';
    } finally {
      btnLoginSubmit.disabled = false;
      btnLoginSubmit.querySelector('span').textContent = 'Ingresar al Panel';
    }
  });

  // Authenticated fetch wrapper
  async function authFetch(url, options = {}) {
    const token = localStorage.getItem('survey_admin_token');
    if (!token) {
      logout();
      throw new Error('No autorizado');
    }

    const headers = {
      ...(options.headers || {}),
      'Authorization': `Bearer ${token}`,
    };

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401) {
      logout();
      throw new Error('Sesión expirada');
    }

    return res;
  }

  // 2. CSV EXPORT BUTTON WITH AUTH
  btnExportCsv.addEventListener('click', async () => {
    const token = localStorage.getItem('survey_admin_token');
    if (!token) {
      logout();
      return;
    }
    window.location.href = `/api/admin/export?token=${encodeURIComponent(token)}`;
  });

  // 3. TAB NAVIGATION
  initTabs();

  btnRefresh.addEventListener('click', () => {
    btnRefresh.classList.add('loading');
    loadAllData().finally(() => {
      btnRefresh.classList.remove('loading');
    });
  });

  function initTabs() {
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');

        tabButtons.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const activePane = document.getElementById(targetTab);
        if (activePane) activePane.classList.add('active');

        // Resize charts if switching to metrics tab
        if (targetTab === 'tab-metrics') {
          if (csatChartInstance) csatChartInstance.resize();
          if (npsChartInstance) npsChartInstance.resize();
        }
      });
    });
  }

  async function loadAllData() {
    await Promise.all([
      loadMetrics(),
      loadOpenFeedback(),
      loadQuestionsManagement(),
    ]);
  }

  // 4. LOAD METRICS & CHARTS (Pastel Theme)
  async function loadMetrics() {
    try {
      const res = await authFetch('/api/admin/metrics');
      const data = await res.json();

      if (!data.success) throw new Error(data.message);

      const { kpis, questionMetrics } = data;

      // Update KPI cards
      kpiTotalResponses.textContent = kpis.totalResponses;
      kpiCsatAvg.textContent = kpis.globalCsat.toFixed(1);
      kpiNpsScore.textContent = `${kpis.globalNps > 0 ? '+' : ''}${kpis.globalNps}`;
      kpiPromotersRate.textContent = `${kpis.promotersPercent}%`;

      // Render Charts
      renderCsatDistributionChart(questionMetrics);
      renderNpsBreakdownChart(questionMetrics);

      // Render per-question breakdown cards
      renderQuestionsBreakdown(questionMetrics);
    } catch (err) {
      console.error('Error cargando métricas:', err);
    }
  }

  function renderCsatDistributionChart(questionMetrics) {
    const ctx = document.getElementById('chart-csat-distribution');
    if (!ctx) return;

    let dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    questionMetrics.filter(q => q.type === 'rating').forEach(q => {
      if (q.distribution) {
        for (let star = 1; star <= 5; star++) {
          dist[star] += (q.distribution[star] || 0);
        }
      }
    });

    const labels = ['1 Estrella ★', '2 Estrellas ★★', '3 Estrellas ★★★', '4 Estrellas ★★★★', '5 Estrellas ★★★★★'];
    const values = [dist[1], dist[2], dist[3], dist[4], dist[5]];

    if (csatChartInstance) {
      csatChartInstance.destroy();
    }

    csatChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Votos',
          data: values,
          backgroundColor: [
            '#e84a5f', // Crimson
            '#ff847c', // Coral
            '#fecea8', // Peach
            '#b5cca6', // Soft Sage
            '#99b898', // Sage Green
          ],
          borderColor: [
            '#d23b50',
            '#f56e66',
            '#f2bf94',
            '#9db58f',
            '#7f9e7e',
          ],
          borderWidth: 1.5,
          borderRadius: 8,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#ffffff',
            titleColor: '#2a363b',
            bodyColor: '#3c4c52',
            borderColor: 'rgba(42, 54, 59, 0.15)',
            borderWidth: 1,
            boxShadow: '0 4px 12px rgba(42, 54, 59, 0.1)'
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#6a7c83', font: { family: 'Plus Jakarta Sans', size: 11, weight: '600' } }
          },
          y: {
            grid: { color: 'rgba(42, 54, 59, 0.08)' },
            ticks: { color: '#6a7c83', precision: 0 }
          }
        }
      }
    });
  }

  function renderNpsBreakdownChart(questionMetrics) {
    const ctx = document.getElementById('chart-nps-breakdown');
    if (!ctx) return;

    let promoters = 0;
    let passives = 0;
    let detractors = 0;

    questionMetrics.filter(q => q.type === 'nps').forEach(q => {
      if (q.distribution) {
        for (let i = 0; i <= 6; i++) detractors += (q.distribution[i] || 0);
        for (let i = 7; i <= 8; i++) passives += (q.distribution[i] || 0);
        for (let i = 9; i <= 10; i++) promoters += (q.distribution[i] || 0);
      }
    });

    if (npsChartInstance) {
      npsChartInstance.destroy();
    }

    npsChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Promotores (9-10)', 'Pasivos (7-8)', 'Detractores (0-6)'],
        datasets: [{
          data: [promoters, passives, detractors],
          backgroundColor: [
            '#99b898', // Sage Green (#99B898)
            '#fecea8', // Peach (#FECEA8)
            '#e84a5f', // Crimson (#E84A5F)
          ],
          borderColor: '#ffffff',
          borderWidth: 3,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#2a363b', font: { family: 'Plus Jakarta Sans', size: 12, weight: '700' } }
          }
        },
        cutout: '65%'
      }
    });
  }

  function renderQuestionsBreakdown(questionMetrics) {
    questionsBreakdownContainer.innerHTML = '';

    questionMetrics.forEach(q => {
      const card = document.createElement('div');
      card.className = 'breakdown-card';

      let bodyHtml = '';

      if (q.type === 'rating') {
        const total = q.totalAnswers || 1;
        bodyHtml = `
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
            <span class="badge badge-amber">⭐ Promedio: ${q.average || 0} / 5</span>
            <span style="font-size: 0.82rem; color: var(--text-muted); font-weight: 600;">${q.totalAnswers} respuestas</span>
          </div>
          <div>
            ${[5, 4, 3, 2, 1].map(star => {
              const count = q.distribution ? (q.distribution[star] || 0) : 0;
              const pct = Math.round((count / total) * 100);
              return `
                <div class="bar-distribution-item">
                  <div class="bar-label-row">
                    <span>${star} ★</span>
                    <span>${count} (${pct}%)</span>
                  </div>
                  <div class="distribution-track">
                    <div class="distribution-fill" style="width: ${pct}%;"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      } else if (q.type === 'nps') {
        bodyHtml = `
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.8rem;">
            <span class="badge badge-emerald">NPS Score: ${q.npsScore > 0 ? '+' : ''}${q.npsScore || 0}</span>
            <span style="font-size: 0.82rem; color: var(--text-muted); font-weight: 600;">${q.totalAnswers} respuestas</span>
          </div>
          <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem; text-align: center;">
            <div style="flex: 1; background: var(--pastel-mint); padding: 0.65rem; border-radius: var(--radius-sm); border: 1px solid var(--pastel-mint-border);">
              <div style="font-size: 1.15rem; font-weight: 800; color: var(--pastel-mint-text);">${q.promotersPercent || 0}%</div>
              <div style="font-size: 0.72rem; color: var(--pastel-mint-text); font-weight: 700;">Promotores</div>
            </div>
            <div style="flex: 1; background: var(--pastel-amber); padding: 0.65rem; border-radius: var(--radius-sm); border: 1px solid var(--pastel-amber-border);">
              <div style="font-size: 1.15rem; font-weight: 800; color: var(--pastel-amber-text);">${q.passivesPercent || 0}%</div>
              <div style="font-size: 0.72rem; color: var(--pastel-amber-text); font-weight: 700;">Pasivos</div>
            </div>
            <div style="flex: 1; background: var(--pastel-rose); padding: 0.65rem; border-radius: var(--radius-sm); border: 1px solid var(--pastel-rose-border);">
              <div style="font-size: 1.15rem; font-weight: 800; color: var(--pastel-rose-text);">${q.detractorsPercent || 0}%</div>
              <div style="font-size: 0.72rem; color: var(--pastel-rose-text); font-weight: 700;">Detractores</div>
            </div>
          </div>
        `;
      } else if (q.type === 'single_choice' || q.type === 'multiple_choice') {
        const totalPicks = q.totalPicks || 1;
        const counts = q.counts || {};
        bodyHtml = `
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.8rem;">
            <span class="badge badge-cyan">${q.type === 'single_choice' ? 'Opción Única' : 'Opción Múltiple'}</span>
            <span style="font-size: 0.82rem; color: var(--text-muted); font-weight: 600;">${q.totalAnswers} respuestas</span>
          </div>
          <div>
            ${Object.entries(counts).map(([opt, count]) => {
              const pct = Math.round((count / totalPicks) * 100);
              return `
                <div class="bar-distribution-item">
                  <div class="bar-label-row">
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px;" title="${escapeHtml(opt)}">${escapeHtml(opt)}</span>
                    <span>${count} (${pct}%)</span>
                  </div>
                  <div class="distribution-track">
                    <div class="distribution-fill" style="width: ${pct}%; background: var(--secondary-gradient);"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      } else if (q.type === 'text') {
        bodyHtml = `
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.8rem;">
            <span class="badge badge-indigo">Pregunta Abierta</span>
            <span style="font-size: 0.82rem; color: var(--text-muted); font-weight: 600;">${q.totalAnswers} respuestas</span>
          </div>
          <p style="font-size: 0.88rem; color: var(--text-muted);">
            Se han recolectado ${q.totalAnswers} comentarios de retroalimentación libre.
          </p>
          <button type="button" class="btn btn-secondary" style="width: 100%; margin-top: 0.8rem; font-size: 0.85rem; padding: 0.55rem;" onclick="document.querySelector('[data-tab=\\'tab-feedback\\']').click()">
            Ver comentarios en bandeja 💬
          </button>
        `;
      }

      card.innerHTML = `
        <h3 class="breakdown-title">${escapeHtml(q.title)}</h3>
        ${bodyHtml}
      `;

      questionsBreakdownContainer.appendChild(card);
    });
  }

  // 5. LOAD OPEN FEEDBACK
  async function loadOpenFeedback() {
    try {
      const res = await authFetch('/api/admin/open-feedback');
      const data = await res.json();

      if (!data.success) return;

      openFeedbackData = data.feedback || [];
      feedbackCounterBadge.textContent = openFeedbackData.length;
      renderFeedbackList(openFeedbackData);
    } catch (err) {
      console.error('Error cargando feedback:', err);
    }
  }

  function renderFeedbackList(items) {
    feedbackListContainer.innerHTML = '';

    if (items.length === 0) {
      feedbackListContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">💬</div>
          <h3>Aún no hay respuestas abiertas</h3>
          <p>Cuando los clientes dejen comentarios o sugerencias de texto, aparecerán aquí.</p>
        </div>
      `;
      return;
    }

    items.forEach(fb => {
      const card = document.createElement('div');
      card.className = 'feedback-item-card';

      const dateStr = fb.createdAt 
        ? new Date(fb.createdAt).toLocaleDateString('es-ES', { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : 'Reciente';

      card.innerHTML = `
        <div class="feedback-meta">
          <span class="feedback-respondent">👤 ${escapeHtml(fb.respondentName)}</span>
          <span>📅 ${dateStr}</span>
        </div>
        <p class="feedback-text">${escapeHtml(fb.content)}</p>
        <span class="feedback-question-tag">Pregunta: ${escapeHtml(fb.questionTitle)}</span>
      `;

      feedbackListContainer.appendChild(card);
    });
  }

  feedbackSearchInput.addEventListener('input', () => {
    const query = feedbackSearchInput.value.toLowerCase().trim();
    if (!query) {
      renderFeedbackList(openFeedbackData);
      return;
    }

    const filtered = openFeedbackData.filter(item => 
      (item.content && item.content.toLowerCase().includes(query)) ||
      (item.respondentName && item.respondentName.toLowerCase().includes(query)) ||
      (item.questionTitle && item.questionTitle.toLowerCase().includes(query))
    );

    renderFeedbackList(filtered);
  });

  // 6. QUESTIONS MANAGEMENT
  async function loadQuestionsManagement() {
    try {
      const res = await authFetch('/api/admin/questions');
      const data = await res.json();

      if (!data.success) return;

      renderQuestionsTable(data.questions || []);
    } catch (err) {
      console.error('Error al cargar gestión de preguntas:', err);
    }
  }

  function renderQuestionsTable(questions) {
    questionsTableBody.innerHTML = '';

    if (questions.length === 0) {
      questionsTableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            No hay preguntas registradas. Haz clic en "+ Nueva Pregunta" para crear una.
          </td>
        </tr>
      `;
      return;
    }

    questions.forEach(q => {
      const tr = document.createElement('tr');

      const typeBadges = {
        rating: '<span class="badge badge-amber">★ Calificación (1-5)</span>',
        nps: '<span class="badge badge-emerald">🚀 NPS (0-10)</span>',
        single_choice: '<span class="badge badge-cyan">◉ Opción Única</span>',
        multiple_choice: '<span class="badge badge-indigo">☑ Opción Múltiple</span>',
        text: '<span class="badge badge-rose">✍ Pregunta Abierta</span>',
      };

      const optionsCount = Array.isArray(q.options) ? q.options.length : 0;
      const optionsInfo = (q.type === 'single_choice' || q.type === 'multiple_choice')
        ? `${optionsCount} opciones`
        : '-';

      tr.innerHTML = `
        <td style="font-weight: 700; color: var(--text-muted);">${q.orderIndex}</td>
        <td>
          <div style="font-weight: 700; color: var(--text-main);">${escapeHtml(q.title)}</div>
          ${q.description ? `<div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(q.description)}</div>` : ''}
        </td>
        <td>${typeBadges[q.type] || q.type}</td>
        <td>${optionsInfo}</td>
        <td>
          ${q.required ? '<span class="badge badge-emerald">Sí</span>' : '<span style="color: var(--text-muted);">No</span>'}
        </td>
        <td style="font-weight: 700;">${q.answerCount || 0}</td>
        <td>
          <button type="button" class="btn-toggle-active badge ${q.isActive ? 'badge-emerald' : 'badge-rose'}" data-id="${q.id}" data-active="${q.isActive}" style="cursor: pointer;">
            ${q.isActive ? '● Activa' : '○ Inactiva'}
          </button>
        </td>
        <td style="text-align: right;">
          <div class="table-actions" style="justify-content: flex-end;">
            <button type="button" class="btn-icon btn-edit-question" data-id="${q.id}" title="Editar pregunta">
              ✏️
            </button>
            <button type="button" class="btn-icon danger btn-delete-question" data-id="${q.id}" data-title="${escapeHtml(q.title)}" title="Eliminar pregunta">
              🗑️
            </button>
          </div>
        </td>
      `;

      tr.querySelector('.btn-toggle-active').addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const currentActive = e.currentTarget.getAttribute('data-active') === 'true';
        await toggleQuestionStatus(id, !currentActive);
      });

      tr.querySelector('.btn-edit-question').addEventListener('click', () => {
        openEditQuestionModal(q);
      });

      tr.querySelector('.btn-delete-question').addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const title = e.currentTarget.getAttribute('data-title');
        confirmDeleteQuestion(id, title);
      });

      questionsTableBody.appendChild(tr);
    });
  }

  async function toggleQuestionStatus(id, newStatus) {
    try {
      const res = await authFetch(`/api/admin/questions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        loadAllData();
      }
    } catch (err) {
      console.error('Error al cambiar estado:', err);
    }
  }

  async function confirmDeleteQuestion(id, title) {
    if (confirm(`¿Estás seguro de que deseas eliminar la pregunta:\n\n"${title}"?\n\nEsta acción también borrará sus respuestas asociadas.`)) {
      try {
        const res = await authFetch(`/api/admin/questions/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          loadAllData();
        } else {
          alert(data.message || 'Error al eliminar');
        }
      } catch (err) {
        console.error('Error al eliminar:', err);
      }
    }
  }

  // 7. MODAL CREATE / EDIT QUESTION
  btnOpenCreateModal.addEventListener('click', () => {
    modalTitle.textContent = 'Crear Nueva Pregunta';
    questionForm.reset();
    formQuestionId.value = '';
    formOrder.value = '1';
    formRequired.checked = true;
    optionsInputsList.innerHTML = '';
    handleTypeChange();
    openModal();
  });

  btnCloseModal.addEventListener('click', closeModal);
  btnCancelModal.addEventListener('click', closeModal);

  formType.addEventListener('change', handleTypeChange);

  function handleTypeChange() {
    const selected = formType.value;
    if (selected === 'single_choice' || selected === 'multiple_choice') {
      formOptionsWrapper.style.display = 'block';
      if (optionsInputsList.children.length === 0) {
        addOptionInput('Opción 1');
        addOptionInput('Opción 2');
      }
    } else {
      formOptionsWrapper.style.display = 'none';
    }
  }

  btnAddOption.addEventListener('click', () => {
    addOptionInput('');
  });

  function addOptionInput(defaultValue = '') {
    const row = document.createElement('div');
    row.className = 'option-input-row';
    row.innerHTML = `
      <input type="text" class="form-control form-option-val" placeholder="Texto de la opción..." value="${escapeHtml(defaultValue)}" required>
      <button type="button" class="btn-icon danger btn-remove-option" title="Quitar opción">✕</button>
    `;

    row.querySelector('.btn-remove-option').addEventListener('click', () => {
      row.remove();
    });

    optionsInputsList.appendChild(row);
  }

  function openEditQuestionModal(q) {
    modalTitle.textContent = 'Editar Pregunta';
    formQuestionId.value = q.id;
    formTitle.value = q.title;
    formDescription.value = q.description || '';
    formType.value = q.type;
    formOrder.value = q.orderIndex || 1;
    formRequired.checked = q.required;

    optionsInputsList.innerHTML = '';
    if (q.type === 'single_choice' || q.type === 'multiple_choice') {
      formOptionsWrapper.style.display = 'block';
      if (Array.isArray(q.options) && q.options.length > 0) {
        q.options.forEach(opt => addOptionInput(opt));
      } else {
        addOptionInput('');
      }
    } else {
      formOptionsWrapper.style.display = 'none';
    }

    openModal();
  }

  function openModal() {
    questionModal.classList.add('active');
  }

  function closeModal() {
    questionModal.classList.remove('active');
  }

  questionForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = formQuestionId.value;
    const title = formTitle.value.trim();
    const description = formDescription.value.trim();
    const type = formType.value;
    const orderIndex = parseInt(formOrder.value, 10) || 1;
    const required = formRequired.checked;

    let options = [];
    if (type === 'single_choice' || type === 'multiple_choice') {
      const optionInputs = optionsInputsList.querySelectorAll('.form-option-val');
      optionInputs.forEach(inp => {
        const val = inp.value.trim();
        if (val) options.push(val);
      });

      if (options.length < 2) {
        alert('Debes agregar al menos 2 opciones para preguntas de selección.');
        return;
      }
    }

    const payload = {
      title,
      description,
      type,
      options,
      orderIndex,
      required,
    };

    try {
      let res;
      if (id) {
        res = await authFetch(`/api/admin/questions/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await authFetch('/api/admin/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (data.success) {
        closeModal();
        loadAllData();
      } else {
        alert(data.message || 'Error al guardar la pregunta');
      }
    } catch (err) {
      console.error('Error al guardar pregunta:', err);
      alert('Error de conexión al guardar');
    }
  });

  // Helper
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Start auth check
  checkAuth();
});
