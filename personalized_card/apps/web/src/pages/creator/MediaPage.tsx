import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Media, MediaType } from '@letter/types';
import { MediaThumbnail, MediaUploadArea } from '../../components/MediaPicker';
import { useDeleteMedia, useMedia } from '../../hooks/useExperience';
import { formatBytes, formatDate, formatDuration } from '../../lib/format';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  Select,
  Spinner,
  Stack,
  cx,
  useToast,
} from '../../ui';
import { useExperienceContext } from './ExperienceLayout';
import styles from './MediaPage.module.css';
import pageStyles from './creator.module.css';

export default function MediaPage() {
  const experience = useExperienceContext();
  const experienceId = experience.id;
  const { notify, notifyError } = useToast();

  const { data, isPending, isError, error, refetch } = useMedia(experienceId);
  const remove = useDeleteMedia(experienceId);

  const [filter, setFilter] = useState<MediaType | 'ALL'>('ALL');
  const [pendingDelete, setPendingDelete] = useState<Media | null>(null);

  const items = useMemo(() => {
    const all = data ?? [];
    return filter === 'ALL' ? all : all.filter((item) => item.type === filter);
  }, [data, filter]);

  return (
    <div className={pageStyles.page}>
      <div>
        <h2 className={pageStyles.pageTitle}>Photos, clips and voice notes</h2>
        <p className={pageStyles.pageLead}>
          Everything you upload here can be used anywhere in this letter — as the cover, inside a
          chapter, or beside a moment on the timeline.
        </p>
      </div>

      <Card>
        <Stack>
          <MediaUploadArea
            experienceId={experienceId}
            onUploaded={(added) =>
              notify(added.length === 1 ? 'Added to the library.' : `${added.length} files added.`)
            }
          />
          <p className={cx(pageStyles.muted, pageStyles.small)}>
            Photos, video and audio. If a file is too large or the wrong kind, it will say so right
            here rather than failing quietly.
          </p>
        </Stack>
      </Card>

      {isPending && <Spinner label="Loading your files" />}
      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && data.length === 0 && (
        <EmptyState
          emoji="🖼️"
          title="Nothing in the library yet"
          description="Add the photo you keep coming back to. Everything else can follow later."
        />
      )}

      {data && data.length > 0 && (
        <>
          <div className={styles.filterBar}>
            <Field label="Show">
              {(props) => (
                <Select
                  {...props}
                  value={filter}
                  onChange={(event) => setFilter(event.target.value as MediaType | 'ALL')}
                >
                  <option value="ALL">Everything ({data.length})</option>
                  <option value="IMAGE">Photos</option>
                  <option value="VIDEO">Video</option>
                  <option value="AUDIO">Audio</option>
                </Select>
              )}
            </Field>
          </div>

          {items.length === 0 ? (
            <EmptyState
              title="Nothing of that kind yet"
              description="Try another filter, or add a file above."
            />
          ) : (
            <ul className={styles.grid}>
              {items.map((item) => (
                <li key={item.id}>
                  <Card className={styles.tile}>
                    <MediaThumbnail media={item} />
                    <span className={styles.tileName} title={item.originalName}>
                      {item.originalName}
                    </span>
                    <span className={styles.tileMeta}>
                      {item.type === 'IMAGE' ? 'Photo' : item.type === 'VIDEO' ? 'Video' : 'Audio'} ·{' '}
                      {formatBytes(item.size)}
                      {item.width && item.height ? ` · ${item.width}×${item.height}` : ''}
                      {item.duration ? ` · ${formatDuration(item.duration)}` : ''}
                    </span>
                    <span className={styles.tileMeta}>Added {formatDate(item.createdAt)}</span>
                    <div className={styles.tileActions}>
                      {experience.coverMediaId === item.id && (
                        <span className={styles.usedFlag}>The cover</span>
                      )}
                      {experience.musicMediaId === item.id && (
                        <span className={styles.usedFlag}>The music</span>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Delete ${item.originalName}`}
                        onClick={() => setPendingDelete(item)}
                      >
                        <Trash2 size={14} aria-hidden />
                      </Button>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          remove.mutate(pendingDelete.id, {
            onSuccess: () => notify('Deleted.'),
            onError: notifyError,
          });
        }}
        title={pendingDelete ? `Delete ${pendingDelete.originalName}?` : 'Delete this file?'}
        description="Anywhere in the letter that used this file will be left empty. The file itself cannot be recovered."
        confirmLabel="Delete it"
        destructive
      />
    </div>
  );
}
