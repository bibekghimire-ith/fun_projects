import type { ImageBlockContent } from '@letter/types';
import { MediaField } from '../../../../components/MediaPicker';
import { Field, Input, Select, Switch } from '../../../../ui';
import type { EditorProps } from './types';
import styles from '../builder.module.css';

export default function ImageBlockEditor({
  content,
  onChange,
  onCommit,
  mediaId,
  onMediaChange,
  experienceId,
}: EditorProps<ImageBlockContent>) {
  return (
    <div className={styles.editorStack}>
      <MediaField
        label="Photo"
        experienceId={experienceId}
        mediaId={mediaId}
        onChange={onMediaChange}
        filter="IMAGE"
      />

      <Field label="Caption" hint="Optional. Shown under the photo.">
        {(props) => (
          <Input
            {...props}
            value={content.caption ?? ''}
            onChange={(event) => onChange({ ...content, caption: event.target.value })}
            onBlur={onCommit}
          />
        )}
      </Field>

      <Field
        label="Description for screen readers"
        hint="Describe what is in the photo, so someone who cannot see it still gets the moment."
      >
        {(props) => (
          <Input
            {...props}
            value={content.alt ?? ''}
            onChange={(event) => onChange({ ...content, alt: event.target.value })}
            onBlur={onCommit}
            placeholder="The two of us on the pier, squinting into the sun"
          />
        )}
      </Field>

      <div className={styles.editorRow}>
        <Field label="How it fills the frame">
          {(props) => (
            <Select
              {...props}
              value={content.fit ?? 'cover'}
              onChange={(event) => {
                onChange({ ...content, fit: event.target.value as ImageBlockContent['fit'] });
                onCommit();
              }}
            >
              <option value="cover">Fill the frame</option>
              <option value="contain">Show the whole photo</option>
            </Select>
          )}
        </Field>

        <Switch
          checked={content.rounded ?? true}
          onChange={(checked) => {
            onChange({ ...content, rounded: checked });
            onCommit();
          }}
          label="Soften the corners"
        />
      </div>
    </div>
  );
}
