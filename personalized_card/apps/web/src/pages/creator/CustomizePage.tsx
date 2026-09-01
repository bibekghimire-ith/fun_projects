import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import {
  COPY_GROUPS,
  COPY_KEYS,
  DEFAULT_COPY,
  DEFAULT_FEATURES,
  FEATURE_KEYS,
  FEATURE_LABELS,
  interpolate,
  type CopyKey,
  type ExperienceConfig,
  type FeatureKey,
  type NavigationMode,
} from '@letter/types';
import { useAuth } from '../../auth';
import { useConfig, useUpdateConfig } from '../../hooks/useExperience';
import { formatDate } from '../../lib/format';
import {
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  Select,
  Spinner,
  Stack,
  Switch,
  cx,
  useToast,
} from '../../ui';
import { useExperienceContext } from './ExperienceLayout';
import styles from './CustomizePage.module.css';
import pageStyles from './creator.module.css';

type CopyDraft = Record<CopyKey, string>;

function seedDraft(config: ExperienceConfig): CopyDraft {
  const draft = {} as CopyDraft;
  for (const key of COPY_KEYS) draft[key] = config.copy?.[key] ?? '';
  return draft;
}

export default function CustomizePage() {
  const experience = useExperienceContext();
  const experienceId = experience.id;
  const { user } = useAuth();
  const { notify, notifyError } = useToast();

  const { data: config, isPending, isError, error, refetch } = useConfig(experienceId);
  const update = useUpdateConfig(experienceId);

  const [draft, setDraft] = useState<CopyDraft | null>(null);

  useEffect(() => {
    if (config && draft === null) setDraft(seedDraft(config));
  }, [config, draft]);

  if (isPending) return <Spinner label="Loading the wording" />;
  if (isError || !config) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const features = { ...DEFAULT_FEATURES, ...config.features } as Record<FeatureKey, boolean>;

  const tokens = {
    recipient: experience.recipientName,
    sender: user?.name ?? '',
    title: experience.title,
    eventDate: formatDate(experience.eventDate, config.dateFormat, config.locale),
  };

  function save(input: Parameters<typeof update.mutate>[0], message?: string) {
    update.mutate(input, {
      onSuccess: () => {
        if (message) notify(message);
      },
      onError: notifyError,
    });
  }

  return (
    <div className={pageStyles.page}>
      <div>
        <h2 className={pageStyles.pageTitle}>Wording and what shows</h2>
        <p className={pageStyles.pageLead}>
          Every word the letter says to them is here, and every part of it can be switched off. The
          defaults are a starting point, not a rule.
        </p>
      </div>

      <Card>
        <Stack>
          <h3 className={pageStyles.sectionTitle}>What this letter includes</h3>
          <p className={cx(pageStyles.muted, pageStyles.small)}>
            Turning something off hides it from them. Nothing you have written is deleted.
          </p>

          <div className={styles.toggleGrid}>
            {FEATURE_KEYS.map((key) => (
              <Switch
                key={key}
                checked={features[key]}
                label={FEATURE_LABELS[key]}
                onChange={(checked) => save({ features: { [key]: checked } })}
              />
            ))}
          </div>
        </Stack>
      </Card>

      <Card>
        <Stack>
          <h3 className={pageStyles.sectionTitle}>How it behaves</h3>

          <div className={pageStyles.fieldRow}>
            <Field label="Moving through it" hint="One long scroll, or a chapter at a time.">
              {(props) => (
                <Select
                  {...props}
                  value={config.navigationMode}
                  onChange={(event) =>
                    save({ navigationMode: event.target.value as NavigationMode })
                  }
                >
                  <option value="SCROLL">One long scroll</option>
                  <option value="CHAPTERS">A chapter at a time</option>
                </Select>
              )}
            </Field>

            <Field
              label="Music volume"
              hint={`${config.musicVolume} out of 100.`}
            >
              {(props) => (
                <input
                  {...props}
                  className={styles.range}
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  defaultValue={config.musicVolume}
                  onChange={(event) => save({ musicVolume: Number(event.target.value) })}
                />
              )}
            </Field>
          </div>

          <div className={styles.toggleGrid}>
            <Switch
              checked={config.showProgressBar}
              label="Show a progress bar"
              onChange={(checked) => save({ showProgressBar: checked })}
            />
            <Switch
              checked={config.enableConfetti}
              label="Confetti at the end"
              onChange={(checked) => save({ enableConfetti: checked })}
            />
            <Switch
              checked={config.musicAutoplay}
              label="Start the music on its own"
              hint="Most phones will wait for them to press play anyway."
              onChange={(checked) => save({ musicAutoplay: checked })}
            />
          </div>

          <div className={pageStyles.fieldRow}>
            <Field label="Language" hint="Used for month and day names, e.g. en, fr, de.">
              {(props) => (
                <Input
                  {...props}
                  defaultValue={config.locale}
                  onBlur={(event) => {
                    const value = event.target.value.trim();
                    if (value && value !== config.locale) save({ locale: value });
                  }}
                />
              )}
            </Field>

            <Field
              label="Date format"
              hint="Tokens: yyyy yy MMMM MMM MM M dd d EEEE EEE HH mm"
            >
              {(props) => (
                <Input
                  {...props}
                  defaultValue={config.dateFormat}
                  spellCheck={false}
                  onBlur={(event) => {
                    const value = event.target.value.trim();
                    if (value && value !== config.dateFormat) save({ dateFormat: value });
                  }}
                />
              )}
            </Field>
          </div>

          <p className={pageStyles.previewBox}>
            Today reads as <strong>{formatDate(new Date(), config.dateFormat, config.locale)}</strong>
          </p>
        </Stack>
      </Card>

      <Card>
        <Stack>
          <h3 className={pageStyles.sectionTitle}>Every word it says</h3>
          <p className={cx(pageStyles.muted, pageStyles.small)}>
            Leave a box empty to keep the default, shown in grey. You can use{' '}
            <code className={styles.token}>{'{recipient}'}</code>,{' '}
            <code className={styles.token}>{'{sender}'}</code>,{' '}
            <code className={styles.token}>{'{title}'}</code> and{' '}
            <code className={styles.token}>{'{eventDate}'}</code> anywhere — they are filled in when
            they read it.
          </p>

          {draft &&
            COPY_GROUPS.map((group) => {
              const groupKeys = COPY_KEYS.filter((key) => key.startsWith(group.prefix));
              if (groupKeys.length === 0) return null;

              return (
                <section key={group.prefix} className={styles.copyGroup}>
                  <h4 className={styles.copyGroupTitle}>{group.label}</h4>

                  {groupKeys.map((key) => {
                    const value = draft[key];
                    const shown = value.trim() ? value : DEFAULT_COPY[key];
                    return (
                      <div key={key} className={styles.copyRow}>
                        <Field label={key.slice(group.prefix.length)}>
                          {(props) => (
                            <Input
                              {...props}
                              value={value}
                              placeholder={DEFAULT_COPY[key]}
                              onChange={(event) =>
                                setDraft((current) =>
                                  current ? { ...current, [key]: event.target.value } : current,
                                )
                              }
                            />
                          )}
                        </Field>

                        <div className={styles.copySide}>
                          <p className={styles.copyPreview}>{interpolate(shown, tokens)}</p>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Reset ${key} to the default wording`}
                            disabled={!value}
                            onClick={() => {
                              setDraft((current) =>
                                current ? { ...current, [key]: '' } : current,
                              );
                              save({ copy: { [key]: '' } }, 'Back to the default wording.');
                            }}
                          >
                            <RotateCcw size={13} aria-hidden />
                            Reset
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </section>
              );
            })}

          <div className={pageStyles.actions}>
            <Button
              variant="primary"
              loading={update.isPending}
              onClick={() => {
                if (!draft) return;
                save({ copy: draft }, 'Your words are saved.');
              }}
            >
              Save the wording
            </Button>
          </div>
        </Stack>
      </Card>
    </div>
  );
}
