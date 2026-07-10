import React from 'react';
import styles from './Statistics.module.css';
import { useAudioStore } from '../../../store/audioStore';
import { formatDuration, formatPercent } from '../../../utils/formatters';
import { TrendingDown } from 'lucide-react';

export const Statistics: React.FC = () => {
  const statistics = useAudioStore((s) => s.statistics);
  const activeRegions = useAudioStore((s) => s.activeRegions);

  if (!statistics) {
    return (
      <div className={styles.empty}>
        <TrendingDown size={24} className={styles.emptyIcon} />
        <p>Statistics will appear after processing</p>
        {activeRegions.length > 0 && (
          <p className={styles.hint}>
            {activeRegions.length} region{activeRegions.length !== 1 ? 's' : ''} detected
          </p>
        )}
      </div>
    );
  }

  const stats = [
    {
      label: 'Original Duration',
      value: formatDuration(statistics.originalDuration),
    },
    {
      label: 'Final Duration',
      value: formatDuration(statistics.finalDuration),
      highlight: true,
    },
    {
      label: 'Time Saved',
      value: formatDuration(statistics.timeSaved),
      color: 'success',
    },
    {
      label: 'Silence Removed',
      value: formatDuration(statistics.silenceRemoved),
    },
    {
      label: 'Number of Cuts',
      value: statistics.numberOfCuts.toString(),
    },
    {
      label: 'Avg Silence Length',
      value: `${statistics.averageSilenceLength.toFixed(2)}s`,
    },
    {
      label: 'Largest Gap Removed',
      value: `${statistics.largestRemovedGap.toFixed(2)}s`,
    },
    {
      label: 'Size Reduction',
      value: formatPercent(statistics.percentageReduction),
      color: 'success',
    },
  ];

  return (
    <div className={styles.root}>
      {/* Hero stat */}
      <div className={styles.hero}>
        <span className={styles.heroValue}>
          {formatPercent(statistics.percentageReduction)}
        </span>
        <span className={styles.heroLabel}>shorter</span>
      </div>

      {/* Grid of stats */}
      <div className={styles.grid}>
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={[
              styles.stat,
              stat.highlight ? styles.highlight : '',
              stat.color ? styles[stat.color] : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span className={styles.statValue}>{stat.value}</span>
            <span className={styles.statLabel}>{stat.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
