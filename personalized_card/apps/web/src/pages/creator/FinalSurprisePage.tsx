import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, X } from 'lucide-react';
import type { ResponseType } from '@letter/types';
import { FinalSurpriseSchema, type FinalSurpriseInput } from '@letter/validation';
import { MediaField } from '../../components/MediaPicker';
import { useDeleteFinalSurprise, useSaveFinalSurprise } from '../../hooks/useExperience';
import {
  Button,
  Card,
  ConfirmDialog,
  Field,
  Input,
  Select,
  Stack,
  Textarea,
  cx,
  useToast,
} from '../../ui';
import { useExperienceContext } from './ExperienceLayout';
import styles from './FinalSurprisePage.module.css';
import pageStyles from './creator.module.css';

const RESPONSE_HINTS: Record<ResponseType, string> = {
  YES_NO: 'Two buttons: yes, or no. Both are recorded.',
  SINGLE_BUTTON: 'One button. Pressing it is the whole answer.',
  MULTIPLE_CHOICE: 'A short list to choose from.',
  TEXT_INPUT: 'A box they can write anything in.',
};

export default function FinalSurprisePage() {
  const experience = useExperienceContext();
  const experienceId = experience.id;
  const surprise = experience.finalSurprise;
  const { notify, notifyError } = useToast();

  const save = useSaveFinalSurprise(experienceId);
  const remove = useDeleteFinalSurprise(experienceId);

  const [responseType, setResponseType] = useState<ResponseType>(
    surprise?.responseType ?? 'YES_NO',
  );
  const [options, setOptions] = useState<string[]>(surprise?.options ?? ['', '']);
  const [mediaId, setMediaId] = useState<string | null>(surprise?.mediaId ?? null);
  const [confirming, setConfirming] = useState(false);
  const [optionProblem, setOptionProblem] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FinalSurpriseInput>({
    resolver: zodResolver(FinalSurpriseSchema),
    defaultValues: {
      question: surprise?.question ?? '',
      buttonText: surprise?.buttonText ?? 'Reveal',
      successMessage: surprise?.successMessage ?? 'Thank you. That means everything.',
      ctaText: surprise?.ctaText ?? '',
      ctaUrl: surprise?.ctaUrl ?? '',
    },
  });

  function onSubmit(values: FinalSurpriseInput) {
    let chosen: string[] | null = null;

    if (responseType === 'MULTIPLE_CHOICE') {
      chosen = options.map((option) => option.trim()).filter(Boolean);
      if (chosen.length < 2) {
        setOptionProblem('Give them at least two things to choose between.');
        return;
      }
      if (chosen.length > 8) {
        setOptionProblem('Eight choices is the most — any more and it stops being a question.');
        return;
      }
    }
    setOptionProblem(null);

    save.mutate(
      {
        ...values,
        responseType,
        options: chosen,
        mediaId,
        ctaText: values.ctaText?.trim() ? values.ctaText : null,
        // An empty box is not a broken link — send nothing rather than "".
        ctaUrl: values.ctaUrl?.trim() ? values.ctaUrl : null,
      },
      {
        onSuccess: () => notify('Saved. That is the last thing they will read.'),
        onError: notifyError,
      },
    );
  }

  return (
    <div className={pageStyles.page}>
      <div>
        <h2 className={pageStyles.pageTitle}>The last thing</h2>
        <p className={pageStyles.pageLead}>
          One question at the end, and whatever you want to say when they answer it. Their answer
          comes back to you on the Replies page.
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack>
            <Field label="The question" error={errors.question?.message}>
              {(props) => (
                <Textarea
                  {...props}
                  {...register('question')}
                  rows={2}
                  placeholder="So — will you?"
                />
              )}
            </Field>

            <div className={pageStyles.fieldRow}>
              <Field
                label="The button before the reveal"
                hint="What they press to see the question."
                error={errors.buttonText?.message}
              >
                {(props) => <Input {...props} {...register('buttonText')} />}
              </Field>

              <Field label="How they answer" hint={RESPONSE_HINTS[responseType]}>
                {(props) => (
                  <Select
                    {...props}
                    value={responseType}
                    onChange={(event) => setResponseType(event.target.value as ResponseType)}
                  >
                    <option value="YES_NO">Yes or no</option>
                    <option value="SINGLE_BUTTON">One button</option>
                    <option value="MULTIPLE_CHOICE">A few choices</option>
                    <option value="TEXT_INPUT">They write something</option>
                  </Select>
                )}
              </Field>
            </div>

            {responseType === 'MULTIPLE_CHOICE' && (
              <fieldset className={styles.options}>
                <legend className={styles.optionsTitle}>The choices</legend>
                {optionProblem && (
                  <p className={styles.optionError} role="alert">
                    {optionProblem}
                  </p>
                )}

                {options.map((option, index) => (
                  <div key={index} className={styles.optionRow}>
                    <Field label={`Choice ${index + 1}`}>
                      {(props) => (
                        <Input
                          {...props}
                          value={option}
                          maxLength={200}
                          onChange={(event) =>
                            setOptions((current) =>
                              current.map((value, position) =>
                                position === index ? event.target.value : value,
                              ),
                            )
                          }
                        />
                      )}
                    </Field>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Remove choice ${index + 1}`}
                      disabled={options.length <= 2}
                      onClick={() =>
                        setOptions((current) => current.filter((_, position) => position !== index))
                      }
                    >
                      <X size={14} aria-hidden />
                    </Button>
                  </div>
                ))}

                <Button
                  size="sm"
                  disabled={options.length >= 8}
                  onClick={() => setOptions((current) => [...current, ''])}
                >
                  <Plus size={14} aria-hidden />
                  Another choice
                </Button>
              </fieldset>
            )}

            <Field
              label="What you say when they answer"
              error={errors.successMessage?.message}
            >
              {(props) => <Textarea {...props} {...register('successMessage')} rows={3} />}
            </Field>

            <MediaField
              label="Something to show with it"
              hint="Optional."
              experienceId={experienceId}
              mediaId={mediaId}
              onChange={setMediaId}
            />

            <div className={pageStyles.fieldRow}>
              <Field label="A link afterwards" hint="Optional. What the link says." error={errors.ctaText?.message}>
                {(props) => <Input {...props} {...register('ctaText')} placeholder="Book the table" />}
              </Field>

              <Field label="Where it goes" hint="Optional. A full web address." error={errors.ctaUrl?.message}>
                {(props) => (
                  <Input {...props} {...register('ctaUrl')} type="url" placeholder="https://" />
                )}
              </Field>
            </div>

            <div className={pageStyles.actions}>
              <Button type="submit" variant="primary" loading={save.isPending}>
                {surprise ? 'Save the ending' : 'Write the ending'}
              </Button>
              {surprise && (
                <Button variant="ghost" onClick={() => setConfirming(true)}>
                  <Trash2 size={14} aria-hidden />
                  Remove it
                </Button>
              )}
            </div>
          </Stack>
        </form>
      </Card>

      {surprise && (
        <p className={cx(pageStyles.muted, pageStyles.small)}>
          Answers appear on the Replies page as soon as they arrive.
        </p>
      )}

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() =>
          remove.mutate(undefined, {
            onSuccess: () => notify('The ending is gone. The letter just closes now.'),
            onError: notifyError,
          })
        }
        title="Remove the final surprise?"
        description="The question and your reply to it go with it. Any answers already sent to you are kept."
        confirmLabel="Remove it"
        destructive
      />
    </div>
  );
}
