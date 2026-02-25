import { Loader2, RotateCcw } from 'lucide-react';

export function DataLoading({ label = 'Loading data...' }) {
  return (
    <div className="ui-empty">
      <div className="inline-flex items-center gap-2 text-sm text-gray-400">
        <Loader2 size={16} className="animate-spin" /> {label}
      </div>
    </div>
  );
}

export function DataEmpty({ label = 'No records found.', actionLabel, onAction }) {
  return (
    <div className="ui-empty">
      <p className="text-sm">{label}</p>
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction} className="btn btn-ghost mt-3">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function DataError({ label = 'Something went wrong.', onRetry }) {
  return (
    <div className="ui-empty border-red-500/35 text-red-200">
      <p className="text-sm">{label}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="btn btn-danger mt-3">
          <RotateCcw size={13} /> Retry
        </button>
      ) : null}
    </div>
  );
}
