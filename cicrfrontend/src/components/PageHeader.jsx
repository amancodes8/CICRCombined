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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`ui-header ${className}`.trim()}
    >
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="min-w-0">
          {eyebrow ? (
            <motion.p
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.05 }}
              className="ui-header-eyebrow"
            >
              {eyebrow}
            </motion.p>
          ) : null}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="mt-2 flex items-center gap-3 min-w-0"
          >
            {Icon ? (
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/10 border border-blue-500/20 shrink-0">
                <Icon size={18} className="text-cyan-300" />
              </div>
            ) : null}
            <h1 className="ui-header-title truncate">{title}</h1>
          </motion.div>
          {subtitle ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.15 }}
              className="ui-header-subtitle mt-2"
            >
              {subtitle}
            </motion.p>
          ) : null}
        </div>

        {actions ? (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.12 }}
            className="w-full lg:w-auto flex flex-col sm:flex-row gap-2"
          >
            {actions}
          </motion.div>
        ) : null}
      </div>

      {badge ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="ui-badge w-fit"
        >
          {badge}
        </motion.div>
      ) : null}
    </motion.header>
  );
}
