import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Box,
  Check,
  ChevronDown,
  ChevronUp,
  Database,
  Loader2,
  MapPin,
  Minus,
  Pencil,
  Plus,
  Search,
  UserRound,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  adjustInventoryStock,
  adjustInventoryStockById,
  fetchInventory,
  issueInventoryItem,
} from '../api';
import PageHeader from '../components/PageHeader';
import { DataEmpty } from '../components/DataState';

const STOCK_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'critical', label: 'Critical' },
  { id: 'low', label: 'Low' },
  { id: 'healthy', label: 'Healthy' },
];

const dispatchToast = (message, type = 'info') => {
  try {
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type } }));
  } catch {
    window.alert(message);
  }
};

const toDateLabel = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown time';
  return parsed.toLocaleString([], {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getStockHealth = (item) => {
  const total = Math.max(Number(item?.totalQuantity || 0), 0);
  const available = Math.max(Number(item?.availableQuantity || 0), 0);
  if (available === 0 || total === 0) {
    return {
      id: 'critical',
      label: 'Critical',
      className: 'text-rose-200 border-rose-500/35 bg-rose-500/10',
    };
  }

  const ratio = available / total;
  if (ratio <= 0.2 || available <= 3) {
    return {
      id: 'critical',
      label: 'Critical',
      className: 'text-rose-200 border-rose-500/35 bg-rose-500/10',
    };
  }

  if (ratio <= 0.45 || available <= 8) {
    return {
      id: 'low',
      label: 'Low',
      className: 'text-amber-200 border-amber-500/35 bg-amber-500/10',
    };
  }

  return {
    id: 'healthy',
    label: 'Healthy',
    className: 'text-emerald-200 border-emerald-500/35 bg-emerald-500/10',
  };
};

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [expandedItemId, setExpandedItemId] = useState('');
  const [issueData, setIssueData] = useState({ quantity: 1, project: '' });
  const [isIssuing, setIsIssuing] = useState(false);
  const [editingItemId, setEditingItemId] = useState('');
  const [adjustMode, setAdjustMode] = useState('add');
  const [adjustQty, setAdjustQty] = useState(1);
  const [adjusting, setAdjusting] = useState(false);

  const profileData = JSON.parse(localStorage.getItem('profile') || '{}');
  const userData = profileData.result || profileData;
  const isAdmin =
    userData.role?.toLowerCase() === 'admin' || userData.role?.toLowerCase() === 'head';

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedItem) return;
    setIssueData((prev) => ({
      ...prev,
      quantity: Math.min(Number(prev.quantity) || 1, Math.max(selectedItem.availableQuantity || 1, 1)),
    }));
  }, [selectedItem]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data } = await fetchInventory();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      dispatchToast('Failed to load inventory.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const metrics = useMemo(() => {
    const totalParts = items.length;
    const unitsTotal = items.reduce((sum, row) => sum + Number(row.totalQuantity || 0), 0);
    const unitsAvailable = items.reduce((sum, row) => sum + Number(row.availableQuantity || 0), 0);
    const unitsIssued = Math.max(unitsTotal - unitsAvailable, 0);
    const attentionCount = items.filter((row) => getStockHealth(row).id !== 'healthy').length;

    return {
      totalParts,
      unitsAvailable,
      unitsIssued,
      attentionCount,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();

    const rows = items.filter((item) => {
      const matchesSearch =
        !normalized ||
        String(item.itemName || '').toLowerCase().includes(normalized) ||
        String(item.category || '').toLowerCase().includes(normalized) ||
        String(item.location || '').toLowerCase().includes(normalized);
      if (!matchesSearch) return false;

      if (stockFilter === 'all') return true;
      return getStockHealth(item).id === stockFilter;
    });

    return [...rows].sort((a, b) => {
      const healthRank = { critical: 0, low: 1, healthy: 2 };
      const aRank = healthRank[getStockHealth(a).id] ?? 3;
      const bRank = healthRank[getStockHealth(b).id] ?? 3;
      if (aRank !== bRank) return aRank - bRank;
      return String(a.itemName || '').localeCompare(String(b.itemName || ''));
    });
  }, [items, searchTerm, stockFilter]);

  const openIssue = (item) => {
    setSelectedItem(item);
    setIssueData({ quantity: 1, project: '' });
  };

  const openEdit = (itemId) => {
    setExpandedItemId(itemId);
    setEditingItemId(itemId);
    setAdjustMode('add');
    setAdjustQty(1);
  };

  const closeEdit = () => {
    setEditingItemId('');
    setAdjustQty(1);
  };

  const submitAdjust = async (itemId) => {
    setAdjusting(true);
    try {
      const payload = { itemId, mode: adjustMode, quantity: Number(adjustQty) };
      try {
        await adjustInventoryStock(payload);
      } catch {
        await adjustInventoryStockById(itemId, {
          mode: adjustMode,
          quantity: Number(adjustQty),
        });
      }
      await loadData();
      closeEdit();
      dispatchToast('Stock updated successfully.', 'success');
    } catch (err) {
      const status = err.response?.status;
      const message =
        err.response?.data?.message ||
        (status === 404
          ? 'Adjust API not found. Restart backend and try again.'
          : `Failed to adjust stock${status ? ` (HTTP ${status})` : ''}`);
      dispatchToast(message, 'error');
    } finally {
      setAdjusting(false);
    }
  };

  const handleIssueSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;

    setIsIssuing(true);
    try {
      await issueInventoryItem({
        itemId: selectedItem._id,
        quantity: Number(issueData.quantity),
        project: issueData.project,
      });
      setSelectedItem(null);
      setIssueData({ quantity: 1, project: '' });
      await loadData();
      dispatchToast('Inventory issued successfully.', 'success');
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Failed to issue item.', 'error');
    } finally {
      setIsIssuing(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-blue-500" size={42} />
        <p className="text-gray-400 text-xs uppercase tracking-[0.2em] font-semibold">Loading inventory</p>
      </div>
    );
  }

  return (
    <div className="ui-page space-y-8 pb-20 page-motion-a">
      <header className="section-motion section-motion-delay-1">
        <PageHeader
          eyebrow="Inventory Operations"
          title="Lab Inventory"
          subtitle="Operational stock board for parts, issue records, and adjustment history."
          icon={Database}
          actions={
            isAdmin ? (
              <Link to="/inventory/add" className="btn btn-primary">
                <Plus size={14} /> Add Part
              </Link>
            ) : null
          }
        />
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 section-motion section-motion-delay-2">
        <Metric label="Parts" value={metrics.totalParts} hint="Tracked components" />
        <Metric label="Available" value={metrics.unitsAvailable} hint="Units ready to issue" tone="emerald" />
        <Metric label="Issued" value={metrics.unitsIssued} hint="Units in circulation" tone="blue" />
        <Metric label="Needs Attention" value={metrics.attentionCount} hint="Low or critical stock" tone="amber" />
      </section>

      <section className="section-motion section-motion-delay-2">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search name, category, location"
              className="ui-input pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {STOCK_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setStockFilter(filter.id)}
                className={`btn !w-auto !px-3 !py-2 ${
                  stockFilter === filter.id ? 'btn-primary' : 'btn-ghost'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="section-motion section-motion-delay-3">
        {filteredItems.length === 0 ? (
          <DataEmpty
            label="No inventory rows match the current filters."
            actionLabel="Clear filters"
            onAction={() => {
              setSearchTerm('');
              setStockFilter('all');
            }}
          />
        ) : (
          <div className="border border-gray-800/80 rounded-2xl overflow-hidden">
            <div className="hidden lg:grid grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1.2fr)_auto] gap-4 px-4 py-3 ui-table-head border-b border-gray-800/80">
              <p>Component</p>
              <p>Stock</p>
              <p>Context</p>
              <p className="text-right">Actions</p>
            </div>

            <div className="divide-y divide-gray-800/70">
              {filteredItems.map((item, idx) => {
                const health = getStockHealth(item);
                const available = Math.max(Number(item.availableQuantity || 0), 0);
                const total = Math.max(Number(item.totalQuantity || 0), 0);
                const issued = Math.max(total - available, 0);
                const ratio = total > 0 ? Math.min((available / total) * 100, 100) : 0;
                const history = Array.isArray(item.issuedTo) ? [...item.issuedTo].reverse() : [];
                const isExpanded = expandedItemId === item._id;
                const isEditing = editingItemId === item._id;

                return (
                  <motion.article
                    key={item._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.025 }}
                    className="px-4 py-4"
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1.2fr)_auto] gap-4">
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-white truncate">{item.itemName}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span className="text-[11px] px-2 py-0.5 rounded-full border border-gray-700/80 text-gray-300">
                            {item.category || 'General'}
                          </span>
                          <span className={`text-[11px] px-2 py-0.5 rounded-full border ${health.className}`}>
                            {health.label}
                          </span>
                          <span className="text-[11px] text-gray-500 inline-flex items-center gap-1">
                            <MapPin size={12} /> {item.location || 'Lab'}
                          </span>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-sm">
                          <p className="text-gray-300 inline-flex items-center gap-1">
                            <Box size={13} className="text-blue-300" />
                            {available} / {total}
                          </p>
                          <p className="text-xs text-gray-500">{Math.round(ratio)}%</p>
                        </div>
                        <div className="mt-2 h-2 bg-white/5 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${ratio}%` }}
                            transition={{ duration: 0.65, ease: 'easeOut' }}
                            className={
                              health.id === 'critical'
                                ? 'h-full bg-gradient-to-r from-rose-500 to-red-400'
                                : health.id === 'low'
                                ? 'h-full bg-gradient-to-r from-amber-500 to-orange-400'
                                : 'h-full bg-gradient-to-r from-emerald-500 to-cyan-400'
                            }
                          />
                        </div>
                      </div>

                      <div className="text-sm text-gray-400">
                        <p className="inline-flex items-center gap-1.5">
                          <ArrowUp size={13} className="text-emerald-300" /> Available: {available}
                        </p>
                        <p className="mt-1 inline-flex items-center gap-1.5">
                          <ArrowDown size={13} className="text-amber-300" /> Issued: {issued}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">{history.length} issue records</p>
                      </div>

                      <div className="flex flex-wrap lg:justify-end items-start gap-2">
                        <button
                          type="button"
                          onClick={() => openIssue(item)}
                          disabled={available === 0}
                          className={`btn !w-auto !px-3 !py-2 ${available > 0 ? 'btn-secondary' : 'btn-ghost !opacity-45'}`}
                        >
                          Issue
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => openEdit(item._id)}
                            className="btn btn-ghost !w-auto !px-3 !py-2"
                            title="Adjust stock"
                          >
                            <Pencil size={13} /> Adjust
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedItemId((prev) => (prev === item._id ? '' : item._id))
                          }
                          className="btn btn-ghost !w-auto !px-2.5 !py-2"
                          title="Toggle details"
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 8 }}
                          className="mt-4 border-t border-gray-800/80 pt-4"
                        >
                          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)] gap-5">
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.14em] text-gray-500 font-semibold">
                                Recent issuance log
                              </p>
                              <div className="mt-2 divide-y divide-gray-800/60 border border-gray-800/70 rounded-xl overflow-hidden">
                                {history.length === 0 ? (
                                  <p className="px-3 py-3 text-sm text-gray-500">No issue records yet.</p>
                                ) : (
                                  history.slice(0, 7).map((entry, historyIdx) => (
                                    <div
                                      key={`${entry.issueDate || historyIdx}-${historyIdx}`}
                                      className="px-3 py-2.5 text-sm"
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-gray-200 inline-flex items-center gap-1.5">
                                          <UserRound size={13} className="text-cyan-300" />
                                          {entry.user?.name || 'Member'}
                                          <span className="text-gray-500 text-xs">
                                            @{entry.user?.collegeId || 'N/A'}
                                          </span>
                                        </p>
                                        <span className="text-[11px] text-gray-500">
                                          {toDateLabel(entry.issueDate)}
                                        </span>
                                      </div>
                                      <p className="text-xs text-gray-400 mt-1">
                                        Qty {entry.quantity || 0} for project {entry.project || 'N/A'}
                                      </p>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>

                            {isAdmin && isEditing && (
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  submitAdjust(item._id);
                                }}
                                className="space-y-3 border border-gray-800/75 rounded-xl p-3"
                              >
                                <p className="text-[11px] uppercase tracking-[0.14em] text-gray-500 font-semibold">
                                  Stock adjustment
                                </p>

                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setAdjustMode('subtract')}
                                    className={`btn !w-auto !px-3 !py-2 ${
                                      adjustMode === 'subtract' ? 'btn-danger' : 'btn-ghost'
                                    }`}
                                  >
                                    <Minus size={12} /> Remove
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setAdjustMode('add')}
                                    className={`btn !w-auto !px-3 !py-2 ${
                                      adjustMode === 'add' ? 'btn-primary' : 'btn-ghost'
                                    }`}
                                  >
                                    <Plus size={12} /> Add
                                  </button>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setAdjustQty((q) => Math.max(1, Number(q) - 1))}
                                    className="btn btn-ghost !w-auto !px-2.5 !py-2"
                                  >
                                    <Minus size={12} />
                                  </button>
                                  <input
                                    type="number"
                                    min="1"
                                    value={adjustQty}
                                    onChange={(e) => setAdjustQty(Math.max(1, Number(e.target.value) || 1))}
                                    className="ui-input !text-center"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setAdjustQty((q) => Number(q) + 1)}
                                    className="btn btn-ghost !w-auto !px-2.5 !py-2"
                                  >
                                    <Plus size={12} />
                                  </button>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    type="submit"
                                    disabled={adjusting}
                                    className="btn btn-primary !w-auto !px-3 !py-2"
                                  >
                                    {adjusting ? <Loader2 size={14} className="animate-spin" /> : <Check size={13} />}
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={closeEdit}
                                    className="btn btn-ghost !w-auto !px-3 !py-2"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </form>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.article>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItem(null)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              className="relative w-full max-w-xl border border-gray-800/80 rounded-2xl bg-[#080c12] p-5 md:p-6"
            >
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="absolute right-3 top-3 btn btn-ghost !w-auto !px-2 !py-1.5"
              >
                <X size={14} />
              </button>

              <h3 className="text-xl font-semibold text-white">Issue {selectedItem.itemName}</h3>
              <p className="text-xs text-gray-500 mt-1">Available quantity: {selectedItem.availableQuantity}</p>

              <form onSubmit={handleIssueSubmit} className="mt-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="ui-field">
                    <label className="ui-label">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      max={Math.max(Number(selectedItem.availableQuantity || 1), 1)}
                      required
                      value={issueData.quantity}
                      onChange={(e) =>
                        setIssueData((prev) => ({
                          ...prev,
                          quantity: Math.max(
                            1,
                            Math.min(Number(e.target.value) || 1, Number(selectedItem.availableQuantity || 1))
                          ),
                        }))
                      }
                      className="ui-input"
                    />
                  </div>

                  <div className="ui-field">
                    <label className="ui-label">Project</label>
                    <input
                      type="text"
                      required
                      value={issueData.project}
                      onChange={(e) =>
                        setIssueData((prev) => ({ ...prev, project: e.target.value }))
                      }
                      placeholder="Project name / ID"
                      className="ui-input"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 inline-flex items-start gap-2">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  Ensure issued items are tracked and returned after work completion.
                </div>

                <button disabled={isIssuing} className="btn btn-primary w-full">
                  {isIssuing ? <Loader2 size={15} className="animate-spin" /> : <AlertCircle size={14} />}
                  Confirm Issue
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Metric({ label, value, hint, tone = 'slate' }) {
  const toneClass =
    tone === 'emerald'
      ? 'border-emerald-500/30'
      : tone === 'blue'
      ? 'border-blue-500/30'
      : tone === 'amber'
      ? 'border-amber-500/30'
      : 'border-gray-700/70';

  return (
    <article className={`px-3 py-3 border-y ${toneClass}`}>
      <p className="text-[11px] uppercase tracking-[0.14em] text-gray-500 font-semibold">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{hint}</p>
    </article>
  );
}
