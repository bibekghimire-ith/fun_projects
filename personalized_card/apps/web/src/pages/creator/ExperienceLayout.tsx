import { NavLink, Outlet, useOutletContext, useParams } from 'react-router-dom';
import { Eye, Share2 } from 'lucide-react';
import { useExperience, type ExperienceDetail } from '../../hooks/useExperience';
import { Button, ErrorState, Spinner, StatusBadge, cx } from '../../ui';
import styles from './ExperienceLayout.module.css';
import pageStyles from './creator.module.css';

const TABS: { to: string; label: string }[] = [
  { to: 'edit', label: 'Build' },
  { to: 'settings', label: 'Details' },
  { to: 'memories', label: 'Timeline' },
  { to: 'open-when', label: 'Open when' },
  { to: 'future-letter', label: 'Future letter' },
  { to: 'surprise', label: 'Surprise' },
  { to: 'media', label: 'Media' },
  { to: 'theme', label: 'Theme' },
  { to: 'customize', label: 'Wording' },
  { to: 'responses', label: 'Replies' },
  { to: 'share', label: 'Share' },
];

export default function ExperienceLayout() {
  const { id } = useParams<{ id: string }>();
  const { data, isPending, isError, error, refetch } = useExperience(id);

  if (isPending) {
    return (
      <div className={styles.centered}>
        <Spinner label="Opening your letter" />
      </div>
    );
  }

  if (isError || !data) {
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  }

  return (
    <div className={styles.frame}>
      <header className={styles.head}>
        <div className={styles.headText}>
          <div className={pageStyles.wrapRow}>
            <h1 className={styles.title}>{data.title}</h1>
            <StatusBadge status={data.status} />
          </div>
          <p className={styles.subtitle}>For {data.recipientName}</p>
        </div>

        <div className={pageStyles.actions}>
          <Button size="sm" onClick={() => window.open(`/experiences/${data.id}/preview`, '_blank')}>
            <Eye size={14} aria-hidden />
            Preview
          </Button>
          <NavLink to={`/experiences/${data.id}/share`} className={styles.shareLink}>
            <Share2 size={14} aria-hidden />
            Share
          </NavLink>
        </div>
      </header>

      <nav className={styles.tabs} aria-label="This letter">
        <ul className={styles.tabList}>
          {TABS.map((tab) => (
            <li key={tab.to}>
              <NavLink
                to={`/experiences/${data.id}/${tab.to}`}
                className={({ isActive }) => cx(styles.tab, isActive && styles.tabActive)}
              >
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <Outlet context={data} />
    </div>
  );
}

/** The loaded letter, for any page rendered inside this layout. */
export function useExperienceContext(): ExperienceDetail {
  return useOutletContext<ExperienceDetail>();
}
