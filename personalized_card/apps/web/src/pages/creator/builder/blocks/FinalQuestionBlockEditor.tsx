import { Link } from 'react-router-dom';
import type { FinalQuestionBlockContent } from '@letter/types';
import { useExperience } from '../../../../hooks/useExperience';
import { Switch } from '../../../../ui';
import type { EditorProps } from './types';
import styles from '../builder.module.css';

export default function FinalQuestionBlockEditor({
  content,
  onChange,
  onCommit,
  experienceId,
}: EditorProps<FinalQuestionBlockContent>) {
  const { data } = useExperience(experienceId);
  const surprise = data?.finalSurprise ?? null;

  return (
    <div className={styles.editorStack}>
      <p className={styles.editorNote}>
        {surprise ? (
          <>
            This asks: &ldquo;{surprise.question}&rdquo;{' '}
            <Link to={`/experiences/${experienceId}/surprise`}>Change the question</Link>
          </>
        ) : (
          <>
            You have not written the final surprise yet, so this block will not show anything.{' '}
            <Link to={`/experiences/${experienceId}/surprise`}>Write it</Link>
          </>
        )}
      </p>

      <Switch
        checked={content.showIntro ?? true}
        onChange={(checked) => {
          onChange({ ...content, showIntro: checked });
          onCommit();
        }}
        label="Lead into it with a line first"
        hint="“That's everything. Well… almost.”"
      />
    </div>
  );
}
