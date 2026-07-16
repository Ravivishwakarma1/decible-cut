import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './AdminLoginPage.module.css';
import { useSEO } from '../hooks/useSEO';
import { Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';

export const AdminLoginPage: React.FC = () => {
  useSEO({
    title: 'Admin Verification | DecibelCut',
    description: 'Provide administrator password to access the support inbox dashboard.'
  });

  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isShaking, setIsShaking] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Admin password check. Support environment variable or fallback to standard password
    const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'decibelcutadmin';

    if (password === adminPassword) {
      localStorage.setItem('decibelcut_admin_auth', 'true');
      navigate('/admin/inbox');
    } else {
      setError('Incorrect administrator password. Please try again.');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
  };

  return (
    <div className={styles.root}>
      <div className={[styles.card, isShaking ? styles.shake : ''].join(' ')}>
        <div className={styles.iconWrap}>
          <Lock size={24} />
        </div>

        <div className={styles.titleArea}>
          <h2 className={styles.title}>Admin Access</h2>
          <p className={styles.subtitle}>
            Please enter your administrator password to unlock the support inbox dashboard.
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="admin-pass" className={styles.label}>Password</label>
            <div className={styles.inputWrapper}>
              <input
                type={showPassword ? 'text' : 'password'}
                id="admin-pass"
                className={styles.input}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                placeholder="••••••••"
                required
                autoFocus
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && <p className={styles.errorText}>{error}</p>}

          <button type="submit" className={styles.submitBtn}>
            Unlock Dashboard
          </button>
        </form>

        <a href="/" className={styles.backHome} onClick={(e) => { e.preventDefault(); navigate('/'); }}>
          <ArrowLeft size={14} /> Back to Home
        </a>
      </div>
    </div>
  );
};
export default AdminLoginPage;
