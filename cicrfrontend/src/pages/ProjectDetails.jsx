import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Loader2, MessageSquarePlus, Users } from 'lucide-react';
import { addProjectSuggestion, fetchProjectById } from '../api';

const fmt = (value) => new Date(value).toLocaleString();

export default function ProjectDetails() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [suggestionText, setSuggestionText] = useState('');
  const [saving, setSaving] = useState(false);

  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  const user = profile.result || profile;
  const canSuggest = ['admin', 'head', 'alumni'].includes((user.role || '').toLowerCase());

  const loadProject = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await fetchProjectById(id);
      setProject(data);
    } catch (err) {
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const orderedSuggestions = useMemo(
    () => [...(project?.suggestions || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [project]
  );

  const submitSuggestion = async (e) => {
    e.preventDefault();
    const text = suggestionText.trim();
    if (!text) return;
    setSaving(true);
    try {
      await addProjectSuggestion(id, text);
      setSuggestionText('');
      await loadProject();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add suggestion');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[70vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 page-motion-b">
        <Link to="/projects" className="inline-flex items-center gap-2 text-gray-400 hover:text-white section-motion section-motion-delay-1">
          <ArrowLeft size={16} /> Back to projects
        </Link>
        <div className="border border-gray-800 rounded-3xl p-8 section-motion section-motion-delay-2">
          <p className="text-red-400 font-semibold">Project not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 page-motion-b pro-stagger">
      <Link to="/projects" className="inline-flex items-center gap-2 text-gray-400 hover:text-white section-motion section-motion-delay-1">
        <ArrowLeft size={16} /> Back to projects
      </Link>

      <section className="border border-gray-800 rounded-3xl p-8 space-y-5 section-motion section-motion-delay-2">
        <p className="text-xs uppercase tracking-widest text-blue-400 font-black">{project.domain} • {project.status}</p>
        <h1 className="text-3xl font-black text-white">{project.title}</h1>
        <p className="text-gray-300 leading-relaxed">{project.description}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="bg-[#0a0a0c] border border-gray-800 rounded-2xl p-4">
            <p className="text-gray-500 uppercase tracking-widest text-[10px] font-black">Project Lead</p>
            <p className="text-white mt-2">{project.lead?.name || 'N/A'}</p>
          </div>
          <div className="bg-[#0a0a0c] border border-gray-800 rounded-2xl p-4">
            <p className="text-gray-500 uppercase tracking-widest text-[10px] font-black">Members</p>
            <p className="text-white mt-2">{project.team?.length || 0}</p>
          </div>
        </div>
      </section>

      <section className="border border-gray-800 rounded-3xl p-8 section-motion section-motion-delay-2">
        <h2 className="text-xl font-black text-white flex items-center gap-2"><Users size={18} className="text-indigo-400" /> Team</h2>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {(project.team || []).map((member) => (
            <Link
              key={member._id}
              to={`/profile/${member.collegeId || ''}`}
              className="bg-[#0a0a0c] border border-gray-800 rounded-xl p-4 hover:border-blue-500/40 transition-colors"
            >
              <p className="text-white font-semibold">{member.name}</p>
              <p className="text-xs text-gray-500">{member.email}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="border border-gray-800 rounded-3xl p-8 space-y-4 section-motion section-motion-delay-3">
        <h2 className="text-xl font-black text-white flex items-center gap-2"><CalendarDays size={18} className="text-emerald-400" /> Suggestions</h2>

        {canSuggest && (
          <form onSubmit={submitSuggestion} className="space-y-3">
            <textarea
              rows={3}
              value={suggestionText}
              onChange={(e) => setSuggestionText(e.target.value)}
              placeholder="Add practical suggestions to improve this project."
              className="w-full bg-[#0a0a0c] border border-gray-800 rounded-2xl p-4 text-white outline-none focus:border-blue-500"
            />
            <button
              disabled={saving}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <MessageSquarePlus size={16} />}
              Add Suggestion
            </button>
          </form>
        )}

        <div className="space-y-3">
          {orderedSuggestions.length === 0 && <p className="text-sm text-gray-500">No suggestions yet.</p>}
          {orderedSuggestions.map((s) => (
            <div key={s._id} className="bg-[#0a0a0c] border border-gray-800 rounded-2xl p-4">
              <p className="text-gray-200">{s.text}</p>
              <p className="text-xs text-gray-500 mt-2">{s.author?.name || 'Member'} • {fmt(s.createdAt)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
