import type { DividerBlockContent } from '@letter/types';
import { Field, Select } from '../../../../ui';
import type { EditorProps } from './types';
import styles from '../builder.module.css';

export default function DividerBlockEditor({
  content,
  onChange,
  onCommit,
}: EditorProps<DividerBlockContent>) {
  return (
    <div className={styles.editorStack}>
      <Field label="How the break looks" hint="A breath between two ideas.">
        {(props) => (
          <Select
            {...props}
            value={content.style ?? 'line'}
            onChange={(event) => {
              onChange({ ...content, style: event.target.value as DividerBlockContent['style'] });
              onCommit();
            }}
          >
            <option value="line">A thin line</option>
            <option value="dots">Three dots</option>
            <option value="hearts">Hearts</option>
            <option value="space">Nothing, just space</option>
          </Select>
        )}
      </Field>
    </div>
  );
}
