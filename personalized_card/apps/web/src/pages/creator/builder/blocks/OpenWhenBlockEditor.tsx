import { Link } from 'react-router-dom';
import type { OpenWhenBlockContent } from '@letter/types';
import { useOpenWhen } from '../../../../hooks/useExperience';
import { Field, Input, Switch } from '../../../../ui';
import type { EditorProps } from './types';
import styles from '../builder.module.css';

export default function OpenWhenBlockEditor({
  content,
  onChange,
  onCommit,
  experienceId,
}: EditorProps<OpenWhenBlockContent>) {
  const { data } = useOpenWhen(experienceId);
  const notes = data ?? [];
  const picking = Array.isArray(content.messageIds);
  const chosen = content.messageIds ?? [];

  function toggle(id: string) {
    const next = chosen.includes(id) ? chosen.filter((value) => value !== id) : [...chosen, id];
    onChange({ ...content, messageIds: next });
    onCommit();
  }

  return (
    <div className={styles.editorStack}>
      <Field label="Title" hint="Optional. Leave it empty to use your Wording page.">
        {(props) => (
          <Input
            {...props}
            value={content.title ?? ''}
            onChange={(event) => onChange({ ...content, title: event.target.value })}
            onBlur={onCommit}
            placeholder="Open when…"
          />
        )}
      </Field>

      <Switch
        checked={!picking}
        onChange={(checked) => {
          onChange({ ...content, messageIds: checked ? undefined : [] });
          onCommit();
        }}
        label="Show every sealed note"
        hint="Turn this off to show only some of them here."
      />

      {picking &&
        (notes.length === 0 ? (
          <p className={styles.editorNote}>
            You have not written any sealed notes yet.{' '}
            <Link to={`/experiences/${experienceId}/open-when`}>Write one</Link> and it will show up
            here.
          </p>
        ) : (
          <ul className={styles.checkList}>
            {notes.map((note) => (
              <li key={note.id}>
                <label className={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={chosen.includes(note.id)}
                    onChange={() => toggle(note.id)}
                  />
                  <span>
                    <span className={styles.checkTitle}>
                      {note.emoji ? `${note.emoji} ` : ''}
                      {note.label}
                    </span>
                    <span className={styles.checkMeta}>
                      {note.unlockType === 'IMMEDIATE'
                        ? 'Open from the start'
                        : note.unlockType === 'DATE_LOCKED'
                          ? 'Opens on a date'
                          : 'You unlock it yourself'}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
