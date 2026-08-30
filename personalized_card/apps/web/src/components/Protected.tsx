import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth';
import type { ReactNode } from 'react';

export function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p style={{ padding: 24 }}>Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
