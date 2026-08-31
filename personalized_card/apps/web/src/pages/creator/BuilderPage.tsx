import { useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import type { BlockType, ContentBlock, ExperienceSection } from '@letter/types';
import {
  keys,
  useApplyPreset,
  useCreateBlock,
  useCreateSection,
  useDeleteBlock,
  useDeleteSection,
  useReorderBlocks,
  useReorderSections,
  useSections,
  useUpdateBlock,
  useUpdateSection,
} from '../../hooks/useExperience';
import { Button, EmptyState, ErrorState, Spinner, useToast } from '../../ui';
import { useExperienceContext } from './ExperienceLayout';
import { SectionCard } from './builder/SectionCard';
import { defaultBlockContent } from './builder/blocks';
import styles from './builder/builder.module.css';
import pageStyles from './creator.module.css';

export default function BuilderPage() {
  const experience = useExperienceContext();
  const experienceId = experience.id;
  const queryClient = useQueryClient();
  const { notify, notifyError } = useToast();

  const { data, isPending, isError, error, refetch } = useSections(experienceId);

  const createSection = useCreateSection(experienceId);
  const updateSection = useUpdateSection(experienceId);
  const deleteSection = useDeleteSection(experienceId);
  const reorderSections = useReorderSections(experienceId);
  const createBlock = useCreateBlock(experienceId);
  const updateBlock = useUpdateBlock(experienceId);
  const deleteBlock = useDeleteBlock(experienceId);
  const reorderBlocks = useReorderBlocks(experienceId);
  const applyPreset = useApplyPreset(experienceId);

  const [presetPending, setPresetPending] = useState<string | null>(null);

  const sensors = useSensors(
    // A small threshold so a click on a button inside a card is still a click.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sections = data ?? [];

  function writeSections(next: ExperienceSection[]) {
    queryClient.setQueryData<ExperienceSection[]>(keys.sections(experienceId), next);
  }

  function moveSection(from: number, to: number) {
    if (to < 0 || to >= sections.length) return;
    const next = arrayMove(sections, from, to);
    writeSections(next);
    reorderSections.mutate(
      next.map((section) => section.id),
      { onError: notifyError },
    );
  }

  function moveBlock(sectionId: string, from: number, to: number) {
    const section = sections.find((item) => item.id === sectionId);
    if (!section) return;
    const blocks = section.blocks ?? [];
    if (to < 0 || to >= blocks.length) return;

    const reordered = arrayMove(blocks, from, to);
    writeSections(
      sections.map((item) => (item.id === sectionId ? { ...item, blocks: reordered } : item)),
    );
    reorderBlocks.mutate(
      { sectionId, ids: reordered.map((block) => block.id) },
      { onError: notifyError },
    );
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const kind = active.data.current?.type;

    if (kind === 'section') {
      const from = sections.findIndex((section) => section.id === active.id);
      const to = sections.findIndex((section) => section.id === over.id);
      if (from === -1 || to === -1) return;
      moveSection(from, to);
      return;
    }

    if (kind === 'block') {
      const sectionId = active.data.current?.sectionId as string | undefined;
      // Blocks stay in the chapter they were written for; moving one between
      // chapters would need a second write the API does not offer.
      if (!sectionId || over.data.current?.sectionId !== sectionId) return;
      const section = sections.find((item) => item.id === sectionId);
      if (!section) return;
      const blocks = section.blocks ?? [];
      const from = blocks.findIndex((block) => block.id === active.id);
      const to = blocks.findIndex((block) => block.id === over.id);
      if (from === -1 || to === -1) return;
      moveBlock(sectionId, from, to);
    }
  }

  function addSection() {
    createSection.mutate(`Chapter ${sections.length + 1}`, {
      onSuccess: () => notify('A new chapter is waiting for you.'),
      onError: notifyError,
    });
  }

  function addBlock(sectionId: string, type: BlockType) {
    createBlock.mutate(
      { sectionId, type, content: defaultBlockContent(type) },
      { onError: notifyError },
    );
  }

  function duplicateBlock(block: ContentBlock, content: Record<string, unknown>) {
    createBlock.mutate(
      { sectionId: block.sectionId, type: block.type, content, mediaId: block.mediaId },
      {
        onSuccess: () => notify('Copied, right underneath.'),
        onError: notifyError,
      },
    );
  }

  return (
    <div className={pageStyles.page}>
      <div className={pageStyles.pageHead}>
        <div>
          <h2 className={pageStyles.pageTitle}>Build the letter</h2>
          <p className={pageStyles.pageLead}>
            Chapters hold blocks, and blocks hold what you have to say. Everything saves itself as
            you write.
          </p>
        </div>
        <Button variant="primary" onClick={addSection} loading={createSection.isPending}>
          <Plus size={16} aria-hidden />
          Add a chapter
        </Button>
      </div>

      {isPending && <Spinner label="Loading the chapters" />}
      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && sections.length === 0 && (
        <EmptyState
          emoji="📖"
          title="A blank page"
          description="Start with one chapter. You can rename it, reorder it and take it back out later."
          action={
            <Button variant="primary" onClick={addSection} loading={createSection.isPending}>
              Add the first chapter
            </Button>
          }
        />
      )}

      {sections.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext
            items={sections.map((section) => section.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className={styles.sectionList}>
              {sections.map((section, index) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  experienceId={experienceId}
                  index={index}
                  total={sections.length}
                  presetPending={presetPending}
                  onMoveSection={moveSection}
                  onMoveBlock={moveBlock}
                  onRename={(target, title) =>
                    updateSection.mutate({ id: target.id, title }, { onError: notifyError })
                  }
                  onToggleSection={(target, enabled) =>
                    updateSection.mutate({ id: target.id, enabled }, { onError: notifyError })
                  }
                  onDeleteSection={(target) =>
                    deleteSection.mutate(target.id, {
                      onSuccess: () => notify(`"${target.title}" is gone.`),
                      onError: notifyError,
                    })
                  }
                  onAddBlock={addBlock}
                  onApplyPreset={(sectionId, slug) => {
                    setPresetPending(slug);
                    applyPreset.mutate(
                      { sectionId, slug },
                      {
                        onSuccess: () => notify('Added. The words are yours to change.'),
                        onError: notifyError,
                        onSettled: () => setPresetPending(null),
                      },
                    );
                  }}
                  onDuplicateBlock={duplicateBlock}
                  onDeleteBlock={(block) =>
                    deleteBlock.mutate(block.id, { onError: notifyError })
                  }
                  onToggleBlock={(block, enabled) =>
                    updateBlock.mutate({ id: block.id, enabled }, { onError: notifyError })
                  }
                  onBlockMediaChange={(block, mediaId) =>
                    updateBlock.mutate({ id: block.id, mediaId }, { onError: notifyError })
                  }
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
