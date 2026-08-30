import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import type { Experience } from '@letter/types';

export function ExperienceEditPage() {
  const { id } = useParams<{ id: string }>();

  const { data: experience, isLoading, isError, error } = useQuery({
    queryKey: ['experiences', id],
    queryFn: () => api.get<Experience>(`/api/experiences/${id}`),
  });

  if (isLoading) return <div style={{ padding: '2rem' }}>Loading experience...</div>;
  if (isError) return <div style={{ padding: '2rem', color: 'red' }}>Error loading experience: {error.message}</div>;
  if (!experience) return <div style={{ padding: '2rem' }}>Experience not found</div>;

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '2rem 1rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>{experience.title}</h1>
          <p style={{ color: 'var(--color-muted)', margin: 0 }}>
            For {experience.recipientName}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Link
            to={`/e/${experience.publicToken}`}
            target="_blank"
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            Preview
          </Link>
          <Link
            to={`/experiences/${id}/share`}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-surface)',
              borderRadius: '4px',
              textDecoration: 'none',
            }}
          >
            Share
          </Link>
        </div>
      </header>

      <div style={{ display: 'flex', gap: '2rem' }}>
        <aside style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ padding: '0.5rem', backgroundColor: '#eee', borderRadius: '4px', fontWeight: 500 }}>General</div>
          <div style={{ padding: '0.5rem', borderRadius: '4px', cursor: 'pointer' }}>Sections & Blocks</div>
          <div style={{ padding: '0.5rem', borderRadius: '4px', cursor: 'pointer' }}>Theme</div>
          <div style={{ padding: '0.5rem', borderRadius: '4px', cursor: 'pointer' }}>Media & Audio</div>
        </aside>
        
        <main style={{ flex: 1, backgroundColor: '#fff', padding: '2rem', borderRadius: '8px', boxShadow: 'var(--shadow-sm)' }}>
          <h2>General Settings</h2>
          <p>This is where we will build the edit form.</p>
        </main>
      </div>
    </div>
  );
}
