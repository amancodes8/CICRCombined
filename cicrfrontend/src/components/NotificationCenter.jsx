import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, CheckCheck, ChevronRight, Loader2, RefreshCcw } from 'lucide-react';

const CATEGORY_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'mentions', label: 'Mentions' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'issues', label: 'Issues' },
  { id: 'applications', label: 'Recruitment' },
  { id: 'events', label: 'Events' },
  { id: 'system', label: 'System' },
];

const categoryFromNotification = (item = {}) => {
  const title = String(item.title || '').toLowerCase();
  const message = String(item.message || '').toLowerCase();
  const link = String(item.link || '').toLowerCase();
  const hay = `${title} ${message} ${link}`;
  if (item.meta?.mention || hay.includes('mention') || hay.includes('@')) return 'mentions';
  if (hay.includes('approval') || hay.includes('pending admin')) return 'approvals';
  if (hay.includes('issue')) return 'issues';
  if (hay.includes('application') || hay.includes('recruitment')) return 'applications';
  if (hay.includes('event') || hay.includes('meeting')) return 'events';
  return 'system';
};

export default function NotificationCenter({
  open,
  onClose,
  items = [],
  loading = false,
  unreadCount = 0,
  onRefresh,
  onReadAll,
  onReadItem,
}) {
  const [filter, setFilter] = useState('all');

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'unread') return items.filter((item) => !item.isRead);
    return items.filter((item) => categoryFromNotification(item) === filter);
  }, [filter, items]);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/55"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.25 }}
            className="fixed right-0 top-0 h-full w-[min(480px,96vw)] z-[110] border-l border-gray-800 bg-[#090d13] shadow-2xl flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="Notification center"
          >
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-blue-300 font-black">Notification Center</p>
                <h3 className="text-lg font-black text-white mt-0.5 inline-flex items-center gap-2">
                  <Bell size={15} className="text-cyan-300" />
                  Alerts and Updates
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-ghost !px-2.5 !py-1.5"
                aria-label="Close notification center"
              >
                Close
              </button>
            </div>

            <div className="px-5 py-3 border-b border-gray-800 space-y-3">
              <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-gray-300">
                <span className="ui-badge">{unreadCount} unread</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_FILTERS.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setFilter(row.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] uppercase tracking-widest border ${
                      filter === row.id
                        ? 'border-cyan-500/45 text-cyan-100 bg-cyan-500/10'
                        : 'border-gray-700 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {row.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={onReadAll} className="btn btn-secondary !px-3 !py-1.5">
                  <CheckCheck size={12} />
                  Mark All Read
                </button>
                <button type="button" onClick={onRefresh} className="btn btn-ghost !px-3 !py-1.5">
                  <RefreshCcw size={12} />
                  Refresh
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto px-3 py-3 space-y-2">
              {loading ? (
                <div className="h-full flex items-center justify-center text-sm text-gray-400">
                  <Loader2 size={16} className="animate-spin mr-2" />
                  Syncing notifications...
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="ui-empty text-sm">No notifications in this view.</div>
              ) : (
                filteredItems.map((item) => {
                  const category = categoryFromNotification(item);
                  return (
                    <button
                      key={item._id}
                      type="button"
                      onClick={() => onReadItem?.(item)}
                      className={`w-full text-left rounded-xl border p-3 transition-colors ${
                        item.isRead
                          ? 'border-gray-800 text-gray-400 hover:border-gray-700'
                          : 'border-blue-500/35 text-gray-100 bg-blue-500/5 hover:border-blue-400/45'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold leading-tight">{item.title || 'Notification'}</p>
                          <p className="text-xs mt-1 text-gray-400 line-clamp-2">{item.message || ''}</p>
                        </div>
                        <ChevronRight size={14} className="mt-0.5 text-gray-500 shrink-0" />
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-gray-500">
                        <span>{category}</span>
                        <span>•</span>
                        <span>{item.createdAt ? new Date(item.createdAt).toLocaleString() : 'N/A'}</span>
                        {item.link ? (
                          <>
                            <span>•</span>
                            <span className="text-cyan-300">Open</span>
                          </>
                        ) : null}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
