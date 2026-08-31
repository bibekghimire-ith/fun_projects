import type { CountdownBlockContent } from '@letter/types';
import { fromLocalInputValue, toLocalInputValue } from '../../../../hooks/useExperience';
import { countdownTo } from '../../../../lib/format';
import { Field, Input } from '../../../../ui';
import type { EditorProps } from './types';
import styles from '../builder.module.css';

export default function CountdownBlockEditor({
  content,
  onChange,
  onCommit,
}: EditorProps<CountdownBlockContent>) {
  const target = content.targetDate ? countdownTo(content.targetDate) : null;

  return (
    <div className={styles.editorStack}>
      <Field label="Counting down to" hint="Your own time zone.">
        {(props) => (
          <Input
            {...props}
            type="datetime-local"
            value={toLocalInputValue(content.targetDate)}
            onChange={(event) => {
              const iso = fromLocalInputValue(event.target.value);
              if (iso) onChange({ ...content, targetDate: iso });
            }}
            onBlur={onCommit}
          />
        )}
      </Field>

      {target && (
        <p className={styles.editorNote}>
          {target.done
            ? 'That moment has already passed, so this will show its finished words straight away.'
            : `Right now that is ${target.days} days and ${target.hours} hours away.`}
        </p>
      )}

      <div className={styles.editorRow}>
        <Field label="Label" hint="Optional. Shown above the numbers.">
          {(props) => (
            <Input
              {...props}
              value={content.label ?? ''}
              onChange={(event) => onChange({ ...content, label: event.target.value })}
              onBlur={onCommit}
              placeholder="Until I see you"
            />
          )}
        </Field>

        <Field label="What it says once it gets there" hint="Optional.">
          {(props) => (
            <Input
              {...props}
              value={content.completedText ?? ''}
              onChange={(event) => onChange({ ...content, completedText: event.target.value })}
              onBlur={onCommit}
              placeholder="Today is the day"
            />
          )}
        </Field>
      </div>
    </div>
  );
}
