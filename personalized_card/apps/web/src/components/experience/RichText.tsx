import { Fragment, type ReactNode } from 'react';
import styles from './richtext.module.css';
import { cx } from '../../ui';

/**
 * TipTap stores its documents as ProseMirror JSON. Rather than converting that
 * back to an HTML string and trusting it, the tree is walked here and rendered
 * as real React elements — a creator's writing can never become markup.
 */

interface PMMark {
  type?: unknown;
  attrs?: unknown;
}

interface PMNode {
  type?: unknown;
  text?: unknown;
  content?: unknown;
  marks?: unknown;
  attrs?: unknown;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNode(value: unknown): PMNode | null {
  return isObject(value) ? (value as PMNode) : null;
}

function typeOf(node: PMNode | PMMark): string {
  return typeof node.type === 'string' ? node.type : '';
}

function childrenOf(node: PMNode): PMNode[] {
  if (!Array.isArray(node.content)) return [];
  return node.content.map(asNode).filter((child): child is PMNode => child !== null);
}

function marksOf(node: PMNode): PMMark[] {
  if (!Array.isArray(node.marks)) return [];
  return node.marks.filter(isObject) as PMMark[];
}

function attr(node: PMNode | PMMark, key: string): unknown {
  return isObject(node.attrs) ? node.attrs[key] : undefined;
}

/** Only schemes that cannot execute anything. */
function safeHref(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return trimmed;
  return null;
}

function renderText(node: PMNode, key: number): ReactNode {
  let out: ReactNode = typeof node.text === 'string' ? node.text : '';
  if (out === '') return null;

  for (const mark of marksOf(node)) {
    switch (typeOf(mark)) {
      case 'bold':
      case 'strong':
        out = <strong>{out}</strong>;
        break;
      case 'italic':
      case 'em':
        out = <em>{out}</em>;
        break;
      case 'strike':
      case 'strikethrough':
        out = <s>{out}</s>;
        break;
      case 'underline':
        out = <u>{out}</u>;
        break;
      case 'code':
        out = <code className={styles.code}>{out}</code>;
        break;
      case 'link': {
        const href = safeHref(attr(mark, 'href'));
        if (href) {
          out = (
            <a className={styles.link} href={href} target="_blank" rel="noopener noreferrer">
              {out}
            </a>
          );
        }
        break;
      }
      default:
        break;
    }
  }

  return <Fragment key={key}>{out}</Fragment>;
}

function renderChildren(node: PMNode): ReactNode[] {
  return childrenOf(node)
    .map((child, index) => renderNode(child, index))
    .filter((child) => child !== null);
}

function headingTag(level: unknown): 'h2' | 'h3' | 'h4' {
  if (level === 1) return 'h2';
  if (level === 2) return 'h3';
  return 'h4';
}

function renderNode(node: PMNode, key: number): ReactNode {
  const type = typeOf(node);

  switch (type) {
    case 'text':
      return renderText(node, key);

    case 'paragraph': {
      const children = renderChildren(node);
      if (children.length === 0) return <p key={key} className={styles.spacer} aria-hidden />;
      return (
        <p key={key} className={styles.paragraph}>
          {children}
        </p>
      );
    }

    case 'heading': {
      const Tag = headingTag(attr(node, 'level'));
      return (
        <Tag key={key} className={styles.heading}>
          {renderChildren(node)}
        </Tag>
      );
    }

    case 'bulletList':
      return (
        <ul key={key} className={styles.list}>
          {renderChildren(node)}
        </ul>
      );

    case 'orderedList':
      return (
        <ol key={key} className={cx(styles.list, styles.ordered)}>
          {renderChildren(node)}
        </ol>
      );

    case 'listItem':
      return (
        <li key={key} className={styles.listItem}>
          {renderChildren(node)}
        </li>
      );

    case 'blockquote':
      return (
        <blockquote key={key} className={styles.quote}>
          {renderChildren(node)}
        </blockquote>
      );

    case 'codeBlock':
      return (
        <pre key={key} className={styles.pre}>
          <code>{renderChildren(node)}</code>
        </pre>
      );

    case 'hardBreak':
      return <br key={key} />;

    case 'horizontalRule':
      return <hr key={key} className={styles.rule} />;

    case 'image':
      // Images live in their own block type, where they get a real alt text.
      return null;

    default: {
      // An unknown wrapper should not swallow the words inside it.
      const children = renderChildren(node);
      if (children.length === 0) return null;
      return <Fragment key={key}>{children}</Fragment>;
    }
  }
}

function renderDoc(doc: unknown): ReactNode[] | null {
  const root = asNode(doc);
  if (!root) return null;
  const children = renderChildren(root);
  return children.length > 0 ? children : null;
}

/** Plain text, with blank lines becoming paragraph breaks. */
export function PlainText({ text, className }: { text: string | null | undefined; className?: string }) {
  if (!text || text.trim().length === 0) return null;
  const paragraphs = text.split(/\n{2,}/);
  return (
    <div className={cx(styles.prose, className)}>
      {paragraphs.map((paragraph, index) => (
        <p key={index} className={styles.paragraph}>
          {paragraph.split('\n').map((line, lineIndex, lines) => (
            <Fragment key={lineIndex}>
              {line}
              {lineIndex < lines.length - 1 && <br />}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}

interface RichTextProps {
  doc?: unknown;
  text?: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export function RichText({ doc, text, align, className }: RichTextProps) {
  const rendered = renderDoc(doc);
  const alignClass =
    align === 'center' ? styles.center : align === 'right' ? styles.right : undefined;

  if (rendered) {
    return <div className={cx(styles.prose, alignClass, className)}>{rendered}</div>;
  }

  return <PlainText text={text} className={cx(alignClass, className)} />;
}
