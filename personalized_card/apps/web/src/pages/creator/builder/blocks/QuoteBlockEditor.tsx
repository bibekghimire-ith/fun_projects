import type { QuoteBlockContent } from '@letter/types';
import { Field, Input, Textarea } from '../../../../ui';
import type { EditorProps } from './types';
import styles from '../builder.module.css';

export default function QuoteBlockEditor({
  content,
  onChange,
  onCommit,
}: EditorProps<QuoteBlockContent>) {
  return (
    <div className={styles.editorStack}>
      <Field label="The quote">
        {(props) => (
          <Textarea
            {...props}
            value={content.text ?? ''}
            onChange={(event) => onChange({ ...content, text: event.target.value })}
            onBlur={onCommit}
            rows={3}
            placeholder="Something one of you said that neither of you forgot."
          />
        )}
      </Field>

      <Field label="Who said it" hint="Optional.">
        {(props) => (
          <Input
            {...props}
            value={content.attribution ?? ''}
            onChange={(event) => onChange({ ...content, attribution: event.target.value })}
            onBlur={onCommit}
            placeholder="You, on a Tuesday"
          />
        )}
      </Field>
    </div>
  );
}
