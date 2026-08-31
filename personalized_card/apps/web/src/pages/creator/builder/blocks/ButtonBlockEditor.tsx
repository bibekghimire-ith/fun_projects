import type { ButtonBlockContent } from '@letter/types';
import { Field, Input, Select } from '../../../../ui';
import type { EditorProps } from './types';
import styles from '../builder.module.css';

export default function ButtonBlockEditor({
  content,
  onChange,
  onCommit,
}: EditorProps<ButtonBlockContent>) {
  return (
    <div className={styles.editorStack}>
      <Field label="What the button says">
        {(props) => (
          <Input
            {...props}
            value={content.text ?? ''}
            onChange={(event) => onChange({ ...content, text: event.target.value })}
            onBlur={onCommit}
            placeholder="Look at this"
          />
        )}
      </Field>

      <Field label="Where it goes" hint="A full web address, starting with https://">
        {(props) => (
          <Input
            {...props}
            type="url"
            inputMode="url"
            value={content.url ?? ''}
            // An empty string is not a URL — drop the key instead, so a cleared
            // field saves rather than failing validation.
            onChange={(event) => onChange({ ...content, url: event.target.value || undefined })}
            onBlur={onCommit}
            placeholder="https://"
          />
        )}
      </Field>

      <Field label="How it looks">
        {(props) => (
          <Select
            {...props}
            value={content.style ?? 'primary'}
            onChange={(event) => {
              onChange({ ...content, style: event.target.value as ButtonBlockContent['style'] });
              onCommit();
            }}
          >
            <option value="primary">Solid</option>
            <option value="secondary">Outlined</option>
            <option value="ghost">Just the words</option>
          </Select>
        )}
      </Field>
    </div>
  );
}
