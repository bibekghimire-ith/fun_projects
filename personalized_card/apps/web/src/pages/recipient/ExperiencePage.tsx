import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { ThemeScope } from '../../lib/theme';
import ExperienceRenderer from '../../components/experience/ExperienceRenderer';
import {
  classifyFailure,
  usePublicExperience,
} from '../../components/experience/publicApi';
import { FailureScreen, LoadingScreen } from '../../components/experience/StatusScreen';
import styles from './experience.module.css';

/**
 * The letter itself. Everything below this point is the shared renderer — the
 * creator's preview runs exactly the same code.
 */
export default function ExperiencePage() {
  const { token } = useParams<{ token: string }>();
  const query = usePublicExperience(token);
  const data = query.data;
  const title = data && !data.pinRequired ? data.title : null;

  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);

  if (!token) return <FailureScreen kind="notFound" />;
  if (query.isPending) return <LoadingScreen />;

  if (query.isError || !data) {
    return (
      <FailureScreen kind={classifyFailure(query.error)} onRetry={() => void query.refetch()} />
    );
  }

  if (data.pinRequired) return <Navigate to={`/e/${token}/pin`} replace />;

  return (
    <ThemeScope theme={data.theme} className={styles.page} fullHeight>
      <ExperienceRenderer experience={data} token={token} />
    </ThemeScope>
  );
}
