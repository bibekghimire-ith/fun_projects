import type { VideoBlockContent } from '@letter/types';
import { MediaField } from '../../../../components/MediaPicker';
import { Field, Input, Switch } from '../../../../ui';
import type { EditorProps } from './types';
import styles from '../builder.module.css';

export default function VideoBlockEditor({
  content,
  onChange,
  onCommit,
  mediaId,
  onMediaChange,
  experienceId,
}: EditorProps<VideoBlockContent>) {
  return (
    <div className={styles.editorStack}>
      <MediaField
        label="Video"
        experienceId={experienceId}
        mediaId={mediaId}
        onChange={onMediaChange}
        filter="VIDEO"
      />

      <Field label="Caption" hint="Optional.">
        {(props) => (
          <Input
            {...props}
            value={content.caption ?? ''}
            onChange={(event) => onChange({ ...content, caption: event.target.value })}
            onBlur={onCommit}
          />
        )}
      </Field>

      <div className={styles.editorRow}>
        <Switch
          checked={content.autoplay ?? false}
          onChange={(checked) => {
            onChange({ ...content, autoplay: checked });
            onCommit();
          }}
          label="Start playing on its own"
          hint="Some phones will ignore this, and it always starts muted."
        />
        <Switch
          checked={content.loop ?? false}
          onChange={(checked) => {
            onChange({ ...content, loop: checked });
            onCommit();
          }}
          label="Play it on a loop"
        />
      </div>
    </div>
  );
}
