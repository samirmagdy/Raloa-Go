import React, {
  useState,
  useRef,
  useEffect,
  useId,
  useCallback,
  ReactNode,
  ReactElement,
  cloneElement,
  isValidElement
} from 'react';

export interface TooltipProps {
  /** The primary label or content to show in the tooltip */
  content: ReactNode;
  /** Optional secondary detailed description providing deeper context */
  description?: ReactNode;
  /** Optional keyboard shortcut key (e.g. 'T', 'M', 'V', '?') */
  shortcut?: string;
  /** Preferred tooltip placement relative to the trigger element */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Horizontal alignment for top/bottom positions or vertical alignment for left/right */
  align?: 'center' | 'start' | 'end';
  /** Delay in milliseconds before showing the tooltip on hover (default 150ms) */
  delay?: number;
  /** Delay in milliseconds before hiding the tooltip after mouse leaves (default 100ms) */
  hideDelay?: number;
  /** If true, the tooltip is disabled and will not display */
  disabled?: boolean;
  /** Whether to render a directional pointer arrow (default true) */
  arrow?: boolean;
  /** Additional custom class names for the tooltip card */
  className?: string;
  /** The interactive trigger element (button, link, or container) */
  children: ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  description,
  shortcut,
  position = 'bottom',
  align = 'center',
  delay = 150,
  hideDelay = 100,
  disabled = false,
  arrow = true,
  className = '',
  children
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipId = useId();

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  const showTooltip = useCallback(() => {
    if (disabled || !content) return;
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    timeoutRef.current = setTimeout(() => {
      setIsMounted(true);
      // Small tick for CSS transition
      requestAnimationFrame(() => {
        setIsOpen(true);
      });
    }, delay);
  }, [disabled, content, delay]);

  const hideTooltip = useCallback((immediate: boolean = false) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (immediate) {
      setIsOpen(false);
      setIsMounted(false);
    } else {
      hideTimeoutRef.current = setTimeout(() => {
        setIsOpen(false);
        setTimeout(() => setIsMounted(false), 150);
      }, hideDelay);
    }
  }, [hideDelay]);

  // Handle Escape key to dismiss tooltip for WCAG 2.1 compliance (1.4.13)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.stopPropagation();
        hideTooltip(true);
      }
    },
    [isOpen, hideTooltip]
  );

  // Position and alignment classes
  const getPositionClasses = () => {
    switch (position) {
      case 'top':
        return `bottom-full mb-2 ${
          align === 'start'
            ? 'left-0'
            : align === 'end'
            ? 'right-0'
            : 'left-1/2 -translate-x-1/2'
        }`;
      case 'bottom':
        return `top-full mt-2 ${
          align === 'start'
            ? 'left-0'
            : align === 'end'
            ? 'right-0'
            : 'left-1/2 -translate-x-1/2'
        }`;
      case 'left':
        return `right-full mr-2 ${
          align === 'start'
            ? 'top-0'
            : align === 'end'
            ? 'bottom-0'
            : 'top-1/2 -translate-y-1/2'
        }`;
      case 'right':
        return `left-full ml-2 ${
          align === 'start'
            ? 'top-0'
            : align === 'end'
            ? 'bottom-0'
            : 'top-1/2 -translate-y-1/2'
        }`;
      default:
        return 'top-full mt-2 left-1/2 -translate-x-1/2';
    }
  };

  const getArrowClasses = () => {
    switch (position) {
      case 'top':
        return `-bottom-1 border-b border-r ${
          align === 'start'
            ? 'left-4'
            : align === 'end'
            ? 'right-4'
            : 'left-1/2 -translate-x-1/2'
        }`;
      case 'bottom':
        return `-top-1 border-t border-l ${
          align === 'start'
            ? 'left-4'
            : align === 'end'
            ? 'right-4'
            : 'left-1/2 -translate-x-1/2'
        }`;
      case 'left':
        return `-right-1 border-t border-r ${
          align === 'start'
            ? 'top-2.5'
            : align === 'end'
            ? 'bottom-2.5'
            : 'top-1/2 -translate-y-1/2'
        }`;
      case 'right':
        return `-left-1 border-b border-l ${
          align === 'start'
            ? 'top-2.5'
            : align === 'end'
            ? 'bottom-2.5'
            : 'top-1/2 -translate-y-1/2'
        }`;
      default:
        return '-top-1 border-t border-l left-1/2 -translate-x-1/2';
    }
  };

  const renderTrigger = () => {
    if (isValidElement(children)) {
      const child = children as ReactElement<any>;
      const existingAriaDescribedBy = child.props['aria-describedby'];
      const combinedAria = [existingAriaDescribedBy, isOpen ? tooltipId : null]
        .filter(Boolean)
        .join(' ');

      return cloneElement(child, {
        'aria-describedby': combinedAria || undefined,
        onMouseEnter: (e: React.MouseEvent) => {
          child.props.onMouseEnter?.(e);
          showTooltip();
        },
        onMouseLeave: (e: React.MouseEvent) => {
          child.props.onMouseLeave?.(e);
          hideTooltip();
        },
        onFocus: (e: React.FocusEvent) => {
          child.props.onFocus?.(e);
          showTooltip();
        },
        onBlur: (e: React.FocusEvent) => {
          child.props.onBlur?.(e);
          hideTooltip(true);
        },
        onKeyDown: (e: React.KeyboardEvent) => {
          child.props.onKeyDown?.(e);
          handleKeyDown(e);
        }
      });
    }

    return (
      <span
        tabIndex={0}
        aria-describedby={isOpen ? tooltipId : undefined}
        onMouseEnter={showTooltip}
        onMouseLeave={() => hideTooltip()}
        onFocus={showTooltip}
        onBlur={() => hideTooltip(true)}
        onKeyDown={handleKeyDown}
        className="inline-flex items-center"
      >
        {children}
      </span>
    );
  };

  return (
    <div
      className="relative inline-flex items-center justify-center"
      onMouseEnter={showTooltip}
      onMouseLeave={() => hideTooltip()}
    >
      {renderTrigger()}

      {/* Tooltip Content Popover */}
      {isMounted && (
        <div
          id={tooltipId}
          role="tooltip"
          aria-hidden={!isOpen}
          onMouseEnter={showTooltip}
          onMouseLeave={() => hideTooltip()}
          className={`absolute z-50 pointer-events-auto whitespace-normal select-none transition-all duration-150 ease-out ${getPositionClasses()} ${
            isOpen
              ? 'opacity-100 scale-100 translate-y-0'
              : 'opacity-0 scale-95 pointer-events-none'
          }`}
        >
          <div
            className={`flex flex-col gap-1 px-3 py-2 rounded-xl text-left rtl:text-right bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-900 shadow-xl shadow-slate-950/20 dark:shadow-slate-900/10 backdrop-blur-md border border-slate-700/60 dark:border-slate-300 min-w-[140px] max-w-xs ${className}`}
          >
            {/* Header: Title / Content + Shortcut Badge */}
            <div className="flex items-center justify-between gap-2.5">
              <span className="text-xs font-semibold leading-tight tracking-tight">
                {content}
              </span>
              {shortcut && (
                <kbd
                  aria-label={`Shortcut: ${shortcut}`}
                  className="px-1.5 py-0.5 rounded bg-slate-800 dark:bg-slate-100 border border-slate-700 dark:border-slate-300 text-[10px] font-mono font-bold text-indigo-400 dark:text-indigo-600 shadow-2xs shrink-0"
                >
                  {shortcut}
                </kbd>
              )}
            </div>

            {/* Optional Secondary Context Description */}
            {description && (
              <p className="text-[11px] text-slate-300 dark:text-slate-600 font-normal leading-normal">
                {description}
              </p>
            )}
          </div>

          {/* Micro Arrow Pointer */}
          {arrow && (
            <div
              aria-hidden="true"
              className={`absolute w-2 h-2 rotate-45 bg-slate-900 dark:bg-white border-slate-700/60 dark:border-slate-300 pointer-events-none ${getArrowClasses()}`}
            />
          )}
        </div>
      )}
    </div>
  );
};
