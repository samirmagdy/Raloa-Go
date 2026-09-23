import { useState, useEffect, useRef, useCallback } from 'react';
import { isTypingInInput } from './useKeyboardShortcuts';

export type KeySequence = string | string[];

export interface KeySequenceItem {
  id: string;
  name: string;
  keys: string[];
}

export interface UseGlobalKeyboardListenerOptions {
  /**
   * Sequence(s) to listen for.
   * Can be:
   * - 'RALOA' or 'KONAMI' (preset shortcuts)
   * - A string of characters, e.g. "raloa" or "magic"
   * - An array of key names, e.g. ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']
   * - An array of sequence configs
   *
   * If omitted, defaults to listening for BOTH 'RALOA' and the 'Konami Code'.
   */
  sequence?: KeySequence | KeySequenceItem[];

  /**
   * Callback fired when a sequence is matched.
   */
  onTrigger?: (sequenceName: string) => void;

  /**
   * Whether to ignore keypresses when typing in input, textarea, select, or contenteditable.
   * Default: true
   */
  ignoreInInputs?: boolean;

  /**
   * Inactivity timeout in ms after which the typed key buffer is reset.
   * Default: 3000 ms
   */
  timeout?: number;

  /**
   * Whether the listener is active.
   * Default: true
   */
  enabled?: boolean;
}

export interface UseGlobalKeyboardListenerReturn {
  isTriggered: boolean;
  activeSequence: string | null;
  triggerCount: number;
  reset: () => void;
  trigger: (sequenceName?: string) => void;
}

// Canonical Konami code: ↑ ↑ ↓ ↓ ← → ← → B A
export const KONAMI_CODE_KEYS: string[] = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a'
];

export const RALOA_KEYS: string[] = ['r', 'a', 'l', 'o', 'a'];

/**
 * Standardize key representation for robust matching
 */
function normalizeKey(key: string): string {
  const lower = key.toLowerCase();

  // Normalize common directional key aliases
  if (key === 'ArrowUp' || lower === 'up') return 'ArrowUp';
  if (key === 'ArrowDown' || lower === 'down') return 'ArrowDown';
  if (key === 'ArrowLeft' || lower === 'left') return 'ArrowLeft';
  if (key === 'ArrowRight' || lower === 'right') return 'ArrowRight';

  // Letters and single numbers/punctuation normalized to lowercase
  if (key.length === 1) {
    return lower;
  }

  return key;
}

/**
 * Convert user-provided sequence definitions into normalized KeySequenceItems
 */
function parseSequences(
  sequenceConfig?: KeySequence | KeySequenceItem[]
): KeySequenceItem[] {
  if (!sequenceConfig) {
    // Default: both RALOA and Konami Code are monitored
    return [
      { id: 'raloa', name: 'RALOA', keys: RALOA_KEYS.map(normalizeKey) },
      { id: 'konami', name: 'Konami Code', keys: KONAMI_CODE_KEYS.map(normalizeKey) }
    ];
  }

  if (Array.isArray(sequenceConfig)) {
    // Check if it's an array of KeySequenceItem objects
    if (sequenceConfig.length > 0 && typeof sequenceConfig[0] === 'object' && 'keys' in sequenceConfig[0]) {
      return (sequenceConfig as KeySequenceItem[]).map((item) => ({
        ...item,
        keys: item.keys.map(normalizeKey)
      }));
    }

    // Check if it's an array of key strings: ['ArrowUp', 'ArrowUp', ...]
    return [
      {
        id: 'custom-sequence',
        name: 'Secret Sequence',
        keys: (sequenceConfig as string[]).map(normalizeKey)
      }
    ];
  }

  // String input, e.g. "raloa" or "konami"
  const upper = sequenceConfig.toUpperCase();
  if (upper === 'KONAMI' || upper === 'KONAMI_CODE') {
    return [{ id: 'konami', name: 'Konami Code', keys: KONAMI_CODE_KEYS.map(normalizeKey) }];
  }
  if (upper === 'RALOA') {
    return [{ id: 'raloa', name: 'RALOA', keys: RALOA_KEYS.map(normalizeKey) }];
  }

  // Generic string split into letters
  return [
    {
      id: sequenceConfig.toLowerCase(),
      name: sequenceConfig.toUpperCase(),
      keys: sequenceConfig.split('').map(normalizeKey)
    }
  ];
}

/**
 * Custom React hook that listens globally for a specific secret key sequence
 * (such as the Konami Code or 'RALOA') to trigger a celebratory Easter Egg.
 */
export function useGlobalKeyboardListener(
  options: UseGlobalKeyboardListenerOptions = {}
): UseGlobalKeyboardListenerReturn {
  const {
    sequence,
    onTrigger,
    ignoreInInputs = true,
    timeout = 3000,
    enabled = true
  } = options;

  const [isTriggered, setIsTriggered] = useState(false);
  const [activeSequence, setActiveSequence] = useState<string | null>(null);
  const [triggerCount, setTriggerCount] = useState(0);

  const bufferRef = useRef<string[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onTriggerRef = useRef(onTrigger);

  useEffect(() => {
    onTriggerRef.current = onTrigger;
  }, [onTrigger]);

  const reset = useCallback(() => {
    setIsTriggered(false);
    setActiveSequence(null);
    bufferRef.current = [];
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const trigger = useCallback((sequenceName: string = 'RALOA') => {
    setIsTriggered(true);
    setActiveSequence(sequenceName);
    setTriggerCount((prev) => prev + 1);
    if (onTriggerRef.current) {
      onTriggerRef.current(sequenceName);
    }
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const parsedSequences = parseSequences(sequence);
    const maxLen = Math.max(...parsedSequences.map((s) => s.keys.length), 12);

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if typing inside input, textarea, contenteditable unless explicitly disabled
      if (ignoreInInputs && isTypingInInput(event.target)) {
        return;
      }

      // Ignore modifier combinations like Ctrl+C or Cmd+R so browser shortcuts aren't intercepted
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const normalized = normalizeKey(event.key);

      // Append normalized key to rolling buffer
      bufferRef.current = [...bufferRef.current, normalized].slice(-maxLen);

      // Reset inactivity timer
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        bufferRef.current = [];
      }, timeout);

      // Check if buffer ends with any of the watched sequences
      for (const item of parsedSequences) {
        const seqLen = item.keys.length;
        if (bufferRef.current.length >= seqLen) {
          const tail = bufferRef.current.slice(-seqLen);
          const isMatch = tail.every((key, idx) => key === item.keys[idx]);

          if (isMatch) {
            // Clear buffer to prevent double triggers
            bufferRef.current = [];
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }

            // Prevent default arrow key scrolling if Konami code matched
            if (item.id === 'konami') {
              event.preventDefault();
            }

            setIsTriggered(true);
            setActiveSequence(item.name);
            setTriggerCount((prev) => prev + 1);

            if (onTriggerRef.current) {
              onTriggerRef.current(item.name);
            }
            break;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, sequence, ignoreInInputs, timeout]);

  return {
    isTriggered,
    activeSequence,
    triggerCount,
    reset,
    trigger
  };
}
