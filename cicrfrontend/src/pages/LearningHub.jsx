import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpenCheck,
  Brain,
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  Eye,
  Flag,
  GraduationCap,
  Layers,
  Lightbulb,
  Loader2,
  Medal,
  Plus,
  Save,
  Send,
  Settings2,
  Sparkles,
  Star,
  Trophy,
  UserCheck,
  Wrench,
} from 'lucide-react';
import {
  createLearningTrack,
  fetchLearningConfig,
  fetchLearningOverview,
  fetchLearningSubmissions,
  fetchLearningTracks,
  fetchMyLearningSubmissions,
  reviewLearningSubmission,
  setLearningTrackArchive,
  setLearningTrackPublish,
  submitLearningTask,
  updateLearningConfig,
  updateLearningTrack,
} from '../api';
import PageHeader from '../components/PageHeader';
import { DataEmpty, DataError, DataLoading } from '../components/DataState';

const AUDIENCE_OPTIONS = ['AllMembers', 'FirstYear', 'SecondYear', 'FirstAndSecond'];
const LEVEL_OPTIONS = ['Foundation', 'Intermediate', 'Applied'];
const RESOURCE_TYPES = ['Doc', 'Video', 'Repo', 'Practice', 'Other'];
const REVIEW_OPTIONS = ['UnderReview', 'Approved', 'NeedsRevision'];

const AUDIENCE_LABELS = {
  AllMembers: 'All Members',
  FirstYear: 'First Year',
  SecondYear: 'Second Year',
  FirstAndSecond: '1st + 2nd Year',
};

const TASK_STATUS_CLASS = {
  Approved: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
  Submitted: 'text-blue-300 border-blue-500/40 bg-blue-500/10',
  UnderReview: 'text-cyan-300 border-cyan-500/40 bg-cyan-500/10',
  NeedsRevision: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
  NotStarted: 'text-gray-300 border-gray-700 bg-gray-800/30',
};

const SUBMISSION_STATUS_CLASS = {
  Approved: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
  Submitted: 'text-blue-300 border-blue-500/40 bg-blue-500/10',
  UnderReview: 'text-cyan-300 border-cyan-500/40 bg-cyan-500/10',
  NeedsRevision: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
};

const dispatchToast = (message, type = 'info') => {
  try {
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type } }));
  } catch {
    window.alert(message);
  }
};

const fmtDateTime = (value) => {
  if (!value) return 'N/A';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString();
};

const createComposerState = () => ({
  title: '',
  summary: '',
  targetAudience: 'FirstAndSecond',
  level: 'Foundation',
  estimatedHours: 8,
  tags: '',
  moduleTitle: '',
  moduleDescription: '',
  tasks: [{ title: '', description: '', points: 10 }],
  resources: [{ label: '', url: '', type: 'Doc' }],
  publishNow: true,
  featured: false,
});

export default function LearningHub() {
  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  const user = profile.result || profile;
  const role = String(user.role || '').toLowerCase();
  const year = Number(user.year);
  const isAdminOrHead = role === 'admin' || role === 'head';
  const isJuniorMember = role === 'user' && (year === 1 || year === 2);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState(null);
  const [config, setConfig] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [mySubmissions, setMySubmissions] = useState([]);
  const [submissionDrafts, setSubmissionDrafts] = useState({});
  const [submittingTaskKey, setSubmittingTaskKey] = useState('');

  const [adminRows, setAdminRows] = useState([]);
  const [adminConfigDraft, setAdminConfigDraft] = useState(null);
  const [configSaving, setConfigSaving] = useState(false);
  const [composer, setComposer] = useState(createComposerState);
  const [composerBusy, setComposerBusy] = useState(false);
  const [trackActionBusy, setTrackActionBusy] = useState('');

  const [reviewRows, setReviewRows] = useState([]);
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [reviewBusyId, setReviewBusyId] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const [overviewRes, tracksRes, mineRes, configRes, reviewRes] = await Promise.all([
        fetchLearningOverview(),
        fetchLearningTracks(isAdminOrHead ? { includeArchived: 'true' } : {}),
        fetchMyLearningSubmissions().catch(() => ({ data: [] })),
        fetchLearningConfig().catch(() => ({ data: null })),
        isAdminOrHead ? fetchLearningSubmissions().catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      ]);

      const overviewData = overviewRes?.data || null;
      const trackItems = Array.isArray(tracksRes?.data?.items) ? tracksRes.data.items : [];
      const configData = configRes?.data || overviewData?.config || tracksRes?.data?.config || null;
      const myRows = Array.isArray(mineRes?.data) ? mineRes.data : [];
      const adminReviewRows = Array.isArray(reviewRes?.data) ? reviewRes.data : [];

      setOverview(overviewData);
      setTracks(trackItems);
      setConfig(configData);
      setAdminRows(trackItems);
      setMySubmissions(myRows);
      setReviewRows(adminReviewRows);

      if (configData) {
        setAdminConfigDraft({
          learningHubEnabled: !!configData.learningHubEnabled,
          allowFirstYear: !!configData.allowFirstYear,
          allowSecondYear: !!configData.allowSecondYear,
          allowSubmissions: !!configData.allowSubmissions,
          showLeaderboard: !!configData.showLeaderboard,
          spotlightTitle: String(configData.spotlightTitle || 'Growth Program'),
          spotlightMessage: String(configData.spotlightMessage || ''),
        });
      }

      setSelectedTrackId((prev) => {
        if (prev && trackItems.some((track) => String(track._id) === String(prev))) return prev;
        return trackItems[0]?._id || '';
      });

      const nextReviewDrafts = {};
      adminReviewRows.forEach((row) => {
        nextReviewDrafts[row._id] = {
          status: row.status === 'Submitted' ? 'Approved' : row.status || 'Approved',
          pointsAwarded: row.taskPoints || row.pointsAwarded || 0,
          reviewNote: row.reviewNote || '',
        };
      });
      setReviewDrafts(nextReviewDrafts);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load learning hub data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedTrack = useMemo(
    () => tracks.find((track) => String(track._id) === String(selectedTrackId)) || null,
    [tracks, selectedTrackId]
  );

  const trackStats = useMemo(() => {
    const total = tracks.length;
    const published = tracks.filter((row) => row.isPublished && !row.isArchived).length;
    const archived = tracks.filter((row) => row.isArchived).length;
    return { total, published, archived };
  }, [tracks]);

  const handleTrackSelect = (id) => {
    setSelectedTrackId(id);
  };

  const submissionKey = (trackId, moduleIndex, taskIndex) => `${trackId}::${moduleIndex}::${taskIndex}`;

  const updateSubmissionDraft = (key, field, value) => {
    setSubmissionDrafts((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || { evidenceText: '', evidenceLink: '' }),
        [field]: value,
      },
    }));
  };

  const submitTaskProof = async (trackId, moduleIndex, taskIndex) => {
    const key = submissionKey(trackId, moduleIndex, taskIndex);
    const draft = submissionDrafts[key] || {};

    if (!String(draft.evidenceText || '').trim() && !String(draft.evidenceLink || '').trim()) {
      dispatchToast('Add evidence text or link before submitting.', 'error');
      return;
    }

    setSubmittingTaskKey(key);
    try {
      await submitLearningTask(trackId, {
        moduleIndex,
        taskIndex,
        evidenceText: String(draft.evidenceText || '').trim(),
        evidenceLink: String(draft.evidenceLink || '').trim(),
      });
      dispatchToast('Task submission sent for review.', 'success');
      setSubmissionDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      await loadData();
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Unable to submit this task.', 'error');
    } finally {
      setSubmittingTaskKey('');
    }
  };

  const saveConfig = async () => {
    if (!isAdminOrHead || !adminConfigDraft) return;
    setConfigSaving(true);
    try {
      await updateLearningConfig(adminConfigDraft);
      dispatchToast('Engagement controls updated.', 'success');
      await loadData();
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to update controls.', 'error');
    } finally {
      setConfigSaving(false);
    }
  };

  const createTrack = async (event) => {
    event.preventDefault();
    if (!isAdminOrHead) return;

    const moduleTasks = composer.tasks
      .map((task) => ({
        title: String(task.title || '').trim(),
        description: String(task.description || '').trim(),
        points: Number(task.points || 0),
      }))
      .filter((task) => task.title);

    if (!String(composer.title || '').trim()) {
      dispatchToast('Track title is required.', 'error');
      return;
    }
    if (!String(composer.moduleTitle || '').trim()) {
      dispatchToast('Module title is required.', 'error');
      return;
    }
    if (!moduleTasks.length) {
      dispatchToast('Add at least one task for the module.', 'error');
      return;
    }

    const moduleResources = composer.resources
      .map((item) => ({
        label: String(item.label || '').trim(),
        url: String(item.url || '').trim(),
        type: item.type || 'Doc',
      }))
      .filter((item) => item.label && item.url);

    setComposerBusy(true);
    try {
      await createLearningTrack({
        title: String(composer.title || '').trim(),
        summary: String(composer.summary || '').trim(),
        targetAudience: composer.targetAudience,
        level: composer.level,
        estimatedHours: Number(composer.estimatedHours || 8),
        tags: String(composer.tags || '')
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        featured: !!composer.featured,
        isPublished: !!composer.publishNow,
        modules: [
          {
            title: String(composer.moduleTitle || '').trim(),
            description: String(composer.moduleDescription || '').trim(),
            tasks: moduleTasks,
            resources: moduleResources,
          },
        ],
      });
      dispatchToast('Track created successfully.', 'success');
      setComposer(createComposerState());
      await loadData();
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Unable to create track.', 'error');
    } finally {
      setComposerBusy(false);
    }
  };

  const setTrackPublishState = async (track, nextPublished) => {
    const key = `publish:${track._id}`;
    setTrackActionBusy(key);
    try {
      await setLearningTrackPublish(track._id, { isPublished: nextPublished });
      dispatchToast(nextPublished ? 'Track published.' : 'Track unpublished.', 'success');
      await loadData();
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to update publish state.', 'error');
    } finally {
      setTrackActionBusy('');
    }
  };

  const setTrackArchiveState = async (track, nextArchived) => {
    const key = `archive:${track._id}`;
    setTrackActionBusy(key);
    try {
      await setLearningTrackArchive(track._id, { isArchived: nextArchived });
      dispatchToast(nextArchived ? 'Track archived.' : 'Track restored.', 'success');
      await loadData();
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to update archive state.', 'error');
    } finally {
      setTrackActionBusy('');
    }
  };

  const setTrackFeaturedState = async (track, nextFeatured) => {
    const key = `feature:${track._id}`;
    setTrackActionBusy(key);
    try {
      await updateLearningTrack(track._id, { featured: nextFeatured });
      dispatchToast(nextFeatured ? 'Track marked as featured.' : 'Track removed from featured.', 'success');
      await loadData();
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to update featured state.', 'error');
    } finally {
      setTrackActionBusy('');
    }
  };

  const applyReview = async (row) => {
    const draft = reviewDrafts[row._id] || {
      status: 'Approved',
      pointsAwarded: row.taskPoints || 0,
      reviewNote: '',
    };

    setReviewBusyId(row._id);
    try {
      await reviewLearningSubmission(row._id, {
        status: draft.status,
        pointsAwarded: Number(draft.pointsAwarded || 0),
        reviewNote: String(draft.reviewNote || '').trim(),
      });
      dispatchToast('Submission reviewed.', 'success');
      await loadData();
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to review submission.', 'error');
    } finally {
      setReviewBusyId('');
    }
  };

  if (loading) {
    return (
      <div className="ui-page pb-16 page-motion-c">
        <DataLoading label="Loading Learning Hub..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="ui-page pb-16 page-motion-c">
        <DataError label={error} onRetry={loadData} />
      </div>
    );
  }

  if (!config?.learningHubEnabled && !isAdminOrHead) {
    return (
      <div className="ui-page pb-16 page-motion-c">
        <DataEmpty label="Learning Hub is currently disabled by admin controls." />
      </div>
    );
  }

  return (
    <div className="ui-page pb-16 space-y-8 page-motion-c">
      <section className="section-motion section-motion-delay-1">
        <PageHeader
          eyebrow="Member Growth"
          title={config?.spotlightTitle || 'Learning Hub'}
          subtitle={
            config?.spotlightMessage ||
            'Structured learning tracks, practical tasks, and review-driven progress for junior members.'
          }
          icon={BookOpenCheck}
          badge={
            <>
              <Sparkles size={13} className="text-blue-300" />
              {isAdminOrHead
                ? 'Admin Control Active'
                : isJuniorMember
                ? `Year ${year} Learning Mode`
                : 'Professional Development'}
            </>
          }
          actions={
            <>
              <StatChip icon={Layers} label="Tracks" value={overview?.stats?.activeTracks || tracks.length || 0} />
              <StatChip icon={Trophy} label="Points" value={overview?.stats?.myPoints || 0} />
              <StatChip icon={ClipboardCheck} label="Approved" value={overview?.stats?.myApprovedTasks || 0} />
            </>
          }
        />
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 section-motion section-motion-delay-2 pro-stagger">
        <InsightCard icon={BookOpenCheck} label="Active Tracks" value={overview?.stats?.activeTracks || tracks.length} />
        <InsightCard icon={CheckCircle2} label="My Submissions" value={overview?.stats?.mySubmittedTasks || 0} />
        <InsightCard icon={Medal} label="My Approved Tasks" value={overview?.stats?.myApprovedTasks || 0} />
        <InsightCard
          icon={ClockIconForRole(isAdminOrHead)}
          label={isAdminOrHead ? 'Pending Reviews' : 'Total Tasks'}
          value={isAdminOrHead ? overview?.stats?.pendingReviews || 0 : overview?.stats?.totalTasks || 0}
        />
      </section>

      <section className="grid grid-cols-1 2xl:grid-cols-12 gap-6 section-motion section-motion-delay-2">
        <article className="2xl:col-span-5 border border-gray-800 rounded-[1.6rem] p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-gray-200 inline-flex items-center gap-2">
              <Lightbulb size={15} className="text-cyan-300" /> Recommended Queue
            </h2>
            <span className="text-[10px] uppercase tracking-widest text-gray-500">
              {overview?.recommendedTasks?.length || 0} tasks
            </span>
          </div>

          {overview?.recommendedTasks?.length ? (
            <div className="space-y-3 max-h-[26rem] overflow-y-auto pr-1">
              {overview.recommendedTasks.map((row) => (
                <button
                  type="button"
                  key={`${row.trackId}-${row.moduleIndex}-${row.taskIndex}`}
                  onClick={() => handleTrackSelect(row.trackId)}
                  className="w-full text-left rounded-xl border border-gray-800 px-3 py-3 hover:border-blue-500/40 transition-colors"
                >
                  <p className="text-sm font-bold text-white">{row.taskTitle}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {row.trackTitle} • {row.moduleTitle}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border ${
                        TASK_STATUS_CLASS[row.status] || TASK_STATUS_CLASS.NotStarted
                      }`}
                    >
                      <Flag size={11} /> {row.status === 'NotStarted' ? 'Start' : row.status}
                    </span>
                    <span className="text-xs text-cyan-200">{row.points || 0} pts</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <DataEmpty label="No pending tasks right now. You are caught up." />
          )}
        </article>

        <article className="2xl:col-span-7 border border-gray-800 rounded-[1.6rem] p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-gray-200 inline-flex items-center gap-2">
              <Brain size={15} className="text-blue-300" /> Learning Tracks
            </h2>
            <span className="text-[10px] uppercase tracking-widest text-gray-500">{tracks.length} available</span>
          </div>

          {tracks.length ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {tracks.map((track) => (
                  <motion.button
                    key={track._id}
                    whileHover={{ y: -2 }}
                    type="button"
                    onClick={() => handleTrackSelect(track._id)}
                    className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                      String(selectedTrackId) === String(track._id)
                        ? 'border-blue-500/55 bg-blue-500/10'
                        : 'border-gray-800 hover:border-blue-500/35'
                    }`}
                  >
                    <p className="text-sm font-bold text-white line-clamp-2">{track.title}</p>
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">{track.summary || 'No summary provided.'}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-widest text-cyan-200">
                        {AUDIENCE_LABELS[track.targetAudience] || track.targetAudience}
                      </span>
                      <span className="text-xs text-gray-300">{track.progressPercent || 0}%</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(0, Math.min(100, track.progressPercent || 0))}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
                      />
                    </div>
                  </motion.button>
                ))}
              </div>

              {selectedTrack ? (
                <TrackDetail
                  track={selectedTrack}
                  isAdminOrHead={isAdminOrHead}
                  submissionDrafts={submissionDrafts}
                  updateSubmissionDraft={updateSubmissionDraft}
                  onSubmitTask={submitTaskProof}
                  submittingTaskKey={submittingTaskKey}
                  canSubmit={!!config?.allowSubmissions || isAdminOrHead}
                />
              ) : null}
            </div>
          ) : (
            <DataEmpty
              label={
                isJuniorMember
                  ? 'No tracks published for your year yet. Admin can publish tracks from this page.'
                  : 'No learning tracks found right now.'
              }
            />
          )}
        </article>
      </section>

      {config?.showLeaderboard && overview?.leaderboard?.length ? (
        <section className="border border-gray-800 rounded-[1.6rem] p-5 md:p-6 section-motion section-motion-delay-3">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-gray-200 inline-flex items-center gap-2">
              <Trophy size={15} className="text-amber-300" /> Learning Leaderboard
            </h2>
            <span className="text-[10px] uppercase tracking-widest text-gray-500">Top performers</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {overview.leaderboard.map((entry) => (
              <article key={`${entry.member._id}-${entry.rank}`} className="rounded-xl border border-gray-800 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-white">#{entry.rank} {entry.member.name}</p>
                  <span className="text-xs text-cyan-200">{entry.points} pts</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {entry.member.collegeId} • Year {entry.member.year || 'N/A'} • {entry.tasks} tasks
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="border border-gray-800 rounded-[1.6rem] p-5 md:p-6 section-motion section-motion-delay-3">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-gray-200 inline-flex items-center gap-2">
            <ClipboardCheck size={15} className="text-emerald-300" /> My Submission Timeline
          </h2>
          <span className="text-[10px] uppercase tracking-widest text-gray-500">{mySubmissions.length} records</span>
        </div>

        {mySubmissions.length ? (
          <div className="space-y-3 max-h-[24rem] overflow-y-auto pr-1">
            {mySubmissions.slice(0, 24).map((row) => (
              <article key={row._id} className="rounded-xl border border-gray-800 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-white">
                    {row.taskTitle || `Module ${row.moduleIndex + 1} • Task ${row.taskIndex + 1}`}
                  </p>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border ${
                      SUBMISSION_STATUS_CLASS[row.status] || SUBMISSION_STATUS_CLASS.Submitted
                    }`}
                  >
                    <Eye size={11} /> {row.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {row.track?.title || 'Track'} • Updated {fmtDateTime(row.updatedAt)}
                </p>
                {row.reviewNote ? <p className="text-xs text-amber-200 mt-2">Review: {row.reviewNote}</p> : null}
                {row.pointsAwarded ? (
                  <p className="text-xs text-emerald-300 mt-2">Points: {row.pointsAwarded}</p>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <DataEmpty label="No submissions yet. Start with any task from your active track." />
        )}
      </section>

      {isAdminOrHead ? (
        <>
          <section className="border border-gray-800 rounded-[1.6rem] p-5 md:p-6 section-motion section-motion-delay-3 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-gray-200 inline-flex items-center gap-2">
                <Settings2 size={15} className="text-indigo-300" /> Admin Engagement Controls
              </h2>
              <button type="button" onClick={saveConfig} className="btn btn-primary" disabled={configSaving}>
                {configSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save Controls
              </button>
            </div>

            {adminConfigDraft ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                <ToggleCard
                  icon={BookOpenCheck}
                  label="Learning Hub Enabled"
                  value={adminConfigDraft.learningHubEnabled}
                  onChange={(value) => setAdminConfigDraft((prev) => ({ ...prev, learningHubEnabled: value }))}
                />
                <ToggleCard
                  icon={GraduationCap}
                  label="First-Year Access"
                  value={adminConfigDraft.allowFirstYear}
                  onChange={(value) => setAdminConfigDraft((prev) => ({ ...prev, allowFirstYear: value }))}
                />
                <ToggleCard
                  icon={UserCheck}
                  label="Second-Year Access"
                  value={adminConfigDraft.allowSecondYear}
                  onChange={(value) => setAdminConfigDraft((prev) => ({ ...prev, allowSecondYear: value }))}
                />
                <ToggleCard
                  icon={Send}
                  label="Allow Submissions"
                  value={adminConfigDraft.allowSubmissions}
                  onChange={(value) => setAdminConfigDraft((prev) => ({ ...prev, allowSubmissions: value }))}
                />
                <ToggleCard
                  icon={Trophy}
                  label="Show Leaderboard"
                  value={adminConfigDraft.showLeaderboard}
                  onChange={(value) => setAdminConfigDraft((prev) => ({ ...prev, showLeaderboard: value }))}
                />
              </div>
            ) : null}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <label className="ui-field">
                <span className="ui-label">Spotlight Title</span>
                <input
                  value={adminConfigDraft?.spotlightTitle || ''}
                  onChange={(event) =>
                    setAdminConfigDraft((prev) => ({ ...prev, spotlightTitle: event.target.value }))
                  }
                  className="ui-input"
                  placeholder="Growth Program"
                />
              </label>
              <label className="ui-field lg:col-span-2">
                <span className="ui-label">Spotlight Message</span>
                <textarea
                  value={adminConfigDraft?.spotlightMessage || ''}
                  onChange={(event) =>
                    setAdminConfigDraft((prev) => ({ ...prev, spotlightMessage: event.target.value }))
                  }
                  rows={3}
                  className="ui-input resize-none"
                />
              </label>
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 section-motion section-motion-delay-3">
            <article className="xl:col-span-6 border border-gray-800 rounded-[1.6rem] p-5 md:p-6 space-y-4">
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-gray-200 inline-flex items-center gap-2">
                <Plus size={15} className="text-cyan-300" /> Create New Track
              </h2>

              <form onSubmit={createTrack} className="space-y-3">
                <input
                  value={composer.title}
                  onChange={(event) => setComposer((prev) => ({ ...prev, title: event.target.value }))}
                  className="ui-input"
                  placeholder="Track title"
                  required
                />
                <textarea
                  value={composer.summary}
                  onChange={(event) => setComposer((prev) => ({ ...prev, summary: event.target.value }))}
                  className="ui-input resize-none"
                  rows={3}
                  placeholder="What this track helps members achieve"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    value={composer.targetAudience}
                    onChange={(event) => setComposer((prev) => ({ ...prev, targetAudience: event.target.value }))}
                    className="ui-input"
                  >
                    {AUDIENCE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {AUDIENCE_LABELS[option] || option}
                      </option>
                    ))}
                  </select>
                  <select
                    value={composer.level}
                    onChange={(event) => setComposer((prev) => ({ ...prev, level: event.target.value }))}
                    className="ui-input"
                  >
                    {LEVEL_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="number"
                    min={1}
                    max={300}
                    value={composer.estimatedHours}
                    onChange={(event) =>
                      setComposer((prev) => ({ ...prev, estimatedHours: Number(event.target.value || 1) }))
                    }
                    className="ui-input"
                    placeholder="Hours"
                  />
                  <input
                    value={composer.tags}
                    onChange={(event) => setComposer((prev) => ({ ...prev, tags: event.target.value }))}
                    className="ui-input sm:col-span-2"
                    placeholder="Tags (comma separated)"
                  />
                </div>

                <div className="border border-gray-800 rounded-xl p-3 space-y-3">
                  <input
                    value={composer.moduleTitle}
                    onChange={(event) => setComposer((prev) => ({ ...prev, moduleTitle: event.target.value }))}
                    className="ui-input"
                    placeholder="Module title"
                    required
                  />
                  <textarea
                    value={composer.moduleDescription}
                    onChange={(event) =>
                      setComposer((prev) => ({ ...prev, moduleDescription: event.target.value }))
                    }
                    className="ui-input resize-none"
                    rows={2}
                    placeholder="Module description"
                  />

                  <div className="space-y-2">
                    {composer.tasks.map((task, index) => (
                      <div key={`task-${index}`} className="grid grid-cols-1 md:grid-cols-12 gap-2">
                        <input
                          value={task.title}
                          onChange={(event) =>
                            setComposer((prev) => ({
                              ...prev,
                              tasks: prev.tasks.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, title: event.target.value } : item
                              ),
                            }))
                          }
                          className="ui-input md:col-span-5"
                          placeholder={`Task ${index + 1} title`}
                        />
                        <input
                          value={task.description}
                          onChange={(event) =>
                            setComposer((prev) => ({
                              ...prev,
                              tasks: prev.tasks.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, description: event.target.value } : item
                              ),
                            }))
                          }
                          className="ui-input md:col-span-5"
                          placeholder="Task description"
                        />
                        <input
                          type="number"
                          min={0}
                          max={300}
                          value={task.points}
                          onChange={(event) =>
                            setComposer((prev) => ({
                              ...prev,
                              tasks: prev.tasks.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, points: Number(event.target.value || 0) } : item
                              ),
                            }))
                          }
                          className="ui-input md:col-span-2"
                          placeholder="Points"
                        />
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() =>
                      setComposer((prev) => ({
                        ...prev,
                        tasks: [...prev.tasks, { title: '', description: '', points: 10 }],
                      }))
                    }
                  >
                    <Plus size={13} /> Add Task
                  </button>

                  <div className="space-y-2">
                    {composer.resources.map((resource, index) => (
                      <div key={`resource-${index}`} className="grid grid-cols-1 md:grid-cols-12 gap-2">
                        <input
                          value={resource.label}
                          onChange={(event) =>
                            setComposer((prev) => ({
                              ...prev,
                              resources: prev.resources.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, label: event.target.value } : item
                              ),
                            }))
                          }
                          className="ui-input md:col-span-4"
                          placeholder="Resource label"
                        />
                        <input
                          value={resource.url}
                          onChange={(event) =>
                            setComposer((prev) => ({
                              ...prev,
                              resources: prev.resources.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, url: event.target.value } : item
                              ),
                            }))
                          }
                          className="ui-input md:col-span-6"
                          placeholder="Resource URL"
                        />
                        <select
                          value={resource.type}
                          onChange={(event) =>
                            setComposer((prev) => ({
                              ...prev,
                              resources: prev.resources.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, type: event.target.value } : item
                              ),
                            }))
                          }
                          className="ui-input md:col-span-2"
                        >
                          {RESOURCE_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() =>
                      setComposer((prev) => ({
                        ...prev,
                        resources: [...prev.resources, { label: '', url: '', type: 'Doc' }],
                      }))
                    }
                  >
                    <Plus size={13} /> Add Resource
                  </button>
                </div>

                <div className="flex flex-wrap gap-3">
                  <label className="inline-flex items-center gap-2 text-xs text-gray-300">
                    <input
                      type="checkbox"
                      checked={composer.publishNow}
                      onChange={(event) => setComposer((prev) => ({ ...prev, publishNow: event.target.checked }))}
                    />
                    Publish immediately
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs text-gray-300">
                    <input
                      type="checkbox"
                      checked={composer.featured}
                      onChange={(event) => setComposer((prev) => ({ ...prev, featured: event.target.checked }))}
                    />
                    Feature on top
                  </label>
                </div>

                <button type="submit" className="btn btn-primary" disabled={composerBusy}>
                  {composerBusy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create Track
                </button>
              </form>
            </article>

            <article className="xl:col-span-6 border border-gray-800 rounded-[1.6rem] p-5 md:p-6 space-y-4">
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-gray-200 inline-flex items-center gap-2">
                <Wrench size={15} className="text-amber-300" /> Track Management
              </h2>

              <div className="grid grid-cols-3 gap-3">
                <MiniStat label="Total" value={trackStats.total} />
                <MiniStat label="Published" value={trackStats.published} />
                <MiniStat label="Archived" value={trackStats.archived} />
              </div>

              {adminRows.length ? (
                <div className="space-y-3 max-h-[34rem] overflow-y-auto pr-1">
                  {adminRows.map((track) => {
                    const taskCount = Number(track.totalTasks || 0);
                    return (
                      <article key={track._id} className="rounded-xl border border-gray-800 px-4 py-3 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-white">{track.title}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {AUDIENCE_LABELS[track.targetAudience] || track.targetAudience} • {track.level} • {taskCount} tasks
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {track.featured ? (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border border-amber-500/45 bg-amber-500/10 text-amber-200">
                                <Star size={11} /> Featured
                              </span>
                            ) : null}
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border ${
                                track.isArchived
                                  ? 'border-rose-500/45 bg-rose-500/10 text-rose-200'
                                  : track.isPublished
                                  ? 'border-emerald-500/45 bg-emerald-500/10 text-emerald-200'
                                  : 'border-gray-700 bg-gray-800/30 text-gray-300'
                              }`}
                            >
                              {track.isArchived ? 'Archived' : track.isPublished ? 'Published' : 'Draft'}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setTrackPublishState(track, !track.isPublished)}
                            disabled={track.isArchived || trackActionBusy === `publish:${track._id}`}
                          >
                            {trackActionBusy === `publish:${track._id}` ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : track.isPublished ? (
                              <CircleDashed size={13} />
                            ) : (
                              <CheckCircle2 size={13} />
                            )}
                            {track.isPublished ? 'Unpublish' : 'Publish'}
                          </button>

                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setTrackFeaturedState(track, !track.featured)}
                            disabled={trackActionBusy === `feature:${track._id}`}
                          >
                            {trackActionBusy === `feature:${track._id}` ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Star size={13} />
                            )}
                            {track.featured ? 'Unfeature' : 'Feature'}
                          </button>

                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => setTrackArchiveState(track, !track.isArchived)}
                            disabled={trackActionBusy === `archive:${track._id}`}
                          >
                            {trackActionBusy === `archive:${track._id}` ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <ArchiveIcon archived={track.isArchived} />
                            )}
                            {track.isArchived ? 'Restore' : 'Archive'}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <DataEmpty label="No tracks yet. Create one from the left panel." />
              )}
            </article>
          </section>

          <section className="border border-gray-800 rounded-[1.6rem] p-5 md:p-6 section-motion section-motion-delay-3">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-gray-200 inline-flex items-center gap-2">
                <ClipboardCheck size={15} className="text-cyan-300" /> Submission Review Queue
              </h2>
              <span className="text-[10px] uppercase tracking-widest text-gray-500">{reviewRows.length} submissions</span>
            </div>

            {reviewRows.length ? (
              <div className="space-y-3 max-h-[34rem] overflow-y-auto pr-1">
                {reviewRows.map((row) => {
                  const draft = reviewDrafts[row._id] || {
                    status: 'Approved',
                    pointsAwarded: row.taskPoints || 0,
                    reviewNote: '',
                  };
                  const isBusy = reviewBusyId === row._id;
                  return (
                    <article key={row._id} className="rounded-xl border border-gray-800 px-4 py-3 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-white">{row.member?.name || 'Member'} • {row.taskTitle}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {row.track?.title || 'Track'} • Year {row.member?.year || 'N/A'} • {fmtDateTime(row.submittedAt)}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border ${
                            SUBMISSION_STATUS_CLASS[row.status] || SUBMISSION_STATUS_CLASS.Submitted
                          }`}
                        >
                          {row.status}
                        </span>
                      </div>

                      <p className="text-xs text-gray-300 line-clamp-2">{row.evidenceText || row.evidenceLink || 'No evidence text.'}</p>
                      {row.evidenceLink ? (
                        <a href={row.evidenceLink} target="_blank" rel="noreferrer" className="text-xs text-cyan-300 hover:text-cyan-200">
                          {row.evidenceLink}
                        </a>
                      ) : null}

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                        <select
                          value={draft.status}
                          onChange={(event) =>
                            setReviewDrafts((prev) => ({
                              ...prev,
                              [row._id]: { ...draft, status: event.target.value },
                            }))
                          }
                          className="ui-input md:col-span-3"
                        >
                          {REVIEW_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={0}
                          max={500}
                          value={draft.pointsAwarded}
                          onChange={(event) =>
                            setReviewDrafts((prev) => ({
                              ...prev,
                              [row._id]: { ...draft, pointsAwarded: Number(event.target.value || 0) },
                            }))
                          }
                          className="ui-input md:col-span-2"
                          placeholder="Points"
                        />
                        <input
                          value={draft.reviewNote}
                          onChange={(event) =>
                            setReviewDrafts((prev) => ({
                              ...prev,
                              [row._id]: { ...draft, reviewNote: event.target.value },
                            }))
                          }
                          className="ui-input md:col-span-5"
                          placeholder="Review note"
                        />
                        <button
                          type="button"
                          className="btn btn-primary md:col-span-2"
                          onClick={() => applyReview(row)}
                          disabled={isBusy}
                        >
                          {isBusy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                          Apply
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <DataEmpty label="No submissions to review right now." />
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function TrackDetail({
  track,
  isAdminOrHead,
  submissionDrafts,
  updateSubmissionDraft,
  onSubmitTask,
  submittingTaskKey,
  canSubmit,
}) {
  return (
    <section className="rounded-xl border border-gray-800 p-4 md:p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-gray-300 inline-flex items-center gap-2">
            <BookOpenCheck size={14} className="text-cyan-300" /> Selected Track
          </p>
          <h3 className="text-xl font-black text-white mt-2">{track.title}</h3>
          <p className="text-sm text-gray-400 mt-1">{track.summary || 'No summary provided.'}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-cyan-200">{track.progressPercent || 0}% complete</p>
          <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-1">
            {track.approvedCount || 0}/{track.totalTasks || 0} approved
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {(track.modules || []).map((module) => (
          <article key={`${track._id}-module-${module.index}`} className="rounded-xl border border-gray-800 px-4 py-3 space-y-3">
            <div>
              <p className="text-sm font-bold text-white">{module.title}</p>
              {module.description ? <p className="text-xs text-gray-400 mt-1">{module.description}</p> : null}
            </div>

            {module.resources?.length ? (
              <div className="flex flex-wrap gap-2">
                {module.resources.map((resource, idx) => (
                  <a
                    key={`${resource.url}-${idx}`}
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest border border-cyan-500/30 text-cyan-200 hover:border-cyan-400/55"
                  >
                    <Sparkles size={11} /> {resource.type}: {resource.label}
                  </a>
                ))}
              </div>
            ) : null}

            <div className="space-y-3">
              {(module.tasks || []).map((task) => {
                const taskKey = `${track._id}::${module.index}::${task.index}`;
                const draft = submissionDrafts[taskKey] || { evidenceText: '', evidenceLink: '' };
                const busy = submittingTaskKey === taskKey;

                return (
                  <div key={taskKey} className="rounded-lg border border-gray-800 px-3 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-white">{task.title}</p>
                        <p className="text-xs text-gray-400 mt-1">{task.description || 'Complete this activity and submit your proof.'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-cyan-200">{task.points || 0} pts</span>
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border ${
                            TASK_STATUS_CLASS[task.status] || TASK_STATUS_CLASS.NotStarted
                          }`}
                        >
                          <Flag size={11} /> {task.status || 'NotStarted'}
                        </span>
                      </div>
                    </div>

                    {!isAdminOrHead ? (
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-12 gap-2">
                        <input
                          value={draft.evidenceText}
                          onChange={(event) => updateSubmissionDraft(taskKey, 'evidenceText', event.target.value)}
                          className="ui-input md:col-span-5"
                          placeholder="What did you complete?"
                        />
                        <input
                          value={draft.evidenceLink}
                          onChange={(event) => updateSubmissionDraft(taskKey, 'evidenceLink', event.target.value)}
                          className="ui-input md:col-span-5"
                          placeholder="URL (GitHub/Doc/Video/etc.)"
                        />
                        <button
                          type="button"
                          className="btn btn-primary md:col-span-2"
                          onClick={() => onSubmitTask(track._id, module.index, task.index)}
                          disabled={busy || !canSubmit}
                        >
                          {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                          Submit
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>

      {!canSubmit && !isAdminOrHead ? (
        <p className="text-xs text-amber-200">Submissions are temporarily paused by admin controls.</p>
      ) : null}
    </section>
  );
}

function ToggleCard({ icon: Icon, label, value, onChange }) {
  return (
    <div className="rounded-xl border border-gray-800 px-4 py-3 flex items-center justify-between gap-3">
      <div className="inline-flex items-center gap-2">
        <Icon size={14} className="text-cyan-300" />
        <span className="text-xs uppercase tracking-widest text-gray-300">{label}</span>
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
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

function InsightCard({ icon: Icon, label, value }) {
  return (
    <article className="rounded-2xl border border-gray-800 px-5 py-4">
      <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-black inline-flex items-center gap-1">
        <Icon size={12} className="text-cyan-300" /> {label}
      </p>
      <p className="text-2xl font-black text-white mt-2">{value}</p>
    </article>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-800 px-3 py-3 text-center">
      <p className="text-[10px] uppercase tracking-widest text-gray-500">{label}</p>
      <p className="text-lg font-black text-white mt-1">{value}</p>
    </div>
  );
}

function StatChip({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-gray-800 px-3 py-2 inline-flex items-center gap-2 text-xs text-gray-300">
      <Icon size={13} className="text-cyan-300" />
      <span className="uppercase tracking-widest text-[10px]">{label}</span>
      <span className="font-black text-white">{value}</span>
    </div>
  );
}

function ArchiveIcon({ archived }) {
  if (archived) return <Eye size={13} />;
  return <CircleDashed size={13} />;
}

function ClockIconForRole(isAdminOrHead) {
  return isAdminOrHead ? CircleDashed : Medal;
}
