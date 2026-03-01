import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import {
  BookMarked,
  BrainCircuit,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  Compass,
  Crown,
  Flag,
  Handshake,
  Lightbulb,
  Loader2,
  Medal,
  Plus,
  Rocket,
  Save,
  Send,
  Settings2,
  Sparkles,
  Target,
  Trophy,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import {
  fetchProgramOverview,
  fetchProgramConfig,
  updateProgramConfig,
  fetchProgramQuests,
  createProgramQuest,
  updateProgramQuest,
  submitProgramQuest,
  fetchMyProgramQuestSubmissions,
  fetchProgramQuestSubmissions,
  reviewProgramQuestSubmission,
  fetchMentorRequests,
  createMentorRequest,
  updateMentorRequest,
  fetchBadgeOverview,
  fetchBadgeRules,
  createBadgeRule,
  updateBadgeRule,
  fetchProgramIdeas,
  createProgramIdea,
  updateProgramIdea,
  toggleProgramIdeaJoin,
  convertProgramIdea,
  fetchOfficeHourSlots,
  createOfficeHourSlot,
  updateOfficeHourSlot,
  bookOfficeHourSlot,
  fetchMyOfficeHourBookings,
  updateOfficeHourBooking,
  fetchContests,
  createContest,
  updateContest as updateContestApi,
  startContestAttempt,
  submitContestAttempt,
  fetchMyContestAttempts,
} from '../api';
import PageHeader from '../components/PageHeader';
import { DataEmpty, DataError, DataLoading } from '../components/DataState';

const TABS = [
  { id: 'overview', label: 'Overview', icon: Sparkles },
  { id: 'quests', label: 'Weekly Quests', icon: Target },
  { id: 'contests', label: 'Contests', icon: ClipboardList },
  { id: 'mentor', label: 'Mentor Desk', icon: Handshake },
  { id: 'badges', label: 'Badges & Level', icon: Trophy },
  { id: 'ideas', label: 'Idea Incubator', icon: Lightbulb },
  { id: 'office-hours', label: 'Office Hours', icon: CalendarClock },
];

const QUEST_STATUS_CLASS = {
  NotSubmitted: 'text-gray-300 border-gray-700 bg-gray-800/30',
  Submitted: 'text-blue-300 border-blue-500/40 bg-blue-500/10',
  Approved: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
  Rejected: 'text-rose-300 border-rose-500/40 bg-rose-500/10',
  NeedsRevision: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
};

const MENTOR_STATUS_CLASS = {
  Open: 'text-cyan-300 border-cyan-500/40 bg-cyan-500/10',
  Accepted: 'text-blue-300 border-blue-500/40 bg-blue-500/10',
  Resolved: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
  Closed: 'text-gray-300 border-gray-700 bg-gray-800/30',
};

const IDEA_STATUS_CLASS = {
  UnderReview: 'text-cyan-300 border-cyan-500/40 bg-cyan-500/10',
  Approved: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
  Rejected: 'text-rose-300 border-rose-500/40 bg-rose-500/10',
  Converted: 'text-indigo-300 border-indigo-500/40 bg-indigo-500/10',
};

const SLOT_STATUS_CLASS = {
  Open: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
  Closed: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
  Cancelled: 'text-rose-300 border-rose-500/40 bg-rose-500/10',
};

const BADGE_ICONS = {
  Medal,
  Trophy,
  Crown,
  Rocket,
  Compass,
  Flag,
};

const dispatchToast = (message, type = 'info') => {
  try {
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type } }));
  } catch {
    window.alert(message);
  }
};

const sanitize = (value) => String(value || '').trim();

const formatDateTime = (value) => {
  if (!value) return 'N/A';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString();
};

export default function ProgramsHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  const user = profile.result || profile;
  const role = String(user.role || '').toLowerCase();
  const year = Number(user.year);
  const isAdminOrHead = role === 'admin' || role === 'head';
  const isSeniorMentor = isAdminOrHead || role === 'alumni' || (role === 'user' && Number.isFinite(year) && year >= 2);

  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || localStorage.getItem('programs_tab') || 'overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [overview, setOverview] = useState(null);
  const [configDraft, setConfigDraft] = useState(null);
  const [configBusy, setConfigBusy] = useState(false);

  const [quests, setQuests] = useState([]);
  const [myQuestRows, setMyQuestRows] = useState([]);
  const [questReviewRows, setQuestReviewRows] = useState([]);
  const [questSubmissionDrafts, setQuestSubmissionDrafts] = useState({});
  const [questSubmitBusy, setQuestSubmitBusy] = useState('');
  const [questReviewDrafts, setQuestReviewDrafts] = useState({});
  const [questReviewBusy, setQuestReviewBusy] = useState('');
  const [questCreateBusy, setQuestCreateBusy] = useState(false);
  const [questStatusBusy, setQuestStatusBusy] = useState('');
  const [questForm, setQuestForm] = useState({
    title: '',
    summary: '',
    category: 'Technical',
    audience: 'FirstAndSecond',
    points: 40,
    startsAt: '',
    endsAt: '',
    status: 'Active',
  });

  const [mentorRows, setMentorRows] = useState([]);
  const [mentorBusy, setMentorBusy] = useState('');
  const [mentorNoteDrafts, setMentorNoteDrafts] = useState({});
  const [mentorFormBusy, setMentorFormBusy] = useState(false);
  const [mentorForm, setMentorForm] = useState({
    topic: '',
    description: '',
    urgency: 'Medium',
    preferredMode: 'Either',
  });

  const [badgeOverview, setBadgeOverview] = useState(null);
  const [badgeRules, setBadgeRules] = useState([]);
  const [badgeFormBusy, setBadgeFormBusy] = useState(false);
  const [badgeRuleForm, setBadgeRuleForm] = useState({
    name: '',
    description: '',
    icon: 'Medal',
    criteriaType: 'PointsThreshold',
    criteriaValue: 100,
    isEnabled: true,
    order: 50,
  });

  const [ideas, setIdeas] = useState([]);
  const [ideaBusy, setIdeaBusy] = useState('');
  const [ideaReviewDrafts, setIdeaReviewDrafts] = useState({});
  const [ideaFormBusy, setIdeaFormBusy] = useState(false);
  const [ideaForm, setIdeaForm] = useState({
    title: '',
    summary: '',
    problemStatement: '',
    proposedStack: '',
    tags: '',
  });

  const [officeSlots, setOfficeSlots] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [officeBusy, setOfficeBusy] = useState('');
  const [bookingNotes, setBookingNotes] = useState({});
  const [slotFormBusy, setSlotFormBusy] = useState(false);
  const [slotForm, setSlotForm] = useState({
    title: '',
    topic: '',
    mode: 'Online',
    locationOrLink: '',
    capacity: 8,
    startTime: '',
    endTime: '',
    status: 'Open',
  });

  const [contests, setContests] = useState([]);
  const [myContestAttempts, setMyContestAttempts] = useState([]);
  const [contestBusy, setContestBusy] = useState('');
  const [activeContest, setActiveContest] = useState(null);
  const [contestQuestions, setContestQuestions] = useState([]);
  const [contestAnswers, setContestAnswers] = useState({});
  const [contestAttempt, setContestAttempt] = useState(null);
  const [contestCreateBusy, setContestCreateBusy] = useState(false);
  const [contestForm, setContestForm] = useState({
    title: '',
    description: '',
    duration: 30,
    audience: 'AllMembers',
    status: 'Draft',
    startsAt: '',
    endsAt: '',
    questions: [{ questionText: '', questionType: 'MCQ', options: ['', '', '', ''], correctAnswer: '', points: 10 }],
  });

  const loadPrograms = async () => {
    setLoading(true);
    setError('');

    try {
      const [
        overviewRes,
        configRes,
        questsRes,
        myQuestRes,
        questReviewRes,
        mentorRes,
        badgeOverviewRes,
        badgeRuleRes,
        ideaRes,
        slotRes,
        myBookingsRes,
        contestsRes,
        myContestAttemptsRes,
      ] = await Promise.all([
        fetchProgramOverview().catch(() => ({ data: null })),
        fetchProgramConfig().catch(() => ({ data: null })),
        fetchProgramQuests(isAdminOrHead ? { includeArchived: 'true' } : {}).catch(() => ({ data: [] })),
        fetchMyProgramQuestSubmissions().catch(() => ({ data: [] })),
        isAdminOrHead ? fetchProgramQuestSubmissions().catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        fetchMentorRequests().catch(() => ({ data: [] })),
        fetchBadgeOverview().catch(() => ({ data: null })),
        fetchBadgeRules().catch(() => ({ data: [] })),
        fetchProgramIdeas().catch(() => ({ data: [] })),
        fetchOfficeHourSlots(isAdminOrHead ? { includePast: 'true' } : {}).catch(() => ({ data: [] })),
        fetchMyOfficeHourBookings().catch(() => ({ data: [] })),
        fetchContests(isAdminOrHead ? { includeAll: 'true' } : {}).catch(() => ({ data: [] })),
        fetchMyContestAttempts().catch(() => ({ data: [] })),
      ]);

      const nextConfig = configRes?.data || overviewRes?.data?.config || null;
      setOverview(overviewRes?.data || null);
      setConfigDraft(
        nextConfig
          ? {
              weeklyQuestsEnabled: !!nextConfig.weeklyQuestsEnabled,
              mentorDeskEnabled: !!nextConfig.mentorDeskEnabled,
              badgeSystemEnabled: !!nextConfig.badgeSystemEnabled,
              ideaIncubatorEnabled: !!nextConfig.ideaIncubatorEnabled,
              officeHoursEnabled: !!nextConfig.officeHoursEnabled,
              contestsEnabled: !!nextConfig.contestsEnabled,
              showProgramLeaderboard: !!nextConfig.showProgramLeaderboard,
            }
          : null
      );
      setQuests(Array.isArray(questsRes?.data) ? questsRes.data : []);
      setMyQuestRows(Array.isArray(myQuestRes?.data) ? myQuestRes.data : []);

      const reviewRows = Array.isArray(questReviewRes?.data) ? questReviewRes.data : [];
      setQuestReviewRows(reviewRows);
      setQuestReviewDrafts(
        reviewRows.reduce((acc, row) => {
          acc[row._id] = {
            status: row.status === 'Submitted' ? 'Approved' : row.status || 'Approved',
            pointsAwarded: row.quest?.points || row.pointsAwarded || 0,
            reviewNote: row.reviewNote || '',
          };
          return acc;
        }, {})
      );

      setMentorRows(Array.isArray(mentorRes?.data) ? mentorRes.data : []);
      setBadgeOverview(badgeOverviewRes?.data || null);
      setBadgeRules(Array.isArray(badgeRuleRes?.data) ? badgeRuleRes.data : []);

      const ideaRows = Array.isArray(ideaRes?.data) ? ideaRes.data : [];
      setIdeas(ideaRows);
      setIdeaReviewDrafts(
        ideaRows.reduce((acc, row) => {
          acc[row._id] = {
            status: row.status === 'Converted' ? 'Approved' : row.status || 'UnderReview',
            reviewNote: row.reviewNote || '',
            convertDomain: 'Tech',
          };
          return acc;
        }, {})
      );

      setOfficeSlots(Array.isArray(slotRes?.data) ? slotRes.data : []);
      setMyBookings(Array.isArray(myBookingsRes?.data) ? myBookingsRes.data : []);
      setContests(Array.isArray(contestsRes?.data) ? contestsRes.data : []);
      setMyContestAttempts(Array.isArray(myContestAttemptsRes?.data) ? myContestAttemptsRes.data : []);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load program hub data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrograms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem('programs_tab', activeTab);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (activeTab) next.set('tab', activeTab);
        return next;
      },
      { replace: true }
    );
  }, [activeTab, setSearchParams]);

  const myQuestMap = useMemo(
    () =>
      new Map(
        (Array.isArray(myQuestRows) ? myQuestRows : []).map((row) => [String(row.quest?._id || row.quest), row])
      ),
    [myQuestRows]
  );

  const leaderboardRows = useMemo(() => (Array.isArray(overview?.leaderboard) ? overview.leaderboard : []), [overview?.leaderboard]);

  const saveConfig = async () => {
    if (!isAdminOrHead || !configDraft) return;
    setConfigBusy(true);
    try {
      await updateProgramConfig(configDraft);
      dispatchToast('Program controls updated.', 'success');
      await loadPrograms();
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to save config.', 'error');
    } finally {
      setConfigBusy(false);
    }
  };

  const createQuest = async (event) => {
    event.preventDefault();
    if (!isAdminOrHead) return;
    setQuestCreateBusy(true);
    try {
      await createProgramQuest(questForm);
      dispatchToast('Weekly quest created.', 'success');
      setQuestForm({
        title: '',
        summary: '',
        category: 'Technical',
        audience: 'FirstAndSecond',
        points: 40,
        startsAt: '',
        endsAt: '',
        status: 'Active',
      });
      await loadPrograms();
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to create quest.', 'error');
    } finally {
      setQuestCreateBusy(false);
    }
  };

  const submitQuestEvidence = async (questId) => {
    const draft = questSubmissionDrafts[questId] || { evidenceText: '', evidenceLink: '' };
    if (!sanitize(draft.evidenceText) && !sanitize(draft.evidenceLink)) {
      dispatchToast('Add evidence text or link before submitting.', 'error');
      return;
    }

    setQuestSubmitBusy(questId);
    try {
      await submitProgramQuest(questId, {
        evidenceText: sanitize(draft.evidenceText),
        evidenceLink: sanitize(draft.evidenceLink),
      });
      setQuestSubmissionDrafts((prev) => {
        const next = { ...prev };
        delete next[questId];
        return next;
      });
      dispatchToast('Quest submission sent.', 'success');
      await loadPrograms();
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to submit quest evidence.', 'error');
    } finally {
      setQuestSubmitBusy('');
    }
  };

  const applyQuestReview = async (submissionId) => {
    const draft = questReviewDrafts[submissionId];
    if (!draft) return;
    setQuestReviewBusy(submissionId);
    try {
      await reviewProgramQuestSubmission(submissionId, {
        status: draft.status,
        pointsAwarded: Number(draft.pointsAwarded || 0),
        reviewNote: sanitize(draft.reviewNote),
      });
      dispatchToast('Quest review applied.', 'success');
      await loadPrograms();
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to apply quest review.', 'error');
    } finally {
      setQuestReviewBusy('');
    }
  };

  const updateQuestState = async (questId, status) => {
    setQuestStatusBusy(`${questId}:${status}`);
    try {
      await updateProgramQuest(questId, { status });
      dispatchToast(`Quest moved to ${status}.`, 'success');
      await loadPrograms();
    } catch (err) {
      dispatchToast(err.response?.data?.message || `Failed to move quest to ${status}.`, 'error');
    } finally {
      setQuestStatusBusy('');
    }
  };

  const createMentorHelpRequest = async (event) => {
    event.preventDefault();
    setMentorFormBusy(true);
    try {
      await createMentorRequest(mentorForm);
      dispatchToast('Mentor request submitted.', 'success');
      setMentorForm({ topic: '', description: '', urgency: 'Medium', preferredMode: 'Either' });
      await loadPrograms();
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to create mentor request.', 'error');
    } finally {
      setMentorFormBusy(false);
    }
  };

  const transitionMentorRequest = async (row, status) => {
    setMentorBusy(row._id);
    try {
      const payload = { status };
      if (status === 'Resolved') {
        payload.resolutionNote = sanitize(mentorNoteDrafts[row._id] || '');
      }
      if (status === 'Closed' || status === 'Open' || status === 'Accepted') {
        payload.note = sanitize(mentorNoteDrafts[row._id] || '');
      }
      await updateMentorRequest(row._id, payload);
      dispatchToast(`Request moved to ${status}.`, 'success');
      await loadPrograms();
    } catch (err) {
      dispatchToast(err.response?.data?.message || `Failed to move request to ${status}.`, 'error');
    } finally {
      setMentorBusy('');
    }
  };

  const createRule = async (event) => {
    event.preventDefault();
    if (!isAdminOrHead) return;
    setBadgeFormBusy(true);
    try {
      await createBadgeRule(badgeRuleForm);
      dispatchToast('Badge rule created.', 'success');
      setBadgeRuleForm({
        name: '',
        description: '',
        icon: 'Medal',
        criteriaType: 'PointsThreshold',
        criteriaValue: 100,
        isEnabled: true,
        order: 50,
      });
      await loadPrograms();
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to create badge rule.', 'error');
    } finally {
      setBadgeFormBusy(false);
    }
  };

  const toggleRule = async (rule) => {
    try {
      await updateBadgeRule(rule._id, { isEnabled: !rule.isEnabled });
      dispatchToast(`Badge rule ${!rule.isEnabled ? 'enabled' : 'disabled'}.`, 'success');
      await loadPrograms();
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to update badge rule.', 'error');
    }
  };

  const createIdea = async (event) => {
    event.preventDefault();
    setIdeaFormBusy(true);
    try {
      await createProgramIdea({
        ...ideaForm,
        tags: ideaForm.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      });
      dispatchToast('Idea submitted for review.', 'success');
      setIdeaForm({
        title: '',
        summary: '',
        problemStatement: '',
        proposedStack: '',
        tags: '',
      });
      await loadPrograms();
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to submit idea.', 'error');
    } finally {
      setIdeaFormBusy(false);
    }
  };

  const joinIdea = async (ideaId) => {
    setIdeaBusy(`join:${ideaId}`);
    try {
      await toggleProgramIdeaJoin(ideaId);
      await loadPrograms();
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to update idea team.', 'error');
    } finally {
      setIdeaBusy('');
    }
  };

  const reviewIdea = async (ideaId) => {
    const draft = ideaReviewDrafts[ideaId];
    if (!draft) return;
    setIdeaBusy(`review:${ideaId}`);
    try {
      await updateProgramIdea(ideaId, {
        status: draft.status,
        reviewNote: sanitize(draft.reviewNote),
      });
      dispatchToast('Idea review updated.', 'success');
      await loadPrograms();
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to review idea.', 'error');
    } finally {
      setIdeaBusy('');
    }
  };

  const convertIdea = async (ideaId) => {
    const draft = ideaReviewDrafts[ideaId] || { convertDomain: 'Tech' };
    setIdeaBusy(`convert:${ideaId}`);
    try {
      await convertProgramIdea(ideaId, { domain: draft.convertDomain });
      dispatchToast('Idea converted to project.', 'success');
      await loadPrograms();
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to convert idea.', 'error');
    } finally {
      setIdeaBusy('');
    }
  };

  const createSlot = async (event) => {
    event.preventDefault();
    if (!isAdminOrHead) return;
    setSlotFormBusy(true);
    try {
      await createOfficeHourSlot(slotForm);
      dispatchToast('Office-hour slot created.', 'success');
      setSlotForm({
        title: '',
        topic: '',
        mode: 'Online',
        locationOrLink: '',
        capacity: 8,
        startTime: '',
        endTime: '',
        status: 'Open',
      });
      await loadPrograms();
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to create office-hour slot.', 'error');
    } finally {
      setSlotFormBusy(false);
    }
  };

  const bookSlot = async (slotId) => {
    setOfficeBusy(`book:${slotId}`);
    try {
      await bookOfficeHourSlot(slotId, { note: sanitize(bookingNotes[slotId]) });
      setBookingNotes((prev) => ({ ...prev, [slotId]: '' }));
      dispatchToast('Office-hour slot booked.', 'success');
      await loadPrograms();
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to book slot.', 'error');
    } finally {
      setOfficeBusy('');
    }
  };

  const updateSlotStatus = async (slotId, status) => {
    setOfficeBusy(`slot:${slotId}`);
    try {
      await updateOfficeHourSlot(slotId, { status });
      dispatchToast(`Slot moved to ${status}.`, 'success');
      await loadPrograms();
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to update slot.', 'error');
    } finally {
      setOfficeBusy('');
    }
  };

  const applyBookingAction = async (bookingId, action) => {
    setOfficeBusy(`booking:${bookingId}`);
    try {
      await updateOfficeHourBooking(bookingId, { action });
      dispatchToast(`Booking marked ${action}.`, 'success');
      await loadPrograms();
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to update booking.', 'error');
    } finally {
      setOfficeBusy('');
    }
  };

  /* ─── Contest handlers ─── */

  const myAttemptMap = useMemo(
    () => new Map((Array.isArray(myContestAttempts) ? myContestAttempts : []).map((a) => [String(a.contest?._id || a.contest), a])),
    [myContestAttempts]
  );

  const handleCreateContest = async (event) => {
    event.preventDefault();
    if (!isAdminOrHead) return;
    setContestCreateBusy(true);
    try {
      await createContest({
        ...contestForm,
        questions: contestForm.questions.filter((q) => q.questionText.trim()),
      });
      dispatchToast('Contest created.', 'success');
      setContestForm({
        title: '',
        description: '',
        duration: 30,
        audience: 'AllMembers',
        status: 'Draft',
        startsAt: '',
        endsAt: '',
        questions: [{ questionText: '', questionType: 'MCQ', options: ['', '', '', ''], correctAnswer: '', points: 10 }],
      });
      await loadPrograms();
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to create contest.', 'error');
    } finally {
      setContestCreateBusy(false);
    }
  };

  const handleUpdateContestStatus = async (contestId, status) => {
    setContestBusy(`status:${contestId}`);
    try {
      await updateContestApi(contestId, { status });
      dispatchToast(`Contest moved to ${status}.`, 'success');
      await loadPrograms();
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to update contest.', 'error');
    } finally {
      setContestBusy('');
    }
  };

  const handleStartContest = async (contestId) => {
    setContestBusy(`start:${contestId}`);
    try {
      const { data } = await startContestAttempt(contestId);
      setActiveContest(contestId);
      setContestAttempt(data.attempt);
      setContestQuestions(Array.isArray(data.questions) ? data.questions : []);
      const initial = {};
      (data.attempt?.answers || []).forEach((a) => {
        initial[a.questionId] = a.selectedAnswer;
      });
      setContestAnswers(initial);
      if (data.attempt?.status === 'Submitted') {
        dispatchToast('You have already submitted this contest.', 'info');
      }
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to start contest.', 'error');
    } finally {
      setContestBusy('');
    }
  };

  const handleSubmitContest = async () => {
    if (!activeContest) return;
    setContestBusy(`submit:${activeContest}`);
    try {
      const answers = Object.entries(contestAnswers).map(([questionId, selectedAnswer]) => ({
        questionId,
        selectedAnswer,
      }));
      const { data } = await submitContestAttempt(activeContest, { answers });
      setContestAttempt(data);
      dispatchToast(`Contest submitted! Your score: ${data.score} / ${data.totalPoints}`, 'success');
      setActiveContest(null);
      setContestQuestions([]);
      setContestAnswers({});
      setContestAttempt(null);
      await loadPrograms();
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to submit contest.', 'error');
    } finally {
      setContestBusy('');
    }
  };

  const addContestQuestion = () => {
    setContestForm((prev) => ({
      ...prev,
      questions: [...prev.questions, { questionText: '', questionType: 'MCQ', options: ['', '', '', ''], correctAnswer: '', points: 10 }],
    }));
  };

  const removeContestQuestion = (idx) => {
    setContestForm((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== idx),
    }));
  };

  const updateContestQuestion = (idx, field, value) => {
    setContestForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q, i) => (i === idx ? { ...q, [field]: value } : q)),
    }));
  };

  const updateContestOption = (qIdx, oIdx, value) => {
    setContestForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q, i) =>
        i === qIdx ? { ...q, options: q.options.map((o, j) => (j === oIdx ? value : o)) } : q
      ),
    }));
  };

  if (loading) {
    return (
      <div className="ui-page pb-16 page-motion-a">
        <DataLoading label="Loading Programs Hub..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="ui-page pb-16 page-motion-a">
        <DataError label={error} onRetry={loadPrograms} />
      </div>
    );
  }

  return (
    <div className="ui-page pb-16 space-y-8 page-motion-a">
      <section className="section-motion section-motion-delay-1">
        <PageHeader
          eyebrow="Member Experience"
          title="Programs Hub"
          subtitle="Weekly quests, contests, mentor support, badges, idea incubation, and office hours in one control plane."
          icon={BrainCircuit}
          actions={
            <>
              <StatPill icon={Target} label="Quests" value={overview?.stats?.activeQuests || 0} />
              <StatPill icon={Trophy} label="Points" value={overview?.stats?.myPoints || 0} />
              <StatPill icon={Crown} label="Level" value={overview?.stats?.myLevel || 'Explorer'} />
            </>
          }
        />
      </section>

      <section className="ui-toolbar-sticky section-motion section-motion-delay-1">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-label={`Open ${tab.label} tab`}
                aria-pressed={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-xl border text-xs uppercase tracking-[0.14em] font-black transition-colors inline-flex items-center gap-1.5 ${
                  isActive
                    ? 'border-blue-500/55 bg-blue-500/15 text-blue-100'
                    : 'border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
                }`}
              >
                <tab.icon size={13} /> {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      <AnimatePresence mode="wait">
        <motion.section
          key={activeTab}
          initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -8, filter: 'blur(3px)' }}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          className="section-motion section-motion-delay-2"
        >
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 pro-stagger">
                <QuickStat icon={Target} label="Active Quests" value={overview?.stats?.activeQuests || 0} />
                <QuickStat icon={ClipboardList} label="Contests" value={contests.filter((c) => c.status === 'Active').length} />
                <QuickStat icon={Handshake} label="Open Mentor Requests" value={overview?.stats?.myMentorOpen || 0} />
                <QuickStat icon={Lightbulb} label="Ideas Raised" value={overview?.stats?.myIdeas || 0} />
                <QuickStat icon={CalendarClock} label="Upcoming Bookings" value={overview?.stats?.myBookings || 0} />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="rounded-[1.5rem] border border-gray-800 p-5 md:p-6">
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-300 inline-flex items-center gap-2">
                    <Target size={14} className="text-cyan-300" /> Next Quests
                  </h3>
                  <div className="mt-4 space-y-3">
                    {Array.isArray(overview?.upcomingQuests) && overview.upcomingQuests.length > 0 ? (
                      overview.upcomingQuests.map((quest) => (
                        <article key={quest._id} className="rounded-xl border border-gray-800 px-4 py-3">
                          <p className="text-sm font-bold text-white">{quest.title}</p>
                          <p className="text-xs text-gray-400 mt-1">{quest.category} • {quest.points} points</p>
                          <p className="text-xs text-cyan-200 mt-1">Ends {formatDateTime(quest.endsAt)}</p>
                        </article>
                      ))
                    ) : (
                      <DataEmpty label="No active quests scheduled right now." />
                    )}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-gray-800 p-5 md:p-6">
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-300 inline-flex items-center gap-2">
                    <Trophy size={14} className="text-amber-300" /> Leaderboard Snapshot
                  </h3>
                  <div className="mt-4 space-y-3 max-h-[18rem] overflow-y-auto pr-1">
                    {leaderboardRows.length > 0 ? (
                      leaderboardRows.slice(0, 8).map((row) => (
                        <article key={`${row.member?._id}-${row.rank}`} className="rounded-xl border border-gray-800 px-4 py-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-white">#{row.rank} {row.member?.name || 'Member'}</p>
                            <p className="text-xs text-gray-400 mt-1">{row.member?.collegeId} • Year {row.member?.year || 'N/A'}</p>
                          </div>
                          <p className="text-sm font-black text-cyan-200">{row.points} pts</p>
                        </article>
                      ))
                    ) : (
                      <DataEmpty label="Leaderboard data is currently unavailable." />
                    )}
                  </div>
                </div>
              </div>

              {isAdminOrHead && configDraft && (
                <div className="rounded-[1.5rem] border border-gray-800 p-5 md:p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-300 inline-flex items-center gap-2">
                      <Settings2 size={14} className="text-indigo-300" /> Admin Visibility Controls
                    </h3>
                    <button type="button" onClick={saveConfig} className="btn btn-primary" disabled={configBusy}>
                      {configBusy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    <ToggleRow
                      label="Weekly Quests"
                      value={configDraft.weeklyQuestsEnabled}
                      onToggle={() => setConfigDraft((prev) => ({ ...prev, weeklyQuestsEnabled: !prev.weeklyQuestsEnabled }))}
                    />
                    <ToggleRow
                      label="Mentor Desk"
                      value={configDraft.mentorDeskEnabled}
                      onToggle={() => setConfigDraft((prev) => ({ ...prev, mentorDeskEnabled: !prev.mentorDeskEnabled }))}
                    />
                    <ToggleRow
                      label="Badge System"
                      value={configDraft.badgeSystemEnabled}
                      onToggle={() => setConfigDraft((prev) => ({ ...prev, badgeSystemEnabled: !prev.badgeSystemEnabled }))}
                    />
                    <ToggleRow
                      label="Idea Incubator"
                      value={configDraft.ideaIncubatorEnabled}
                      onToggle={() => setConfigDraft((prev) => ({ ...prev, ideaIncubatorEnabled: !prev.ideaIncubatorEnabled }))}
                    />
                    <ToggleRow
                      label="Office Hours"
                      value={configDraft.officeHoursEnabled}
                      onToggle={() => setConfigDraft((prev) => ({ ...prev, officeHoursEnabled: !prev.officeHoursEnabled }))}
                    />
                    <ToggleRow
                      label="Contests"
                      value={configDraft.contestsEnabled}
                      onToggle={() => setConfigDraft((prev) => ({ ...prev, contestsEnabled: !prev.contestsEnabled }))}
                    />
                    <ToggleRow
                      label="Program Leaderboard"
                      value={configDraft.showProgramLeaderboard}
                      onToggle={() =>
                        setConfigDraft((prev) => ({ ...prev, showProgramLeaderboard: !prev.showProgramLeaderboard }))
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'quests' && (
            <div className="space-y-6">
              {isAdminOrHead && (
                <form onSubmit={createQuest} className="rounded-[1.5rem] border border-gray-800 p-5 md:p-6 space-y-3">
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-300 inline-flex items-center gap-2">
                    <Plus size={14} className="text-cyan-300" /> Create Weekly Quest
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input className="ui-input" value={questForm.title} onChange={(e) => setQuestForm((p) => ({ ...p, title: e.target.value }))} placeholder="Quest title" required />
                    <input className="ui-input" type="number" min={1} max={500} value={questForm.points} onChange={(e) => setQuestForm((p) => ({ ...p, points: Number(e.target.value || 1) }))} placeholder="Points" required />
                    <select className="ui-input" value={questForm.category} onChange={(e) => setQuestForm((p) => ({ ...p, category: e.target.value }))}>
                      <option>Technical</option>
                      <option>Design</option>
                      <option>Communication</option>
                      <option>Operations</option>
                      <option>Community</option>
                    </select>
                    <select className="ui-input" value={questForm.audience} onChange={(e) => setQuestForm((p) => ({ ...p, audience: e.target.value }))}>
                      <option value="AllMembers">All Members</option>
                      <option value="FirstYear">First Year</option>
                      <option value="SecondYear">Second Year</option>
                      <option value="FirstAndSecond">1st + 2nd Year</option>
                    </select>
                    <input className="ui-input" type="datetime-local" value={questForm.startsAt} onChange={(e) => setQuestForm((p) => ({ ...p, startsAt: e.target.value }))} required />
                    <input className="ui-input" type="datetime-local" value={questForm.endsAt} onChange={(e) => setQuestForm((p) => ({ ...p, endsAt: e.target.value }))} required />
                  </div>
                  <textarea className="ui-input resize-none" rows={3} value={questForm.summary} onChange={(e) => setQuestForm((p) => ({ ...p, summary: e.target.value }))} placeholder="Quest description and acceptance expectations" />
                  <button className="btn btn-primary" type="submit" disabled={questCreateBusy}>
                    {questCreateBusy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Create Quest
                  </button>
                </form>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {quests.map((quest) => {
                  const mine = myQuestMap.get(String(quest._id));
                  const status = quest.mySubmissionStatus || mine?.status || 'NotSubmitted';
                  const canSubmit = quest.status === 'Active' && !isAdminOrHead;
                  const draft = questSubmissionDrafts[quest._id] || { evidenceText: '', evidenceLink: '' };
                  return (
                    <motion.article key={quest._id} whileHover={{ y: -2 }} className="rounded-[1.2rem] border border-gray-800 p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-white">{quest.title}</p>
                          <p className="text-xs text-gray-400 mt-1">{quest.category} • {quest.points} points • {quest.audience}</p>
                        </div>
                        <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border ${QUEST_STATUS_CLASS[status] || QUEST_STATUS_CLASS.NotSubmitted}`}>
                          {status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300">{quest.summary || 'No summary available.'}</p>
                      <p className="text-xs text-gray-400">Window: {formatDateTime(quest.startsAt)} - {formatDateTime(quest.endsAt)}</p>

                      {!isAdminOrHead && (
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                          <input
                            className="ui-input md:col-span-5"
                            value={draft.evidenceText}
                            onChange={(e) => setQuestSubmissionDrafts((prev) => ({ ...prev, [quest._id]: { ...(prev[quest._id] || {}), evidenceText: e.target.value } }))}
                            placeholder="What did you complete?"
                          />
                          <input
                            className="ui-input md:col-span-5"
                            value={draft.evidenceLink}
                            onChange={(e) => setQuestSubmissionDrafts((prev) => ({ ...prev, [quest._id]: { ...(prev[quest._id] || {}), evidenceLink: e.target.value } }))}
                            placeholder="Evidence URL"
                          />
                          <button
                            type="button"
                            className="btn btn-primary md:col-span-2"
                            onClick={() => submitQuestEvidence(quest._id)}
                            disabled={!canSubmit || questSubmitBusy === quest._id}
                          >
                            {questSubmitBusy === quest._id ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Submit
                          </button>
                        </div>
                      )}

                      {isAdminOrHead && (
                        <div className="flex flex-wrap gap-2">
                          <button className="btn btn-secondary" type="button" onClick={() => updateQuestState(quest._id, 'Active')} disabled={questStatusBusy === `${quest._id}:Active`}>
                            Activate
                          </button>
                          <button className="btn btn-secondary" type="button" onClick={() => updateQuestState(quest._id, 'Closed')} disabled={questStatusBusy === `${quest._id}:Closed`}>
                            Close
                          </button>
                          <button className="btn btn-danger" type="button" onClick={() => updateQuestState(quest._id, 'Archived')} disabled={questStatusBusy === `${quest._id}:Archived`}>
                            Archive
                          </button>
                        </div>
                      )}
                    </motion.article>
                  );
                })}
                {quests.length === 0 && <DataEmpty label="No quests available right now." />}
              </div>

              {isAdminOrHead && (
                <div className="rounded-[1.5rem] border border-gray-800 p-5 md:p-6">
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-300 inline-flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-300" /> Quest Review Queue
                  </h3>
                  <div className="mt-4 space-y-3 max-h-[28rem] overflow-y-auto pr-1">
                    {questReviewRows.length > 0 ? (
                      questReviewRows.map((row) => {
                        const draft = questReviewDrafts[row._id] || { status: 'Approved', pointsAwarded: row.quest?.points || 0, reviewNote: '' };
                        return (
                          <article key={row._id} className="rounded-xl border border-gray-800 p-4 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-bold text-white">{row.member?.name} • {row.quest?.title}</p>
                                <p className="text-xs text-gray-400 mt-1">Submitted {formatDateTime(row.submittedAt)}</p>
                              </div>
                              <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border ${QUEST_STATUS_CLASS[row.status] || QUEST_STATUS_CLASS.Submitted}`}>{row.status}</span>
                            </div>
                            <p className="text-sm text-gray-300">{row.evidenceText || row.evidenceLink || 'No evidence text.'}</p>
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                              <select className="ui-input md:col-span-3" value={draft.status} onChange={(e) => setQuestReviewDrafts((prev) => ({ ...prev, [row._id]: { ...draft, status: e.target.value } }))}>
                                <option>Approved</option>
                                <option>NeedsRevision</option>
                                <option>Rejected</option>
                              </select>
                              <input className="ui-input md:col-span-2" type="number" min={0} max={500} value={draft.pointsAwarded} onChange={(e) => setQuestReviewDrafts((prev) => ({ ...prev, [row._id]: { ...draft, pointsAwarded: Number(e.target.value || 0) } }))} />
                              <input className="ui-input md:col-span-5" value={draft.reviewNote} onChange={(e) => setQuestReviewDrafts((prev) => ({ ...prev, [row._id]: { ...draft, reviewNote: e.target.value } }))} placeholder="Review note" />
                              <button className="btn btn-primary md:col-span-2" type="button" onClick={() => applyQuestReview(row._id)} disabled={questReviewBusy === row._id}>
                                {questReviewBusy === row._id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Apply
                              </button>
                            </div>
                          </article>
                        );
                      })
                    ) : (
                      <DataEmpty label="No quest submissions pending review." />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'contests' && (
            <div className="space-y-6">

              {/* ── Active Contest Attempt View ── */}
              {activeContest && contestAttempt && contestAttempt.status !== 'Submitted' && (
                <div className="rounded-[1.5rem] border border-blue-500/30 bg-blue-500/5 p-5 md:p-6 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-blue-200 inline-flex items-center gap-2">
                      <ClipboardList size={14} className="text-blue-300" /> Attempting Contest
                    </h3>
                    <div className="inline-flex items-center gap-2 text-xs text-gray-400">
                      <Clock size={13} /> Started {formatDateTime(contestAttempt.startedAt)}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {contestQuestions.map((q, idx) => (
                      <article key={q._id} className="rounded-xl border border-gray-800 px-4 py-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-bold text-white">
                            <span className="text-cyan-300 mr-2">Q{idx + 1}.</span>
                            {q.questionText}
                          </p>
                          <span className="text-[10px] font-black text-gray-500 uppercase shrink-0">{q.points} pts</span>
                        </div>

                        {q.questionType === 'MCQ' && Array.isArray(q.options) && q.options.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {q.options.map((opt, oIdx) => {
                              const selected = contestAnswers[q._id] === opt;
                              return (
                                <button
                                  key={oIdx}
                                  type="button"
                                  onClick={() => setContestAnswers((prev) => ({ ...prev, [q._id]: opt }))}
                                  className={`text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                                    selected
                                      ? 'border-blue-500/50 bg-blue-500/15 text-blue-100 font-bold'
                                      : 'border-gray-700 text-gray-300 hover:border-gray-600 hover:text-white'
                                  }`}
                                >
                                  <span className="font-black mr-1.5 text-gray-500">{String.fromCharCode(65 + oIdx)}.</span>
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <input
                            className="ui-input"
                            value={contestAnswers[q._id] || ''}
                            onChange={(e) => setContestAnswers((prev) => ({ ...prev, [q._id]: e.target.value }))}
                            placeholder="Type your answer..."
                          />
                        )}
                      </article>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleSubmitContest}
                      disabled={contestBusy === `submit:${activeContest}`}
                    >
                      {contestBusy === `submit:${activeContest}` ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Submit Contest
                    </button>
                    <button
                      type="button"
                      className="btn border-gray-700 text-gray-400 hover:text-white"
                      onClick={() => { setActiveContest(null); setContestQuestions([]); setContestAnswers({}); setContestAttempt(null); }}
                    >
                      <X size={13} /> Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* ── Admin: Create Contest Form ── */}
              {isAdminOrHead && (
                <form onSubmit={handleCreateContest} className="rounded-[1.5rem] border border-gray-800 p-5 md:p-6 space-y-3">
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-300 inline-flex items-center gap-2">
                    <Plus size={14} className="text-cyan-300" /> Create Contest
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input className="ui-input" value={contestForm.title} onChange={(e) => setContestForm((p) => ({ ...p, title: e.target.value }))} placeholder="Contest title" required />
                    <select className="ui-input" value={contestForm.audience} onChange={(e) => setContestForm((p) => ({ ...p, audience: e.target.value }))}>
                      <option value="AllMembers">All Members</option>
                      <option value="FirstYear">First Year</option>
                      <option value="SecondYear">Second Year</option>
                      <option value="FirstAndSecond">First & Second</option>
                    </select>
                    <input className="ui-input" type="number" min={1} max={300} value={contestForm.duration} onChange={(e) => setContestForm((p) => ({ ...p, duration: Number(e.target.value || 30) }))} placeholder="Duration (min)" />
                    <select className="ui-input" value={contestForm.status} onChange={(e) => setContestForm((p) => ({ ...p, status: e.target.value }))}>
                      <option value="Draft">Draft</option>
                      <option value="Active">Active</option>
                      <option value="Closed">Closed</option>
                    </select>
                    <input className="ui-input" type="datetime-local" value={contestForm.startsAt} onChange={(e) => setContestForm((p) => ({ ...p, startsAt: e.target.value }))} required />
                    <input className="ui-input" type="datetime-local" value={contestForm.endsAt} onChange={(e) => setContestForm((p) => ({ ...p, endsAt: e.target.value }))} required />
                    <textarea className="ui-input md:col-span-2" rows={2} value={contestForm.description} onChange={(e) => setContestForm((p) => ({ ...p, description: e.target.value }))} placeholder="Description (optional)" />
                  </div>

                  <h4 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 pt-2">Questions</h4>
                  <div className="space-y-3">
                    {contestForm.questions.map((q, qIdx) => (
                      <div key={qIdx} className="rounded-xl border border-gray-800 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-cyan-300">Q{qIdx + 1}</span>
                          <input className="ui-input flex-1" value={q.questionText} onChange={(e) => updateContestQuestion(qIdx, 'questionText', e.target.value)} placeholder="Question text" required />
                          <select className="ui-input w-24" value={q.questionType} onChange={(e) => updateContestQuestion(qIdx, 'questionType', e.target.value)}>
                            <option value="MCQ">MCQ</option>
                            <option value="Text">Text</option>
                          </select>
                          <input className="ui-input w-16" type="number" min={1} max={100} value={q.points} onChange={(e) => updateContestQuestion(qIdx, 'points', Number(e.target.value || 10))} title="Points" />
                          {contestForm.questions.length > 1 && (
                            <button type="button" onClick={() => removeContestQuestion(qIdx)} className="text-rose-400 hover:text-rose-300"><X size={14} /></button>
                          )}
                        </div>
                        {q.questionType === 'MCQ' && (
                          <div className="grid grid-cols-2 gap-2">
                            {q.options.map((opt, oIdx) => (
                              <input key={oIdx} className="ui-input text-xs" value={opt} onChange={(e) => updateContestOption(qIdx, oIdx, e.target.value)} placeholder={`Option ${String.fromCharCode(65 + oIdx)}`} />
                            ))}
                          </div>
                        )}
                        <input className="ui-input text-xs" value={q.correctAnswer} onChange={(e) => updateContestQuestion(qIdx, 'correctAnswer', e.target.value)} placeholder="Correct answer" required />
                      </div>
                    ))}
                  </div>

                  <button type="button" className="text-xs text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1" onClick={addContestQuestion}>
                    <Plus size={12} /> Add Question
                  </button>
                  <div>
                    <button className="btn btn-primary" type="submit" disabled={contestCreateBusy}>
                      {contestCreateBusy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Create Contest
                    </button>
                  </div>
                </form>
              )}

              {/* ── Available Contests List ── */}
              <div className="rounded-[1.5rem] border border-gray-800 p-5 md:p-6 space-y-4">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-300 inline-flex items-center gap-2">
                  <ClipboardList size={14} className="text-cyan-300" /> Available Contests
                </h3>
                <div className="space-y-3">
                  {contests.length > 0 ? (
                    contests.map((c) => {
                      const attempt = myAttemptMap.get(String(c._id));
                      const submitted = attempt?.status === 'Submitted';
                      const now = new Date();
                      const isOpen = c.status === 'Active' && new Date(c.startsAt) <= now && now <= new Date(c.endsAt);
                      return (
                        <article key={c._id} className="rounded-xl border border-gray-800 px-4 py-3 space-y-2">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-bold text-white">{c.title}</p>
                              {c.description && <p className="text-xs text-gray-400 mt-0.5">{c.description}</p>}
                              <p className="text-xs text-gray-500 mt-1">
                                {c.questions?.length || 0} questions • {c.duration} min • {c.audience}
                              </p>
                              <p className="text-xs text-cyan-200 mt-0.5">
                                {formatDateTime(c.startsAt)} — {formatDateTime(c.endsAt)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${
                                c.status === 'Active' ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10'
                                  : c.status === 'Closed' ? 'text-rose-300 border-rose-500/40 bg-rose-500/10'
                                  : 'text-gray-300 border-gray-700 bg-gray-800/30'
                              }`}>{c.status}</span>

                              {submitted && (
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md border text-emerald-300 border-emerald-500/40 bg-emerald-500/10">
                                  Score: {attempt.score}/{attempt.totalPoints}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {!submitted && isOpen && (
                              <button
                                type="button"
                                className="btn btn-primary text-xs"
                                onClick={() => handleStartContest(c._id)}
                                disabled={contestBusy === `start:${c._id}`}
                              >
                                {contestBusy === `start:${c._id}` ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                                {attempt ? 'Resume' : 'Attempt'}
                              </button>
                            )}

                            {isAdminOrHead && c.status === 'Draft' && (
                              <button type="button" className="btn text-xs border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10" onClick={() => handleUpdateContestStatus(c._id, 'Active')} disabled={contestBusy === `status:${c._id}`}>
                                {contestBusy === `status:${c._id}` ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Activate
                              </button>
                            )}
                            {isAdminOrHead && c.status === 'Active' && (
                              <button type="button" className="btn text-xs border-rose-500/40 text-rose-300 hover:bg-rose-500/10" onClick={() => handleUpdateContestStatus(c._id, 'Closed')} disabled={contestBusy === `status:${c._id}`}>
                                {contestBusy === `status:${c._id}` ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />} Close
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <DataEmpty label="No contests available." />
                  )}
                </div>
              </div>

              {/* ── My Contest Attempts / Scores ── */}
              {myContestAttempts.length > 0 && (
                <div className="rounded-[1.5rem] border border-gray-800 p-5 md:p-6 space-y-4">
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-300 inline-flex items-center gap-2">
                    <Trophy size={14} className="text-amber-300" /> My Scores & Attempts
                  </h3>
                  <div className="space-y-3">
                    {myContestAttempts.map((a) => (
                      <article key={a._id} className="rounded-xl border border-gray-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-white">{a.contest?.title || 'Contest'}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {a.status === 'Submitted' ? `Submitted ${formatDateTime(a.submittedAt)}` : 'In Progress'}
                          </p>
                        </div>
                        <div className="text-right">
                          {a.status === 'Submitted' ? (
                            <p className="text-lg font-black text-cyan-200">{a.score}<span className="text-xs text-gray-500">/{a.totalPoints}</span></p>
                          ) : (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md border text-blue-300 border-blue-500/40 bg-blue-500/10">In Progress</span>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'mentor' && (
            <div className="space-y-6">
              <form onSubmit={createMentorHelpRequest} className="rounded-[1.5rem] border border-gray-800 p-5 md:p-6 space-y-3">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-300 inline-flex items-center gap-2">
                  <Plus size={14} className="text-cyan-300" /> Raise Mentor Request
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input className="ui-input" value={mentorForm.topic} onChange={(e) => setMentorForm((p) => ({ ...p, topic: e.target.value }))} placeholder="Topic" required />
                  <select className="ui-input" value={mentorForm.urgency} onChange={(e) => setMentorForm((p) => ({ ...p, urgency: e.target.value }))}>
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Critical</option>
                  </select>
                  <select className="ui-input" value={mentorForm.preferredMode} onChange={(e) => setMentorForm((p) => ({ ...p, preferredMode: e.target.value }))}>
                    <option>Either</option>
                    <option>Online</option>
                    <option>Offline</option>
                  </select>
                </div>
                <textarea className="ui-input resize-none" rows={4} value={mentorForm.description} onChange={(e) => setMentorForm((p) => ({ ...p, description: e.target.value }))} placeholder="Explain where you need help and expected outcome." required />
                <button className="btn btn-primary" type="submit" disabled={mentorFormBusy}>
                  {mentorFormBusy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Submit Request
                </button>
              </form>

              <div className="space-y-3">
                {mentorRows.length > 0 ? (
                  mentorRows.map((row) => {
                    const isRequester = String(row.requester?._id || row.requester) === String(user._id);
                    const isMentor = String(row.assignedMentor?._id || row.assignedMentor) === String(user._id);
                    const canAccept = row.status === 'Open' && (isSeniorMentor || isAdminOrHead);
                    const canResolve = row.status === 'Accepted' && (isMentor || isAdminOrHead);
                    const canClose = ['Open', 'Accepted'].includes(row.status) && (isRequester || isMentor || isAdminOrHead);
                    const canReopen = ['Closed', 'Resolved'].includes(row.status) && (isRequester || isAdminOrHead);
                    return (
                      <article key={row._id} className="rounded-[1.2rem] border border-gray-800 p-4 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-white">{row.topic}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {row.requester?.name} • {row.urgency} • {row.preferredMode}
                            </p>
                          </div>
                          <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border ${MENTOR_STATUS_CLASS[row.status] || MENTOR_STATUS_CLASS.Open}`}>{row.status}</span>
                        </div>
                        <p className="text-sm text-gray-300">{row.description}</p>
                        {row.assignedMentor ? <p className="text-xs text-cyan-200">Mentor: {row.assignedMentor?.name || 'Assigned'}</p> : null}

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                          <input className="ui-input md:col-span-8" value={mentorNoteDrafts[row._id] || ''} onChange={(e) => setMentorNoteDrafts((prev) => ({ ...prev, [row._id]: e.target.value }))} placeholder="Optional note / resolution details" />
                          <div className="md:col-span-4 flex flex-wrap gap-2">
                            {canAccept && (
                              <button className="btn btn-primary" type="button" onClick={() => transitionMentorRequest(row, 'Accepted')} disabled={mentorBusy === row._id}>
                                {mentorBusy === row._id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Accept
                              </button>
                            )}
                            {canResolve && (
                              <button className="btn btn-secondary" type="button" onClick={() => transitionMentorRequest(row, 'Resolved')} disabled={mentorBusy === row._id}>
                                Resolve
                              </button>
                            )}
                            {canClose && (
                              <button className="btn btn-danger" type="button" onClick={() => transitionMentorRequest(row, 'Closed')} disabled={mentorBusy === row._id}>
                                <X size={13} /> Close
                              </button>
                            )}
                            {canReopen && (
                              <button className="btn btn-secondary" type="button" onClick={() => transitionMentorRequest(row, 'Open')} disabled={mentorBusy === row._id}>
                                Reopen
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <DataEmpty label="No mentor requests available." />
                )}
              </div>
            </div>
          )}

          {activeTab === 'badges' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <QuickStat icon={Trophy} label="Total Points" value={badgeOverview?.metrics?.totalPoints || 0} />
                <QuickStat icon={Crown} label="Current Level" value={badgeOverview?.level?.currentLabel || 'Explorer'} />
                <QuickStat icon={Rocket} label="Points To Next" value={badgeOverview?.level?.toNext || 0} />
              </div>

              <div className="rounded-[1.5rem] border border-gray-800 p-5 md:p-6">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-300 inline-flex items-center gap-2">
                  <BookMarked size={14} className="text-cyan-300" /> Earned Badges
                </h3>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {Array.isArray(badgeOverview?.earnedBadges) && badgeOverview.earnedBadges.length > 0 ? (
                    badgeOverview.earnedBadges.map((award) => {
                      const Icon = BADGE_ICONS[award.badgeRule?.icon] || Medal;
                      return (
                        <article key={award._id} className="rounded-xl border border-gray-800 p-4">
                          <p className="text-sm font-bold text-white inline-flex items-center gap-2">
                            <Icon size={14} className="text-amber-300" /> {award.badgeRule?.name || 'Badge'}
                          </p>
                          <p className="text-xs text-gray-400 mt-2">{award.badgeRule?.description}</p>
                          <p className="text-xs text-cyan-200 mt-2">Awarded {formatDateTime(award.awardedAt)}</p>
                        </article>
                      );
                    })
                  ) : (
                    <DataEmpty label="No badges unlocked yet. Complete quests and contributions to earn badges." />
                  )}
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-gray-800 p-5 md:p-6 space-y-4">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-300 inline-flex items-center gap-2">
                  <Medal size={14} className="text-indigo-300" /> Badge Rules
                </h3>
                <div className="space-y-2">
                  {badgeRules.map((rule) => (
                    <article key={rule._id} className="rounded-xl border border-gray-800 p-3 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{rule.name}</p>
                        <p className="text-xs text-gray-400 mt-1">{rule.criteriaType} • {rule.criteriaValue}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border ${rule.isEnabled ? 'text-emerald-300 border-emerald-500/35 bg-emerald-500/10' : 'text-gray-300 border-gray-700 bg-gray-800/30'}`}>
                          {rule.isEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                        {isAdminOrHead && (
                          <button className="btn btn-secondary" type="button" onClick={() => toggleRule(rule)}>
                            Toggle
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>

                {isAdminOrHead && (
                  <form onSubmit={createRule} className="border border-gray-800 rounded-xl p-4 space-y-3">
                    <p className="text-xs uppercase tracking-widest text-gray-400">Create Badge Rule</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input className="ui-input" value={badgeRuleForm.name} onChange={(e) => setBadgeRuleForm((p) => ({ ...p, name: e.target.value }))} placeholder="Rule name" required />
                      <input className="ui-input" value={badgeRuleForm.icon} onChange={(e) => setBadgeRuleForm((p) => ({ ...p, icon: e.target.value }))} placeholder="Icon name" />
                      <select className="ui-input" value={badgeRuleForm.criteriaType} onChange={(e) => setBadgeRuleForm((p) => ({ ...p, criteriaType: e.target.value }))}>
                        <option>PointsThreshold</option>
                        <option>QuestCompletions</option>
                        <option>IdeasConverted</option>
                        <option>MentorResolutions</option>
                      </select>
                      <input className="ui-input" type="number" min={1} value={badgeRuleForm.criteriaValue} onChange={(e) => setBadgeRuleForm((p) => ({ ...p, criteriaValue: Number(e.target.value || 1) }))} />
                    </div>
                    <textarea className="ui-input resize-none" rows={2} value={badgeRuleForm.description} onChange={(e) => setBadgeRuleForm((p) => ({ ...p, description: e.target.value }))} placeholder="Rule description" />
                    <button className="btn btn-primary" type="submit" disabled={badgeFormBusy}>
                      {badgeFormBusy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add Rule
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          {activeTab === 'ideas' && (
            <div className="space-y-6">
              <form onSubmit={createIdea} className="rounded-[1.5rem] border border-gray-800 p-5 md:p-6 space-y-3">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-300 inline-flex items-center gap-2">
                  <Plus size={14} className="text-cyan-300" /> Submit Project Idea
                </h3>
                <input className="ui-input" value={ideaForm.title} onChange={(e) => setIdeaForm((p) => ({ ...p, title: e.target.value }))} placeholder="Idea title" required />
                <textarea className="ui-input resize-none" rows={3} value={ideaForm.summary} onChange={(e) => setIdeaForm((p) => ({ ...p, summary: e.target.value }))} placeholder="Idea summary" required />
                <textarea className="ui-input resize-none" rows={3} value={ideaForm.problemStatement} onChange={(e) => setIdeaForm((p) => ({ ...p, problemStatement: e.target.value }))} placeholder="Problem statement" />
                <input className="ui-input" value={ideaForm.proposedStack} onChange={(e) => setIdeaForm((p) => ({ ...p, proposedStack: e.target.value }))} placeholder="Proposed stack / tooling" />
                <input className="ui-input" value={ideaForm.tags} onChange={(e) => setIdeaForm((p) => ({ ...p, tags: e.target.value }))} placeholder="Tags (comma separated)" />
                <button className="btn btn-primary" type="submit" disabled={ideaFormBusy}>
                  {ideaFormBusy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Submit Idea
                </button>
              </form>

              <div className="space-y-3">
                {ideas.length > 0 ? (
                  ideas.map((idea) => {
                    const isOwner = String(idea.createdBy?._id || idea.createdBy) === String(user._id);
                    const inTeam = Array.isArray(idea.team) && idea.team.some((member) => String(member?._id || member) === String(user._id));
                    const draft = ideaReviewDrafts[idea._id] || { status: idea.status, reviewNote: '', convertDomain: 'Tech' };
                    return (
                      <article key={idea._id} className="rounded-[1.2rem] border border-gray-800 p-4 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-white">{idea.title}</p>
                            <p className="text-xs text-gray-400 mt-1">{idea.createdBy?.name || 'Member'} • Team {idea.team?.length || 0}</p>
                          </div>
                          <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border ${IDEA_STATUS_CLASS[idea.status] || IDEA_STATUS_CLASS.UnderReview}`}>{idea.status}</span>
                        </div>
                        <p className="text-sm text-gray-300">{idea.summary}</p>
                        {idea.problemStatement ? <p className="text-xs text-gray-400">Problem: {idea.problemStatement}</p> : null}
                        {idea.proposedStack ? <p className="text-xs text-cyan-200">Stack: {idea.proposedStack}</p> : null}
                        {idea.convertedProject ? <p className="text-xs text-emerald-200">Converted Project: {idea.convertedProject.title}</p> : null}

                        <div className="flex flex-wrap gap-2">
                          {!isOwner && (
                            <button className="btn btn-secondary" type="button" onClick={() => joinIdea(idea._id)} disabled={ideaBusy === `join:${idea._id}`}>
                              {ideaBusy === `join:${idea._id}` ? <Loader2 size={13} className="animate-spin" /> : <Users size={13} />} {inTeam ? 'Leave Team' : 'Join Team'}
                            </button>
                          )}
                        </div>

                        {isAdminOrHead && idea.status !== 'Converted' && (
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-2 border border-gray-800 rounded-xl p-3">
                            <select className="ui-input md:col-span-3" value={draft.status} onChange={(e) => setIdeaReviewDrafts((prev) => ({ ...prev, [idea._id]: { ...draft, status: e.target.value } }))}>
                              <option>UnderReview</option>
                              <option>Approved</option>
                              <option>Rejected</option>
                            </select>
                            <input className="ui-input md:col-span-5" value={draft.reviewNote} onChange={(e) => setIdeaReviewDrafts((prev) => ({ ...prev, [idea._id]: { ...draft, reviewNote: e.target.value } }))} placeholder="Review note" />
                            <button className="btn btn-primary md:col-span-2" type="button" onClick={() => reviewIdea(idea._id)} disabled={ideaBusy === `review:${idea._id}`}>
                              {ideaBusy === `review:${idea._id}` ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Review
                            </button>
                            <select className="ui-input md:col-span-2" value={draft.convertDomain} onChange={(e) => setIdeaReviewDrafts((prev) => ({ ...prev, [idea._id]: { ...draft, convertDomain: e.target.value } }))}>
                              <option>Tech</option>
                              <option>Management</option>
                              <option>PR</option>
                            </select>
                            {idea.status === 'Approved' && (
                              <button className="btn btn-secondary md:col-span-12" type="button" onClick={() => convertIdea(idea._id)} disabled={ideaBusy === `convert:${idea._id}`}>
                                {ideaBusy === `convert:${idea._id}` ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Convert To Project
                              </button>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })
                ) : (
                  <DataEmpty label="No ideas available." />
                )}
              </div>
            </div>
          )}

          {activeTab === 'office-hours' && (
            <div className="space-y-6">
              {isAdminOrHead && (
                <form onSubmit={createSlot} className="rounded-[1.5rem] border border-gray-800 p-5 md:p-6 space-y-3">
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-300 inline-flex items-center gap-2">
                    <Plus size={14} className="text-cyan-300" /> Create Office-Hour Slot
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input className="ui-input" value={slotForm.title} onChange={(e) => setSlotForm((p) => ({ ...p, title: e.target.value }))} placeholder="Slot title" required />
                    <input className="ui-input" value={slotForm.topic} onChange={(e) => setSlotForm((p) => ({ ...p, topic: e.target.value }))} placeholder="Topic" />
                    <select className="ui-input" value={slotForm.mode} onChange={(e) => setSlotForm((p) => ({ ...p, mode: e.target.value }))}>
                      <option>Online</option>
                      <option>Offline</option>
                      <option>Hybrid</option>
                    </select>
                    <input className="ui-input" type="number" min={1} max={500} value={slotForm.capacity} onChange={(e) => setSlotForm((p) => ({ ...p, capacity: Number(e.target.value || 1) }))} placeholder="Capacity" required />
                    <input className="ui-input" value={slotForm.locationOrLink} onChange={(e) => setSlotForm((p) => ({ ...p, locationOrLink: e.target.value }))} placeholder="Location / meeting link" />
                    <select className="ui-input" value={slotForm.status} onChange={(e) => setSlotForm((p) => ({ ...p, status: e.target.value }))}>
                      <option>Open</option>
                      <option>Closed</option>
                      <option>Cancelled</option>
                    </select>
                    <input className="ui-input" type="datetime-local" value={slotForm.startTime} onChange={(e) => setSlotForm((p) => ({ ...p, startTime: e.target.value }))} required />
                    <input className="ui-input" type="datetime-local" value={slotForm.endTime} onChange={(e) => setSlotForm((p) => ({ ...p, endTime: e.target.value }))} required />
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={slotFormBusy}>
                    {slotFormBusy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Create Slot
                  </button>
                </form>
              )}

              <div className="space-y-3">
                {officeSlots.length > 0 ? (
                  officeSlots.map((slot) => {
                    const myBooking = myBookings.find((row) => String(row.slot?._id || row.slot) === String(slot._id));
                    return (
                      <article key={slot._id} className="rounded-[1.2rem] border border-gray-800 p-4 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-white">{slot.title}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {slot.topic || 'General'} • {slot.mode} • Mentor: {slot.mentor?.name || 'N/A'}
                            </p>
                          </div>
                          <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border ${SLOT_STATUS_CLASS[slot.status] || SLOT_STATUS_CLASS.Open}`}>{slot.status}</span>
                        </div>
                        <p className="text-xs text-cyan-200">{formatDateTime(slot.startTime)} - {formatDateTime(slot.endTime)}</p>
                        <p className="text-xs text-gray-400">Capacity {slot.bookedCount || 0}/{slot.capacity} • Seats left {slot.seatsLeft ?? Math.max(0, Number(slot.capacity || 0) - Number(slot.bookedCount || 0))}</p>
                        {slot.locationOrLink ? <p className="text-xs text-gray-300">{slot.locationOrLink}</p> : null}

                        {!isAdminOrHead && (
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                            <input className="ui-input md:col-span-9" value={bookingNotes[slot._id] || ''} onChange={(e) => setBookingNotes((prev) => ({ ...prev, [slot._id]: e.target.value }))} placeholder="Optional note for mentor" />
                            <button className="btn btn-primary md:col-span-3" type="button" onClick={() => bookSlot(slot._id)} disabled={officeBusy === `book:${slot._id}` || slot.isBookedByMe || slot.status !== 'Open'}>
                              {officeBusy === `book:${slot._id}` ? <Loader2 size={13} className="animate-spin" /> : <CalendarClock size={13} />} {slot.isBookedByMe ? 'Booked' : 'Book'}
                            </button>
                          </div>
                        )}

                        {isAdminOrHead && (
                          <div className="flex flex-wrap gap-2">
                            <button className="btn btn-secondary" type="button" onClick={() => updateSlotStatus(slot._id, 'Open')} disabled={officeBusy === `slot:${slot._id}`}>Open</button>
                            <button className="btn btn-secondary" type="button" onClick={() => updateSlotStatus(slot._id, 'Closed')} disabled={officeBusy === `slot:${slot._id}`}>Close</button>
                            <button className="btn btn-danger" type="button" onClick={() => updateSlotStatus(slot._id, 'Cancelled')} disabled={officeBusy === `slot:${slot._id}`}>Cancel</button>
                          </div>
                        )}

                        {myBooking && (
                          <div className="border border-gray-800 rounded-xl p-3">
                            <p className="text-xs text-gray-400">My Booking: {myBooking.status}</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {myBooking.status === 'Booked' && (
                                <button className="btn btn-danger" type="button" onClick={() => applyBookingAction(myBooking._id, 'Cancel')} disabled={officeBusy === `booking:${myBooking._id}`}>
                                  Cancel
                                </button>
                              )}
                              {isAdminOrHead && myBooking.status === 'Booked' && (
                                <>
                                  <button className="btn btn-secondary" type="button" onClick={() => applyBookingAction(myBooking._id, 'Complete')} disabled={officeBusy === `booking:${myBooking._id}`}>Mark Complete</button>
                                  <button className="btn btn-secondary" type="button" onClick={() => applyBookingAction(myBooking._id, 'NoShow')} disabled={officeBusy === `booking:${myBooking._id}`}>No Show</button>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })
                ) : (
                  <DataEmpty label="No office-hour slots available right now." />
                )}
              </div>
            </div>
          )}
        </motion.section>
      </AnimatePresence>
    </div>
  );
}

function QuickStat({ icon: Icon, label, value }) {
  return (
    <article className="rounded-2xl border border-gray-800 px-5 py-4">
      <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-black inline-flex items-center gap-1">
        <Icon size={12} className="text-cyan-300" /> {label}
      </p>
      <p className="text-2xl font-black text-white mt-2">{value}</p>
    </article>
  );
}

function StatPill({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-gray-800 px-3 py-2 inline-flex items-center gap-2 text-xs text-gray-300">
      <Icon size={13} className="text-cyan-300" />
      <span className="uppercase tracking-widest text-[10px]">{label}</span>
      <span className="font-black text-white">{value}</span>
    </div>
  );
}

function ToggleRow({ label, value, onToggle }) {
  return (
    <div className="rounded-xl border border-gray-800 px-4 py-3 flex items-center justify-between gap-3">
      <span className="text-xs uppercase tracking-widest text-gray-300">{label}</span>
      <button
        type="button"
        onClick={onToggle}
        aria-label={`Toggle ${label}`}
        aria-pressed={value}
        className={`relative h-7 w-12 rounded-full border transition-colors ${
          value ? 'border-emerald-500/50 bg-emerald-500/20' : 'border-gray-700 bg-gray-800/40'
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
            value ? 'left-6' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
}
