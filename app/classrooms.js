(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FaiscaClassrooms = factory();
  }
})(typeof window === 'undefined' ? this : window, function () {
  'use strict';

  function createManager(options) {
    const A = options.account;
    const C = options.core;
    const catalog = options.catalog;
    const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);

    // In-memory queue cache per account
    let memoryQueues = Object.create(null);
    let isSyncingQueue = false;

    function getOwner() {
      return (A && typeof A.owner === 'function') ? A.owner() : 'guest';
    }

    function storageKey(owner) {
      return 'faisca-event-queue.' + (owner || getOwner());
    }

    async function loadQueue(owner) {
      const o = owner || getOwner();
      if (memoryQueues[o]) return memoryQueues[o];
      if (A && typeof A.queueLoad === 'function') {
        const nativeQ = await A.queueLoad();
        if (Array.isArray(nativeQ)) {
          memoryQueues[o] = nativeQ;
          return nativeQ;
        }
      }
      if (storage) {
        try {
          const raw = storage.getItem(storageKey(o));
          memoryQueues[o] = raw ? JSON.parse(raw) : [];
          return memoryQueues[o];
        } catch (e) {
          memoryQueues[o] = [];
          return [];
        }
      }
      memoryQueues[o] = memoryQueues[o] || [];
      return memoryQueues[o];
    }

    async function saveQueue(queue, owner) {
      const o = owner || getOwner();
      memoryQueues[o] = queue;
      if (A && typeof A.queueSave === 'function') {
        await A.queueSave(queue);
      }
      if (storage) {
        try {
          storage.setItem(storageKey(o), JSON.stringify(queue));
        } catch (ignored) {}
      }
    }

    async function enqueue(event, owner) {
      if (!event || !event.id) return;
      const o = owner || getOwner();
      const q = await loadQueue(o);
      if (!q.some(e => e.id === event.id)) {
        q.push(event);
        // Keep queue capped at safe limit (e.g. 2000 events)
        if (q.length > 2000) q.splice(0, q.length - 2000);
        await saveQueue(q, o);
      }
      // Attempt background flush if authenticated and online
      if (A && A.status && A.status().user && !A.status().needsLogin) {
        scheduleQueueSync();
      }
    }

    async function clearConfirmed(confirmedIds, owner) {
      const o = owner || getOwner();
      if (!confirmedIds || !confirmedIds.length) return;
      const q = await loadQueue(o);
      const set = new Set(confirmedIds);
      const remaining = q.filter(e => !set.has(e.id));
      await saveQueue(remaining, o);
    }

    let syncTimer = null;
    function scheduleQueueSync() {
      if (syncTimer) clearTimeout(syncTimer);
      syncTimer = setTimeout(() => {
        syncEventQueue().catch(() => {});
      }, 1500);
    }

    async function syncEventQueue(owner) {
      if (isSyncingQueue) return false;
      const o = owner || getOwner();
      if (!A || !A.status().user || o === 'guest') return false;
      isSyncingQueue = true;
      try {
        const q = await loadQueue(o);
        if (!q.length) return true;
        const batch = q.slice(0, 50);
        const displayName = (A.status().user && A.status().user.name) || '';
        const res = await A.rpc('faisca_sync_learning_events', {
          events: batch,
          display_name: displayName
        });
        if (res && res.ok) {
          const syncedCount = res.syncedCount !== undefined ? res.syncedCount : (res.count !== undefined ? res.count : batch.length);
          const syncedIds = batch.slice(0, syncedCount).map(e => e.id);
          await clearConfirmed(syncedIds, o);
          // If more events remain, process next batch
          if (q.length > batch.length) {
            scheduleQueueSync();
          }
          return { ok: true, syncedCount, count: syncedCount };
        }
        return false;
      } catch (err) {
        return false;
      } finally {
        isSyncingQueue = false;
      }
    }

    // Connect automatically to core events
    if (C && typeof C.addEventListener === 'function') {
      C.addEventListener(event => {
        enqueue(event).catch(() => {});
      });
    }

    // Performance and metrics formulas
    function calculateMetrics(events = [], trackedTracks = [], initialProgress = {}, options = {}) {
      if (!Array.isArray(trackedTracks) && !(trackedTracks instanceof Set)) {
        if (Array.isArray(initialProgress)) {
          const temp = trackedTracks;
          trackedTracks = initialProgress;
          initialProgress = temp;
        } else {
          trackedTracks = [];
        }
      }
      const tracksArr = Array.from(trackedTracks);
      const tracksSet = new Set(tracksArr);
      let period = 'all';
      let trackFilter = null;
      if (typeof options === 'string') {
        period = options;
      } else if (options && typeof options === 'object') {
        period = options.period || 'all';
        trackFilter = options.track || null;
      }

      let cutoff = null;
      if (period === '7d') cutoff = Date.now() - 7 * 86400000;
      else if (period === '30d') cutoff = Date.now() - 30 * 86400000;

      const relevantEvents = (events || []).filter(e => {
        const cId = e.courseId || e.course_id || e.trackId || e.track_id || (e.lessonId || e.lesson_id ? String(e.lessonId || e.lesson_id).split('-')[0] : null);
        if (tracksSet.size > 0 && !tracksSet.has(cId)) return false;
        if (trackFilter && cId !== trackFilter) return false;
        if (cutoff !== null) {
          const t = new Date(e.clientTime || e.client_time || e.timestamp).getTime();
          if (Number.isFinite(t) && t < cutoff) return false;
        }
        return true;
      });

      // 1. Completed unique lessons
      const completedLessonSet = new Set();
      relevantEvents.forEach(e => {
        const evType = e.eventType || e.event_type;
        const lId = e.lessonId || e.lesson_id;
        if (evType === 'lesson_completed' && lId) {
          completedLessonSet.add(lId);
        }
      });

      // Include initial progress if period is 'all'
      if (period === 'all' && initialProgress && typeof initialProgress === 'object') {
        Object.keys(initialProgress).forEach(lId => {
          const cId = lId.split('-')[0];
          if ((tracksSet.size === 0 || tracksSet.has(cId)) && (!trackFilter || cId === trackFilter)) {
            completedLessonSet.add(lId);
          }
        });
      }

      // Total lessons in tracked tracks
      let totalLessonsInTracks = 0;
      if (catalog && catalog.courses) {
        const checkTracks = trackFilter ? [trackFilter] : tracksArr;
        checkTracks.forEach(cId => {
          if (catalog.courses[cId] && catalog.courses[cId].lessons) {
            totalLessonsInTracks += catalog.courses[cId].lessons.length;
          } else {
            totalLessonsInTracks += 40; // Default 40 lessons per track in Faísca
          }
        });
      } else {
        totalLessonsInTracks = (trackFilter ? 1 : tracksArr.length) * 40;
      }

      const progressPercent = totalLessonsInTracks > 0
        ? Math.round((completedLessonSet.size / totalLessonsInTracks) * 1000) / 10
        : null;

      // 2. First-try accuracy on exercises:
      // Exercícios acertados na primeira submissão de cada sessão ÷ exercícios com primeira submissão registrada * 100
      const firstTrySubmissions = Object.create(null);
      relevantEvents.forEach(e => {
        const evType = e.eventType || e.event_type;
        const att = e.attempt !== undefined ? e.attempt : 1;
        const qId = e.questionId || e.question_id;
        const sId = e.sessionId || e.session_id || 'sess';
        const isCorr = e.isCorrect !== undefined ? e.isCorrect : (e.is_correct === true);
        if (evType === 'answer_submitted' && att === 1 && qId) {
          const key = sId + ':' + qId;
          if (firstTrySubmissions[key] === undefined) {
            firstTrySubmissions[key] = isCorr === true;
          }
        }
      });

      const firstTryKeys = Object.keys(firstTrySubmissions);
      const firstTryTotal = firstTryKeys.length;
      const firstTryCorrect = firstTryKeys.filter(k => firstTrySubmissions[k]).length;
      const firstTryAcc = firstTryTotal > 0
        ? Math.round((firstTryCorrect / firstTryTotal) * 1000) / 10
        : null;

      // 3. Accuracy by submission:
      // Submissões corretas ÷ total de submissões registradas * 100
      let totalSubmissions = 0;
      let correctSubmissions = 0;
      relevantEvents.forEach(e => {
        const evType = e.eventType || e.event_type;
        const isCorr = e.isCorrect !== undefined ? e.isCorrect : (e.is_correct === true);
        if (evType === 'answer_submitted') {
          totalSubmissions++;
          if (isCorr === true) correctSubmissions++;
        }
      });
      const submissionAcc = totalSubmissions > 0
        ? Math.round((correctSubmissions / totalSubmissions) * 1000) / 10
        : null;

      // 4. Average attempts per exercise
      const exercisesAttempted = new Set();
      relevantEvents.forEach(e => {
        const evType = e.eventType || e.event_type;
        const qId = e.questionId || e.question_id;
        const sId = e.sessionId || e.session_id || 'sess';
        if (evType === 'answer_submitted' && qId) {
          exercisesAttempted.add(sId + ':' + qId);
        }
      });
      const avgAttempts = exercisesAttempted.size > 0
        ? Math.round((totalSubmissions / exercisesAttempted.size) * 10) / 10
        : null;

      return {
        completedLessonsCount: completedLessonSet.size,
        totalLessonsInTracks,
        progressPercent,
        firstTryAcc,
        firstTryTotal,
        firstTryCorrect,
        submissionAcc,
        totalSubmissions,
        correctSubmissions,
        avgAttempts,
        exercisesCount: exercisesAttempted.size,
        eventsCount: relevantEvents.length
      };
    }

    // Classroom Server APIs via A.rpc
    function listMyClassrooms() {
      return A.rpc('faisca_list_my_classrooms');
    }

    function getClassroom(classroomId) {
      return A.rpc('faisca_get_classroom', { classroom_id: classroomId });
    }

    function createClassroom(dataOrName, description, tracks) {
      let payload;
      if (typeof dataOrName === 'string') {
        payload = {
          name: dataOrName,
          description: description || null,
          tracks: tracks || []
        };
      } else if (dataOrName && typeof dataOrName === 'object') {
        payload = {
          name: dataOrName.name,
          description: dataOrName.description || null,
          tracks: dataOrName.tracks || []
        };
      } else {
        payload = {};
      }
      return A.rpc('faisca_create_classroom', payload);
    }

    function previewCode(code) {
      return A.rpc('faisca_preview_classroom_code', { code });
    }

    function joinClassroom(code, displayName, initialSummary = {}) {
      return A.rpc('faisca_join_classroom', {
        code,
        display_name: displayName,
        initial_summary: initialSummary
      });
    }

    function leaveClassroom(classroomId) {
      return A.rpc('faisca_leave_classroom', { p_classroom_id: classroomId });
    }

    function updateClassroom(classroomId, data) {
      return A.rpc('faisca_update_classroom', {
        p_classroom_id: classroomId,
        p_name: data.name,
        p_description: data.description || null,
        p_tracks: data.tracks,
        p_status: data.status,
        p_lock_exit: data.lock_exit === true
      });
    }

    function regenerateCode(classroomId) {
      return A.rpc('faisca_regenerate_classroom_code', { p_classroom_id: classroomId });
    }

    function removeMember(classroomId, targetUserId) {
      return A.rpc('faisca_remove_classroom_member', {
        p_classroom_id: classroomId,
        p_target_user_id: targetUserId
      });
    }

    function readmitMember(classroomId, targetUserId) {
      return A.rpc('faisca_readmit_classroom_member', {
        p_classroom_id: classroomId,
        p_target_user_id: targetUserId
      });
    }

    function manageTeacher(classroomId, targetEmail, action) {
      return A.rpc('faisca_manage_classroom_teacher', {
        p_classroom_id: classroomId,
        p_target_email: targetEmail,
        p_action: action
      });
    }

    function archiveClassroom(classroomId) {
      return A.rpc('faisca_archive_classroom', { p_classroom_id: classroomId });
    }

    function fetchTeacherDashboard(classroomId, filterTrack = null, filterPeriod = 'all') {
      return A.rpc('faisca_classroom_teacher_dashboard', {
        p_classroom_id: classroomId,
        filter_track: filterTrack,
        filter_period: filterPeriod
      });
    }

    function fetchStudentReport(classroomId, studentId, filterTrack = null, filterPeriod = 'all') {
      return A.rpc('faisca_classroom_student_report', {
        p_classroom_id: classroomId,
        p_student_id: studentId,
        filter_track: filterTrack,
        filter_period: filterPeriod
      });
    }

    function fetchStudentView(classroomId) {
      return A.rpc('faisca_classroom_student_view', { p_classroom_id: classroomId });
    }

    function createAssignment(classroomId, data) {
      const lesson = data && data.lesson;
      return A.rpc('faisca_create_classroom_assignment', {
        p_classroom_id: classroomId,
        p_kind: data.kind,
        p_title: data.title,
        p_description: data.description || null,
        p_due_date: data.dueDate,
        p_course_id: lesson ? lesson.courseId : null,
        p_lesson_id: lesson ? lesson.id : null,
        p_lesson_number: lesson ? lesson.number : null,
        p_lesson_title: lesson ? lesson.title : null
      });
    }

    function cancelAssignment(classroomId, assignmentId) {
      return A.rpc('faisca_cancel_classroom_assignment', {
        p_classroom_id: classroomId,
        p_assignment_id: assignmentId
      });
    }

    return {
      enqueue,
      loadQueue,
      saveQueue,
      clearConfirmed,
      syncEventQueue,
      calculateMetrics,
      listMyClassrooms,
      getClassroom,
      createClassroom,
      previewCode,
      joinClassroom,
      leaveClassroom,
      updateClassroom,
      regenerateCode,
      removeMember,
      readmitMember,
      manageTeacher,
      archiveClassroom,
      fetchTeacherDashboard,
      fetchStudentReport,
      fetchStudentView,
      createAssignment,
      cancelAssignment
    };
  }

  return { createManager };
});
