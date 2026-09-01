import { Link } from 'react-router-dom';
import type { TimelineBlockContent } from '@letter/types';
import { useMemories } from '../../../../hooks/useExperience';
import { formatDate } from '../../../../lib/format';
import { Field, Input, Select, Switch } from '../../../../ui';
import type { EditorProps } from './types';
import styles from '../builder.module.css';

export default function TimelineBlockEditor({
  content,
  onChange,
  onCommit,
  experienceId,
}: EditorProps<TimelineBlockContent>) {
  const { data } = useMemories(experienceId);
  const memories = data ?? [];
  const picking = Array.isArray(content.memoryIds);
  const chosen = content.memoryIds ?? [];

  function toggle(id: string) {
    const next = chosen.includes(id) ? chosen.filter((value) => value !== id) : [...chosen, id];
    onChange({ ...content, memoryIds: next });
    onCommit();
  }

  return (
    <div className={styles.editorStack}>
      <Field label="Title" hint="Optional. Leave it empty to use the wording from your Wording page.">
        {(props) => (
          <Input
            {...props}
            value={content.title ?? ''}
            onChange={(event) => onChange({ ...content, title: event.target.value })}
            onBlur={onCommit}
            placeholder="How we got here"
          />
        )}
      </Field>

      <Field label="Layout">
        {(props) => (
          <Select
            {...props}
            value={content.layout ?? 'vertical'}
            onChange={(event) => {
              onChange({ ...content, layout: event.target.value as TimelineBlockContent['layout'] });
              onCommit();
            }}
          >
            <option value="vertical">One after another</option>
            <option value="alternating">Left and right</option>
          </Select>
        )}
      </Field>

      <Switch
        checked={!picking}
        onChange={(checked) => {
          onChange({ ...content, memoryIds: checked ? undefined : [] });
          onCommit();
        }}
        label="Show every moment on the timeline"
        hint="Turn this off to pick just a few."
      />

      {picking &&
        (memories.length === 0 ? (
          <p className={styles.editorNote}>
            There are no moments yet. <Link to={`/experiences/${experienceId}/memories`}>Add
            some to the timeline</Link> and they will appear here.
          </p>
        ) : (
          <ul className={styles.checkList}>
            {memories.map((memory) => (
              <li key={memory.id}>
                <label className={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={chosen.includes(memory.id)}
                    onChange={() => toggle(memory.id)}
                  />
                  <span>
                    <span className={styles.checkTitle}>{memory.title}</span>
                    <span className={styles.checkMeta}>{formatDate(memory.date)}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
