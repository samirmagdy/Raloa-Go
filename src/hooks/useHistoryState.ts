import { useState, useCallback, useRef } from 'react';

export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export interface UseHistoryStateOptions<T> {
  maxHistory?: number;
  isEqual?: (a: T, b: T) => boolean;
}

export interface UseHistoryStateReturn<T> {
  state: T;
  set: (newPresentOrFn: T | ((prev: T) => T), options?: { overwrite?: boolean }) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  reset: (newPresent: T) => void;
  pastCount: number;
  futureCount: number;
  history: HistoryState<T>;
}

/**
 * Custom state history hook implementing an undo/redo stack.
 *
 * @param initialPresent The initial state value or initializer function.
 * @param options Configuration options including max history length.
 */
export function useHistoryState<T>(
  initialPresent: T | (() => T),
  options: UseHistoryStateOptions<T> = {}
): UseHistoryStateReturn<T> {
  const { maxHistory = 50, isEqual } = options;

  const [history, setHistory] = useState<HistoryState<T>>(() => {
    const present =
      typeof initialPresent === 'function'
        ? (initialPresent as () => T)()
        : initialPresent;
    return {
      past: [],
      present,
      future: []
    };
  });

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  // Reference to always have the latest history in callbacks without stale closures
  const historyRef = useRef(history);
  historyRef.current = history;

  const set = useCallback(
    (newPresentOrFn: T | ((prev: T) => T), setOptions?: { overwrite?: boolean }) => {
      setHistory((currentHistory) => {
        const nextPresent =
          typeof newPresentOrFn === 'function'
            ? (newPresentOrFn as (prev: T) => T)(currentHistory.present)
            : newPresentOrFn;

        const areEqual = isEqual
          ? isEqual(currentHistory.present, nextPresent)
          : currentHistory.present === nextPresent;

        if (areEqual) {
          return currentHistory;
        }

        if (setOptions?.overwrite) {
          return {
            ...currentHistory,
            present: nextPresent
          };
        }

        const newPast = [...currentHistory.past, currentHistory.present];
        if (newPast.length > maxHistory) {
          newPast.shift();
        }

        return {
          past: newPast,
          present: nextPresent,
          future: [] // Any new mutation resets the redo stack
        };
      });
    },
    [maxHistory, isEqual]
  );

  const undo = useCallback(() => {
    setHistory((currentHistory) => {
      if (currentHistory.past.length === 0) return currentHistory;

      const previous = currentHistory.past[currentHistory.past.length - 1];
      const newPast = currentHistory.past.slice(0, currentHistory.past.length - 1);

      return {
        past: newPast,
        present: previous,
        future: [currentHistory.present, ...currentHistory.future]
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((currentHistory) => {
      if (currentHistory.future.length === 0) return currentHistory;

      const next = currentHistory.future[0];
      const newFuture = currentHistory.future.slice(1);

      return {
        past: [...currentHistory.past, currentHistory.present],
        present: next,
        future: newFuture
      };
    });
  }, []);

  const reset = useCallback((newPresent: T) => {
    setHistory({
      past: [],
      present: newPresent,
      future: []
    });
  }, []);

  return {
    state: history.present,
    set,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
    pastCount: history.past.length,
    futureCount: history.future.length,
    history
  };
}

// Alias for flexibility
export const useHistory = useHistoryState;
export const useStateHistory = useHistoryState;
