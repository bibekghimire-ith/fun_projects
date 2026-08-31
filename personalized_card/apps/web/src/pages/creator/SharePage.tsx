import { useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { Check, Copy, Eye, Lock, Unlock } from 'lucide-react';
import { useExperienceContext } from './ExperienceLayout';
import {
  usePublish,
  usePublishCheck,
  useRevoke,
  useShare,
  useUnpublish,
} from '../../hooks/useExperience';
import {
  Button,
  Card,
  ConfirmDialog,
  ErrorState,
  Spinner,
  Stack,
  StatusBadge,
  cx,
  useToast,
} from '../../ui';
import styles from './SharePage.module.css';
import pageStyles from './creator.module.css';

const MISSING_COVER = 'MISSING_COVER';

/**
 * The publish check builds its own fix links, and one of them points at a path
 * the app does not have. Rewrite it rather than sending the creator nowhere.
 */
function fixHref(path: string | undefined): string | null {
  if (!path) return null;
  return path.replace(/\/builder$/, '/edit');
}

export default function SharePage() {
  const experience = useExperienceContext();
  const experienceId = experience.id;
  const { notify, notifyError } = useToast();

  const check = usePublishCheck(experienceId);
  const share = useShare(experienceId);
  const publish = usePublish(experienceId);
  const unpublish = useUnpublish(experienceId);
  const revoke = useRevoke(experienceId);

  const [copied, setCopied] = useState(false);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);

  // A local const keeps the narrowing inside the callbacks below.
  const shareInfo = share.data;
  const issues = check.data?.issues ?? [];
  const onlyMissingCover =
    issues.length === 1 && issues[0].code === MISSING_COVER;
  const isPublished = experience.status === 'PUBLISHED';
  const isRevoked = experience.status === 'REVOKED';

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      notify('Link copied.');
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      notifyError(new Error('Your browser would not let us copy it. Select the link and copy it by hand.'));
    }
  }

  function doPublish(allowWithoutCover: boolean) {
    publish.mutate(allowWithoutCover, {
      onSuccess: () => notify('It is live. The link works from this moment on.'),
      onError: notifyError,
    });
  }

  return (
    <div className={pageStyles.page}>
      <div className={pageStyles.pageHead}>
        <div>
          <h2 className={pageStyles.pageTitle}>Sending it</h2>
          <p className={pageStyles.pageLead}>
            One private link, for one person. Nothing is public and nothing is listed anywhere.
          </p>
        </div>
        <StatusBadge status={experience.status} />
      </div>

      {isRevoked && (
        <Card className={cx(pageStyles.notice, pageStyles.noticeDanger)}>
          <strong>This letter has been revoked.</strong>
          <span className={pageStyles.small}>
            The old link no longer opens anything, and it cannot be published again. If you want to
            send this letter after all, duplicate it from your dashboard and share the copy.
          </span>
        </Card>
      )}

      {!isRevoked && (
        <Card>
          <Stack>
            <h3 className={pageStyles.sectionTitle}>Is it ready?</h3>

            {check.isPending && <Spinner label="Checking the letter" />}
            {check.isError && (
              <ErrorState error={check.error} onRetry={() => void check.refetch()} />
            )}

            {check.data?.ok && (
              <div className={cx(pageStyles.notice, pageStyles.noticeGood)}>
                <strong>Everything is in place.</strong>
                <span className={pageStyles.small}>
                  Whenever you are ready — there is no rush.
                </span>
              </div>
            )}

            {issues.length > 0 && (
              <ul className={styles.issueList}>
                {issues.map((issue) => {
                  const href = fixHref(issue.fixPath);
                  return (
                    <li key={issue.code} className={styles.issue}>
                      <span>{issue.message}</span>
                      {href && (
                        <Link to={href} className={styles.issueLink}>
                          Take me there
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className={pageStyles.actions}>
              {!isPublished && (
                <Button
                  variant="primary"
                  loading={publish.isPending}
                  disabled={issues.length > 0 && !onlyMissingCover}
                  onClick={() => doPublish(onlyMissingCover)}
                >
                  {experience.status === 'UNPUBLISHED' ? 'Make it live again' : 'Send it'}
                </Button>
              )}

              {!isPublished && onlyMissingCover && (
                <span className={cx(pageStyles.muted, pageStyles.small)}>
                  There is no cover image. A letter can go without one — it will just open on your
                  words instead of a photo.
                </span>
              )}

              {isPublished && (
                <Button
                  loading={unpublish.isPending}
                  onClick={() =>
                    unpublish.mutate(undefined, {
                      onSuccess: () => notify('Paused. The link shows a quiet holding page for now.'),
                      onError: notifyError,
                    })
                  }
                >
                  Pause it
                </Button>
              )}

              <Button variant="ghost" onClick={() => setConfirmingRevoke(true)}>
                Revoke the link
              </Button>
            </div>
          </Stack>
        </Card>
      )}

      <Card>
        <Stack>
          <h3 className={pageStyles.sectionTitle}>The link</h3>

          {share.isPending && <Spinner label="Loading the link" />}
          {share.isError && <ErrorState error={share.error} onRetry={() => void share.refetch()} />}

          {shareInfo && (
            <div className={styles.shareGrid}>
              <div className={styles.shareText}>
                <p className={cx(pageStyles.mono, styles.url)}>{shareInfo.url}</p>

                <div className={pageStyles.actions}>
                  <Button variant="primary" onClick={() => void copyLink(shareInfo.url)}>
                    {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
                    {copied ? 'Copied' : 'Copy the link'}
                  </Button>
                  <Button onClick={() => window.open(`/experiences/${experienceId}/preview`, '_blank')}>
                    <Eye size={14} aria-hidden />
                    See what they see
                  </Button>
                </div>

                <p className={styles.pinLine}>
                  {shareInfo.pinEnabled ? (
                    <>
                      <Lock size={14} aria-hidden />
                      They will need the four-digit code before it opens.
                    </>
                  ) : (
                    <>
                      <Unlock size={14} aria-hidden />
                      Anyone with this link can read it.{' '}
                      <Link to={`/experiences/${experienceId}/settings`}>Add a code</Link>
                    </>
                  )}
                </p>

                {!isPublished && (
                  <p className={cx(pageStyles.muted, pageStyles.small)}>
                    This link only opens once the letter is live.
                  </p>
                )}
              </div>

              <figure className={styles.qr}>
                <QRCodeCanvas value={shareInfo.url} size={148} includeMargin />
                <figcaption className={cx(pageStyles.muted, pageStyles.small)}>
                  Point a phone camera at this to open the letter.
                </figcaption>
              </figure>
            </div>
          )}
        </Stack>
      </Card>

      <ConfirmDialog
        open={confirmingRevoke}
        onClose={() => setConfirmingRevoke(false)}
        onConfirm={() =>
          revoke.mutate(undefined, {
            onSuccess: () => notify('The link has been revoked.'),
            onError: notifyError,
          })
        }
        title="Revoke this link for good?"
        description="The link stops working the moment you do this, for everyone, forever — including anyone in the middle of reading. A new link cannot be issued for this letter. Everything you wrote is kept, and you can duplicate it to start again."
        confirmLabel="Revoke it"
        destructive
      />
    </div>
  );
}
