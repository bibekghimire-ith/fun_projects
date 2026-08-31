import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Headphones, Image as ImageIcon, Upload, Video, X } from 'lucide-react';
import type { Media, MediaType } from '@letter/types';
import { useMedia, useMediaToken, useMediaUploader } from '../hooks/useExperience';
import { formatBytes, formatDuration } from '../lib/format';
import { withMediaToken } from '../lib/mediaUrl';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Modal,
  Select,
  Spinner,
  Stack,
  cx,
  useToast,
} from '../ui';
import styles from './MediaPicker.module.css';

const TYPE_LABELS: Record<MediaType, string> = {
  IMAGE: 'Photos',
  VIDEO: 'Video',
  AUDIO: 'Audio',
};

const ACCEPT: Record<MediaType, string> = {
  IMAGE: 'image/*',
  VIDEO: 'video/*',
  AUDIO: 'audio/*',
};

export function MediaIcon({ type, size = 20 }: { type: MediaType; size?: number }) {
  if (type === 'VIDEO') return <Video size={size} aria-hidden />;
  if (type === 'AUDIO') return <Headphones size={size} aria-hidden />;
  return <ImageIcon size={size} aria-hidden />;
}

/**
 * A thumbnail that degrades quietly on a genuine load error. A draft's media
 * needs the scoped media token appended (`token`) since an <img> cannot send
 * an Authorization header; a published letter's media needs no token at all.
 */
export function MediaThumbnail({
  media,
  token,
  className,
}: {
  media: Media;
  token?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = withMediaToken(media.thumbnailUrl ?? media.url, token);
  const showImage = media.type === 'IMAGE' && !failed;

  return (
    <span className={cx(styles.thumb, className)}>
      {showImage ? (
        <img
          className={styles.thumbImage}
          src={src}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className={styles.thumbFallback}>
          <MediaIcon type={media.type} size={22} />
        </span>
      )}
    </span>
  );
}

/* ── Upload surface ───────────────────────────────────────────────────────── */

export function MediaUploadArea({
  experienceId,
  filter,
  onUploaded,
}: {
  experienceId: string;
  filter?: MediaType;
  onUploaded?: (media: Media[]) => void;
}) {
  const { uploads, upload, dismissUpload } = useMediaUploader(experienceId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const added = await upload(Array.from(files));
    if (added.length > 0) onUploaded?.(added);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void handleFiles(event.dataTransfer.files);
  }

  return (
    <div className={styles.uploadWrap}>
      <div
        className={cx(styles.dropZone, dragging && styles.dropZoneActive)}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <Upload size={20} aria-hidden />
        <p className={styles.dropText}>Drop files here, or choose them from your computer.</p>
        <Button onClick={() => inputRef.current?.click()}>Choose files</Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={filter ? ACCEPT[filter] : undefined}
          className={styles.hiddenInput}
          onChange={(event) => {
            void handleFiles(event.target.files);
            // Reset so picking the same file twice still fires a change.
            event.target.value = '';
          }}
          aria-label="Add files"
        />
      </div>

      {uploads.length > 0 && (
        <ul className={styles.uploadList}>
          {uploads.map((item) => (
            <li key={item.id} className={styles.uploadItem}>
              <span className={styles.uploadName}>{item.name}</span>
              {item.error ? (
                <>
                  <span className={styles.uploadError}>{item.error}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Dismiss the error for ${item.name}`}
                    onClick={() => dismissUpload(item.id)}
                  >
                    <X size={14} aria-hidden />
                  </Button>
                </>
              ) : (
                <span className={styles.progressTrack}>
                  <span
                    className={styles.progressBar}
                    style={{ width: `${item.percent}%` }}
                    role="progressbar"
                    aria-valuenow={item.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Uploading ${item.name}`}
                  />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── The picker ───────────────────────────────────────────────────────────── */

export interface MediaPickerProps {
  open: boolean;
  onClose: () => void;
  experienceId: string;
  /** Restrict the library to one kind of file. */
  filter?: MediaType;
  multiple?: boolean;
  initialSelected?: string[];
  onConfirm: (media: Media[]) => void;
  title?: string;
}

export function MediaPicker({
  open,
  onClose,
  experienceId,
  filter,
  multiple = false,
  initialSelected = [],
  onConfirm,
  title,
}: MediaPickerProps) {
  const { data, isPending, isError, error, refetch } = useMedia(experienceId);
  const { data: mediaTokenData } = useMediaToken(experienceId);
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [typeFilter, setTypeFilter] = useState<MediaType | 'ALL'>(filter ?? 'ALL');

  // Re-seed each time the picker opens, so cancelling really does cancel. The
  // parent hands us a fresh array every render, so depend on its contents.
  const initialKey = initialSelected.join(',');
  useEffect(() => {
    if (!open) return;
    setSelected(initialKey ? initialKey.split(',') : []);
    setTypeFilter(filter ?? 'ALL');
  }, [open, filter, initialKey]);

  const items = useMemo(() => {
    const all = data ?? [];
    return typeFilter === 'ALL' ? all : all.filter((item) => item.type === typeFilter);
  }, [data, typeFilter]);

  function toggle(id: string) {
    setSelected((current) => {
      if (multiple) {
        return current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
      }
      return current.includes(id) ? [] : [id];
    });
  }

  function confirm() {
    const byId = new Map((data ?? []).map((item) => [item.id, item] as const));
    const chosen = selected.map((id) => byId.get(id)).filter((item): item is Media => Boolean(item));
    onConfirm(chosen);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={title ?? (multiple ? 'Choose some files' : 'Choose a file')}
      description={
        multiple ? 'Pick as many as you like. The order you pick them is the order they appear.' : undefined
      }
      footer={
        <div className={styles.footer}>
          <span className={styles.footerCount}>
            {selected.length === 0
              ? 'Nothing chosen yet'
              : `${selected.length} chosen`}
          </span>
          <span className={styles.footerActions}>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={confirm} disabled={selected.length === 0}>
              Use {multiple ? 'these' : 'this'}
            </Button>
          </span>
        </div>
      }
    >
      <Stack>
        <MediaUploadArea
          experienceId={experienceId}
          filter={filter}
          onUploaded={(added) => {
            // A file you just uploaded is almost certainly the one you wanted.
            setSelected((current) =>
              multiple ? [...current, ...added.map((item) => item.id)] : [added[0].id],
            );
          }}
        />

        {!filter && (
          <label className={styles.filterRow}>
            <span className={styles.filterLabel}>Show</span>
            <Select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as MediaType | 'ALL')}
            >
              <option value="ALL">Everything</option>
              <option value="IMAGE">{TYPE_LABELS.IMAGE}</option>
              <option value="VIDEO">{TYPE_LABELS.VIDEO}</option>
              <option value="AUDIO">{TYPE_LABELS.AUDIO}</option>
            </Select>
          </label>
        )}

        {isPending && <Spinner label="Loading your files" />}
        {isError && <ErrorState error={error} onRetry={() => void refetch()} />}

        {data && items.length === 0 && (
          <EmptyState
            emoji="🖼️"
            title="Nothing here yet"
            description="Add a photo, a clip or a voice note above and it will appear here."
          />
        )}

        {items.length > 0 && (
          <ul className={styles.grid}>
            {items.map((item) => {
              const isSelected = selected.includes(item.id);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={cx(styles.gridItem, isSelected && styles.gridItemSelected)}
                    aria-pressed={isSelected}
                    onClick={() => toggle(item.id)}
                  >
                    <MediaThumbnail media={item} token={mediaTokenData?.token} />
                    <span className={styles.gridName}>{item.originalName}</span>
                    <span className={styles.gridMeta}>
                      {formatBytes(item.size)}
                      {item.width && item.height ? ` · ${item.width}×${item.height}` : ''}
                      {item.duration ? ` · ${formatDuration(item.duration)}` : ''}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Stack>
    </Modal>
  );
}

/* ── A labelled "pick one file" control for forms ─────────────────────────── */

export function MediaField({
  label,
  hint,
  experienceId,
  mediaId,
  onChange,
  filter,
}: {
  label: string;
  hint?: string;
  experienceId: string;
  mediaId: string | null;
  onChange: (mediaId: string | null) => void;
  filter?: MediaType;
}) {
  const [open, setOpen] = useState(false);
  const { data } = useMedia(experienceId);
  const { data: mediaTokenData } = useMediaToken(experienceId);
  const { notify } = useToast();
  const current = (data ?? []).find((item) => item.id === mediaId) ?? null;

  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {hint && <span className={styles.fieldHint}>{hint}</span>}

      <Card className={styles.fieldCard}>
        {current ? (
          <>
            <MediaThumbnail media={current} token={mediaTokenData?.token} className={styles.fieldThumb} />
            <span className={styles.fieldName}>{current.originalName}</span>
          </>
        ) : (
          <>
            <span className={cx(styles.thumb, styles.fieldThumb)}>
              <span className={styles.thumbFallback}>
                <MediaIcon type={filter ?? 'IMAGE'} size={20} />
              </span>
            </span>
            <span className={styles.fieldEmpty}>
              {mediaId ? 'That file is no longer in the library.' : 'Nothing chosen yet.'}
            </span>
          </>
        )}

        <span className={styles.fieldActions}>
          <Button
            size="sm"
            onClick={() => setOpen(true)}
            aria-label={`${current ? 'Change' : 'Choose'} ${label.toLowerCase()}`}
          >
            {current ? 'Change' : 'Choose'}
          </Button>
          {mediaId && (
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Remove ${label.toLowerCase()}`}
              onClick={() => {
                onChange(null);
                notify(`${label} removed.`);
              }}
            >
              Remove
            </Button>
          )}
        </span>
      </Card>

      <MediaPicker
        open={open}
        onClose={() => setOpen(false)}
        experienceId={experienceId}
        filter={filter}
        initialSelected={mediaId ? [mediaId] : []}
        onConfirm={(chosen) => onChange(chosen[0]?.id ?? null)}
        title={label}
      />
    </div>
  );
}
