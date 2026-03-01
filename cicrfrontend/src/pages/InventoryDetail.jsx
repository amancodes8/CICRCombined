import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  Cpu,
  Loader2,
  Package,
  UserRound,
} from 'lucide-react';
import { fetchInventory, issueInventoryItem } from '../api';
import FormField from '../components/FormField';
import PageHeader from '../components/PageHeader';
import { DataEmpty, DataError, DataLoading } from '../components/DataState';

const dispatchToast = (message, type = 'info') => {
  try {
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type } }));
  } catch {
    window.alert(message);
  }
};

const fmtDate = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString();
};

export default function InventoryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [issueData, setIssueData] = useState({ quantity: 1, project: '' });

  const getItemDetails = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await fetchInventory();
      const rows = Array.isArray(data) ? data : [];
      const found = rows.find((row) => String(row._id) === String(id));
      setItem(found || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load inventory item.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    getItemDetails();
  }, [getItemDetails]);

  const stock = useMemo(() => {
    const totalQuantity = Number(item?.totalQuantity ?? item?.quantity ?? 0);
    const availableQuantity = Number(item?.availableQuantity ?? item?.stock ?? 0);
    const inUse = Math.max(0, totalQuantity - availableQuantity);
    return { totalQuantity, availableQuantity, inUse };
  }, [item]);

  const canIssue = stock.availableQuantity > 0;

  const handleIssue = async (event) => {
    event.preventDefault();
    const quantity = Number(issueData.quantity || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      dispatchToast('Quantity must be greater than zero.', 'error');
      return;
    }
    if (quantity > stock.availableQuantity) {
      dispatchToast('Quantity exceeds available stock.', 'error');
      return;
    }

    setIssuing(true);
    try {
      await issueInventoryItem({
        itemId: id,
        quantity,
        project: String(issueData.project || '').trim(),
      });
      dispatchToast('Item issued successfully.', 'success');
      setIssueData({ quantity: 1, project: '' });
      await getItemDetails();
    } catch (err) {
      dispatchToast(err.response?.data?.message || 'Error issuing item.', 'error');
    } finally {
      setIssuing(false);
    }
  };

  if (loading) {
    return (
      <div className="ui-page pb-16 page-motion-c">
        <DataLoading label="Loading item details..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="ui-page pb-16 page-motion-c">
        <DataError label={error} onRetry={getItemDetails} />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="ui-page pb-16 page-motion-c">
        <DataEmpty
          title="Inventory item not found"
          hint="It may have been removed or your session is out of date."
          actionLabel="Back to inventory"
          onAction={() => navigate('/inventory')}
        />
      </div>
    );
  }

  return (
    <div className="ui-page space-y-6 pb-16 page-motion-c">
      <section className="section-motion section-motion-delay-1">
        <PageHeader
          eyebrow="Inventory"
          title={item.itemName || item.name || 'Component Detail'}
          subtitle={`${item.category || 'General'} • ${item.location || 'No location'}`}
          icon={Cpu}
          actions={
            <Link to="/inventory" className="btn btn-ghost">
              <ArrowLeft size={13} /> Back
            </Link>
          }
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,0.9fr)] gap-6 section-motion section-motion-delay-2">
        <article className="rounded-[1.5rem] border border-gray-800 p-5 md:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatTile label="Total" value={stock.totalQuantity} tone="white" />
            <StatTile label="Available" value={stock.availableQuantity} tone="emerald" />
            <StatTile label="In Use" value={stock.inUse} tone="blue" />
          </div>

          <div className="border border-gray-800 rounded-xl p-4 bg-[#0a0f17]/50">
            <p className="text-xs uppercase tracking-widest text-gray-500">Description</p>
            <p className="text-sm text-gray-300 mt-2">{item.description || 'No description available.'}</p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500 font-black mb-2 inline-flex items-center gap-1.5">
              <CalendarClock size={12} className="text-cyan-300" /> Issuance History
            </p>
            <div className="space-y-2 max-h-[24rem] overflow-auto pr-1">
              {Array.isArray(item.issuedTo) && item.issuedTo.length > 0 ? (
                item.issuedTo.map((log, idx) => (
                  <article key={`${log.user?._id || idx}-${log.issueDate || idx}`} className="rounded-lg border border-gray-800 px-3 py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white inline-flex items-center gap-2">
                        <UserRound size={12} className="text-blue-300" /> {log.user?.name || 'Member'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{log.project || 'General usage'} • Qty {log.quantity || 1}</p>
                    </div>
                    <p className="text-[11px] text-gray-500 text-right">{fmtDate(log.issueDate)}</p>
                  </article>
                ))
              ) : (
                <DataEmpty label="No issuance history available yet." />
              )}
            </div>
          </div>
        </article>

        <article className="rounded-[1.5rem] border border-gray-800 p-5 md:p-6 space-y-4 h-fit lg:sticky lg:top-24">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-gray-200 inline-flex items-center gap-1.5">
            <Package size={13} className="text-cyan-300" /> Issue Component
          </p>

          <form onSubmit={handleIssue} className="space-y-3">
            <FormField id="issue-qty" label="Quantity" required>
              <input
                id="issue-qty"
                type="number"
                min="1"
                max={Math.max(1, stock.availableQuantity)}
                value={issueData.quantity}
                onChange={(event) =>
                  setIssueData((prev) => ({ ...prev, quantity: Number(event.target.value || 1) }))
                }
                className="ui-input"
              />
            </FormField>

            <FormField id="issue-project" label="Project" optional hint="Add project context for traceability.">
              <input
                id="issue-project"
                type="text"
                placeholder="e.g., Drone Alpha"
                value={issueData.project}
                onChange={(event) => setIssueData((prev) => ({ ...prev, project: event.target.value }))}
                className="ui-input"
              />
            </FormField>

            <button type="submit" disabled={!canIssue || issuing} className="btn btn-primary w-full">
              {issuing ? <Loader2 size={13} className="animate-spin" /> : <CheckBadge />} 
              {canIssue ? 'Confirm Issuance' : 'Out of Stock'}
            </button>

            {!canIssue ? (
              <p className="text-xs text-amber-200">No stock available right now. Try again after a return/adjustment.</p>
            ) : null}
          </form>
        </article>
      </section>
    </div>
  );
}

function StatTile({ label, value, tone = 'white' }) {
  const toneClass =
    tone === 'emerald'
      ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
      : tone === 'blue'
      ? 'border-blue-500/35 bg-blue-500/10 text-blue-200'
      : 'border-gray-700 bg-gray-800/40 text-white';

  return (
    <article className={`rounded-xl border px-3 py-3 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-widest text-gray-400">{label}</p>
      <p className="text-xl font-black mt-1">{value}</p>
    </article>
  );
}

function CheckBadge() {
  return <span className="inline-flex items-center justify-center">✓</span>;
}
