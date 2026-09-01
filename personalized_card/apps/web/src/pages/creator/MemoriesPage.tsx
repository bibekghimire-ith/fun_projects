import { useEffect, useState, type CSSProperties } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ChevronDown, ChevronUp, GripVertical, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Memory } from '@letter/types';
import { CreateMemorySchema, type CreateMemoryInput } from '@letter/validation';
import { MediaField, MediaThumbnail } from '../../components/MediaPicker';
import {
  fromLocalInputValue,
  keys,
  toDateInputValue,
  useCreateMemory,
  useDeleteMemory,
  useMemories,
  useReorderMemories,
  useUpdateMemory,
} from '../../hooks/useExperience';
import { formatDate } from '../../lib/format';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  Spinner,
  Stack,
  Textarea,
  cx,
  useToast,
} from '../../ui';
import { useExperienceContext } from './ExperienceLayout';
import styles from './MemoriesPage.module.css';
import pageStyles from './creator.module.css';

export default function MemoriesPage() {
  const experience = useExperienceContext();
  const experienceId = experience.id;
  const queryClient = useQueryClient();
  const { notify, notifyError } = useToast();

  const { data, isPending, isError, error, refetch } = useMemories(experienceId);
  const createMemory = useCreateMemory(experienceId);
  const updateMemory = useUpdateMemory(experienceId);
  const deleteMemory = useDeleteMemory(experienceId);
  const reorder = useReorderMemories(experienceId);

  const [editing, setEditing] = useState<Memory | null>(null);
  const [adding, setAdding] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Memory | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const memories = data ?? [];

  function move(from: number, to: number) {
    if (to < 0 || to >= memories.length) return;
    const next = arrayMove(memories, from, to);
    queryClient.setQueryData<Memory[]>(keys.memories(experienceId), next);
    reorder.mutate(
      next.map((memory) => memory.id),
      { onError: notifyError },
    );
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = memories.findIndex((memory) => memory.id === active.id);
    const to = memories.findIndex((memory) => memory.id === over.id);
    if (from === -1 || to === -1) return;
    move(from, to);
  }

  return (
    <div className={pageStyles.page}>
      <div className={pageStyles.pageHead}>
        <div>
          <h2 className={pageStyles.pageTitle}>The timeline</h2>
          <p className={pageStyles.pageLead}>
            The moments worth another look, in the order you want them read. A date, a line, and a
            photo if you have one.
          </p>
        </div>
        <Button variant="primary" onClick={() => setAdding(true)}>
          <Plus size={16} aria-hidden />
          Add a moment
        </Button>
      </div>

      {isPending && <Spinner label="Loading the timeline" />}
      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && memories.length === 0 && (
        <EmptyState
          emoji="🕰️"
          title="Nothing on the timeline yet"
          description="Start with the one you both bring up every time. The rest tends to follow."
          action={
            <Button variant="primary" onClick={() => setAdding(true)}>
              Add the first moment
            </Button>
          }
        />
      )}

      {memories.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext
            items={memories.map((memory) => memory.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className={styles.list}>
              {memories.map((memory, index) => (
                <MemoryRow
                  key={memory.id}
                  memory={memory}
                  index={index}
                  total={memories.length}
                  onMove={move}
                  onEdit={() => setEditing(memory)}
                  onDelete={() => setPendingDelete(memory)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <MemoryForm
        open={adding}
        onClose={() => setAdding(false)}
        experienceId={experienceId}
        memory={null}
        saving={createMemory.isPending}
        onSave={(values) =>
          createMemory.mutate(values, {
            onSuccess: () => {
              notify('Added to the timeline.');
              setAdding(false);
            },
            onError: notifyError,
          })
        }
      />

      <MemoryForm
        open={editing !== null}
        onClose={() => setEditing(null)}
        experienceId={experienceId}
        memory={editing}
        saving={updateMemory.isPending}
        onSave={(values) => {
          if (!editing) return;
          updateMemory.mutate(
            { id: editing.id, ...values },
            {
              onSuccess: () => {
                notify('Saved.');
                setEditing(null);
              },
              onError: notifyError,
            },
          );
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteMemory.mutate(pendingDelete.id, {
            onSuccess: () => notify('Taken off the timeline.'),
            onError: notifyError,
          });
        }}
        title={pendingDelete ? `Remove "${pendingDelete.title}"?` : 'Remove this moment?'}
        description="It comes off the timeline. The photo stays in your media library."
        confirmLabel="Remove it"
        destructive
      />
    </div>
  );
}

function MemoryRow({
  memory,
  index,
  total,
  onMove,
  onEdit,
  onDelete,
}: {
  memory: Memory;
  index: number;
  total: number;
  onMove: (from: number, to: number) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: memory.id,
  });

  const style: CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
  };

  return (
    <li ref={setNodeRef} style={style} className={cx(isDragging && styles.dragging)}>
      <Card className={styles.row}>
        <button
          type="button"
          className={styles.handle}
          aria-label={`Reorder "${memory.title}". Press space, then use the arrow keys.`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} aria-hidden />
        </button>

        {memory.media && <MediaThumbnail media={memory.media} className={styles.rowThumb} />}

        <div className={styles.rowText}>
          <span className={styles.rowDate}>{formatDate(memory.date)}</span>
          <span className={styles.rowTitle}>{memory.title}</span>
          {memory.location && (
            <span className={styles.rowMeta}>
              <MapPin size={12} aria-hidden /> {memory.location}
            </span>
          )}
          {memory.description && <p className={styles.rowDescription}>{memory.description}</p>}
        </div>

        <div className={styles.rowActions}>
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Move "${memory.title}" up`}
            disabled={index === 0}
            onClick={() => onMove(index, index - 1)}
          >
            <ChevronUp size={14} aria-hidden />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Move "${memory.title}" down`}
            disabled={index === total - 1}
            onClick={() => onMove(index, index + 1)}
          >
            <ChevronDown size={14} aria-hidden />
          </Button>
          <Button size="sm" variant="ghost" onClick={onEdit} aria-label={`Edit "${memory.title}"`}>
            <Pencil size={14} aria-hidden />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            aria-label={`Remove "${memory.title}"`}
          >
            <Trash2 size={14} aria-hidden />
          </Button>
        </div>
      </Card>
    </li>
  );
}

function MemoryForm({
  open,
  onClose,
  experienceId,
  memory,
  saving,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  experienceId: string;
  memory: Memory | null;
  saving: boolean;
  onSave: (values: CreateMemoryInput) => void;
}) {
  const [dateValue, setDateValue] = useState('');
  const [mediaId, setMediaId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateMemoryInput>({
    resolver: zodResolver(CreateMemorySchema),
  });

  // Fill the form each time it opens, from the moment being edited or empty.
  useEffect(() => {
    if (!open) return;
    const iso = memory?.date ?? new Date().toISOString();
    setDateValue(toDateInputValue(iso));
    setMediaId(memory?.mediaId ?? null);
    reset({
      date: iso,
      title: memory?.title ?? '',
      description: memory?.description ?? '',
      location: memory?.location ?? '',
      mediaId: memory?.mediaId ?? null,
    });
  }, [open, memory, reset]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={memory ? 'Edit this moment' : 'A moment worth keeping'}
      description="Only the date and a title are needed. The rest is yours if you want it."
    >
      <form onSubmit={handleSubmit((values) => onSave({ ...values, mediaId }))} noValidate>
        <Stack>
          <Field label="When" error={errors.date?.message}>
            {(props) => (
              <Input
                {...props}
                type="date"
                value={dateValue}
                onChange={(event) => {
                  setDateValue(event.target.value);
                  const iso = fromLocalInputValue(event.target.value);
                  if (iso) setValue('date', iso, { shouldValidate: true });
                }}
              />
            )}
          </Field>

          <Field label="What happened" error={errors.title?.message}>
            {(props) => (
              <Input {...props} {...register('title')} placeholder="The night of the thunderstorm" />
            )}
          </Field>

          <Field label="A little more" hint="Optional." error={errors.description?.message}>
            {(props) => <Textarea {...props} {...register('description')} rows={3} />}
          </Field>

          <Field label="Where" hint="Optional." error={errors.location?.message}>
            {(props) => <Input {...props} {...register('location')} placeholder="Lisbon" />}
          </Field>

          <MediaField
            label="Photo"
            hint="Optional."
            experienceId={experienceId}
            mediaId={mediaId}
            onChange={setMediaId}
            filter="IMAGE"
          />

          <div className={pageStyles.actions}>
            <Button type="submit" variant="primary" loading={saving}>
              {memory ? 'Save the moment' : 'Add it'}
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </Stack>
      </form>
    </Modal>
  );
}
