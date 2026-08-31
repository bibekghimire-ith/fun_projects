import { useState, type CSSProperties } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { ChevronDown, ChevronUp, Copy, GripVertical, Trash2 } from 'lucide-react';
import { BLOCK_META, type ContentBlock } from '@letter/types';
import { Button, ConfirmDialog, Switch, cx } from '../../../ui';
import { BlockEditor, blockSummary } from './blocks';
import { useBlockAutosave } from './useBlockAutosave';
import styles from './builder.module.css';

const STATUS_TEXT = {
  idle: '',
  saving: 'Saving…',
  saved: 'Saved',
  invalid: 'Not saved yet — it still needs a little more',
} as const;

export function BlockCard({
  block,
  experienceId,
  sectionId,
  index,
  total,
  onMove,
  onDuplicate,
  onDelete,
  onToggle,
  onMediaChange,
}: {
  block: ContentBlock;
  experienceId: string;
  sectionId: string;
  index: number;
  total: number;
  onMove: (from: number, to: number) => void;
  onDuplicate: (block: ContentBlock, content: Record<string, unknown>) => void;
  onDelete: (block: ContentBlock) => void;
  onToggle: (block: ContentBlock, enabled: boolean) => void;
  onMediaChange: (block: ContentBlock, mediaId: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    data: { type: 'block', sectionId },
  });
  const { content, update, flush, status } = useBlockAutosave(experienceId, block);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const meta = BLOCK_META[block.type];
  const style: CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cx(styles.block, isDragging && styles.dragging, !block.enabled && styles.disabled)}
    >
      <div className={styles.blockHead}>
        <button
          type="button"
          className={styles.handle}
          aria-label={`Reorder the ${meta.label} block. Press space, then use the arrow keys.`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} aria-hidden />
        </button>

        <button
          type="button"
          className={styles.blockSummary}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          <span className={styles.blockEmoji} aria-hidden>
            {meta.emoji}
          </span>
          <span className={styles.blockLabel}>{meta.label}</span>
          <span className={styles.blockPreview}>{blockSummary(block.type, content)}</span>
          {open ? <ChevronUp size={15} aria-hidden /> : <ChevronDown size={15} aria-hidden />}
        </button>

        <span className={styles.blockStatus} aria-live="polite">
          {STATUS_TEXT[status]}
        </span>

        <span className={styles.blockActions}>
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Move the ${meta.label} block up`}
            disabled={index === 0}
            onClick={() => onMove(index, index - 1)}
          >
            <ChevronUp size={14} aria-hidden />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Move the ${meta.label} block down`}
            disabled={index === total - 1}
            onClick={() => onMove(index, index + 1)}
          >
            <ChevronDown size={14} aria-hidden />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Duplicate the ${meta.label} block`}
            onClick={() => onDuplicate(block, content)}
          >
            <Copy size={14} aria-hidden />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Delete the ${meta.label} block`}
            onClick={() => setConfirming(true)}
          >
            <Trash2 size={14} aria-hidden />
          </Button>
        </span>
      </div>

      {open && (
        <div className={styles.blockBody}>
          <BlockEditor
            type={block.type}
            content={content}
            onChange={update}
            onCommit={flush}
            mediaId={block.mediaId}
            onMediaChange={(mediaId) => onMediaChange(block, mediaId)}
            experienceId={experienceId}
          />

          <Switch
            checked={block.enabled}
            onChange={(checked) => onToggle(block, checked)}
            label="Include this block"
            hint="Turn it off to keep it here without showing it to them."
          />
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => onDelete(block)}
        title={`Delete this ${meta.label.toLowerCase()} block?`}
        description="What is written in it goes with it. If you only want to hide it for now, turn it off instead."
        confirmLabel="Delete it"
        destructive
      />
    </li>
  );
}
