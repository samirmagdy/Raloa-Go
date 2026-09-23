import { useEffect, useRef } from 'react';

export interface ShortcutItem {
  key: string; // e.g. 'Escape', 't', 'l', '?', 'k'
  ctrlKey?: boolean;
  metaKey?: boolean;
  /**
   * If true, matches either Command (macOS) or Control (Windows/Linux) modifier key.
   */
  metaOrCtrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  /**
   * If true (default for non-Escape keys), shortcut won't fire while typing in
   * <input>, <textarea>, <select>, or contenteditable elements.
   */
  ignoreInInputs?: boolean;
  /**
   * Whether to call event.preventDefault() automatically. Default false.
   */
  preventDefault?: boolean;
  description?: string;
  handler: (event: KeyboardEvent) => void;
}

/**
 * Checks if the currently focused element is an interactive text input
 */
export function isTypingInInput(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input') {
    const inputType = (target as HTMLInputElement).type?.toLowerCase();
    // Don't count checkboxes, radios, buttons, or submit inputs as typing inputs
    const nonTypingTypes = ['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color'];
    return !nonTypingTypes.includes(inputType);
  }

  if (tagName === 'textarea' || tagName === 'select') {
    return true;
  }

  if (target.isContentEditable) {
    return true;
  }

  return false;
}

/**
 * Custom hook to handle global keyboard shortcuts with input element awareness
 * and automatic cleanup.
 *
 * @param shortcuts Array of shortcut definitions
 * @param enabled Optional boolean to toggle listener on/off (default true)
 */
export function useKeyboardShortcuts(
  shortcuts: ShortcutItem[],
  enabled: boolean = true
): void {
  // Keep latest reference to avoid re-binding listener on every render
  const shortcutsRef = useRef<ShortcutItem[]>(shortcuts);

  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInput = isTypingInInput(activeElement);

      for (const shortcut of shortcutsRef.current) {
        const matchesKey =
          shortcut.key.toLowerCase() === event.key.toLowerCase() ||
          shortcut.key === event.code;

        if (!matchesKey) continue;

        // Check modifier keys if specified
        if (shortcut.metaOrCtrlKey) {
          if (!event.metaKey && !event.ctrlKey) continue;
        } else {
          if (shortcut.ctrlKey !== undefined && shortcut.ctrlKey !== event.ctrlKey) continue;
          if (shortcut.metaKey !== undefined && shortcut.metaKey !== event.metaKey) continue;
        }
        if (shortcut.shiftKey !== undefined && shortcut.shiftKey !== event.shiftKey) continue;
        if (shortcut.altKey !== undefined && shortcut.altKey !== event.altKey) continue;

        // For Escape, default ignoreInInputs is false; for others, default is true
        const shouldIgnoreInInputs =
          shortcut.ignoreInInputs !== undefined
            ? shortcut.ignoreInInputs
            : shortcut.key.toLowerCase() !== 'escape';

        if (isInput && shouldIgnoreInInputs) {
          continue;
        }

        if (shortcut.preventDefault) {
          event.preventDefault();
        }

        shortcut.handler(event);
        break; // Match first matching shortcut
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled]);
}

/**
 * Convenience hook specifically for the Escape key, commonly used to dismiss modals or drawers.
 */
export function useEscapeKey(handler: () => void, enabled: boolean = true): void {
  useKeyboardShortcuts(
    [
      {
        key: 'Escape',
        ignoreInInputs: false,
        preventDefault: true,
        handler: () => handler()
      }
    ],
    enabled
  );
}
