import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LogOut, PenLine, WifiOff } from 'lucide-react';
import { useAuth } from '../auth';
import { Button, cx } from '../ui';
import styles from './Shell.module.css';

const APP_NAME = import.meta.env.VITE_APP_NAME ?? 'A Letter From Me To You';

function navClass({ isActive }: { isActive: boolean }): string {
  return cx(styles.navLink, isActive && styles.navLinkActive);
}

/**
 * The app shell is precached (see public/sw.js), so it still opens offline —
 * but nothing in it actually works without the API. This just says so,
 * rather than letting every failed request look like a bug.
 */
function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}

export function Shell() {
  const { user, logout } = useAuth();
  const online = useOnlineStatus();

  return (
    <div className={styles.wrap}>
      <a className="skip-link" href="#main">
        Skip to the page
      </a>

      {!online && (
        <div className={styles.offline} role="status">
          <WifiOff size={15} aria-hidden />
          <span>You&rsquo;re offline. Changes won&rsquo;t save until you&rsquo;re back online.</span>
        </div>
      )}

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <NavLink to="/dashboard" className={styles.brand}>
            <PenLine size={17} aria-hidden />
            <span className={styles.brandName}>{APP_NAME}</span>
          </NavLink>

          <nav className={styles.nav} aria-label="Main">
            <NavLink to="/dashboard" className={navClass} end>
              Your letters
            </NavLink>
            <NavLink to="/experiences/new" className={navClass}>
              Start a new one
            </NavLink>
          </nav>

          <div className={styles.user}>
            {user && (
              <span className={styles.userName} title={user.email}>
                {user.name}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={() => void logout()}>
              <LogOut size={15} aria-hidden />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* tabIndex lets the skip link move focus here, not just the scroll position. */}
      <main className={styles.main} id="main" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
