import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSEO } from '../hooks/useSEO';
import styles from './NotFoundPage.module.css';
import { Home, ArrowLeft, HelpCircle } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  useSEO({
    title: '404 Page Not Found',
    description: 'The page you are looking for does not exist or has been moved.',
    robots: 'noindex, nofollow'
  });

  const navigate = useNavigate();

  return (
    <div className={styles.root}>
      <div className={styles.container}>
        {/* Animated Icon Container */}
        <div className={styles.iconContainer}>
          <div className={styles.pulseRing}></div>
          <HelpCircle size={48} className={styles.icon} />
        </div>

        {/* Error Text */}
        <h1 className={styles.errorCode}>404</h1>
        <h2 className={styles.title}>Lost in Space?</h2>
        <p className={styles.description}>
          We couldn't find the page you're looking for. It might have been moved, deleted, or never existed in the first place.
        </p>

        {/* Action Buttons */}
        <div className={styles.actions}>
          <button onClick={() => navigate(-1)} className={styles.backBtn}>
            <ArrowLeft size={16} />
            Go Back
          </button>
          <button onClick={() => navigate('/')} className={styles.homeBtn}>
            <Home size={16} />
            Return Home
          </button>
        </div>
      </div>
    </div>
  );
};
