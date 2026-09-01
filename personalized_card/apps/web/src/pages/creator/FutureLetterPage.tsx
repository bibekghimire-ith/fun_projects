import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trash2 } from 'lucide-react';
import { FutureLetterSchema, type FutureLetterInput } from '@letter/validation';
import { MediaField } from '../../components/MediaPicker';
import {
  fromLocalInputValue,
  toLocalInputValue,
  useDeleteFutureLetter,
  useSaveFutureLetter,
} from '../../hooks/useExperience';
import { countdownTo, formatDate } from '../../lib/format';
import {
  Button,
  Card,
  ConfirmDialog,
  Field,
  Input,
  Stack,
  Textarea,
  cx,
  useToast,
} from '../../ui';
import { useExperienceContext } from './ExperienceLayout';
import pageStyles from './creator.module.css';

/** A year from now, rounded to the hour — a sensible first suggestion. */
function defaultUnlockDate(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  date.setMinutes(0, 0, 0);
  return date.toISOString();
}

export default function FutureLetterPage() {
  const experience = useExperienceContext();
  const experienceId = experience.id;
  const letter = experience.futureLetter;
  const { notify, notifyError } = useToast();

  const save = useSaveFutureLetter(experienceId);
  const remove = useDeleteFutureLetter(experienceId);

  const [unlockValue, setUnlockValue] = useState(
    toLocalInputValue(letter?.unlockDate ?? defaultUnlockDate()),
  );
  const [mediaId, setMediaId] = useState<string | null>(letter?.mediaId ?? null);
  const [confirming, setConfirming] = useState(false);
  const [, setTick] = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FutureLetterInput>({
    resolver: zodResolver(FutureLetterSchema),
    defaultValues: {
      title: letter?.title ?? '',
      content: letter?.content ?? '',
      unlockDate: letter?.unlockDate ?? defaultUnlockDate(),
    },
  });

  // Keep the countdown honest while the page sits open.
  useEffect(() => {
    const handle = window.setInterval(() => setTick((value) => value + 1), 30_000);
    return () => window.clearInterval(handle);
  }, []);

  const targetIso = fromLocalInputValue(unlockValue);
  const countdown = targetIso ? countdownTo(targetIso) : null;

  return (
    <div className={pageStyles.page}>
      <div>
        <h2 className={pageStyles.pageTitle}>A letter for later</h2>
        <p className={pageStyles.pageLead}>
          Sealed until the day you choose. They will see that it exists, and how long they have to
          wait, but not a word of it.
        </p>
      </div>

      <Card>
        <form
          onSubmit={handleSubmit((values) => {
            const iso = fromLocalInputValue(unlockValue);
            if (!iso) {
              notifyError(new Error('Choose a date and time it should unlock.'));
              return;
            }
            save.mutate(
              { ...values, unlockDate: iso, mediaId },
              {
                onSuccess: () => notify('Sealed. See you then.'),
                onError: notifyError,
              },
            );
          })}
          noValidate
        >
          <Stack>
            <Field label="Title" hint="What they see on the sealed envelope." error={errors.title?.message}>
              {(props) => (
                <Input {...props} {...register('title')} placeholder="Read this in a year" />
              )}
            </Field>

            <Field label="What it says" error={errors.content?.message}>
              {(props) => (
                <Textarea
                  {...props}
                  {...register('content')}
                  rows={12}
                  placeholder="By the time you read this…"
                />
              )}
            </Field>

            <Field label="It unlocks on" hint="Your own time zone.">
              {(props) => (
                <Input
                  {...props}
                  type="datetime-local"
                  value={unlockValue}
                  onChange={(event) => setUnlockValue(event.target.value)}
                />
              )}
            </Field>

            {countdown && (
              <p className={cx(pageStyles.previewBox, pageStyles.small)} aria-live="polite">
                {countdown.done
                  ? 'That moment has already passed, so this would open the instant they arrive. Pick a date still to come.'
                  : `It opens in ${countdown.days} days and ${countdown.hours} hours — on ${formatDate(targetIso, 'EEEE, MMMM d, yyyy')}.`}
              </p>
            )}

            <MediaField
              label="Something to go with it"
              hint="Optional."
              experienceId={experienceId}
              mediaId={mediaId}
              onChange={setMediaId}
            />

            <div className={pageStyles.actions}>
              <Button type="submit" variant="primary" loading={save.isPending}>
                {letter ? 'Save the letter' : 'Seal the letter'}
              </Button>
              {letter && (
                <Button variant="ghost" onClick={() => setConfirming(true)}>
                  <Trash2 size={14} aria-hidden />
                  Remove it
                </Button>
              )}
            </div>
          </Stack>
        </form>
      </Card>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() =>
          remove.mutate(undefined, {
            onSuccess: () => notify('The future letter is gone.'),
            onError: notifyError,
          })
        }
        title="Remove the future letter?"
        description="What you wrote goes with it, and this letter will have nothing waiting at the end."
        confirmLabel="Remove it"
        destructive
      />
    </div>
  );
}
