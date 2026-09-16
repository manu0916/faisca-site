/* Faísca Classrooms UI: Teacher and Student experiences. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FaiscaClassroomsUI = factory();
  }
})(typeof window === 'undefined' ? this : window, function () {
  'use strict';

  function createUI(manager, host) {
    const { esc, icon, button, toast, render, navigate, confirm, catalog, curriculum, state, account } = host;
    const setSala = typeof host.setSala === 'function' ? host.setSala : () => {};

    let currentClassroomId = null;
    let selectedStudentId = null;
    let currentSubView = 'list'; // 'list' | 'create' | 'join' | 'preview' | 'dashboard' | 'student-report' | 'student-view' | 'settings'
    let previewData = null;
    let enteredCode = '';
    let teacherDashboardData = null;
    let studentReportData = null;
    let studentRoomData = null;
    let classroomsList = [];
    let isLoading = false;
    let errorMsg = '';
    let searchQuery = '';
    let filterTrack = '';
    let filterPeriod = 'all';
    let sortBy = 'name'; // 'name' | 'progress' | 'recent'
    let pendingAction = null; // Stored if auth required
    let assignmentDraft = { kind: 'project', title: '', description: '', dueDate: '', courseId: '', lessonId: '' };

    function localToday() {
      const now = new Date();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      return now.getFullYear() + '-' + month + '-' + day;
    }

    function dueLabel(value) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return '';
      return new Date(value + 'T12:00:00').toLocaleDateString('pt-BR');
    }

    function assignmentCard(a, teacherMode) {
      const isHomework = a.kind === 'homework';
      const description = typeof a.description === 'string' ? a.description.trim() : '';
      const course = isHomework ? catalog.courses[a.courseId] : null;
      const lessons = course && Array.isArray(course.lessons) ? course.lessons.filter(l => l.number <= Number(a.lessonNumber)) : [];
      const current = state();
      const completed = lessons.filter(l => current && current.completed && current.completed[l.id]).length;
      const homeworkDone = isHomework && lessons.length > 0 && completed === lessons.length;
      const overdue = !homeworkDone && a.dueDate < localToday();
      const status = homeworkDone ? '<span class="assignment-status done">Concluída</span>' :
        overdue ? '<span class="assignment-status late">Prazo encerrado</span>' : '<span class="assignment-status open">Em andamento</span>';
      const target = isHomework ?
        '<div class="assignment-target"><b>' + esc(course ? course.name : a.courseId) + '</b><span>Até a lição ' + esc(String(a.lessonNumber)) + ': ' + esc(a.lessonTitle || a.lessonId) + '</span></div>' : '';
      const progressHtml = isHomework && lessons.length ?
        '<div class="assignment-progress"><span>' + completed + ' de ' + lessons.length + ' lições concluídas</span><div class="assignment-meter"><i style="width:' + Math.round(completed / lessons.length * 100) + '%"></i></div></div>' : '';
      return '<article class="assignment-card ' + (isHomework ? 'homework' : 'project') + '">' +
        '<div class="assignment-card-head"><span class="assignment-kind">' + (isHomework ? 'LIÇÃO DE CASA' : 'TRABALHO / PROJETO') + '</span>' + status + '</div>' +
        '<h3>' + esc(a.title) + '</h3>' +
        target +
        (description ? '<p class="assignment-description">' + esc(description) + '</p>' : '') +
        progressHtml +
        '<div class="assignment-footer"><b>Entrega: ' + esc(dueLabel(a.dueDate)) + '</b>' +
          (teacherMode ? '<button class="text-btn assignment-cancel" data-action="classroom-cancel-assignment" data-id="' + esc(a.id) + '">Cancelar atividade</button>' :
            isHomework ? '<button class="btn secondary slim" data-action="classroom-open-assignment-course" data-id="' + esc(a.courseId) + '">Abrir trilha ' + icon('arrow') + '</button>' : '') +
        '</div>' +
      '</article>';
    }

    function assignmentComposer(d) {
      const tracks = d.tracks || [];
      if (!tracks.includes(assignmentDraft.courseId)) assignmentDraft.courseId = tracks[0] || '';
      const course = catalog.courses[assignmentDraft.courseId];
      const lessons = course && Array.isArray(course.lessons) ? course.lessons : [];
      if (!lessons.some(l => l.id === assignmentDraft.lessonId)) assignmentDraft.lessonId = lessons[0] ? lessons[0].id : '';
      const homework = assignmentDraft.kind === 'homework';
      return '<section class="card assignment-composer">' +
        '<div class="section-title"><div><div class="eyebrow orange">NOVA ATIVIDADE</div><h2>Publicar para a turma</h2></div></div>' +
        '<div class="assignment-type-switch" role="group" aria-label="Tipo da atividade">' +
          '<button class="account-option" data-action="classroom-assignment-kind" data-id="project" aria-pressed="' + (!homework) + '">Trabalho / projeto</button>' +
          '<button class="account-option" data-action="classroom-assignment-kind" data-id="homework" aria-pressed="' + homework + '">Lição de casa</button>' +
        '</div>' +
        '<div class="assignment-form-grid">' +
          '<div class="field assignment-title-field"><label for="assignment-title">Título</label><input id="assignment-title" maxlength="120" value="' + esc(assignmentDraft.title) + '" placeholder="Ex.: Projeto calculadora"></div>' +
          '<div class="field"><label for="assignment-due-date">Data de entrega</label><input id="assignment-due-date" type="date" min="' + localToday() + '" value="' + esc(assignmentDraft.dueDate) + '"></div>' +
          (homework ? '<div class="field"><label for="assignment-course">Trilha</label><select id="assignment-course">' + tracks.map(id => '<option value="' + esc(id) + '" ' + (id === assignmentDraft.courseId ? 'selected' : '') + '>' + esc(catalog.courses[id] ? catalog.courses[id].name : id) + '</option>').join('') + '</select></div>' +
            '<div class="field"><label for="assignment-lesson">Fazer até</label><select id="assignment-lesson">' + lessons.map(l => '<option value="' + esc(l.id) + '" ' + (l.id === assignmentDraft.lessonId ? 'selected' : '') + '>Lição ' + l.number + ' — ' + esc(l.title) + '</option>').join('') + '</select></div>' : '') +
          '<div class="field assignment-description-field"><label for="assignment-description">Descrição <span class="muted">(opcional)</span></label><textarea id="assignment-description" maxlength="1000" rows="3" placeholder="Orientações adicionais, se precisar">' + esc(assignmentDraft.description) + '</textarea><p class="small muted">Se ficar vazia, nenhuma descrição aparecerá para o aluno.</p></div>' +
        '</div>' +
        (errorMsg ? '<p class="account-error" role="alert">' + esc(errorMsg) + '</p>' : '') +
        '<button class="btn primary" data-action="classroom-publish-assignment" ' + (isLoading ? 'disabled' : '') + '>' + (isLoading ? 'Publicando…' : 'Publicar atividade ' + icon('arrow')) + '</button>' +
      '</section>';
    }

    function setSubView(view) {
      currentSubView = view;
      errorMsg = '';
      if (host.route() === 'classrooms') render(false);
    }

    function checkAuth() {
      const s = account.status();
      return !!(s && s.user && !s.needsLogin);
    }

    function requireAuth(actionDesc, onLoginSuccess) {
      if (checkAuth()) return true;
      pendingAction = onLoginSuccess;
      toast('Crie uma conta ou faça login para ' + actionDesc + '.');
      navigate('account');
      return false;
    }

    function onAuthChanged() {
      if (checkAuth() && pendingAction) {
        const act = pendingAction;
        pendingAction = null;
        act();
      }
    }

    async function loadMyClassrooms() {
      if (!checkAuth()) return;
      isLoading = true;
      errorMsg = '';
      render(false);
      try {
        const res = await manager.listMyClassrooms();
        if (res && res.ok) {
          classroomsList = res.classrooms || [];
        } else {
          errorMsg = (res && res.error) || 'Não foi possível carregar as salas de aula.';
        }
      } catch (err) {
        errorMsg = err.message || 'Erro ao carregar salas de aula.';
      } finally {
        isLoading = false;
        render(false);
      }
    }

    async function openDashboard(classroomId) {
      currentClassroomId = classroomId;
      currentSubView = 'dashboard';
      isLoading = true;
      errorMsg = '';
      render(false);
      try {
        const res = await manager.fetchTeacherDashboard(classroomId, filterTrack || null, filterPeriod);
        if (res && res.ok) {
          teacherDashboardData = res.dashboard;
        } else {
          errorMsg = (res && res.error) || 'Não foi possível carregar o painel do professor.';
        }
      } catch (err) {
        errorMsg = err.message || 'Erro ao carregar painel.';
      } finally {
        isLoading = false;
        render(false);
      }
    }

    async function openStudentReport(classroomId, studentId) {
      currentClassroomId = classroomId;
      selectedStudentId = studentId;
      currentSubView = 'student-report';
      isLoading = true;
      errorMsg = '';
      render(false);
      try {
        const res = await manager.fetchStudentReport(classroomId, studentId, filterTrack || null, filterPeriod);
        if (res && res.ok) {
          studentReportData = res.report;
        } else {
          errorMsg = (res && res.error) || 'Não foi possível carregar o relatório do aluno.';
        }
      } catch (err) {
        errorMsg = err.message || 'Erro ao carregar relatório.';
      } finally {
        isLoading = false;
        render(false);
      }
    }

    async function openStudentView(classroomId) {
      currentClassroomId = classroomId;
      currentSubView = 'student-view';
      isLoading = true;
      errorMsg = '';
      render(false);
      try {
        const res = await manager.fetchStudentView(classroomId);
        if (res && res.ok) {
          studentRoomData = res.studentView;
          setSala((studentRoomData && studentRoomData.tracks) || null);
        } else {
          errorMsg = (res && res.error) || 'Não foi possível carregar sua sala de aula.';
          setSala(null);
        }
      } catch (err) {
        errorMsg = err.message || 'Erro ao carregar dados da sala.';
        setSala(null);
      } finally {
        isLoading = false;
        render(false);
      }
    }

    // Views rendering

    function renderList() {
      const isAuth = checkAuth();
      if (!isAuth) {
        return '<div class="classroom-shell">' +
          '<div class="back-row"><button class="text-btn" data-action="nav" data-route="profile">' + icon('back') + ' Você</button></div>' +
          '<div class="page-intro">' +
            '<div class="eyebrow orange">APRENDER JUNTO FAZ CRESCER</div>' +
            '<h1>Salas de aula</h1>' +
            '<p class="muted">Conecte alunos e professores com acompanhamento pedagógico real.</p>' +
          '</div>' +
          '<section class="card classroom-card">' +
            '<h2>Entre em sua conta</h2>' +
            '<p>Para criar uma sala ou participar de uma turma com código de entrada, conecte sua conta do Faísca. Seu progresso pessoal continua protegido.</p>' +
            button('Entrar ou criar conta ' + icon('arrow'), 'classroom-auth', '', 'primary full') +
          '</section>' +
          '<div class="concept-note">' +
            '<h3>' + icon('spark') + ' Como funciona?</h3>' +
            '<p>Professores geram um código simples de 8 caracteres para a turma. Alunos entram com o código e continuam estudando normalmente. O professor acompanha o avanço e as tentativas nas trilhas selecionadas.</p>' +
          '</div>' +
        '</div>';
      }

      const empty = !isLoading && classroomsList.length === 0;
      const listHtml = classroomsList.map(c => {
        const isTeacher = c.role === 'owner' || c.role === 'collaborator';
        const roleLabel = c.role === 'owner' ? 'Professor responsável' : c.role === 'collaborator' ? 'Professor colaborador' : 'Aluno';
        const statusLabel = c.status === 'archived' ? 'Arquivada' : c.status === 'active_closed' ? 'Entradas fechadas' : 'Ativa';
        const statusClass = c.status === 'archived' ? 'pill-archived' : c.status === 'active_closed' ? 'pill-closed' : 'pill-active';

        const tracksPills = (c.tracks || []).map(tId => {
          const course = catalog.courses[tId];
          return '<span class="course-chip-small" style="--tone:' + (course ? course.color : '#c45126') + '">' + esc(course ? course.name : tId) + '</span>';
        }).join(' ');

        return '<div class="card classroom-item-card">' +
          '<div class="classroom-header-row">' +
            '<span class="pill ' + (isTeacher ? 'orange' : 'green') + '">' + roleLabel + '</span>' +
            '<span class="pill ' + statusClass + '">' + statusLabel + '</span>' +
          '</div>' +
          '<h3>' + esc(c.name) + '</h3>' +
          (c.description ? '<p class="classroom-desc">' + esc(c.description) + '</p>' : '') +
          '<div class="classroom-tracks-row">' + tracksPills + '</div>' +
          '<div class="classroom-meta-row">' +
            (isTeacher ? '<span>' + icon('user') + ' ' + (c.student_count || 0) + ' alunos</span>' : '') +
            (isTeacher && c.code ? '<span class="code-badge" title="Código de entrada">Código: <b>' + esc(c.code) + '</b> <button class="copy-code-btn" data-action="classroom-copy-code" data-code="' + esc(c.code) + '" aria-label="Copiar código">' + icon('bookmark') + '</button></span>' : '') +
          '</div>' +
          '<div class="classroom-card-actions">' +
            button('Abrir sala ' + icon('arrow'), isTeacher ? 'classroom-open-dashboard' : 'classroom-open-student-view', 'data-id="' + c.id + '"', 'primary full') +
          '</div>' +
        '</div>';
      }).join('');

      return '<div class="classroom-shell">' +
        '<div class="back-row"><button class="text-btn" data-action="nav" data-route="profile">' + icon('back') + ' Você</button></div>' +
        '<div class="page-intro">' +
          '<div class="eyebrow orange">APRENDER JUNTO FAZ CRESCER</div>' +
          '<h1>Salas de aula</h1>' +
          '<p class="muted">Acompanhe seus alunos ou participe de uma turma com código.</p>' +
        '</div>' +
        '<section class="card form-card" style="margin-bottom:20px">' +
          '<h3 style="margin-bottom:12px">' + icon('spark') + ' Entrar com código</h3>' +
          '<div class="field" style="margin-bottom:14px">' +
            '<label for="classroom-code-input" class="sr-only">Código da sala</label>' +
            '<input id="classroom-code-input" class="code-input-large" type="text" maxlength="12" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="Código da sala" value="' + esc(enteredCode) + '">' +
          '</div>' +
          (errorMsg ? '<p class="account-error" role="alert">' + esc(errorMsg) + '</p>' : '') +
          button(isLoading ? 'Verificando…' : 'Entrar na turma ' + icon('arrow'), 'classroom-submit-preview', isLoading ? 'disabled' : '', 'primary full') +
        '</section>' +
        button(icon('book') + ' Criar sala de aula', 'classroom-go-create', '', 'secondary full') +
        (isLoading && classroomsList.length === 0 ? '<div class="loading-box"><p class="muted" style="margin-top:20px">Carregando salas…</p></div>' : '') +
        (empty ?
          '<div class="card empty full-span" style="margin-top:20px">' +
            icon('book') +
            '<h2>Nenhuma sala ainda</h2>' +
            '<p>Digite o código do seu professor acima para participar de uma turma.</p>' +
          '</div>' :
          '<div class="classrooms-grid" style="margin-top:20px">' + listHtml + '</div>'
        ) +
      '</div>';
    }

    function renderCreate() {
      const courses = curriculum.courses || [];
      const trackOptions = courses.map(c =>
        '<label class="track-checkbox-item">' +
          '<input type="checkbox" name="classroom-tracks" value="' + esc(c.id) + '">' +
          '<span class="language small" style="--tone:' + c.color + '">' + esc(c.symbol) + '</span>' +
          '<span>' + esc(c.name) + '</span>' +
        '</label>'
      ).join('');

      return '<div class="classroom-shell">' +
        '<div class="back-row"><button class="text-btn" data-action="classroom-back-list">' + icon('back') + ' Minhas salas</button></div>' +
        '<div class="page-intro">' +
          '<div class="eyebrow orange">NOVO ESPAÇO DE APRENDIZAGEM</div>' +
          '<h1>Criar sala de aula</h1>' +
          '<p class="muted">Você será o professor responsável e receberá um código de 8 caracteres para convidar alunos.</p>' +
        '</div>' +
        '<section class="card form-card">' +
          '<div class="field">' +
            '<label for="classroom-name">Nome da sala *</label>' +
            '<input id="classroom-name" type="text" maxlength="100" placeholder="Ex: Turma 2A - Programação Web" required>' +
          '</div>' +
          '<div class="field">' +
            '<label for="classroom-desc">Descrição ou orientações (opcional)</label>' +
            '<textarea id="classroom-desc" maxlength="500" rows="3" placeholder="Orientações sobre as atividades da turma…"></textarea>' +
          '</div>' +
          '<div class="field">' +
            '<label>Trilhas acompanhadas *</label>' +
            '<p class="small muted">Selecione quais linguagens e trilhas serão acompanhadas no painel desta sala.</p>' +
            '<div class="track-checkboxes-grid">' + trackOptions + '</div>' +
          '</div>' +
          (errorMsg ? '<p class="account-error" role="alert">' + esc(errorMsg) + '</p>' : '') +
          '<div class="actions-stack">' +
            button(isLoading ? 'Criando sala…' : 'Criar sala e gerar código ' + icon('arrow'), 'classroom-submit-create', isLoading ? 'disabled' : '', 'primary full') +
            button('Cancelar', 'classroom-back-list', '', 'text-btn full') +
          '</div>' +
        '</section>' +
      '</div>';
    }

    function renderJoin() {
      return '<div class="classroom-shell">' +
        '<div class="back-row"><button class="text-btn" data-action="classroom-back-list">' + icon('back') + ' Minhas salas</button></div>' +
        '<div class="page-intro">' +
          '<div class="eyebrow orange">ENTRAR NA TURMA</div>' +
          '<h1>Código da sala</h1>' +
          '<p class="muted">Digite o código de 8 caracteres informado pelo seu professor.</p>' +
        '</div>' +
        '<section class="card form-card">' +
          '<div class="field">' +
            '<label for="classroom-code-input">Código de entrada</label>' +
            '<input id="classroom-code-input" class="code-input-large" type="text" maxlength="12" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="Ex: ABC23489" value="' + esc(enteredCode) + '">' +
          '</div>' +
          (errorMsg ? '<p class="account-error" role="alert">' + esc(errorMsg) + '</p>' : '') +
          '<div class="actions-stack">' +
            button(isLoading ? 'Verificando…' : 'Verificar código ' + icon('arrow'), 'classroom-submit-preview', isLoading ? 'disabled' : '', 'primary full') +
            button('Voltar', 'classroom-back-list', '', 'text-btn full') +
          '</div>' +
          '<div class="concept-note" style="margin-top:16px">' +
            '<h3>' + icon('spark') + ' Transparência</h3>' +
            '<p>Antes de entrar, você visualizará o nome do professor e exatamente quais dados de estudo serão compartilhados.</p>' +
          '</div>' +
        '</section>' +
      '</div>';
    }

    function renderPreview() {
      if (!previewData) return renderJoin();
      const c = previewData.classroom;
      const tracksPills = (c.tracks || []).map(tId => {
        const course = catalog.courses[tId];
        return '<span class="course-chip-small" style="--tone:' + (course ? course.color : '#c45126') + '">' + esc(course ? course.name : tId) + '</span>';
      }).join(' ');

      return '<div class="classroom-shell">' +
        '<div class="back-row"><button class="text-btn" data-action="classroom-back-list">' + icon('back') + ' Alterar código</button></div>' +
        '<div class="page-intro">' +
          '<div class="eyebrow orange">CONFIRMAÇÃO DE ENTRADA</div>' +
          '<h1>' + esc(c.name) + '</h1>' +
          '<p class="muted">Professor: <b>' + esc(c.ownerName || 'Professor responsável') + '</b></p>' +
        '</div>' +
        '<section class="card classroom-preview-card">' +
          (c.description ? '<p class="classroom-desc">' + esc(c.description) + '</p>' : '') +
          '<div class="field">' +
            '<label>Trilhas acompanhadas nesta sala</label>' +
            '<div class="classroom-tracks-row">' + tracksPills + '</div>' +
          '</div>' +
          '<div class="privacy-notice-box">' +
            '<h3>' + icon('spark') + ' O que será compartilhado?</h3>' +
            '<ul>' +
              '<li>Seu nome de exibição escolhido no Faísca.</li>' +
              '<li>Lições concluídas e atividades realizadas nas trilhas acompanhadas por esta sala.</li>' +
              '<li>Tentativas e indicadores de acerto dos exercícios enviados.</li>' +
            '</ul>' +
            '<p class="small muted"><b>Proteção total:</b> Suas anotações particulares, lições salvas como favoritas e rascunhos de código <u>nunca</u> são compartilhados com o professor.</p>' +
          '</div>' +
          (errorMsg ? '<p class="account-error" role="alert">' + esc(errorMsg) + '</p>' : '') +
          '<div class="actions-stack">' +
            button(isLoading ? 'Entrando na sala…' : 'Confirmar entrada na sala ' + icon('check'), 'classroom-confirm-join', isLoading ? 'disabled' : '', 'primary full') +
            button('Cancelar', 'classroom-back-list', '', 'text-btn full') +
          '</div>' +
        '</section>' +
      '</div>';
    }

    function renderTeacherDashboard() {
      if (!teacherDashboardData) return renderList();
      const d = teacherDashboardData;
      const students = d.students || [];

      // Filter and sort students locally
      let filtered = students.filter(s => {
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          if (!s.name.toLowerCase().includes(q) && !s.shortTag.toLowerCase().includes(q)) return false;
        }
        return true;
      });

      if (sortBy === 'name') {
        filtered.sort((a, b) => a.name.localeCompare(b.name));
      } else if (sortBy === 'progress') {
        filtered.sort((a, b) => (b.completedLessonsCount || 0) - (a.completedLessonsCount || 0));
      } else if (sortBy === 'recent') {
        filtered.sort((a, b) => {
          const tA = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
          const tB = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
          return tB - tA;
        });
      }

      // Aggregate indicators
      const totalEnrolled = d.totalStudents || students.length;
      const activePeriod = d.activePeriodCount || 0;
      let sumFirstTry = 0, countFirstTry = 0;
      let sumSubAcc = 0, countSubAcc = 0;
      students.forEach(s => {
        if (s.firstTryAcc !== null && s.firstTryAcc !== undefined) {
          sumFirstTry += s.firstTryAcc;
          countFirstTry++;
        }
        if (s.submissionAcc !== null && s.submissionAcc !== undefined) {
          sumSubAcc += s.submissionAcc;
          countSubAcc++;
        }
      });
      const avgFirstTry = countFirstTry > 0 ? (Math.round((sumFirstTry / countFirstTry) * 10) / 10) + '%' : 'Sem dados';
      const avgSubAcc = countSubAcc > 0 ? (Math.round((sumSubAcc / countSubAcc) * 10) / 10) + '%' : 'Sem dados';

      const tracksPills = (d.tracks || []).map(tId => {
        const course = catalog.courses[tId];
        return '<span class="course-chip-small" style="--tone:' + (course ? course.color : '#c45126') + '">' + esc(course ? course.name : tId) + '</span>';
      }).join(' ');

      const studentsRows = filtered.map(s => {
        const lastActStr = s.lastActivity
          ? new Date(s.lastActivity).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
          : '<span class="muted">Sem atividades</span>';

        return '<div class="student-card-item">' +
          '<div class="student-item-head">' +
            '<div class="student-name-block">' +
              '<b>' + esc(s.name) + '</b> <span class="student-tag" title="Identificador">' + esc(s.shortTag) + '</span>' +
            '</div>' +
            '<span class="student-joined small muted">Entrou em ' + new Date(s.joinedAt).toLocaleDateString('pt-BR') + '</span>' +
          '</div>' +
          '<div class="student-stats-grid">' +
            '<div class="stat-mini"><span>Lições</span><b>' + s.completedLessonsCount + '</b></div>' +
            '<div class="stat-mini"><span>1ª tentativa</span><b>' + (s.firstTryAcc !== null ? s.firstTryAcc + '%' : '—') + '</b></div>' +
            '<div class="stat-mini"><span>Submissões</span><b>' + (s.submissionAcc !== null ? s.submissionAcc + '%' : '—') + '</b></div>' +
            '<div class="stat-mini"><span>Última ação</span><small>' + lastActStr + '</small></div>' +
          '</div>' +
          '<div class="student-item-actions">' +
            button('Ver relatório completo ' + icon('arrow'), 'classroom-open-student-report', 'data-student-id="' + s.userId + '"', 'secondary full') +
          '</div>' +
        '</div>';
      }).join('');

      return '<div class="classroom-shell">' +
        '<div class="back-row">' +
          '<button class="text-btn" data-action="classroom-back-list">' + icon('back') + ' Minhas salas</button>' +
          '<button class="icon-btn" data-action="classroom-refresh-dashboard" aria-label="Atualizar dados">' + icon('review') + '</button>' +
        '</div>' +
        '<div class="page-intro">' +
          '<div class="eyebrow orange">PAINEL DO PROFESSOR</div>' +
          '<h1>' + esc(d.name) + '</h1>' +
          '<div class="code-share-banner">' +
            '<span>Código da turma: <b>' + esc(d.code) + '</b></span>' +
            '<button class="btn secondary" data-action="classroom-copy-code" data-code="' + esc(d.code) + '">' + icon('bookmark') + ' Copiar código</button>' +
          '</div>' +
          '<div class="classroom-tracks-row" style="margin-top:10px">' + tracksPills + '</div>' +
        '</div>' +

        assignmentComposer(d) +
        '<div class="section-title"><h2>Atividades publicadas</h2><span class="pill">' + (d.assignments || []).length + '</span></div>' +
        ((d.assignments || []).length ? '<div class="assignments-grid teacher">' + d.assignments.map(a => assignmentCard(a, true)).join('') + '</div>' :
          '<div class="card assignment-empty"><h3>Nenhuma atividade publicada</h3><p class="muted">Use o formulário acima para lançar o primeiro trabalho ou a primeira lição de casa.</p></div>') +

        '<!-- Controle de saída -->' +
        '<div class="card" style="margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap">' +
          '<div>' +
            '<div style="font-size:13px;font-weight:800">' + icon('lock') + ' Bloquear saída dos alunos</div>' +
            '<p class="small muted" style="margin-top:4px">Quando ativo, os alunos não podem sair da sala pelo app.</p>' +
          '</div>' +
          '<button class="btn ' + (d.lock_exit ? 'primary' : 'secondary') + ' slim" data-action="classroom-toggle-lock-exit" data-id="' + esc(d.id) + '" aria-pressed="' + !!d.lock_exit + '">' +
            (d.lock_exit ? icon('lock') + ' Bloqueado' : icon('lock') + ' Liberar saída') +
          '</button>' +
        '</div>' +

        '<!-- Overview metrics -->' +
        '<div class="stat-grid-4">' +
          '<div class="stat-card"><b>' + totalEnrolled + '</b><span>Alunos matriculados</span></div>' +
          '<div class="stat-card"><b>' + activePeriod + '</b><span>Ativos no período</span></div>' +
          '<div class="stat-card"><b>' + avgFirstTry + '</b><span>Acerto de 1ª tentativa</span></div>' +
          '<div class="stat-card"><b>' + avgSubAcc + '</b><span>Acerto por submissão</span></div>' +
        '</div>' +

        '<!-- Filters and search -->' +
        '<div class="dashboard-controls">' +
          '<div class="search-wrap">' +
            icon('search') +
            '<input class="search" id="student-search" type="search" placeholder="Buscar aluno pelo nome ou #tag" value="' + esc(searchQuery) + '">' +
          '</div>' +
          '<div class="chips-row">' +
            '<button class="chip ' + (filterPeriod === 'all' ? 'selected' : '') + '" data-action="classroom-filter-period" data-id="all">Todo o período</button>' +
            '<button class="chip ' + (filterPeriod === '30d' ? 'selected' : '') + '" data-action="classroom-filter-period" data-id="30d">Últimos 30 dias</button>' +
            '<button class="chip ' + (filterPeriod === '7d' ? 'selected' : '') + '" data-action="classroom-filter-period" data-id="7d">Últimos 7 dias</button>' +
          '</div>' +
        '</div>' +

        (isLoading ? '<div class="loading-box"><p class="muted">Atualizando dados…</p></div>' : '') +
        (filtered.length === 0 ?
          '<div class="card empty full-span">' +
            icon('user') +
            '<h2>Nenhum aluno encontrado</h2>' +
            '<p>' + (students.length === 0 ? 'Compartilhe o código acima para que seus alunos entrem na sala.' : 'Nenhum aluno corresponde aos filtros.') + '</p>' +
          '</div>' :
          '<div class="students-list-grid">' + studentsRows + '</div>'
        ) +
      '</div>';
    }

    function renderStudentReport() {
      if (!studentReportData) return renderTeacherDashboard();
      const r = studentReportData;
      const st = r.student;
      const events = r.events || [];

      // Calculate indicators
      const m = manager.calculateMetrics(events, r.classroom.tracks || [], st.initialProgress || {});

      const baselineKeys = Object.keys(st.initialProgress || {});
      const baselineHtml = baselineKeys.length > 0 ?
        '<details class="baseline-progress-details">' +
          '<summary>' + icon('book') + ' Histórico anterior ao ingresso (' + baselineKeys.length + ' lições concluídas antes)</summary>' +
          '<p class="small muted">Lições concluídas antes da entrada nesta sala. Detalhes de tentativas limitados ao melhor resultado registrado.</p>' +
          '<div class="baseline-chips">' +
            baselineKeys.map(k => {
              const l = catalog.lessons[k];
              const score = st.initialProgress[k] ? st.initialProgress[k].score : 0;
              return '<span class="pill">' + esc(l ? l.title : k) + ' (' + score + '/3★)</span>';
            }).join(' ') +
          '</div>' +
        '</details>' : '';

      const eventsRows = events.map(e => {
        const l = e.lessonId ? catalog.lessons[e.lessonId] : null;
        const q = e.questionId ? catalog.questions[e.questionId] : null;
        const typeBadge = e.eventType === 'lesson_completed' ? '<span class="pill green">Lição concluída</span>' :
                          e.eventType === 'review_completed' ? '<span class="pill orange">Revisão concluída</span>' :
                          e.eventType === 'exercise_completed' ? '<span class="pill">Exercício concluído</span>' :
                          '<span class="pill">Submissão</span>';

        const resultBadge = e.isCorrect === true ? '<span class="pill-badge correct">' + icon('check') + ' Correto</span>' :
                            e.isCorrect === false ? '<span class="pill-badge wrong">' + icon('close') + ' Incorreto</span>' : '';

        const timeStr = new Date(e.clientTime).toLocaleString('pt-BR', {
          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        });

        return '<div class="activity-event-row">' +
          '<div class="activity-main">' +
            '<div class="activity-type-line">' + typeBadge + resultBadge + '<span class="activity-time">' + timeStr + '</span></div>' +
            '<h4>' + esc(l ? l.title : (e.lessonId || 'Atividade')) + '</h4>' +
            (q ? '<p class="small muted">' + esc(q.prompt) + '</p>' : '') +
            (e.attempt > 1 ? '<span class="attempt-tag">Tentativa ' + e.attempt + '</span>' : '<span class="attempt-tag first">1ª tentativa</span>') +
          '</div>' +
        '</div>';
      }).join('');

      return '<div class="classroom-shell">' +
        '<div class="back-row"><button class="text-btn" data-action="classroom-back-dashboard">' + icon('back') + ' Painel da turma</button></div>' +
        '<div class="page-intro">' +
          '<div class="eyebrow orange">RELATÓRIO INDIVIDUAL DO ALUNO</div>' +
          '<h1>' + esc(st.name) + ' <small class="student-tag">' + esc(st.shortTag) + '</small></h1>' +
          '<p class="muted">Participante desde ' + new Date(st.joinedAt).toLocaleDateString('pt-BR') + ' • ' + esc(r.classroom.name) + '</p>' +
        '</div>' +

        '<!-- Performance stats -->' +
        '<div class="stat-grid-4">' +
          '<div class="stat-card"><b>' + m.completedLessonsCount + '</b><span>Lições concluídas</span></div>' +
          '<div class="stat-card"><b>' + (m.firstTryAcc !== null ? m.firstTryAcc + '%' : 'Sem dados') + '</b><span>Acerto na 1ª tentativa</span></div>' +
          '<div class="stat-card"><b>' + (m.submissionAcc !== null ? m.submissionAcc + '%' : 'Sem dados') + '</b><span>Acerto por submissão</span></div>' +
          '<div class="stat-card"><b>' + (m.avgAttempts !== null ? m.avgAttempts : '—') + '</b><span>Média de tentativas/ex.</span></div>' +
        '</div>' +

        baselineHtml +

        '<div class="section-title"><h2>Histórico de atividades recebidas</h2></div>' +
        (events.length === 0 ?
          '<div class="card empty full-span">' +
            icon('spark') +
            '<h2>Ainda sem novas atividades sincronizadas</h2>' +
            '<p>O aluno concluiu as atividades antes de ingressar ou ainda não sincronizou novas lições nesta sala.</p>' +
          '</div>' :
          '<div class="activity-timeline">' + eventsRows + '</div>'
        ) +
      '</div>';
    }

    function renderStudentView() {
      if (!studentRoomData) return renderList();
      const d = studentRoomData;
      const teachersList = (d.teachers || []).map(t => esc(t.name) + (t.is_owner ? ' (Responsável)' : '')).join(', ');

      const tracksPills = (d.tracks || []).map(tId => {
        const course = catalog.courses[tId];
        return '<span class="course-chip-small" style="--tone:' + (course ? course.color : '#c45126') + '">' + esc(course ? course.name : tId) + '</span>';
      }).join(' ');
      const assignments = d.assignments || [];

      return '<div class="classroom-shell">' +
        '<div class="back-row"><button class="text-btn" data-action="classroom-back-list">' + icon('back') + ' Minhas salas</button></div>' +
        '<div class="page-intro">' +
          '<div class="eyebrow orange">SUA SALA DE AULA</div>' +
          '<h1>' + esc(d.name) + '</h1>' +
          '<p class="muted">Professores: <b>' + (teachersList || 'Seu professor') + '</b></p>' +
        '</div>' +
        '<div class="section-title"><h2>Atividades da turma</h2><span class="pill">' + assignments.length + '</span></div>' +
        (assignments.length ? '<div class="assignments-grid student">' + assignments.map(a => assignmentCard(a, false)).join('') + '</div>' :
          '<div class="card assignment-empty"><h3>Nenhuma atividade no momento</h3><p class="muted">Quando o professor publicar um trabalho ou uma lição de casa, ela aparecerá aqui.</p></div>') +
        '<section class="card classroom-card">' +
          (d.description ? '<p class="classroom-desc">' + esc(d.description) + '</p>' : '') +
          '<div class="field">' +
            '<label>Trilhas acompanhadas</label>' +
            '<div class="classroom-tracks-row">' + tracksPills + '</div>' +
          '</div>' +
          '<div class="privacy-notice-box">' +
            '<h3>' + icon('spark') + ' Dados compartilhados com seus professores</h3>' +
            '<p>Seu progresso e suas tentativas nas trilhas acima são enviados automaticamente ao sincronizar.</p>' +
            '<p class="small muted">Seu caderno de anotações e favoritos continuam 100% particulares.</p>' +
          '</div>' +
          '<div class="classroom-student-actions">' +
            (d.lock_exit
              ? '<p class="small muted" style="text-align:center;padding:10px 0">' + icon('lock') + ' O professor bloqueou a saída desta sala.</p>'
              : button(icon('close') + ' Sair desta sala', 'classroom-leave-room', 'data-id="' + currentClassroomId + '"', 'btn danger full')
            ) +
          '</div>' +
        '</section>' +
      '</div>';
    }

    function page() {
      if (currentSubView === 'create') return renderCreate();
      if (currentSubView === 'join') return renderJoin();
      if (currentSubView === 'preview') return renderPreview();
      if (currentSubView === 'dashboard') return renderTeacherDashboard();
      if (currentSubView === 'student-report') return renderStudentReport();
      if (currentSubView === 'student-view') return renderStudentView();
      return renderList();
    }

    // Event actions dispatcher
    function action(a, element) {
      if (!a.startsWith('classroom-')) return false;

      if (a === 'classroom-auth') {
        requireAuth('acessar salas de aula', () => {
          navigate('classrooms');
          loadMyClassrooms();
        });
        return true;
      }

      if (a === 'classroom-back-list') {
        setSubView('list');
        loadMyClassrooms();
        return true;
      }

      if (a === 'classroom-back-dashboard') {
        setSubView('dashboard');
        return true;
      }

      if (a === 'classroom-go-join') {
        if (!requireAuth('entrar em uma sala de aula', () => {
          setSubView('join');
        })) return true;
        setSubView('join');
        return true;
      }

      if (a === 'classroom-go-create') {
        if (!requireAuth('criar uma sala de aula', () => {
          setSubView('create');
        })) return true;
        setSubView('create');
        return true;
      }

      if (a === 'classroom-submit-create') {
        const nameField = document.getElementById('classroom-name');
        const descField = document.getElementById('classroom-desc');
        const name = nameField ? nameField.value.trim() : '';
        const desc = descField ? descField.value.trim() : '';
        const checkedBoxes = [...document.querySelectorAll('input[name="classroom-tracks"]:checked')];
        const tracks = checkedBoxes.map(b => b.value);

        if (!name) {
          errorMsg = 'Informe um nome para a sala.';
          render(false);
          if (nameField) nameField.focus();
          return true;
        }
        if (tracks.length === 0) {
          errorMsg = 'Selecione pelo menos uma trilha para acompanhar.';
          render(false);
          return true;
        }

        isLoading = true;
        errorMsg = '';
        render(false);
        (async () => {
          try {
            const res = await manager.createClassroom({ name, description: desc, tracks });
            if (res && res.ok && res.classroom) {
              toast('Sala criada com sucesso!');
              openDashboard(res.classroom.id);
            } else {
              errorMsg = (res && res.error) || 'Não foi possível criar a sala.';
              render(false);
            }
          } catch (err) {
            errorMsg = err.message || 'Erro ao criar sala.';
            render(false);
          } finally {
            isLoading = false;
          }
        })();
        return true;
      }

      if (a === 'classroom-submit-preview') {
        if (isLoading) return true;
        const codeInput = document.getElementById('classroom-code-input');
        const code = codeInput ? codeInput.value.trim() : '';
        enteredCode = code;
        if (!code) {
          errorMsg = 'Digite o código da sala.';
          render(false);
          return true;
        }

        isLoading = true;
        errorMsg = '';
        render(false);
        (async () => {
          try {
            const res = await manager.previewCode(code);
            const preview = res && res.preview;
            const classroom = res && (res.classroom || (preview && (preview.classroom || preview)));
            if (res && res.ok && classroom) {
              const alreadyMember = res.alreadyMember === true || !!(preview && preview.is_member);
              previewData = { classroom, alreadyMember, enteredCode: code };
              if (alreadyMember) {
                // Preview intentionally omits membership details; use the user's
                // own room list to choose the teacher or student view.
                const rooms = await manager.listMyClassrooms();
                if (!rooms || !rooms.ok) {
                  throw new Error((rooms && rooms.error) || 'Não foi possível carregar sua participação na sala.');
                }
                const classroomId = classroom.id || classroom.classroom_id;
                const membership = (rooms.classrooms || []).find(c => c.id === classroomId);
                toast('Você já participa desta sala.');
                if (membership && (membership.role === 'owner' || membership.role === 'collaborator')) {
                  await openDashboard(classroomId);
                } else {
                  await openStudentView(classroomId);
                }
              } else {
                setSubView('preview');
              }
            } else {
              errorMsg = (res && res.error) || 'Código inválido ou sala não encontrada.';
              render(false);
            }
          } catch (err) {
            errorMsg = err.message || 'Erro ao consultar código.';
            render(false);
          } finally {
            isLoading = false;
            render(false);
          }
        })();
        return true;
      }

      if (a === 'classroom-confirm-join') {
        if (isLoading) return true;
        if (!previewData || !previewData.enteredCode) return true;
        isLoading = true;
        errorMsg = '';
        render(false);
        (async () => {
          try {
            const currentProgress = state();
            const initialSummary = {};
            if (currentProgress && currentProgress.completed) {
              Object.entries(currentProgress.completed).forEach(([lId, v]) => {
                initialSummary[lId] = { score: v.score, times: v.times, day: v.day };
              });
            }
            const displayName = (currentProgress && currentProgress.name) || 'Aluno';
            const res = await manager.joinClassroom(previewData.enteredCode, displayName, initialSummary);
            if (res && res.ok) {
              const classroom = res.classroom || previewData.classroom;
              const classroomId = res.classroom_id || classroom.id || classroom.classroom_id;
              toast(res.alreadyMember ? 'Você já participa desta sala.' : 'Entrada confirmada! Bem-vindo à sala.');
              if (classroom.role === 'owner' || classroom.role === 'collaborator') {
                await openDashboard(classroomId);
              } else {
                await openStudentView(classroomId);
              }
            } else {
              errorMsg = (res && res.error) || 'Não foi possível confirmar a entrada.';
              render(false);
            }
          } catch (err) {
            errorMsg = err.message || 'Erro ao entrar na sala.';
            render(false);
          } finally {
            isLoading = false;
            render(false);
          }
        })();
        return true;
      }

      if (a === 'classroom-open-dashboard') {
        const id = element.dataset.id;
        if (id) openDashboard(id);
        return true;
      }

      if (a === 'classroom-open-student-view') {
        const id = element.dataset.id;
        if (id) openStudentView(id);
        return true;
      }

      if (a === 'classroom-open-student-report') {
        const studentId = element.dataset.studentId;
        if (studentId && currentClassroomId) {
          openStudentReport(currentClassroomId, studentId);
        }
        return true;
      }

      if (a === 'classroom-refresh-dashboard') {
        if (currentClassroomId) openDashboard(currentClassroomId);
        return true;
      }

      if (a === 'classroom-assignment-kind') {
        assignmentDraft.kind = element.dataset.id === 'homework' ? 'homework' : 'project';
        render(false);
        return true;
      }

      if (a === 'classroom-publish-assignment') {
        if (isLoading || !currentClassroomId || !teacherDashboardData) return true;
        const titleField = document.getElementById('assignment-title');
        const descriptionField = document.getElementById('assignment-description');
        const dueField = document.getElementById('assignment-due-date');
        const courseField = document.getElementById('assignment-course');
        const lessonField = document.getElementById('assignment-lesson');
        const title = titleField ? titleField.value.trim() : assignmentDraft.title.trim();
        const description = descriptionField ? descriptionField.value.trim() : assignmentDraft.description.trim();
        const dueDate = dueField ? dueField.value : assignmentDraft.dueDate;
        const courseId = courseField ? courseField.value : assignmentDraft.courseId;
        const lessonId = lessonField ? lessonField.value : assignmentDraft.lessonId;
        const lesson = catalog.lessons[lessonId];
        assignmentDraft = { ...assignmentDraft, title, description, dueDate, courseId, lessonId };

        if (!title) errorMsg = 'Informe o título da atividade.';
        else if (!dueDate || dueDate < localToday()) errorMsg = 'Escolha hoje ou uma data futura para a entrega.';
        else if (assignmentDraft.kind === 'homework' && (!courseId || !lesson || lesson.courseId !== courseId)) errorMsg = 'Escolha até qual lição os alunos devem fazer.';
        else errorMsg = '';
        if (errorMsg) { render(false); return true; }

        isLoading = true;
        render(false);
        (async () => {
          try {
            const res = await manager.createAssignment(currentClassroomId, {
              kind: assignmentDraft.kind,
              title,
              description,
              dueDate,
              lesson: assignmentDraft.kind === 'homework' ? {
                id: lesson.id, courseId: lesson.courseId, number: lesson.number, title: lesson.title
              } : null
            });
            if (res && res.ok && res.assignment) {
              const assignments = [...(teacherDashboardData.assignments || []), res.assignment]
                .sort((left, right) => String(left.dueDate).localeCompare(String(right.dueDate)));
              teacherDashboardData = { ...teacherDashboardData, assignments };
              assignmentDraft = { kind: assignmentDraft.kind, title: '', description: '', dueDate: '', courseId, lessonId };
              toast('Atividade publicada para a turma!');
            } else {
              errorMsg = (res && res.error) || 'Não foi possível publicar a atividade.';
            }
          } catch (err) {
            errorMsg = err.message || 'Erro ao publicar atividade.';
          } finally {
            isLoading = false;
            render(false);
          }
        })();
        return true;
      }

      if (a === 'classroom-cancel-assignment') {
        const assignmentId = element.dataset.id;
        if (!assignmentId || !currentClassroomId) return true;
        confirm('Cancelar esta atividade?', 'Ela deixará de aparecer para os alunos, mas o registro será preservado no banco.', 'Cancelar atividade', async () => {
          try {
            const res = await manager.cancelAssignment(currentClassroomId, assignmentId);
            if (res && res.ok) {
              teacherDashboardData = { ...teacherDashboardData, assignments: (teacherDashboardData.assignments || []).filter(item => item.id !== assignmentId) };
              toast('Atividade cancelada.');
              render(false);
            } else toast((res && res.error) || 'Não foi possível cancelar a atividade.');
          } catch (err) { toast(err.message || 'Erro ao cancelar atividade.'); }
        }, true);
        return true;
      }

      if (a === 'classroom-open-assignment-course') {
        const courseId = element.dataset.id;
        if (courseId && typeof host.openCourse === 'function') host.openCourse(courseId);
        return true;
      }

      if (a === 'classroom-copy-code') {
        const code = element.dataset.code;
        if (code && navigator.clipboard) {
          navigator.clipboard.writeText(code).then(() => {
            toast('Código ' + code + ' copiado para a área de transferência!');
          }).catch(() => {
            toast('Código: ' + code);
          });
        } else if (code) {
          toast('Código: ' + code);
        }
        return true;
      }

      if (a === 'classroom-leave-room') {
        const id = element.dataset.id || currentClassroomId;
        if (!id) return true;
        confirm('Sair da sala de aula?', 'Você deixará de compartilhar suas novas atividades com esta turma. Seu progresso pessoal continua salvo no Faísca.', 'Sair da sala', async () => {
          try {
            const res = await manager.leaveClassroom(id);
            if (res && res.ok) {
              toast('Você saiu da sala de aula.');
              setSala(null);
              setSubView('list');
              loadMyClassrooms();
            } else {
              toast((res && res.error) || 'Não foi possível sair da sala.');
            }
          } catch (err) {
            toast(err.message || 'Erro ao sair da sala.');
          }
        }, true);
        return true;
      }

      if (a === 'classroom-filter-period') {
        filterPeriod = element.dataset.id || 'all';
        if (currentClassroomId) openDashboard(currentClassroomId);
        return true;
      }

      if (a === 'classroom-toggle-lock-exit') {
        const id = element.dataset.id || currentClassroomId;
        if (!id || !teacherDashboardData) return true;
        const newLock = !teacherDashboardData.lock_exit;
        const d = teacherDashboardData;
        isLoading = true;
        render(false);
        (async () => {
          try {
            const res = await manager.updateClassroom(id, {
              name: d.name,
              description: d.description,
              tracks: d.tracks,
              status: d.status,
              lock_exit: newLock
            });
            if (res && res.ok) {
              teacherDashboardData = { ...teacherDashboardData, lock_exit: newLock };
              toast(newLock ? 'Saída bloqueada. Alunos não podem sair da sala.' : 'Saída liberada.');
            } else {
              toast((res && res.error) || 'Não foi possível atualizar a configuração.');
            }
          } catch (err) {
            toast(err.message || 'Erro ao atualizar configuração.');
          } finally {
            isLoading = false;
            render(false);
          }
        })();
        return true;
      }

      return false;
    }

    // Input and change handlers
    document.addEventListener('input', function (e) {
      if (e.target && e.target.id === 'classroom-code-input') {
        enteredCode = e.target.value;
      }
      if (e.target && e.target.id === 'student-search') {
        searchQuery = e.target.value;
        if (currentSubView === 'dashboard') render(false);
      }
      if (e.target && e.target.id === 'assignment-title') assignmentDraft.title = e.target.value;
      if (e.target && e.target.id === 'assignment-description') assignmentDraft.description = e.target.value;
      if (e.target && e.target.id === 'assignment-due-date') assignmentDraft.dueDate = e.target.value;
    });

    document.addEventListener('change', function (e) {
      if (e.target && e.target.name === 'classroom-tracks') {
        const item = e.target.closest('.track-checkbox-item');
        if (item) item.classList.toggle('selected', e.target.checked);
      }
      if (e.target && e.target.id === 'assignment-course') {
        assignmentDraft.courseId = e.target.value;
        assignmentDraft.lessonId = '';
        render(false);
      }
      if (e.target && e.target.id === 'assignment-lesson') assignmentDraft.lessonId = e.target.value;
    });

    return {
      page,
      action,
      loadMyClassrooms,
      onAuthChanged,
      setSubView
    };
  }

  return { createUI };
});
