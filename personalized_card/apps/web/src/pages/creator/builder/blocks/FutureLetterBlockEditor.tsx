import { Link } from 'react-router-dom';
import type { FutureLetterBlockContent } from '@letter/types';
import { useExperience } from '../../../../hooks/useExperience';
import { formatDate } from '../../../../lib/format';
import { Switch } from '../../../../ui';
import type { EditorProps } from './types';
import styles from '../builder.module.css';

export default function FutureLetterBlockEditor({
  content,
  onChange,
  onCommit,
  experienceId,
}: EditorProps<FutureLetterBlockContent>) {
  const { data } = useExperience(experienceId);
  const letter = data?.futureLetter ?? null;

  return (
    <div className={styles.editorStack}>
      <p className={styles.editorNote}>
        {letter ? (
          <>
            This shows &ldquo;{letter.title}&rdquo;, which unlocks on{' '}
            {formatDate(letter.unlockDate, 'MMMM d, yyyy')}.{' '}
            <Link to={`/experiences/${experienceId}/future-letter`}>Edit the letter</Link>
          </>
        ) : (
          <>
            There is no future letter yet, so this block will not show anything.{' '}
            <Link to={`/experiences/${experienceId}/future-letter`}>Write one</Link>
          </>
        )}
      </p>

      <Switch
        checked={content.showCountdown ?? true}
        onChange={(checked) => {
          onChange({ ...content, showCountdown: checked });
          onCommit();
        }}
        label="Show the countdown while it is still sealed"
      />
    </div>
  );
}
