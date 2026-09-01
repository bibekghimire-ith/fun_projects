import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import { API_BASE_URL, getToken } from '../../api';
import { useResponses } from '../../hooks/useExperience';
import { formatDate, relativeTime } from '../../lib/format';
import { Button, Card, EmptyState, ErrorState, Spinner, cx, useToast } from '../../ui';
import { useExperienceContext } from './ExperienceLayout';
import styles from './ResponsesPage.module.css';
import pageStyles from './creator.module.css';

export default function ResponsesPage() {
  const experience = useExperienceContext();
  const experienceId = experience.id;
  const { notifyError } = useToast();
  const { data, isPending, isError, error, refetch } = useResponses(experienceId);
  const [downloading, setDownloading] = useState(false);

  /**
   * The export endpoint wants an Authorization header, which a plain link
   * cannot send — so fetch it and hand the browser the file ourselves.
   */
  async function downloadCsv() {
    setDownloading(true);
    try {
      const token = getToken();
      const response = await fetch(
        `${API_BASE_URL}/api/experiences/${experienceId}/responses/export`,
        {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        },
      );
      if (!response.ok) throw new Error('That download did not work. Try again in a moment.');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `replies-${experienceId}.csv`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      notifyError(downloadError);
    } finally {
      setDownloading(false);
    }
  }

  const responses = data ?? [];

  return (
    <div className={pageStyles.page}>
      <div className={pageStyles.pageHead}>
        <div>
          <h2 className={pageStyles.pageTitle}>What they said back</h2>
          <p className={pageStyles.pageLead}>
            Every answer to your final question, newest first.
          </p>
        </div>
        {responses.length > 0 && (
          <Button onClick={() => void downloadCsv()} loading={downloading}>
            <Download size={16} aria-hidden />
            Download as CSV
          </Button>
        )}
      </div>

      {isPending && <Spinner label="Loading the replies" />}
      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && responses.length === 0 && (
        <EmptyState
          emoji="📮"
          title="Nothing yet"
          description={
            experience.finalSurprise
              ? 'Their answer will appear here the moment they send it.'
              : 'There is no question at the end of this letter yet, so there is nothing for them to answer.'
          }
          action={
            experience.finalSurprise ? undefined : (
              <Link to={`/experiences/${experienceId}/surprise`}>Write the final question</Link>
            )
          }
        />
      )}

      {responses.length > 0 && (
        <ul className={styles.list}>
          {responses.map((response) => (
            <li key={response.id}>
              <Card className={styles.reply}>
                <p className={styles.answer}>{response.answer}</p>
                <p className={cx(pageStyles.muted, pageStyles.small)}>
                  {formatDate(response.respondedAt, 'EEEE, MMMM d, yyyy')} at{' '}
                  {formatDate(response.respondedAt, 'HH:mm')} · {relativeTime(response.respondedAt)}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
