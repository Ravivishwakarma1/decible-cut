import React from 'react';
import styles from './KeyboardShortcutsModal.module.css';
import { useUIStore } from '../../../store/uiStore';
import { KEYBOARD_SHORTCUTS } from '../../../utils/constants';
import { X } from 'lucide-react';

export const KeyboardShortcutsModal: React.FC = () => {
  const isOpen = useUIStore((s) => s.isKeyboardShortcutsOpen);
  const setOpen = useUIStore((s) => s.setKeyboardShortcutsOpen);

  if (!isOpen) return null;

  const categories = ['Playback', 'Edit', 'Navigation', 'General'] as const;

  return (
    <div
      className={styles.overlay}
      onClick={(e) => e.target === e.currentTarget && setOpen(false)}
    >
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
        <div className={styles.header}>
          <h3 className={styles.title}>Keyboard Shortcuts</h3>
          <button className={styles.closeBtn} onClick={() => setOpen(false)} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className={styles.body}>
          {categories.map((cat) => {
            const shortcuts = KEYBOARD_SHORTCUTS.filter((s) => s.category === cat);
            if (!shortcuts.length) return null;
            return (
              <div key={cat} className={styles.category}>
                <h4 className={styles.catTitle}>{cat}</h4>
                <div className={styles.list}>
                  {shortcuts.map((s) => (
                    <div key={s.id} className={styles.row}>
                      <span className={styles.label}>{s.label}</span>
                      <div className={styles.keys}>
                        {s.keys.map((k, i) => (
                          <React.Fragment key={k}>
                            {i > 0 && <span className={styles.plus}>+</span>}
                            <kbd className={styles.key}>{k}</kbd>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
