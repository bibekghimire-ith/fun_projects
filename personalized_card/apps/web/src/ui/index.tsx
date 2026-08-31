import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import type { ExperienceStatus } from '@letter/types';
import styles from './ui.module.css';

// ─── Button ───────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', block, loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cx(
        styles.button,
        styles[variant],
        size !== 'md' && styles[size],
        block && styles.block,
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className={styles.spinner} aria-hidden />}
      {children}
    </button>
  );
});

// ─── Form fields ──────────────────────────────────────────────────────────────

interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode;
}

/** Wires up label/hint/error ids so every control is described correctly. */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={styles.field}>
      {label && (
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
      )}
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {hint && (
        <span className={styles.hint} id={hintId}>
          {hint}
        </span>
      )}
      {error && (
        <span className={styles.error} id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cx(styles.input, className)} {...rest} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cx(styles.textarea, className)} {...rest} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select ref={ref} className={cx(styles.select, className)} {...rest}>
        {children}
      </select>
    );
  },
);

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, hint, disabled }: SwitchProps) {
  return (
    <label className={styles.switch}>
      <input
        className={styles.switchInput}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className={styles.switchTrack} aria-hidden>
        <span className={styles.switchThumb} />
      </span>
      <span>
        <span>{label}</span>
        {hint && (
          <>
            <br />
            <span className={styles.hint}>{hint}</span>
          </>
        )}
      </span>
    </label>
  );
}

interface ColorInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  'aria-describedby'?: string;
}

export function ColorInput({ value, onChange, ...rest }: ColorInputProps) {
  return (
    <span className={styles.colorInput}>
      <input
        type="color"
        className={styles.colorSwatch}
        value={normalizeHex(value)}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Colour picker"
      />
      <Input
        className={styles.colorText}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        {...rest}
      />
    </span>
  );
}

function normalizeHex(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000';
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export function Card({
  children,
  className,
  flush,
  ...rest
}: { children: ReactNode; className?: string; flush?: boolean } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx(styles.card, flush && styles.cardFlush, className)} {...rest}>
      {children}
    </div>
  );
}

export function Stack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(styles.stack, className)}>{children}</div>;
}

export function Row({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(styles.row, className)}>{children}</div>;
}

export function Spread({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(styles.spread, className)}>{children}</div>;
}

export function StatusBadge({ status }: { status: ExperienceStatus }) {
  const variant = {
    DRAFT: styles.badgeDraft,
    PUBLISHED: styles.badgePublished,
    UNPUBLISHED: styles.badgeUnpublished,
    REVOKED: styles.badgeRevoked,
  }[status];
  const label = { DRAFT: 'Draft', PUBLISHED: 'Live', UNPUBLISHED: 'Paused', REVOKED: 'Revoked' }[status];
  return <span className={cx(styles.badge, variant)}>{label}</span>;
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span className={styles.row}>
      <span className={styles.spinner} aria-hidden />
      <span className={styles.srOnly}>{label}</span>
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
  emoji,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  emoji?: string;
}) {
  return (
    <div className={styles.empty}>
      {emoji && <div style={{ fontSize: '1.8rem' }} aria-hidden>{emoji}</div>}
      <p className={styles.emptyTitle}>{title}</p>
      {description && <p style={{ margin: 0, maxWidth: '38ch' }}>{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return (
    <EmptyState
      emoji="⚠️"
      title="That didn't work"
      description={message}
      action={onRetry ? <Button onClick={onRetry}>Try again</Button> : undefined}
    />
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

export function Modal({ open, onClose, title, description, children, footer, wide }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') trapFocus(event, ref.current);
    };
    document.addEventListener('keydown', onKeyDown);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Move focus into the dialog so screen readers land in the right place.
    window.setTimeout(() => {
      const focusable = ref.current?.querySelector<HTMLElement>(FOCUSABLE);
      (focusable ?? ref.current)?.focus();
    }, 0);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={styles.modalBackdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={cx(styles.modal, wide && styles.modalWide)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle} id={titleId}>
              {title}
            </h2>
            {description && <p className={styles.modalDescription}>{description}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </div>
        {children}
        {footer && <div style={{ marginTop: 'var(--space-4)' }}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

function trapFocus(event: KeyboardEvent, container: HTMLElement | null) {
  if (!container) return;
  const items = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
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
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <Spread>
          <span />
          <Row>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              variant={destructive ? 'danger' : 'primary'}
              onClick={() => {
                onConfirm();
                onClose();
              }}
            >
              {confirmLabel}
            </Button>
          </Row>
        </Spread>
      }
    >
      <span />
    </Modal>
  );
}

// ─── Toasts ───────────────────────────────────────────────────────────────────

interface Toast {
  id: number;
  message: string;
  tone: 'default' | 'error';
}

interface ToastContextValue {
  notify: (message: string) => void;
  notifyError: (error: unknown) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message: string, tone: Toast['tone']) => {
      counter.current += 1;
      const id = counter.current;
      setToasts((current) => [...current, { id, message, tone }]);
      window.setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4000);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      notify: (message) => push(message, 'default'),
      notifyError: (error) =>
        push(error instanceof Error ? error.message : 'Something went wrong.', 'error'),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.toastViewport} role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={cx(styles.toast, toast.tone === 'error' && styles.toastError)}>
            <span style={{ flex: 1 }}>{toast.message}</span>
            <button
              type="button"
              className={styles.toastClose}
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  // A missing provider should never break a page — fall back to the console.
  return (
    context ?? {
      notify: (message: string) => console.info(message),
      notifyError: (error: unknown) => console.error(error),
    }
  );
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function cx(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}

export { styles as uiStyles };
