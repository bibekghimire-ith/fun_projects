import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, Unlock } from 'lucide-react';
import { PinSchema, UpdateExperienceSchema, type UpdateExperienceInput } from '@letter/validation';
import { api } from '../../api';
import { MediaField } from '../../components/MediaPicker';
import {
  fromLocalInputValue,
  keys,
  toDateInputValue,
  useUpdateExperience,
} from '../../hooks/useExperience';
import {
  Button,
  Card,
  Field,
  Input,
  Select,
  Stack,
  Textarea,
  useToast,
} from '../../ui';
import { useExperienceContext } from './ExperienceLayout';
import styles from './creator.module.css';

export default function SettingsPage() {
  const experience = useExperienceContext();
  const experienceId = experience.id;
  const { notify, notifyError } = useToast();
  const update = useUpdateExperience(experienceId);

  const [eventDateValue, setEventDateValue] = useState(toDateInputValue(experience.eventDate));
  const [coverMediaId, setCoverMediaId] = useState(experience.coverMediaId);
  const [musicMediaId, setMusicMediaId] = useState(experience.musicMediaId);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isDirty },
  } = useForm<UpdateExperienceInput>({
    resolver: zodResolver(UpdateExperienceSchema),
    defaultValues: {
      title: experience.title,
      recipientName: experience.recipientName,
      eventType: experience.eventType,
      eventDate: experience.eventDate,
      openingMessage: experience.openingMessage ?? '',
      closingMessage: experience.closingMessage ?? '',
    },
  });

  function onSubmit(values: UpdateExperienceInput) {
    update.mutate(
      { ...values, coverMediaId, musicMediaId },
      {
        onSuccess: () => notify('Saved.'),
        onError: notifyError,
      },
    );
  }

  return (
    <div className={styles.page}>
      <div>
        <h2 className={styles.pageTitle}>The details</h2>
        <p className={styles.pageLead}>
          Who it is for, what it marks, and the first and last things they read.
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack>
            <div className={styles.fieldRow}>
              <Field label="Title" hint="Only you see this." error={errors.title?.message}>
                {(props) => <Input {...props} {...register('title')} />}
              </Field>

              <Field label="Their name" error={errors.recipientName?.message}>
                {(props) => <Input {...props} {...register('recipientName')} autoComplete="off" />}
              </Field>
            </div>

            <div className={styles.fieldRow}>
              <Field label="Occasion" error={errors.eventType?.message}>
                {(props) => (
                  <Select {...props} {...register('eventType')}>
                    <option value="BIRTHDAY">Birthday</option>
                    <option value="ANNIVERSARY">Anniversary</option>
                    <option value="VALENTINES">Valentine&rsquo;s</option>
                    <option value="CUSTOM">Just because</option>
                  </Select>
                )}
              </Field>

              <Field
                label="The date it marks"
                hint="Optional. Countdowns and {eventDate} in your wording use this."
                error={errors.eventDate?.message}
              >
                {(props) => (
                  <Input
                    {...props}
                    type="date"
                    value={eventDateValue}
                    onChange={(event) => {
                      setEventDateValue(event.target.value);
                      setValue('eventDate', fromLocalInputValue(event.target.value), {
                        shouldDirty: true,
                      });
                    }}
                  />
                )}
              </Field>
            </div>

            <Field
              label="How it opens"
              hint="The first thing they read."
              error={errors.openingMessage?.message}
            >
              {(props) => <Textarea {...props} {...register('openingMessage')} rows={3} />}
            </Field>

            <Field
              label="How it closes"
              hint="The last thing they read."
              error={errors.closingMessage?.message}
            >
              {(props) => <Textarea {...props} {...register('closingMessage')} rows={3} />}
            </Field>

            <div className={styles.fieldRow}>
              <MediaField
                label="Cover image"
                hint="The first thing they see. Needed before you can share this, unless you choose to send it without one."
                experienceId={experienceId}
                mediaId={coverMediaId}
                onChange={setCoverMediaId}
                filter="IMAGE"
              />

              <MediaField
                label="Background music"
                hint="Optional. They can always turn it off."
                experienceId={experienceId}
                mediaId={musicMediaId}
                onChange={setMusicMediaId}
                filter="AUDIO"
              />
            </div>

            <div className={styles.actions}>
              <Button
                type="submit"
                variant="primary"
                loading={update.isPending}
                disabled={
                  !isDirty &&
                  coverMediaId === experience.coverMediaId &&
                  musicMediaId === experience.musicMediaId
                }
              >
                Save the details
              </Button>
            </div>
          </Stack>
        </form>
      </Card>

      <PinSection experienceId={experienceId} pinEnabled={experience.pinEnabled} />
    </div>
  );
}

function PinSection({ experienceId, pinEnabled }: { experienceId: string; pinEnabled: boolean }) {
  const queryClient = useQueryClient();
  const { notify, notifyError } = useToast();
  const [pin, setPin] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: keys.experience(experienceId) });
    void queryClient.invalidateQueries({ queryKey: keys.share(experienceId) });
    void queryClient.invalidateQueries({ queryKey: keys.publishCheck(experienceId) });
  }

  const setPinMutation = useMutation({
    mutationFn: (value: string) =>
      api.post<{ pinEnabled: boolean }>(`/api/experiences/${experienceId}/pin`, { pin: value }),
    onSuccess: () => {
      setPin('');
      notify('The code is set. Tell them what it is — this is the only place it lives.');
      refresh();
    },
    onError: notifyError,
  });

  const clearPinMutation = useMutation({
    mutationFn: () => api.del<{ pinEnabled: boolean }>(`/api/experiences/${experienceId}/pin`),
    onSuccess: () => {
      notify('The code is off. Anyone with the link can open it now.');
      refresh();
    },
    onError: notifyError,
  });

  function save() {
    const parsed = PinSchema.safeParse({ pin });
    if (!parsed.success) {
      setProblem(parsed.error.issues[0]?.message ?? 'That is not a four-digit code.');
      return;
    }
    setProblem(null);
    setPinMutation.mutate(parsed.data.pin);
  }

  return (
    <Card>
      <Stack>
        <div className={styles.wrapRow}>
          {pinEnabled ? <Lock size={16} aria-hidden /> : <Unlock size={16} aria-hidden />}
          <h3 className={styles.sectionTitle}>A private code</h3>
        </div>

        <p className={styles.muted}>
          {pinEnabled
            ? 'This letter asks for a four-digit code before it opens. Only someone you tell can read it.'
            : 'Right now anyone with the link can read this. You can ask for a four-digit code instead.'}
        </p>

        <div className={styles.fieldRow}>
          <Field
            label={pinEnabled ? 'Change the code' : 'Set a code'}
            hint="Four digits. Write it down somewhere — you cannot look it up later."
            error={problem}
          >
            {(props) => (
              <Input
                {...props}
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                value={pin}
                placeholder="0000"
                onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
              />
            )}
          </Field>
        </div>

        <div className={styles.actions}>
          <Button
            variant="primary"
            onClick={save}
            loading={setPinMutation.isPending}
            disabled={pin.length !== 4}
          >
            {pinEnabled ? 'Change the code' : 'Turn the code on'}
          </Button>
          {pinEnabled && (
            <Button
              variant="ghost"
              onClick={() => clearPinMutation.mutate()}
              loading={clearPinMutation.isPending}
            >
              Turn it off
            </Button>
          )}
        </div>
      </Stack>
    </Card>
  );
}
