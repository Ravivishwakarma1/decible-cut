import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './SupportPage.module.css';
import { supportDbService } from '../services/supportDbService';
import { useSEO } from '../hooks/useSEO';
import { Send, Check, ArrowLeft, AlertTriangle } from 'lucide-react';

interface FormErrors {
  name?: string;
  email?: string;
  subject?: string;
  category?: string;
  message?: string;
}

export const SupportPage: React.FC = () => {
  useSEO({
    title: 'Contact Customer Support | DecibelCut',
    description: 'Get help with DecibelCut. Submit bug reports, preset requests, feature suggestions, or general questions.'
  });

  const navigate = useNavigate();

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState<'Bug' | 'Preset Request' | 'Feature Request' | 'Feedback' | 'General' | 'Other'>('General');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  // UI States
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; ticketId?: string } | null>(null);

  const validateForm = (): boolean => {
    const tempErrors: FormErrors = {};
    if (!name.trim()) tempErrors.name = 'Name is required';
    
    if (!email.trim()) {
      tempErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      tempErrors.email = 'Please enter a valid email address';
    }

    if (!subject.trim()) tempErrors.subject = 'Subject is required';
    if (!category) tempErrors.category = 'Please select a category';
    if (!message.trim()) {
      tempErrors.message = 'Message body is required';
    } else if (message.trim().length < 10) {
      tempErrors.message = 'Please provide a bit more detail (minimum 10 characters)';
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);

    // Simulate network latency for rich feeling
    setTimeout(() => {
      try {
        const ticket = supportDbService.createTicket({
          name,
          email,
          category,
          subject,
          message
        });

        setIsSubmitting(false);
        setSubmitResult({ success: true, ticketId: ticket.id });
      } catch (err) {
        console.error('Failed to submit ticket:', err);
        setIsSubmitting(false);
        setSubmitResult({ success: false });
      }
    }, 1500);
  };

  const handleReset = () => {
    setName('');
    setEmail('');
    setCategory('General');
    setSubject('');
    setMessage('');
    setErrors({});
    setSubmitResult(null);
  };

  return (
    <div className={styles.root}>
      {/* Header */}
      <header className={styles.header}>
        <button className={styles.logo} onClick={() => navigate('/')}>
          <span className={styles.logoIcon}>⚡</span>
          <span>Decibel<strong>Cut</strong></span>
        </button>
        <button className={styles.backBtn} onClick={() => navigate('/')}>
          <ArrowLeft size={16} /> Back to Home
        </button>
      </header>

      <main className={styles.main}>
        {/* Title Area */}
        <div className={styles.titleArea}>
          <span className={styles.badge}>Support Portal</span>
          <h1 className={styles.title}>How can we help?</h1>
          <p className={styles.subtitle}>
            Have a question, preset request, or spotted a bug? Send us a message and our support team will get right back to you.
          </p>
        </div>

        {/* Form Card */}
        <div className={styles.card}>
          {!submitResult ? (
            <form onSubmit={handleSubmit} className={styles.form} noValidate>
              <div className={styles.row}>
                {/* Name */}
                <div className={styles.field}>
                  <label htmlFor="name" className={styles.label}>Your Name</label>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={[styles.input, errors.name ? styles.inputError : ''].join(' ')}
                    placeholder="John Doe"
                    disabled={isSubmitting}
                  />
                  {errors.name && <span className={styles.errorText}>{errors.name}</span>}
                </div>

                {/* Email */}
                <div className={styles.field}>
                  <label htmlFor="email" className={styles.label}>Email Address</label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={[styles.input, errors.email ? styles.inputError : ''].join(' ')}
                    placeholder="john@example.com"
                    disabled={isSubmitting}
                  />
                  {errors.email && <span className={styles.errorText}>{errors.email}</span>}
                </div>
              </div>

              <div className={styles.row}>
                {/* Category */}
                <div className={styles.field}>
                  <label htmlFor="category" className={styles.label}>Category</label>
                  <select
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className={[styles.select, errors.category ? styles.inputError : ''].join(' ')}
                    disabled={isSubmitting}
                  >
                    <option value="General">General Question</option>
                    <option value="Bug">Report a Bug</option>
                    <option value="Preset Request">Loudness Preset Request</option>
                    <option value="Feature Request">Request a Feature</option>
                    <option value="Feedback">Send Feedback</option>
                    <option value="Other">Other</option>
                  </select>
                  {errors.category && <span className={styles.errorText}>{errors.category}</span>}
                </div>

                {/* Subject */}
                <div className={styles.field}>
                  <label htmlFor="subject" className={styles.label}>Subject</label>
                  <input
                    type="text"
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className={[styles.input, errors.subject ? styles.inputError : ''].join(' ')}
                    placeholder="Short summary of the topic"
                    disabled={isSubmitting}
                  />
                  {errors.subject && <span className={styles.errorText}>{errors.subject}</span>}
                </div>
              </div>

              {/* Message */}
              <div className={styles.field}>
                <label htmlFor="message" className={styles.label}>Describe your issue</label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className={[styles.textarea, errors.message ? styles.inputError : ''].join(' ')}
                  placeholder="Please provide details about your issue, project files type, browser logs if applicable, etc."
                  disabled={isSubmitting}
                />
                {errors.message && <span className={styles.errorText}>{errors.message}</span>}
              </div>

              {/* Submit Button */}
              <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <span className={styles.loadingSpinner} />
                    Sending Ticket...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Send Support Message
                  </>
                )}
              </button>
            </form>
          ) : submitResult.success ? (
            /* Success View */
            <div className={styles.successContainer}>
              <div className={styles.successIconWrap}>
                <Check size={36} />
              </div>
              <h3 className={styles.successTitle}>Support Message Sent!</h3>
              <p className={styles.successText}>
                Thank you for reaching out. We have logged your request. You can check the dashboard or your inbox for replies shortly.
              </p>
              <div className={styles.ticketIdBadge}>
                Ticket ID: {submitResult.ticketId}
              </div>
              <div className={styles.successActions}>
                <button className={styles.primaryAction} onClick={() => navigate('/app')}>
                  Back to Editor
                </button>
                <button className={styles.secondaryAction} onClick={handleReset}>
                  Submit Another
                </button>
              </div>
            </div>
          ) : (
            /* Error View */
            <div className={styles.successContainer}>
              <div className={styles.successIconWrap} style={{ backgroundColor: 'var(--color-error-alpha)', color: 'var(--color-error)', borderColor: 'rgba(248, 113, 113, 0.2)' }}>
                <AlertTriangle size={36} />
              </div>
              <h3 className={styles.successTitle} style={{ color: 'var(--color-error)' }}>Something went wrong</h3>
              <p className={styles.successText}>
                We were unable to save your support request. Please try again later or check your browser local storage settings.
              </p>
              <div className={styles.successActions}>
                <button className={styles.primaryAction} onClick={handleReset}>
                  Try Again
                </button>
                <button className={styles.secondaryAction} onClick={() => navigate('/')}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
