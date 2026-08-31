import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateThemeSchema, type CreateThemeInput } from '@letter/validation';
import type { AnimationLevel, Theme, ThemeTokens, TransitionStyle } from '@letter/types';
import { ThemeScope } from '../lib/theme';
import {
  Button,
  Card,
  ColorInput,
  Field,
  Input,
  Select,
  Stack,
  Textarea,
  useToast,
} from '../ui';
import styles from './ThemeStudio.module.css';

const STARTING_POINT: CreateThemeInput = {
  name: 'My theme',
  description: null,
  primaryColor: '#1a1a1a',
  secondaryColor: '#6b7280',
  backgroundColor: '#fafafa',
  surfaceColor: '#ffffff',
  textColor: '#111111',
  mutedColor: '#6b7280',
  borderColor: '#e5e7eb',
  fontFamily: "'Inter', system-ui, sans-serif",
  headingFontFamily: "'Lora', Georgia, serif",
  baseFontSize: '16px',
  borderRadius: '0.75rem',
  backgroundGradient: null,
  animationLevel: 'NORMAL',
  transitionStyle: 'FADE',
  customCss: null,
};

type ColourKey =
  | 'primaryColor'
  | 'secondaryColor'
  | 'backgroundColor'
  | 'surfaceColor'
  | 'textColor'
  | 'mutedColor'
  | 'borderColor';

const COLOURS: { key: ColourKey; label: string; hint?: string }[] = [
  { key: 'primaryColor', label: 'Primary', hint: 'Buttons and anything that asks to be pressed.' },
  { key: 'secondaryColor', label: 'Secondary' },
  { key: 'backgroundColor', label: 'Background' },
  { key: 'surfaceColor', label: 'Cards' },
  { key: 'textColor', label: 'Text' },
  { key: 'mutedColor', label: 'Quiet text' },
  { key: 'borderColor', label: 'Lines' },
];

function fromTheme(theme: Theme | null): CreateThemeInput {
  if (!theme) return STARTING_POINT;
  return {
    name: theme.name,
    description: theme.description,
    primaryColor: theme.primaryColor,
    secondaryColor: theme.secondaryColor,
    backgroundColor: theme.backgroundColor,
    surfaceColor: theme.surfaceColor,
    textColor: theme.textColor,
    mutedColor: theme.mutedColor,
    borderColor: theme.borderColor,
    fontFamily: theme.fontFamily,
    headingFontFamily: theme.headingFontFamily,
    baseFontSize: theme.baseFontSize,
    borderRadius: theme.borderRadius,
    backgroundGradient: theme.backgroundGradient,
    animationLevel: theme.animationLevel,
    transitionStyle: theme.transitionStyle,
    customCss: theme.customCss,
  };
}

export interface ThemeStudioProps {
  /** null means a brand-new theme. */
  theme: Theme | null;
  saving: boolean;
  onSave: (values: CreateThemeInput) => void;
  onCancel: () => void;
}

export function ThemeStudio({ theme, saving, onSave, onCancel }: ThemeStudioProps) {
  const { notifyError } = useToast();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateThemeInput>({
    resolver: zodResolver(CreateThemeSchema),
    defaultValues: fromTheme(theme),
  });

  const values = watch();

  // The preview is driven by exactly what is in the form right now, so a colour
  // shows its effect the moment it changes.
  const preview: ThemeTokens = {
    primaryColor: values.primaryColor ?? STARTING_POINT.primaryColor,
    secondaryColor: values.secondaryColor ?? STARTING_POINT.secondaryColor,
    backgroundColor: values.backgroundColor ?? STARTING_POINT.backgroundColor,
    surfaceColor: values.surfaceColor ?? STARTING_POINT.surfaceColor,
    textColor: values.textColor ?? STARTING_POINT.textColor,
    mutedColor: values.mutedColor ?? STARTING_POINT.mutedColor,
    borderColor: values.borderColor ?? STARTING_POINT.borderColor,
    fontFamily: values.fontFamily ?? STARTING_POINT.fontFamily,
    headingFontFamily: values.headingFontFamily ?? STARTING_POINT.headingFontFamily,
    baseFontSize: values.baseFontSize ?? STARTING_POINT.baseFontSize,
    borderRadius: values.borderRadius ?? STARTING_POINT.borderRadius,
    backgroundGradient: values.backgroundGradient ?? null,
    animationLevel: values.animationLevel ?? 'NORMAL',
    transitionStyle: values.transitionStyle ?? 'FADE',
    customCss: values.customCss ?? null,
  };

  return (
    <div className={styles.studio}>
      <Card>
        <form
          onSubmit={handleSubmit(onSave, () => notifyError(new Error('Some of this needs a second look.')))}
          noValidate
        >
          <Stack>
            <Field label="Theme name" error={errors.name?.message}>
              {(props) => <Input {...props} {...register('name')} />}
            </Field>

            <Field label="A line about it" hint="Optional." error={errors.description?.message}>
              {(props) => <Input {...props} {...register('description')} />}
            </Field>

            <fieldset className={styles.group}>
              <legend className={styles.groupTitle}>Colours</legend>
              <div className={styles.colourGrid}>
                {COLOURS.map((colour) => (
                  <Field
                    key={colour.key}
                    label={colour.label}
                    hint={colour.hint}
                    error={errors[colour.key]?.message}
                  >
                    {(props) => (
                      <ColorInput
                        id={props.id}
                        aria-describedby={props['aria-describedby']}
                        value={String(values[colour.key] ?? '#000000')}
                        onChange={(next) =>
                          setValue(colour.key, next, { shouldDirty: true, shouldValidate: true })
                        }
                      />
                    )}
                  </Field>
                ))}
              </div>
            </fieldset>

            <fieldset className={styles.group}>
              <legend className={styles.groupTitle}>Type and shape</legend>

              <Field
                label="Body font"
                hint="A CSS font stack, e.g. 'Inter', system-ui, sans-serif"
                error={errors.fontFamily?.message}
              >
                {(props) => <Input {...props} {...register('fontFamily')} spellCheck={false} />}
              </Field>

              <Field
                label="Heading font"
                hint="Fonts are not loaded for you — use ones people already have."
                error={errors.headingFontFamily?.message}
              >
                {(props) => (
                  <Input {...props} {...register('headingFontFamily')} spellCheck={false} />
                )}
              </Field>

              <div className={styles.pairRow}>
                <Field
                  label="Base text size"
                  hint="A CSS length, e.g. 16px"
                  error={errors.baseFontSize?.message}
                >
                  {(props) => <Input {...props} {...register('baseFontSize')} />}
                </Field>

                <Field
                  label="Corner rounding"
                  hint="A CSS length, e.g. 0.75rem"
                  error={errors.borderRadius?.message}
                >
                  {(props) => <Input {...props} {...register('borderRadius')} />}
                </Field>
              </div>

              <Field
                label="Background gradient"
                hint="Optional CSS, e.g. linear-gradient(180deg, #fff, #eee). Leave it empty for a flat colour."
                error={errors.backgroundGradient?.message}
              >
                {(props) => (
                  <Input {...props} {...register('backgroundGradient')} spellCheck={false} />
                )}
              </Field>
            </fieldset>

            <fieldset className={styles.group}>
              <legend className={styles.groupTitle}>Movement</legend>
              <div className={styles.pairRow}>
                <Field label="How much movement" error={errors.animationLevel?.message}>
                  {(props) => (
                    <Select
                      {...props}
                      value={values.animationLevel ?? 'NORMAL'}
                      onChange={(event) =>
                        setValue('animationLevel', event.target.value as AnimationLevel, {
                          shouldDirty: true,
                        })
                      }
                    >
                      <option value="NONE">Still — nothing moves</option>
                      <option value="MINIMAL">Barely there</option>
                      <option value="NORMAL">Normal</option>
                      <option value="RICH">Generous</option>
                    </Select>
                  )}
                </Field>

                <Field label="How things arrive" error={errors.transitionStyle?.message}>
                  {(props) => (
                    <Select
                      {...props}
                      value={values.transitionStyle ?? 'FADE'}
                      onChange={(event) =>
                        setValue('transitionStyle', event.target.value as TransitionStyle, {
                          shouldDirty: true,
                        })
                      }
                    >
                      <option value="FADE">Fade in</option>
                      <option value="SLIDE">Slide up</option>
                      <option value="ZOOM">Grow in</option>
                      <option value="NONE">Just appear</option>
                    </Select>
                  )}
                </Field>
              </div>
            </fieldset>

            <Field
              label="Custom CSS"
              hint="Up to 8000 characters, scoped to this letter alone. No @import, no url(), no expression() and no style tags — those are rejected."
              error={errors.customCss?.message}
            >
              {(props) => (
                <Textarea {...props} {...register('customCss')} rows={6} spellCheck={false} />
              )}
            </Field>

            <div className={styles.formActions}>
              <Button type="submit" variant="primary" loading={saving}>
                {theme ? 'Save the theme' : 'Create the theme'}
              </Button>
              <Button variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </Stack>
        </form>
      </Card>

      <div className={styles.previewColumn}>
        <h3 className={styles.groupTitle}>How it looks</h3>
        <ThemeScope theme={preview} className={styles.preview}>
          <p className={styles.previewEyebrow}>Chapter one</p>
          <h4 className={styles.previewHeading}>The day we met</h4>
          <p className={styles.previewText}>
            I have started this letter four times. This is the version I am keeping, because it is
            the one that sounds like me.
          </p>
          <div className={styles.previewCard}>
            <p className={styles.previewQuiet}>Open when you miss me</p>
            <p className={styles.previewText}>Not yet. Come back when the time is right.</p>
          </div>
          <button type="button" className={styles.previewButton} disabled>
            Read it
          </button>
        </ThemeScope>
      </div>
    </div>
  );
}
