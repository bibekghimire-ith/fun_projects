import type { HeadingBlockContent } from '@letter/types';
import { Field, Input, Select } from '../../../../ui';
import type { EditorProps } from './types';
import styles from '../builder.module.css';

export default function HeadingBlockEditor({
  content,
  onChange,
  onCommit,
}: EditorProps<HeadingBlockContent>) {
  return (
    <div className={styles.editorStack}>
      <Field label="Heading" hint="Short is better. This is the line they will remember.">
        {(props) => (
          <Input
            {...props}
            value={content.text ?? ''}
            onChange={(event) => onChange({ ...content, text: event.target.value })}
            onBlur={onCommit}
            placeholder="The day we met"
          />
        )}
      </Field>

      <Field label="Eyebrow" hint="A quieter line above the heading. Optional.">
        {(props) => (
          <Input
            {...props}
            value={content.eyebrow ?? ''}
            onChange={(event) => onChange({ ...content, eyebrow: event.target.value })}
            onBlur={onCommit}
            placeholder="Chapter one"
          />
        )}
      </Field>

      <div className={styles.editorRow}>
        <Field label="Size">
          {(props) => (
            <Select
              {...props}
              value={String(content.level ?? 2)}
              onChange={(event) => {
                onChange({
                  ...content,
                  level: Number(event.target.value) as HeadingBlockContent['level'],
                });
                onCommit();
              }}
            >
              <option value="1">Large</option>
              <option value="2">Medium</option>
              <option value="3">Small</option>
            </Select>
          )}
        </Field>

        <Field label="Alignment">
          {(props) => (
            <Select
              {...props}
              value={content.align ?? 'left'}
              onChange={(event) => {
                onChange({ ...content, align: event.target.value as HeadingBlockContent['align'] });
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
    </div>
  );
}
