import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth';
import styles from './Shell.module.css';

export function Shell() {
  const { user, logout } = useAuth();
  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <NavLink to="/dashboard" className={styles.brand}>
          A Letter From Me
        </NavLink>
        <nav className={styles.nav}>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/experiences">Experiences</NavLink>
        </nav>
        <div className={styles.user}>
          <span>{user?.name}</span>
          <button type="button" onClick={() => logout()}>
            Sign out
          </button>
        </div>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
