import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lock, Pencil, Plus, Trash2, Unlock } from 'lucide-react';
import type { UnlockType } from '@letter/types';
import { CreateOpenWhenSchema, type CreateOpenWhenInput } from '@letter/validation';
import { MediaField } from '../../components/MediaPicker';
import {
  fromLocalInputValue,
  toLocalInputValue,
  useCreateOpenWhen,
  useDeleteOpenWhen,
  useManualUnlock,
  useOpenWhen,
  useUpdateOpenWhen,
  type OpenWhenRow,
} from '../../hooks/useExperience';
import { formatDate, relativeTime } from '../../lib/format';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  Select,
  Spinner,
  Stack,
  Switch,
  Textarea,
  cx,
  useToast,
} from '../../ui';
import { useExperienceContext } from './ExperienceLayout';
import styles from './OpenWhenPage.module.css';
import pageStyles from './creator.module.css';

/** The creator endpoints return raw rows, so work out the lock state here. */
function isOpen(note: OpenWhenRow, now = Date.now()): boolean {
  if (note.unlockType === 'IMMEDIATE') return true;
  if (note.unlockType === 'DATE_LOCKED') {
    return note.unlockDate ? new Date(note.unlockDate).getTime() <= now : true;
  }
  return note.openedAt !== null;
}

function lockDescription(note: OpenWhenRow): string {
  if (note.unlockType === 'IMMEDIATE') return 'Open from the moment they arrive';
  if (note.unlockType === 'DATE_LOCKED') {
    if (!note.unlockDate) return 'No date set, so it opens straight away';
    return isOpen(note)
      ? `Opened on ${formatDate(note.unlockDate)}`
      : `Sealed until ${formatDate(note.unlockDate)} — ${relativeTime(note.unlockDate)}`;
  }
  return note.openedAt ? `You unlocked this ${relativeTime(note.openedAt)}` : 'Sealed until you say so';
}

export default function OpenWhenPage() {
  const experience = useExperienceContext();
  const experienceId = experience.id;
  const { notify, notifyError } = useToast();

  const { data, isPending, isError, error, refetch } = useOpenWhen(experienceId);
  const createNote = useCreateOpenWhen(experienceId);
  const updateNote = useUpdateOpenWhen(experienceId);
  const deleteNote = useDeleteOpenWhen(experienceId);
  const unlockNote = useManualUnlock(experienceId);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<OpenWhenRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<OpenWhenRow | null>(null);

  const notes = data ?? [];

  return (
    <div className={pageStyles.page}>
      <div className={pageStyles.pageHead}>
        <div>
          <h2 className={pageStyles.pageTitle}>Open when&hellip;</h2>
          <p className={pageStyles.pageLead}>
            Small sealed notes for the days that need them. Some can wait for a date, some until you
            decide, and some can only be opened once.
          </p>
        </div>
        <Button variant="primary" onClick={() => setAdding(true)}>
          <Plus size={16} aria-hidden />
          Write a note
        </Button>
      </div>

      {isPending && <Spinner label="Loading the sealed notes" />}
      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && notes.length === 0 && (
        <EmptyState
          emoji="✉️"
          title="No sealed notes yet"
          description="“Open when you can't sleep.” “Open when you've had a bad day.” Write the one you would want to find."
          action={
            <Button variant="primary" onClick={() => setAdding(true)}>
              Write the first one
            </Button>
          }
        />
      )}

      {notes.length > 0 && (
        <ul className={cx(pageStyles.grid, pageStyles.resetList)}>
          {notes.map((note) => {
            const open = isOpen(note);
            return (
              <li key={note.id}>
                <Card className={styles.note}>
                  <div className={styles.noteHead}>
                    <span className={styles.noteEmoji} aria-hidden>
                      {note.emoji ?? '✉️'}
                    </span>
                    <span className={styles.noteLabel}>{note.label}</span>
                    <span className={cx(styles.lockFlag, open ? styles.lockOpen : styles.lockShut)}>
                      {open ? <Unlock size={12} aria-hidden /> : <Lock size={12} aria-hidden />}
                      {open ? 'Open' : 'Sealed'}
                    </span>
                  </div>

                  <p className={styles.noteBody}>{note.content}</p>

                  <p className={styles.noteMeta}>
                    {lockDescription(note)}
                    {note.isOneTime ? ' · Can only be opened once' : ''}
                  </p>

                  <div className={pageStyles.actions}>
                    {note.unlockType === 'MANUAL' && !note.openedAt && (
                      <Button
                        size="sm"
                        variant="primary"
                        loading={unlockNote.isPending && unlockNote.variables === note.id}
                        onClick={() =>
                          unlockNote.mutate(note.id, {
                            onSuccess: () => notify(`"${note.label}" is open to them now.`),
                            onError: notifyError,
                          })
                        }
                      >
                        <Unlock size={14} aria-hidden />
                        Unlock it now
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditing(note)}
                      aria-label={`Edit "${note.label}"`}
                    >
                      <Pencil size={14} aria-hidden />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setPendingDelete(note)}
                      aria-label={`Delete "${note.label}"`}
                    >
                      <Trash2 size={14} aria-hidden />
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <OpenWhenForm
        open={adding}
        onClose={() => setAdding(false)}
        experienceId={experienceId}
        note={null}
        saving={createNote.isPending}
        onSave={(values) =>
          createNote.mutate(values, {
            onSuccess: () => {
              notify('Sealed and waiting.');
              setAdding(false);
            },
            onError: notifyError,
          })
        }
      />

      <OpenWhenForm
        open={editing !== null}
        onClose={() => setEditing(null)}
        experienceId={experienceId}
        note={editing}
        saving={updateNote.isPending}
        onSave={(values) => {
          if (!editing) return;
          updateNote.mutate(
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
          deleteNote.mutate(pendingDelete.id, {
            onSuccess: () => notify('That note is gone.'),
            onError: notifyError,
          });
        }}
        title={pendingDelete ? `Delete "${pendingDelete.label}"?` : 'Delete this note?'}
        description="What you wrote in it goes too. There is no way back."
        confirmLabel="Delete it"
        destructive
      />
    </div>
  );
}

function OpenWhenForm({
  open,
  onClose,
  experienceId,
  note,
  saving,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  experienceId: string;
  note: OpenWhenRow | null;
  saving: boolean;
  onSave: (values: CreateOpenWhenInput) => void;
}) {
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [unlockType, setUnlockType] = useState<UnlockType>('IMMEDIATE');
  const [unlockDate, setUnlockDate] = useState('');
  const [isOneTime, setIsOneTime] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateOpenWhenInput>({
    resolver: zodResolver(CreateOpenWhenSchema),
  });

  useEffect(() => {
    if (!open) return;
    setMediaId(note?.mediaId ?? null);
    setUnlockType(note?.unlockType ?? 'IMMEDIATE');
    setUnlockDate(toLocalInputValue(note?.unlockDate));
    setIsOneTime(note?.isOneTime ?? false);
    reset({
      label: note?.label ?? '',
      emoji: note?.emoji ?? '',
      content: note?.content ?? '',
      unlockType: note?.unlockType ?? 'IMMEDIATE',
      unlockDate: note?.unlockDate ?? null,
      isOneTime: note?.isOneTime ?? false,
    });
  }, [open, note, reset]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={note ? 'Edit this note' : 'A note for a day like that'}
      description="Name the day it is for, then write what you would say if you were there."
    >
      <form
        onSubmit={handleSubmit((values) =>
          onSave({
            ...values,
            mediaId,
            unlockType,
            unlockDate: unlockType === 'DATE_LOCKED' ? fromLocalInputValue(unlockDate) : null,
            isOneTime,
          }),
        )}
        noValidate
      >
        <Stack>
          <div className={pageStyles.fieldRow}>
            <Field label="Open when&hellip;" error={errors.label?.message}>
              {(props) => (
                <Input {...props} {...register('label')} placeholder="you can't sleep" />
              )}
            </Field>

            <Field label="A small picture" hint="One emoji. Optional." error={errors.emoji?.message}>
              {(props) => <Input {...props} {...register('emoji')} maxLength={10} placeholder="🌙" />}
            </Field>
          </div>

          <Field label="What it says" error={errors.content?.message}>
            {(props) => <Textarea {...props} {...register('content')} rows={6} />}
          </Field>

          <Field label="When they can open it">
            {(props) => (
              <Select
                {...props}
                value={unlockType}
                onChange={(event) => setUnlockType(event.target.value as UnlockType)}
              >
                <option value="IMMEDIATE">Straight away</option>
                <option value="DATE_LOCKED">On a date</option>
                <option value="MANUAL">When I unlock it</option>
              </Select>
            )}
          </Field>

          {unlockType === 'DATE_LOCKED' && (
            <Field label="It opens on" hint="Your own time zone.">
              {(props) => (
                <Input
                  {...props}
                  type="datetime-local"
                  value={unlockDate}
                  onChange={(event) => setUnlockDate(event.target.value)}
                />
              )}
            </Field>
          )}

          <MediaField
            label="Something to go with it"
            hint="Optional."
            experienceId={experienceId}
            mediaId={mediaId}
            onChange={setMediaId}
          />

          <Switch
            checked={isOneTime}
            onChange={setIsOneTime}
            label="It can only be opened once"
            hint="After they read it, it seals again for good."
          />

          <div className={pageStyles.actions}>
            <Button type="submit" variant="primary" loading={saving}>
              {note ? 'Save the note' : 'Seal it'}
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
