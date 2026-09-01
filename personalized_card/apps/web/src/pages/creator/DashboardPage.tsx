import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Copy, Eye, Pencil, Plus, Share2, Trash2 } from 'lucide-react';
import type { Experience } from '@letter/types';
import {
  useDeleteExperience,
  useDuplicateExperience,
  useExperiences,
} from '../../hooks/useExperience';
import { formatDate, relativeTime } from '../../lib/format';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Spinner,
  StatusBadge,
  useToast,
} from '../../ui';
import styles from './creator.module.css';

const EVENT_LABELS: Record<Experience['eventType'], string> = {
  BIRTHDAY: 'Birthday',
  ANNIVERSARY: 'Anniversary',
  VALENTINES: "Valentine's",
  CUSTOM: 'Just because',
};

export default function DashboardPage() {
  const { data, isPending, isError, error, refetch } = useExperiences();
  const duplicate = useDuplicateExperience();
  const remove = useDeleteExperience();
  const { notify, notifyError } = useToast();
  const navigate = useNavigate();
  const [pendingDelete, setPendingDelete] = useState<Experience | null>(null);

  function onDuplicate(experience: Experience) {
    duplicate.mutate(experience.id, {
      onSuccess: (copy) => {
        notify(`Copied. You are now editing "${copy.title}".`);
        navigate(`/experiences/${copy.id}/edit`);
      },
      onError: notifyError,
    });
  }

  function onDelete(experience: Experience) {
    remove.mutate(experience.id, {
      onSuccess: () => notify(`"${experience.title}" is gone.`),
      onError: notifyError,
    });
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Your letters</h1>
          <p className={styles.pageLead}>
            Everything you have written, and everything you are still writing. Take your time.
            There&rsquo;s no rush.
          </p>
        </div>
        <Button variant="primary" onClick={() => navigate('/experiences/new')}>
          <Plus size={16} aria-hidden />
          Start a new one
        </Button>
      </div>

      {isPending && <Spinner label="Loading your letters" />}

      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && data.length === 0 && (
        <EmptyState
          emoji="✉️"
          title="Nothing here yet"
          description="The first one is the hardest. Pick a starting point and write a few lines — you can change everything later."
          action={
            <Button variant="primary" onClick={() => navigate('/experiences/new')}>
              Write your first letter
            </Button>
          }
        />
      )}

      {data && data.length > 0 && (
        <ul className={styles.list}>
          {data.map((experience) => (
            <li key={experience.id}>
              <Card className={styles.itemCard}>
                <div className={styles.itemHead}>
                  <div>
                    <h2 className={styles.itemTitle}>
                      <Link to={`/experiences/${experience.id}/edit`} className={styles.cardLink}>
                        {experience.title}
                      </Link>
                    </h2>
                    <p className={styles.itemMeta}>
                      <span>For {experience.recipientName}</span>
                      <span className={styles.dot}>{EVENT_LABELS[experience.eventType]}</span>
                      {experience.eventDate && (
                        <span className={styles.dot}>{formatDate(experience.eventDate)}</span>
                      )}
                      <span className={styles.dot}>
                        Last touched {relativeTime(experience.updatedAt)}
                      </span>
                    </p>
                  </div>
                  <StatusBadge status={experience.status} />
                </div>

                <div className={styles.actions}>
                  <Button size="sm" onClick={() => navigate(`/experiences/${experience.id}/edit`)}>
                    <Pencil size={14} aria-hidden />
                    Edit
                  </Button>
                  <Button size="sm" onClick={() => navigate(`/experiences/${experience.id}/share`)}>
                    <Share2 size={14} aria-hidden />
                    Share
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => navigate(`/experiences/${experience.id}/preview`)}
                  >
                    <Eye size={14} aria-hidden />
                    Preview
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDuplicate(experience)}
                    loading={duplicate.isPending && duplicate.variables === experience.id}
                  >
                    <Copy size={14} aria-hidden />
                    Duplicate
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className={styles.pushRight}
                    onClick={() => setPendingDelete(experience)}
                  >
                    <Trash2 size={14} aria-hidden />
                    Delete
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) onDelete(pendingDelete);
        }}
        title="Delete this letter?"
        description={
          pendingDelete
            ? `"${pendingDelete.title}" and everything in it — the chapters, the photos, the sealed notes — will be removed. If it has been shared, the link stops working. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete it"
        destructive
      />
    </div>
  );
}
