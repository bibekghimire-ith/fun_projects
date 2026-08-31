import { describe, expect, it } from 'vitest';
import { scopeCss } from './theme';

describe('scopeCss', () => {
  it('prefixes a plain selector with the scope', () => {
    expect(scopeCss('.title { color: red; }', '.scope-abc')).toBe('.scope-abc .title{ color: red; }');
  });

  it('prefixes every selector in a comma-separated list', () => {
    expect(scopeCss('h1, h2 { margin: 0; }', '.scope-abc')).toBe(
      '.scope-abc h1, .scope-abc h2{ margin: 0; }',
    );
  });

  it('rewrites :root to the scope itself, not "scope :root"', () => {
    expect(scopeCss(':root { --x: 1; }', '.scope-abc')).toBe('.scope-abc{ --x: 1; }');
  });

  it('recurses into @media and @supports, scoping the selectors inside', () => {
    const input = '@media (max-width: 600px) { .title { color: blue; } }';
    expect(scopeCss(input, '.scope-abc')).toBe(
      '@media (max-width: 600px){.scope-abc .title{ color: blue; }}',
    );
  });

  it('leaves @keyframes bodies untouched — they have no selectors to scope', () => {
    const input = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
    expect(scopeCss(input, '.scope-abc')).toBe(
      '@keyframes spin{ from { transform: rotate(0deg); } to { transform: rotate(360deg); } }',
    );
  });

  it('handles multiple top-level rules in one stylesheet', () => {
    const input = '.a { color: red; } .b { color: blue; }';
    expect(scopeCss(input, '.scope-abc')).toBe('.scope-abc .a{ color: red; }\n.scope-abc .b{ color: blue; }');
  });

  it('returns an empty string for an empty stylesheet', () => {
    expect(scopeCss('', '.scope-abc')).toBe('');
  });
});
