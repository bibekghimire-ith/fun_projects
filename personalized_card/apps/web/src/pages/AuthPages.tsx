import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import styles from './Auth.module.css';

export function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await login(String(fd.get('email')), String(fd.get('password')));
      nav('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  }

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={onSubmit}>
        <h1>Welcome back</h1>
        <p>I made this for you — sign in to keep building.</p>
        {error && <p className={styles.error}>{error}</p>}
        <label>
          Email
          <input name="email" type="email" defaultValue="creator@example.com" required />
        </label>
        <label>
          Password
          <input name="password" type="password" defaultValue="Password123!" required />
        </label>
        <button type="submit">Sign in</button>
        <Link to="/register">Need an account?</Link>
      </form>
    </div>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await register(String(fd.get('name')), String(fd.get('email')), String(fd.get('password')));
      nav('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
  }

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={onSubmit}>
        <h1>Create an account</h1>
        {error && <p className={styles.error}>{error}</p>}
        <label>
          Name
          <input name="name" required />
        </label>
        <label>
          Email
          <input name="email" type="email" required />
        </label>
        <label>
          Password
          <input name="password" type="password" minLength={8} required />
        </label>
        <button type="submit">Register</button>
        <Link to="/login">Already have an account?</Link>
      </form>
    </div>
  );
}
