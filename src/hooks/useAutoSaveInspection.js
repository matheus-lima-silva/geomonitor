import { useCallback, useRef, useState } from 'react';
import { saveInspection } from '../services/inspectionService';

export function useAutoSaveInspection() {
  const [saving, setSaving] = useState(false);
  const queueRef = useRef(Promise.resolve());

  const ensureSaved = useCallback(async (inspection) => {
    queueRef.current = queueRef.current
      .catch(() => null)
      .then(async () => {
        setSaving(true);
        try {
          return await saveInspection(inspection);
        } finally {
          setSaving(false);
        }
      });

    return queueRef.current;
  }, []);

  return { saving, ensureSaved };
}
