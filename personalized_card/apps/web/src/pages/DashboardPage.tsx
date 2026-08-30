import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { Experience } from '@letter/types';
import styles from './Dashboard.module.css';

export function DashboardPage() {
  const { data } = useQuery({
    queryKey: ['experiences'],
    queryFn: () => api.get<Experience[]>('/api/experiences'),
  });

  return (
    <div>
      <div className={styles.hero}>
        <div>
          <h1>Your letters</h1>
          <p>Take your time. There&apos;s no rush.</p>
        </div>
        <Link className={styles.cta} to="/experiences/new">
          New experience
        </Link>
      </div>
      <ul className={styles.list}>
        {(data ?? []).map((exp) => (
          <li key={exp.id}>
            <Link to={`/experiences/${exp.id}/edit`}>
              <strong>{exp.title}</strong>
              <span>
                For {exp.recipientName} · {exp.status}
              </span>
            </Link>
          </li>
        ))}
        {data?.length === 0 && <p>No experiences yet. Start with a letter.</p>}
      </ul>
    </div>
  );
}

export function ExperienceListPage() {
  return <DashboardPage />;
}
