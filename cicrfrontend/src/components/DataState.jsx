import { Loader2, RotateCcw, SearchX } from 'lucide-react';

export function DataLoading({ label = 'Loading data...' }) {
  return (
    <div className="ui-empty py-10">
      <div className="space-y-4">
        <div className="inline-flex items-center gap-3">
          <div className="relative w-8 h-8">
            <span className="absolute inset-0 rounded-full border-2 border-blue-500/20 animate-ping" />
            <span className="absolute inset-0.5 rounded-full border-2 border-t-blue-400 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
          </div>
          <span className="text-xs text-gray-400 uppercase tracking-widest font-bold">{label}</span>
        </div>

        <div className="grid gap-2">
          <div className="ui-skeleton h-3 w-3/4" />
          <div className="ui-skeleton h-3 w-full" />
          <div className="ui-skeleton h-3 w-5/6" />
        </div>
      </div>
    </div>
  );
}

export function DataEmpty({
  title,
  hint,
  label,
  actionLabel,
  onAction,
}) {
  const displayTitle = title || label || 'No records found.';
  const displayHint = hint || 'Try adjusting filters, clearing search, or creating a new entry.';

  return (
    <div className="ui-empty py-12">
      <div className="inline-flex flex-col items-center gap-3">
        <SearchX size={28} className="text-gray-600" />
        <p className="text-sm text-gray-300 font-semibold">{displayTitle}</p>
        <p className="text-xs text-gray-500 max-w-md">{displayHint}</p>
        {actionLabel && onAction ? (
          <button type="button" onClick={onAction} className="btn btn-ghost mt-1">
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function DataError({ label = 'Something went wrong.', hint = 'Please retry. If the issue persists, refresh this page.', onRetry }) {
  return (
    <div className="ui-empty border-red-500/25 py-12">
      <div className="inline-flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/25 flex items-center justify-center">
          <RotateCcw size={18} className="text-red-400" />
        </div>
        <p className="text-sm text-red-300/80">{label}</p>
        <p className="text-xs text-red-200/70 max-w-md">{hint}</p>
        {onRetry ? (
          <button type="button" onClick={onRetry} className="btn btn-danger mt-1">
            <RotateCcw size={13} /> Retry
          </button>
        ) : null}
      </div>
    </div>
  );
}
