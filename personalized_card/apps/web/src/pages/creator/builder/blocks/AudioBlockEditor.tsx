import type { AudioBlockContent } from '@letter/types';
import { MediaField } from '../../../../components/MediaPicker';
import { Field, Input, Switch, Textarea } from '../../../../ui';
import type { EditorProps } from './types';
import styles from '../builder.module.css';

export default function AudioBlockEditor({
  content,
  onChange,
  onCommit,
  mediaId,
  onMediaChange,
  experienceId,
}: EditorProps<AudioBlockContent>) {
  return (
    <div className={styles.editorStack}>
      <MediaField
        label="Audio"
        hint="A song, or your own voice."
        experienceId={experienceId}
        mediaId={mediaId}
        onChange={onMediaChange}
        filter="AUDIO"
      />

      <Field label="Title" hint="Optional.">
        {(props) => (
          <Input
            {...props}
            value={content.title ?? ''}
            onChange={(event) => onChange({ ...content, title: event.target.value })}
            onBlur={onCommit}
            placeholder="Don't read this. Press play instead."
          />
        )}
      </Field>

      <Field label="A line about it" hint="Optional.">
        {(props) => (
          <Textarea
            {...props}
            rows={2}
            value={content.description ?? ''}
            onChange={(event) => onChange({ ...content, description: event.target.value })}
            onBlur={onCommit}
          />
        )}
      </Field>

      <Switch
        checked={content.isVoiceLetter ?? false}
        onChange={(checked) => {
          onChange({ ...content, isVoiceLetter: checked });
          onCommit();
        }}
        label="This is a voice letter"
        hint="Gives it a whole screen of its own instead of a small player in the text."
      />
    </div>
  );
}
