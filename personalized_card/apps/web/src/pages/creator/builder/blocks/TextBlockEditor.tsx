import { useRef } from 'react';
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { TextBlockContent } from '@letter/types';
import { Field, Select, cx } from '../../../../ui';
import type { EditorProps } from './types';
import styles from '../builder.module.css';

const MARKS = [
  { name: 'bold', label: 'Bold' },
  { name: 'italic', label: 'Italic' },
] as const;

export default function TextBlockEditor({
  content,
  onChange,
  onCommit,
}: EditorProps<TextBlockContent>) {
  // The editor is created once. These refs keep its callbacks pointed at the
  // current props without tearing it down and losing the cursor.
  const latest = useRef(content);
  latest.current = content;
  const emit = useRef(onChange);
  emit.current = onChange;
  const commit = useRef(onCommit);
  commit.current = onCommit;

  const editor = useEditor({
    extensions: [StarterKit],
    content: (content.doc as JSONContent | undefined) ?? content.text ?? '',
    editorProps: {
      attributes: {
        class: styles.prose,
        'aria-label': 'The words of this block',
      },
    },
    onUpdate: ({ editor: instance }) => {
      emit.current({
        ...latest.current,
        doc: instance.getJSON(),
        text: instance.getText(),
      });
    },
    onBlur: () => commit.current(),
  });

  return (
    <div className={styles.editorStack}>
      <div className={styles.toolbar} role="group" aria-label="Text formatting">
        {MARKS.map((mark) => (
          <button
            key={mark.name}
            type="button"
            className={cx(
              styles.toolbarButton,
              editor?.isActive(mark.name) && styles.toolbarButtonOn,
            )}
            aria-pressed={editor?.isActive(mark.name) ?? false}
            onClick={() => {
              if (!editor) return;
              if (mark.name === 'bold') editor.chain().focus().toggleBold().run();
              else editor.chain().focus().toggleItalic().run();
              commit.current();
            }}
          >
            {mark.label}
          </button>
        ))}
        <button
          type="button"
          className={cx(styles.toolbarButton, editor?.isActive('bulletList') && styles.toolbarButtonOn)}
          aria-pressed={editor?.isActive('bulletList') ?? false}
          onClick={() => {
            editor?.chain().focus().toggleBulletList().run();
            commit.current();
          }}
        >
          List
        </button>
        <button
          type="button"
          className={cx(styles.toolbarButton, editor?.isActive('blockquote') && styles.toolbarButtonOn)}
          aria-pressed={editor?.isActive('blockquote') ?? false}
          onClick={() => {
            editor?.chain().focus().toggleBlockquote().run();
            commit.current();
          }}
        >
          Quote
        </button>
      </div>

      <div className={styles.proseFrame}>
        <EditorContent editor={editor} />
      </div>

      <Field label="Alignment">
        {(props) => (
          <Select
            {...props}
            value={content.align ?? 'left'}
            onChange={(event) => {
              onChange({ ...content, align: event.target.value as TextBlockContent['align'] });
              onCommit();
            }}
          >
            <option value="left">Left</option>
            <option value="center">Centred</option>
            <option value="right">Right</option>
          </Select>
        )}
      </Field>
    </div>
  );
}
