import { BLOCK_META, type BlockType } from '@letter/types';
import { Modal } from '../../../ui';
import styles from './builder.module.css';

const ORDER: BlockType[] = [
  'HEADING',
  'TEXT',
  'QUOTE',
  'IMAGE',
  'GALLERY',
  'VIDEO',
  'AUDIO',
  'TIMELINE',
  'COUNTDOWN',
  'OPEN_WHEN',
  'FUTURE_LETTER',
  'FINAL_QUESTION',
  'BUTTON',
  'DIVIDER',
];

export function AddBlockMenu({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (type: BlockType) => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="What goes here?"
      description="You can change your mind later — nothing about this is final."
    >
      <ul className={styles.pickerGrid}>
        {ORDER.map((type) => {
          const meta = BLOCK_META[type];
          return (
            <li key={type}>
              <button
                type="button"
                className={styles.pickerItem}
                onClick={() => {
                  onPick(type);
                  onClose();
                }}
              >
                <span className={styles.pickerEmoji} aria-hidden>
                  {meta.emoji}
                </span>
                <span className={styles.pickerName}>{meta.label}</span>
                <span className={styles.pickerDescription}>{meta.description}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
