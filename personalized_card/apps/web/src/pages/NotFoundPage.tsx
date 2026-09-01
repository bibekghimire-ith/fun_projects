import { Link } from 'react-router-dom';
import { EmptyState } from '../ui';

export default function NotFoundPage() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '70vh', padding: '2rem' }}>
      <EmptyState
        emoji="🔎"
        title="There's nothing here"
        description="The page you're looking for doesn't exist, or the link has changed."
        action={<Link to="/dashboard">Back to your letters</Link>}
      />
    </div>
  );
}
