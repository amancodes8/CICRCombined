import { CalendarCheck2, ShieldCheck, Sparkles, Users, Wrench } from 'lucide-react';

const guidelineSections = [
  {
    icon: ShieldCheck,
    title: 'Conduct & Security',
    points: [
      'Keep all discussions respectful, technical, and traceable.',
      'Do not share private member data outside approved CICR channels.',
      'Report moderation or safety concerns to Admin immediately.',
    ],
  },
  {
    icon: Wrench,
    title: 'Project Standards',
    points: [
      'Document project goals, owners, and status updates weekly.',
      'Use reproducible setups, clear commit history, and readable PRs.',
      'Tag blockers early and avoid silent project drift.',
    ],
  },
  {
    icon: CalendarCheck2,
    title: 'Meetings & Ops',
    points: [
      'Publish agenda before meetings and action items after meetings.',
      'Track attendance and responsibilities for each event.',
      'Close loops on assigned tasks before the next sprint cycle.',
    ],
  },
  {
    icon: Users,
    title: 'Community Workflow',
    points: [
      'Use Community updates for events and important announcements.',
      'Give feedback with context, evidence, and actionable suggestions.',
      'Escalate unresolved conflicts through Admin/Head channels.',
    ],
  },
];

export default function Guidelines() {
  return (
    <div className="max-w-6xl mx-auto pb-10 md:pb-14 space-y-6 page-motion-d">
      <section className="p-7 md:p-10 section-motion section-motion-delay-1">
        <p className="text-[10px] uppercase tracking-[0.26em] text-cyan-300 font-black">CICR Handbook</p>
        <h1 className="text-3xl md:text-4xl font-black text-white mt-3 tracking-tight">Operational Guidelines</h1>
        <p className="text-gray-300/90 mt-3 max-w-3xl text-sm md:text-base leading-relaxed">
          This page defines the baseline operating standards for CICR projects, communication, and collaboration.
          Follow these rules to keep execution fast, secure, and professional.
        </p>
        <div className="mt-5 inline-flex items-center gap-2 text-xs text-cyan-200 border border-cyan-400/20 rounded-full px-3 py-1.5">
          <Sparkles size={14} />
          Updated for current workflow standards
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 pro-stagger section-motion section-motion-delay-2">
        {guidelineSections.map(({ icon: Icon, title, points }) => (
          <article key={title} className="border border-gray-800/75 rounded-2xl p-5 md:p-6 pro-hover-lift">
            <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-cyan-500/12 border border-cyan-400/20 text-cyan-300">
              <Icon size={18} />
            </div>
            <h2 className="text-lg font-black text-white mt-4">{title}</h2>
            <ul className="mt-3 space-y-2.5 text-sm text-gray-300 leading-relaxed">
              {points.map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-cyan-300/80 shrink-0" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-gray-800 px-5 py-4 section-motion section-motion-delay-3">
        <p className="text-xs md:text-sm text-gray-400">
          Need a new rule or exception?
          <span className="text-gray-200"> Propose it in the Community page with context, impact, and owner.</span>
        </p>
      </section>
    </div>
  );
}
