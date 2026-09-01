import { useMemo, useState } from 'react';
import { Check, Copy, Palette, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Theme } from '@letter/types';
import type { CreateThemeInput } from '@letter/validation';
import { ThemeStudio } from '../../components/ThemeStudio';
import {
  useCreateTheme,
  useDeleteTheme,
  useForkTheme,
  useSetTheme,
  useThemes,
  useUpdateTheme,
} from '../../hooks/useExperience';
import { useThemeStyle } from '../../lib/theme';
import { Button, Card, ConfirmDialog, ErrorState, Spinner, cx, useToast } from '../../ui';
import { useExperienceContext } from './ExperienceLayout';
import styles from './ThemePage.module.css';
import pageStyles from './creator.module.css';

type StudioState = { theme: Theme | null } | null;

export default function ThemePage() {
  const experience = useExperienceContext();
  const experienceId = experience.id;
  const { notify, notifyError } = useToast();

  const { data, isPending, isError, error, refetch } = useThemes();
  const setTheme = useSetTheme(experienceId);
  const createTheme = useCreateTheme();
  const updateTheme = useUpdateTheme();
  const forkTheme = useForkTheme();
  const deleteTheme = useDeleteTheme();

  const [studio, setStudio] = useState<StudioState>(null);
  const [pendingDelete, setPendingDelete] = useState<Theme | null>(null);

  const { builtIn, mine } = useMemo(() => {
    const themes = data ?? [];
    return {
      builtIn: themes.filter((theme) => theme.isBuiltIn),
      mine: themes.filter((theme) => !theme.isBuiltIn),
    };
  }, [data]);

  function apply(theme: Theme) {
    setTheme.mutate(theme.id, {
      onSuccess: () => notify(`This letter now wears "${theme.name}".`),
      onError: notifyError,
    });
  }

  function save(values: CreateThemeInput) {
    const editing = studio?.theme ?? null;
    if (editing) {
      updateTheme.mutate(
        { id: editing.id, ...values },
        {
          onSuccess: () => {
            notify('Theme saved.');
            setStudio(null);
          },
          onError: notifyError,
        },
      );
      return;
    }
    createTheme.mutate(values, {
      onSuccess: (theme) => {
        notify('Theme created. Apply it whenever you like.');
        setStudio(null);
        apply(theme);
      },
      onError: notifyError,
    });
  }

  if (studio) {
    return (
      <div className={pageStyles.page}>
        <div>
          <h2 className={pageStyles.pageTitle}>
            {studio.theme ? `Editing "${studio.theme.name}"` : 'A theme of your own'}
          </h2>
          <p className={pageStyles.pageLead}>
            Change anything and watch it happen on the right. Nothing is saved until you say so.
          </p>
        </div>

        <ThemeStudio
          theme={studio.theme}
          saving={createTheme.isPending || updateTheme.isPending}
          onSave={save}
          onCancel={() => setStudio(null)}
        />
      </div>
    );
  }

  return (
    <div className={pageStyles.page}>
      <div className={pageStyles.pageHead}>
        <div>
          <h2 className={pageStyles.pageTitle}>How it looks</h2>
          <p className={pageStyles.pageLead}>
            A theme sets the colours, the type and how much things move. Pick one, or make your own
            from a copy of one you nearly like.
          </p>
        </div>
        <Button variant="primary" onClick={() => setStudio({ theme: null })}>
          <Plus size={16} aria-hidden />
          New theme
        </Button>
      </div>

      {isPending && <Spinner label="Loading the themes" />}
      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && (
        <>
          <section>
            <h3 className={pageStyles.sectionTitle}>Ready to use</h3>
            <ul className={cx(pageStyles.grid, pageStyles.resetList, styles.themeGrid)}>
              {builtIn.map((theme) => (
                <ThemeCard
                  key={theme.id}
                  theme={theme}
                  current={experience.themeId === theme.id}
                  applying={setTheme.isPending && setTheme.variables === theme.id}
                  onApply={() => apply(theme)}
                  onFork={() =>
                    forkTheme.mutate(
                      { themeId: theme.id, name: `${theme.name} (mine)` },
                      {
                        onSuccess: (copy) => {
                          notify('Copied. Now make it yours.');
                          setStudio({ theme: copy });
                        },
                        onError: notifyError,
                      },
                    )
                  }
                />
              ))}
            </ul>
          </section>

          <section>
            <h3 className={pageStyles.sectionTitle}>Yours</h3>
            {mine.length === 0 ? (
              <p className={pageStyles.muted}>
                Nothing yet. Copy one above and change what you want, or start a new theme from
                scratch.
              </p>
            ) : (
              <ul className={cx(pageStyles.grid, pageStyles.resetList, styles.themeGrid)}>
                {mine.map((theme) => (
                  <ThemeCard
                    key={theme.id}
                    theme={theme}
                    current={experience.themeId === theme.id}
                    applying={setTheme.isPending && setTheme.variables === theme.id}
                    onApply={() => apply(theme)}
                    onFork={() =>
                      forkTheme.mutate(
                        { themeId: theme.id, name: `${theme.name} (copy)` },
                        {
                          onSuccess: (copy) => setStudio({ theme: copy }),
                          onError: notifyError,
                        },
                      )
                    }
                    onEdit={() => setStudio({ theme })}
                    onDelete={() => setPendingDelete(theme)}
                  />
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteTheme.mutate(pendingDelete.id, {
            onSuccess: () => notify(`"${pendingDelete.name}" is gone.`),
            onError: notifyError,
          });
        }}
        title={pendingDelete ? `Delete "${pendingDelete.name}"?` : 'Delete this theme?'}
        description="Any letter using it falls back to the default look. The letters themselves are untouched."
        confirmLabel="Delete the theme"
        destructive
      />
    </div>
  );
}

function ThemeCard({
  theme,
  current,
  applying,
  onApply,
  onFork,
  onEdit,
  onDelete,
}: {
  theme: Theme;
  current: boolean;
  applying: boolean;
  onApply: () => void;
  onFork: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  // The swatch only needs the theme's variables, not a full ThemeScope — that
  // also repaints the page background, which eight swatches must not fight over.
  const swatchStyle = useThemeStyle(theme);

  return (
    <li>
      <Card className={cx(styles.themeCard, current && styles.themeCardCurrent)}>
        <div className={styles.swatch} style={swatchStyle} aria-hidden>
          <span className={styles.swatchHeading}>Aa</span>
          <span className={styles.swatchDots}>
            <span className={styles.swatchPrimary} />
            <span className={styles.swatchSecondary} />
            <span className={styles.swatchSurface} />
          </span>
        </div>

        <div className={styles.themeText}>
          <span className={styles.themeName}>
            {theme.name}
            {current && (
              <span className={styles.currentFlag}>
                <Check size={13} aria-hidden /> In use
              </span>
            )}
          </span>
          {theme.description && (
            <span className={cx(pageStyles.muted, pageStyles.small)}>{theme.description}</span>
          )}
        </div>

        <div className={pageStyles.actions}>
          <Button size="sm" variant={current ? 'ghost' : 'primary'} onClick={onApply} loading={applying}>
            <Palette size={14} aria-hidden />
            {current ? 'Applied' : 'Use this'}
          </Button>
          <Button size="sm" variant="ghost" onClick={onFork} aria-label={`Make a copy of ${theme.name}`}>
            <Copy size={14} aria-hidden />
            Copy
          </Button>
          {onEdit && (
            <Button size="sm" variant="ghost" onClick={onEdit} aria-label={`Edit ${theme.name}`}>
              <Pencil size={14} aria-hidden />
              Edit
            </Button>
          )}
          {onDelete && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onDelete}
              aria-label={`Delete ${theme.name}`}
            >
              <Trash2 size={14} aria-hidden />
            </Button>
          )}
        </div>
      </Card>
    </li>
  );
}
