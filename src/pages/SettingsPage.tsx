import React from 'react';
import { Link } from 'react-router-dom';
import styles from './SettingsPage.module.css';
import { useSettingsStore } from '../store/settingsStore';

import { KEYBOARD_SHORTCUTS, PRESETS, EXPORT_FORMATS } from '../utils/constants';
import { ArrowLeft, Sun, Moon, Monitor } from 'lucide-react';
import type { Theme } from '../types/ui.types';

export const SettingsPage: React.FC = () => {
  const settings = useSettingsStore();

  const themes: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: 'dark', label: 'Dark', icon: <Moon size={16} /> },
    { value: 'light', label: 'Light', icon: <Sun size={16} /> },
    { value: 'system', label: 'System', icon: <Monitor size={16} /> },
  ];

  return (
    <div className={styles.root}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <Link to="/app" className={styles.backBtn}>
            <ArrowLeft size={16} />
            Back to Editor
          </Link>
          <h1 className={styles.title}>Settings</h1>
        </div>

        {/* Theme */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Appearance</h2>
          <div className={styles.field}>
            <label className={styles.label}>Theme</label>
            <div className={styles.themeGroup}>
              {themes.map((t) => (
                <button
                  key={t.value}
                  className={[
                    styles.themeBtn,
                    settings.theme === t.value ? styles.themeBtnActive : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => settings.setTheme(t.value)}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Defaults */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Defaults</h2>

          <div className={styles.field}>
            <label className={styles.label}>Default Preset</label>
            <select
              className={styles.select}
              value={settings.defaultPreset}
              onChange={(e) => settings.setDefaultPreset(e.target.value as never)}
            >
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Default Export Format</label>
            <select
              className={styles.select}
              value={settings.defaultExportFormat}
              onChange={(e) => settings.setDefaultExportFormat(e.target.value as never)}
            >
              {EXPORT_FORMATS.map((f) => (
                <option key={f} value={f}>{f.toUpperCase()}</option>
              ))}
            </select>
          </div>
        </section>

        {/* Session */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Session</h2>
          <div className={styles.toggle}>
            <div>
              <p className={styles.toggleLabel}>Auto-save session</p>
              <p className={styles.toggleDesc}>Restore your work after an accidental refresh</p>
            </div>
            <button
              className={[styles.toggleBtn, settings.autoSaveSession ? styles.toggleOn : ''].join(' ')}
              onClick={() => settings.setAutoSaveSession(!settings.autoSaveSession)}
              role="switch"
              aria-checked={settings.autoSaveSession}
            >
              <span className={styles.toggleThumb} />
            </button>
          </div>
        </section>

        {/* Keyboard Shortcuts */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Keyboard Shortcuts</h2>
          {(['Playback', 'Edit', 'Navigation', 'General'] as const).map((cat) => (
            <div key={cat} className={styles.shortcutCategory}>
              <h3 className={styles.shortcutCatTitle}>{cat}</h3>
              <div className={styles.shortcutList}>
                {KEYBOARD_SHORTCUTS.filter((s) => s.category === cat).map((s) => (
                  <div key={s.id} className={styles.shortcut}>
                    <span className={styles.shortcutLabel}>{s.label}</span>
                    <div className={styles.keys}>
                      {s.keys.map((k) => (
                        <kbd key={k} className={styles.key}>{k}</kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* Danger Zone */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Reset</h2>
          <button className={styles.dangerBtn} onClick={() => settings.resetToDefaults()}>
            Reset all settings to defaults
          </button>
        </section>
      </div>
    </div>
  );
};
