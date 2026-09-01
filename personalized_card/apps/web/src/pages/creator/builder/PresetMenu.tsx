import { useMemo } from 'react';
import type { BlockPreset } from '@letter/types';
import { usePresets } from '../../../hooks/useExperience';
import { EmptyState, ErrorState, Modal, Spinner } from '../../../ui';
import styles from './builder.module.css';

export function PresetMenu({
  open,
  onClose,
  onPick,
  pendingSlug,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (slug: string) => void;
  pendingSlug: string | null;
}) {
  const { data, isPending, isError, error, refetch } = usePresets();

  const grouped = useMemo(() => {
    const groups = new Map<BlockPreset['category'], BlockPreset[]>();
    for (const preset of data ?? []) {
      const list = groups.get(preset.category) ?? [];
      list.push(preset);
      groups.set(preset.category, list);
    }
    return [...groups.entries()];
  }, [data]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Add a ready-made piece"
      description="A few blocks that already fit together. Drop one in and rewrite the words."
    >
      {isPending && <Spinner label="Loading the ready-made pieces" />}
      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && data.length === 0 && (
        <EmptyState
          title="Nothing to add here"
          description="No ready-made pieces are installed. You can still add blocks one at a time."
        />
      )}

      {grouped.map(([category, presets]) => (
        <section key={category} className={styles.presetGroup}>
          <h3 className={styles.presetGroupTitle}>{category}</h3>
          <ul className={styles.pickerGrid}>
            {presets.map((preset) => (
              <li key={preset.slug}>
                <button
                  type="button"
                  className={styles.pickerItem}
                  disabled={pendingSlug !== null}
                  onClick={() => onPick(preset.slug)}
                >
                  <span className={styles.pickerEmoji} aria-hidden>
                    {preset.emoji}
                  </span>
                  <span className={styles.pickerName}>
                    {preset.name}
                    {pendingSlug === preset.slug ? ' — adding…' : ''}
                  </span>
                  <span className={styles.pickerDescription}>{preset.description}</span>
                  <span className={styles.pickerMeta}>
                    {preset.blocks.length} {preset.blocks.length === 1 ? 'block' : 'blocks'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Modal>
  );
}
