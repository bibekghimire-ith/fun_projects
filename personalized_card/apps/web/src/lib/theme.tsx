import { useEffect, useId, useMemo, type CSSProperties, type ReactNode } from 'react';
import { themeToCssVars, type Theme, type ThemeTokens } from '@letter/types';

/**
 * Applies a theme as CSS custom properties on a wrapper element. Everything
 * downstream styles itself from those variables, so a theme change is a single
 * re-render with no per-component knowledge of colours.
 */
export function useThemeStyle(theme: ThemeTokens | Theme | null | undefined): CSSProperties {
  return useMemo(() => themeToCssVars(theme ?? null) as CSSProperties, [theme]);
}

/** True when the viewer has asked their OS to reduce motion. */
export function usePrefersReducedMotion(): boolean {
  return useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);
}

interface ThemeScopeProps {
  theme: ThemeTokens | Theme | null | undefined;
  children: ReactNode;
  className?: string;
  /** Renders as a full-height surface — used by the recipient experience. */
  fullHeight?: boolean;
}

/**
 * Scopes a theme (including any custom CSS) to its subtree. Custom CSS is
 * injected into a <style> element prefixed with a generated scope class, so a
 * creator's stylesheet can never escape their own experience.
 */
export function ThemeScope({ theme, children, className, fullHeight }: ThemeScopeProps) {
  const style = useThemeStyle(theme);
  const rawId = useId();
  const scopeClass = `theme-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const customCss = theme?.customCss?.trim();

  const scopedCss = useMemo(() => {
    if (!customCss) return null;
    return scopeCss(customCss, `.${scopeClass}`);
  }, [customCss, scopeClass]);

  useEffect(() => {
    if (!theme) return;
    // Keep the page background in step with the experience, so overscroll on
    // mobile shows the theme colour rather than white.
    const previous = document.body.style.backgroundColor;
    document.body.style.backgroundColor = theme.backgroundColor;
    return () => {
      document.body.style.backgroundColor = previous;
    };
  }, [theme]);

  return (
    <div
      className={[scopeClass, className].filter(Boolean).join(' ')}
      style={{
        ...style,
        background: theme?.backgroundGradient || 'var(--color-background)',
        color: 'var(--color-text)',
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--font-size-base)',
        minHeight: fullHeight ? '100vh' : undefined,
      }}
      data-animation={theme?.animationLevel ?? 'NORMAL'}
      data-transition={theme?.transitionStyle ?? 'FADE'}
    >
      {scopedCss && <style>{scopedCss}</style>}
      {children}
    </div>
  );
}

/**
 * Prefix every selector in a stylesheet with a scope. Deliberately simple: the
 * API already rejects @import, url() and </style>, so this only has to handle
 * plain rule blocks and at-rules with nested blocks (@media, @supports).
 */
export function scopeCss(css: string, scope: string): string {
  const out: string[] = [];
  let index = 0;

  while (index < css.length) {
    const braceIndex = css.indexOf('{', index);
    if (braceIndex === -1) break;

    const prelude = css.slice(index, braceIndex).trim();
    const blockEnd = matchingBrace(css, braceIndex);
    if (blockEnd === -1) break;
    const body = css.slice(braceIndex + 1, blockEnd);

    if (prelude.startsWith('@media') || prelude.startsWith('@supports')) {
      out.push(`${prelude}{${scopeCss(body, scope)}}`);
    } else if (prelude.startsWith('@')) {
      // @keyframes and friends: leave the body alone, it has no selectors.
      out.push(`${prelude}{${body}}`);
    } else {
      const selectors = prelude
        .split(',')
        .map((selector) => selector.trim())
        .filter(Boolean)
        .map((selector) => (selector === ':root' ? scope : `${scope} ${selector}`))
        .join(', ');
      out.push(`${selectors}{${body}}`);
    }

    index = blockEnd + 1;
  }

  return out.join('\n');
}

function matchingBrace(css: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}
