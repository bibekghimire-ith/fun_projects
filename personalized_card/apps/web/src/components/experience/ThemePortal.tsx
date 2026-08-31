import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useThemeStyle } from '../../lib/theme';
import { useExperience } from './context';
import styles from './themePortal.module.css';

/**
 * An overlay rendered at the end of <body> so nothing above it can clip it or
 * trap it in a transformed ancestor — but still carrying the experience's own
 * theme variables, which a bare portal would leave behind.
 */
export function ThemePortal({ children }: { children: ReactNode }) {
  const { experience } = useExperience();
  const style = useThemeStyle(experience.theme);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={styles.layer}
      style={style}
      data-animation={experience.theme?.animationLevel ?? 'NORMAL'}
    >
      {children}
    </div>,
    document.body,
  );
}
