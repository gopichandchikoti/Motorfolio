import { useCallback, useEffect, useRef, useState } from 'react';
import { errorText, loadSnapshot, saveSnapshot } from './storage';

export function useStore<T>(initial: T, parse: (value: unknown) => T) {
  const [state, setState] = useState(initial);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const revision = useRef(0);
  const pending = useRef(false);
  useEffect(() => {
    let active = true;
    loadSnapshot()
      .then((snapshot) => {
        if (!active) return;
        if (snapshot) {
          setState(parse(snapshot.value));
          revision.current = snapshot.revision;
        }
        setReady(true);
      })
      .catch((cause) => {
        if (active) setError(errorText(cause));
      });
    return () => {
      active = false;
    };
  }, [parse]);
  const save = useCallback(
    async (next: T) => {
      if (!ready) throw new Error('Storage is not ready. Reload to retry.');
      if (pending.current) throw new Error('A save is in progress. Please try again.');
      pending.current = true;
      try {
        const validated = parse(next);
        revision.current = await saveSnapshot(validated, revision.current);
        setState(validated);
        setError('');
      } finally {
        pending.current = false;
      }
    },
    [parse, ready],
  );
  return { state, save, ready, error, setError };
}
