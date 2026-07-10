import React, { useId } from 'react';
import styles from './Slider.module.css';

interface SliderProps {
  label?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  displayValue?: string;
  onChange: (value: number) => void;
  disabled?: boolean;
  id?: string;
}

export const Slider: React.FC<SliderProps> = ({
  label,
  value,
  min,
  max,
  step = 0.01,
  unit = '',
  displayValue,
  onChange,
  disabled = false,
  id: externalId,
}) => {
  const generatedId = useId();
  const id = externalId ?? generatedId;

  const percent = ((value - min) / (max - min)) * 100;
  const display = displayValue ?? `${value}${unit}`;

  return (
    <div className={styles.container}>
      {label && (
        <div className={styles.header}>
          <label htmlFor={id} className={styles.label}>{label}</label>
          <span className={styles.value}>{display}</span>
        </div>
      )}
      <div className={styles.track}>
        <div
          className={styles.fill}
          style={{ width: `${percent}%` }}
        />
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className={styles.input}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-label={label}
        />
      </div>
    </div>
  );
};
