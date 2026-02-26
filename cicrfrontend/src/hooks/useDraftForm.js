import { useCallback, useEffect, useMemo, useState } from 'react';

const safeParse = (raw, fallback) => {
  try {
    const parsed = JSON.parse(String(raw || ''));
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const serialize = (value) => {
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
};

export default function useDraftForm({ storageKey, initialValues, autosaveMs = 550 }) {
  const [baselineSerialized, setBaselineSerialized] = useState(() => serialize(initialValues));
  const readInitial = () => {
    if (typeof window === 'undefined' || !storageKey) {
      return { values: initialValues, lastSavedAt: null };
    }
    const draft = safeParse(window.localStorage.getItem(storageKey), null);
    if (!draft || typeof draft !== 'object') {
      return { values: initialValues, lastSavedAt: null };
    }
    const draftValues = draft.values && typeof draft.values === 'object' ? draft.values : null;
    if (!draftValues) {
      return { values: initialValues, lastSavedAt: null };
    }
    return {
      values: { ...initialValues, ...draftValues },
      lastSavedAt: draft.updatedAt || null,
    };
  };

  const initial = readInitial();
  const [lastSavedAt, setLastSavedAt] = useState(initial.lastSavedAt);
  const [values, setValues] = useState(initial.values);

  const isDirty = useMemo(() => serialize(values) !== baselineSerialized, [baselineSerialized, values]);

  useEffect(() => {
    if (typeof window === 'undefined' || !storageKey) return undefined;
    const timer = window.setTimeout(() => {
      if (!isDirty) {
        window.localStorage.removeItem(storageKey);
        return;
      }

      const updatedAt = new Date().toISOString();
      window.localStorage.setItem(storageKey, JSON.stringify({ values, updatedAt }));
      setLastSavedAt(updatedAt);
    }, autosaveMs);

    return () => window.clearTimeout(timer);
  }, [autosaveMs, isDirty, storageKey, values]);

  const setBaseline = useCallback((nextValues) => {
    setBaselineSerialized(serialize(nextValues));
  }, []);

  const clearDraft = useCallback(() => {
    if (typeof window !== 'undefined' && storageKey) {
      window.localStorage.removeItem(storageKey);
    }
    setLastSavedAt(null);
  }, [storageKey]);

  const resetForm = useCallback(
    (nextValues = initialValues) => {
      setValues(nextValues);
      setBaseline(nextValues);
      clearDraft();
    },
    [clearDraft, initialValues, setBaseline]
  );

  return {
    values,
    setValues,
    isDirty,
    lastSavedAt,
    clearDraft,
    setBaseline,
    resetForm,
  };
}
