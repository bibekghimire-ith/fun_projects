import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
  type TouchEvent,
} from 'react';
import { countdownTo, type Countdown } from '../../lib/format';

/**
 * A countdown that ticks once a second. Returns null when there is nothing to
 * count down to, so a caller can render the "already here" state instead.
 */
export function useCountdown(target: string | null | undefined, active = true): Countdown | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!target || !active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [target, active]);

  if (!target) return null;
  const parsed = new Date(target);
  if (Number.isNaN(parsed.getTime())) return null;
  return countdownTo(parsed, new Date(now));
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Escape to close, Tab kept inside, focus moved in on open and handed back on
 * close, and the page behind held still. Attach the returned ref to the dialog.
 */
export function useDialog(active: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.offsetParent !== null,
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const timer = window.setTimeout(() => {
      const target = node?.querySelector<HTMLElement>(FOCUSABLE) ?? node;
      target?.focus();
    }, 0);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [active, onClose]);

  return ref;
}

/** Horizontal swipe, ignoring anything that is mostly a vertical scroll. */
export function useSwipe(onNext: () => void, onPrevious: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((event: TouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    start.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }, []);

  const onTouchEnd = useCallback(
    (event: TouchEvent<HTMLElement>) => {
      const from = start.current;
      start.current = null;
      const touch = event.changedTouches[0];
      if (!from || !touch) return;
      const dx = touch.clientX - from.x;
      const dy = touch.clientY - from.y;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      if (dx < 0) onNext();
      else onPrevious();
    },
    [onNext, onPrevious],
  );

  return { onTouchStart, onTouchEnd };
}

/** Stable `true` once the element has been in view at least once. */
export function useHasBeenSeen(ref: RefObject<Element>, enabled = true): boolean {
  const [seen, setSeen] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      setSeen(true);
      return;
    }
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold: 0, rootMargin: '0px 0px -12% 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, enabled]);

  return seen;
}
