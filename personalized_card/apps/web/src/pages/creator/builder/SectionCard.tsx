import { useState, type CSSProperties } from 'react';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ChevronDown, ChevronUp, GripVertical, Plus, Sparkles, Trash2 } from 'lucide-react';
import type { BlockType, ContentBlock, ExperienceSection } from '@letter/types';
import { Button, Card, ConfirmDialog, EmptyState, Input, Switch, cx } from '../../../ui';
import { AddBlockMenu } from './AddBlockMenu';
import { BlockCard } from './BlockCard';
import { PresetMenu } from './PresetMenu';
import styles from './builder.module.css';

export interface SectionCardProps {
  section: ExperienceSection;
  experienceId: string;
  index: number;
  total: number;
  presetPending: string | null;
  onMoveSection: (from: number, to: number) => void;
  onMoveBlock: (sectionId: string, from: number, to: number) => void;
  onRename: (section: ExperienceSection, title: string) => void;
  onToggleSection: (section: ExperienceSection, enabled: boolean) => void;
  onDeleteSection: (section: ExperienceSection) => void;
  onAddBlock: (sectionId: string, type: BlockType) => void;
  onApplyPreset: (sectionId: string, slug: string) => void;
  onDuplicateBlock: (block: ContentBlock, content: Record<string, unknown>) => void;
  onDeleteBlock: (block: ContentBlock) => void;
  onToggleBlock: (block: ContentBlock, enabled: boolean) => void;
  onBlockMediaChange: (block: ContentBlock, mediaId: string | null) => void;
}

export function SectionCard({
  section,
  experienceId,
  index,
  total,
  presetPending,
  onMoveSection,
  onMoveBlock,
  onRename,
  onToggleSection,
  onDeleteSection,
  onAddBlock,
  onApplyPreset,
  onDuplicateBlock,
  onDeleteBlock,
  onToggleBlock,
  onBlockMediaChange,
}: SectionCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    data: { type: 'section' },
  });

  const [title, setTitle] = useState(section.title);
  const [adding, setAdding] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const style: CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
  };

  const blocks = section.blocks ?? [];

  return (
    <li ref={setNodeRef} style={style} className={cx(isDragging && styles.dragging)}>
      <Card className={cx(styles.section, !section.enabled && styles.disabled)}>
        <div className={styles.sectionHead}>
          <button
            type="button"
            className={styles.handle}
            aria-label={`Reorder the chapter "${section.title}". Press space, then use the arrow keys.`}
            {...attributes}
            {...listeners}
          >
            <GripVertical size={16} aria-hidden />
          </button>

          <Input
            className={styles.sectionTitleInput}
            value={title}
            aria-label={`Chapter ${index + 1} title`}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => {
              const trimmed = title.trim();
              if (!trimmed) {
                setTitle(section.title);
                return;
              }
              if (trimmed !== section.title) onRename(section, trimmed);
            }}
          />

          <span className={styles.sectionActions}>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Move the chapter "${section.title}" up`}
              disabled={index === 0}
              onClick={() => onMoveSection(index, index - 1)}
            >
              <ChevronUp size={15} aria-hidden />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Move the chapter "${section.title}" down`}
              disabled={index === total - 1}
              onClick={() => onMoveSection(index, index + 1)}
            >
              <ChevronDown size={15} aria-hidden />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Delete the chapter "${section.title}"`}
              onClick={() => setConfirming(true)}
            >
              <Trash2 size={15} aria-hidden />
            </Button>
          </span>
        </div>

        <Switch
          checked={section.enabled}
          onChange={(checked) => onToggleSection(section, checked)}
          label="Include this chapter"
          hint="Off means they never see it, but nothing is lost."
        />

        {blocks.length === 0 ? (
          <EmptyState
            title="This chapter is empty"
            description="Add the first block — a heading, or just some words."
            action={
              <Button variant="primary" size="sm" onClick={() => setAdding(true)}>
                <Plus size={14} aria-hidden />
                Add a block
              </Button>
            }
          />
        ) : (
          <SortableContext
            items={blocks.map((block) => block.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className={styles.blockList}>
              {blocks.map((block, blockIndex) => (
                <BlockCard
                  key={block.id}
                  block={block}
                  experienceId={experienceId}
                  sectionId={section.id}
                  index={blockIndex}
                  total={blocks.length}
                  onMove={(from, to) => onMoveBlock(section.id, from, to)}
                  onDuplicate={onDuplicateBlock}
                  onDelete={onDeleteBlock}
                  onToggle={onToggleBlock}
                  onMediaChange={onBlockMediaChange}
                />
              ))}
            </ul>
          </SortableContext>
        )}

        <div className={styles.sectionFooter}>
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus size={14} aria-hidden />
            Add a block
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPresetOpen(true)}>
            <Sparkles size={14} aria-hidden />
            Add a ready-made piece
          </Button>
        </div>
      </Card>

      <AddBlockMenu
        open={adding}
        onClose={() => setAdding(false)}
        onPick={(type) => onAddBlock(section.id, type)}
      />

      <PresetMenu
        open={presetOpen}
        onClose={() => setPresetOpen(false)}
        pendingSlug={presetPending}
        onPick={(slug) => {
          onApplyPreset(section.id, slug);
          setPresetOpen(false);
        }}
      />

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => onDeleteSection(section)}
        title={`Delete "${section.title}"?`}
        description="Every block in this chapter goes with it. If you would rather keep the words for now, turn the chapter off instead."
        confirmLabel="Delete the chapter"
        destructive
      />
    </li>
  );
}
