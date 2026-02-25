import { motion } from 'framer-motion';

export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  badge,
  actions,
  icon: Icon,
  className = '',
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32 }}
      className={`ui-header ${className}`.trim()}
    >
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="min-w-0">
          {eyebrow ? <p className="ui-header-eyebrow">{eyebrow}</p> : null}
          <div className="mt-2 flex items-center gap-2.5 min-w-0">
            {Icon ? <Icon size={18} className="text-cyan-300 shrink-0" /> : null}
            <h1 className="ui-header-title truncate">{title}</h1>
          </div>
          {subtitle ? <p className="ui-header-subtitle mt-2">{subtitle}</p> : null}
        </div>

        {actions ? <div className="w-full lg:w-auto flex flex-col sm:flex-row gap-2">{actions}</div> : null}
      </div>

      {badge ? <div className="ui-badge w-fit">{badge}</div> : null}
    </motion.header>
  );
}
