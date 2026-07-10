import React from 'react';
import styles from './SilenceControls.module.css';
import { Slider } from '../../ui/Slider';
import { Button } from '../../ui/Button';
import { useAudioStore } from '../../../store/audioStore';
import { useAudioEngine } from '../../../hooks/useAudioEngine';
import { PRESETS } from '../../../utils/constants';
import { formatDbfs } from '../../../utils/formatters';
import { Zap } from 'lucide-react';

export const SilenceControls: React.FC = () => {
  const config = useAudioStore((s) => s.config);
  const activePresetId = useAudioStore((s) => s.activePresetId);
  const status = useAudioStore((s) => s.status);
  const fileInfo = useAudioStore((s) => s.fileInfo);
  const detectionProgress = useAudioStore((s) => s.detectionProgress);
  const setConfig = useAudioStore((s) => s.setConfig);
  const setPreset = useAudioStore((s) => s.setPreset);
  const activeRegions = useAudioStore((s) => s.activeRegions);
  const { detectSilenceRegions, applyProcessing } = useAudioEngine();

  const isAnalyzing = status === 'analyzing';
  const canDetect = !!fileInfo && !isAnalyzing && status !== 'processing';

  return (
    <div className={styles.root}>
      {/* Preset Selector */}
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Preset</h4>
        <div className={styles.presets}>
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              className={[
                styles.presetBtn,
                activePresetId === preset.id ? styles.presetActive : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setPreset(preset.id)}
              title={preset.description}
            >
              {preset.name}
            </button>
          ))}
        </div>
        {activePresetId !== 'custom' && (
          <p className={styles.presetDesc}>
            {PRESETS.find((p) => p.id === activePresetId)?.description}
          </p>
        )}
      </div>

      {/* Detection Parameters */}
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Detection Settings</h4>

        <Slider
          label="Silence Threshold"
          value={config.threshold}
          min={-70}
          max={-10}
          step={0.5}
          displayValue={formatDbfs(config.threshold)}
          onChange={(v) => setConfig({ threshold: v })}
        />

        <Slider
          label="Min Silence Duration"
          value={config.minSilenceDuration}
          min={0.1}
          max={10}
          step={0.1}
          unit="s"
          displayValue={`${config.minSilenceDuration.toFixed(1)}s`}
          onChange={(v) => setConfig({ minSilenceDuration: v })}
        />

        <Slider
          label="Padding Before Cut"
          value={config.paddingBefore}
          min={0}
          max={1}
          step={0.01}
          displayValue={`${(config.paddingBefore * 1000).toFixed(0)}ms`}
          onChange={(v) => setConfig({ paddingBefore: v })}
        />

        <Slider
          label="Padding After Cut"
          value={config.paddingAfter}
          min={0}
          max={1}
          step={0.01}
          displayValue={`${(config.paddingAfter * 1000).toFixed(0)}ms`}
          onChange={(v) => setConfig({ paddingAfter: v })}
        />

        <Slider
          label="Crossfade Duration"
          value={config.crossfadeDuration}
          min={0}
          max={0.5}
          step={0.005}
          displayValue={`${(config.crossfadeDuration * 1000).toFixed(0)}ms`}
          onChange={(v) => setConfig({ crossfadeDuration: v })}
        />
      </div>

      {/* Detect Button */}
      <Button
        variant="primary"
        size="md"
        fullWidth
        disabled={!canDetect}
        isLoading={isAnalyzing}
        leftIcon={<Zap size={16} />}
        onClick={detectSilenceRegions}
      >
        {isAnalyzing
          ? `Analyzing… ${detectionProgress}%`
          : 'Detect Silence'}
      </Button>

      {/* Apply Cuts Button */}
      {status === 'ready' && activeRegions.length > 0 && (
        <Button
          variant="secondary"
          size="md"
          fullWidth
          onClick={applyProcessing}
          style={{ marginTop: '12px' }}
        >
          Apply Cuts (Remove Silence)
        </Button>
      )}
    </div>
  );
};
