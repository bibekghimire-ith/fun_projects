import { useState } from 'react';
import { X } from 'lucide-react';
import type { GalleryBlockContent } from '@letter/types';
import { MediaPicker, MediaThumbnail } from '../../../../components/MediaPicker';
import { useMedia } from '../../../../hooks/useExperience';
import { Button, Field, Input, Select } from '../../../../ui';
import type { EditorProps } from './types';
import styles from '../builder.module.css';

export default function GalleryBlockEditor({
  content,
  onChange,
  onCommit,
  experienceId,
}: EditorProps<GalleryBlockContent>) {
  const [open, setOpen] = useState(false);
  const { data } = useMedia(experienceId);
  const ids = content.mediaIds ?? [];
  const byId = new Map((data ?? []).map((item) => [item.id, item] as const));

  function setIds(next: string[]) {
    onChange({ ...content, mediaIds: next });
    onCommit();
  }

  return (
    <div className={styles.editorStack}>
      <div className={styles.galleryHead}>
        <span className={styles.editorLabel}>
          {ids.length === 0
            ? 'No photos in this gallery yet'
            : `${ids.length} ${ids.length === 1 ? 'photo' : 'photos'}`}
        </span>
        <Button size="sm" onClick={() => setOpen(true)}>
          {ids.length === 0 ? 'Choose photos' : 'Change the selection'}
        </Button>
      </div>

      {ids.length > 0 && (
        <ul className={styles.galleryGrid}>
          {ids.map((id, index) => {
            const media = byId.get(id);
            return (
              <li key={id} className={styles.galleryItem}>
                {media ? (
                  <MediaThumbnail media={media} />
                ) : (
                  <span className={styles.galleryMissing}>This photo is no longer here</span>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove photo ${index + 1} from the gallery`}
                  onClick={() => setIds(ids.filter((value) => value !== id))}
                >
                  <X size={14} aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <div className={styles.editorRow}>
        <Field label="Layout">
          {(props) => (
            <Select
              {...props}
              value={content.layout ?? 'grid'}
              onChange={(event) => {
                onChange({
                  ...content,
                  layout: event.target.value as GalleryBlockContent['layout'],
                });
                onCommit();
              }}
            >
              <option value="grid">An even grid</option>
              <option value="masonry">Staggered</option>
              <option value="carousel">One at a time</option>
            </Select>
          )}
        </Field>

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
      </div>

      <MediaPicker
        open={open}
        onClose={() => setOpen(false)}
        experienceId={experienceId}
        filter="IMAGE"
        multiple
        initialSelected={ids}
        onConfirm={(chosen) => setIds(chosen.map((item) => item.id))}
        title="Photos for this gallery"
      />
    </div>
  );
}
