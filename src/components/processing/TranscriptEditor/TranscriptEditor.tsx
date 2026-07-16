import React, { useState } from 'react';
import styles from './TranscriptEditor.module.css';
import { Button } from '../../ui/Button';
import { useAudioStore } from '../../../store/audioStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { transcribeWithGroq, downsampleAudioBufferToWav16k } from '../../../services/groqService';
import { formatDuration } from '../../../utils/formatters';
import { Scissors, RefreshCw, Sparkles, Key, Check } from 'lucide-react';

export const TranscriptEditor: React.FC = () => {
  const audioBuffer = useAudioStore((s) => s.audioBuffer);
  const fileInfo = useAudioStore((s) => s.fileInfo);
  const activeRegions = useAudioStore((s) => s.activeRegions);
  const addRegion = useAudioStore((s) => s.addRegion);
  const deleteRegion = useAudioStore((s) => s.deleteRegion);
  const transcriptSegments = useAudioStore((s) => s.transcriptSegments);
  const setTranscriptSegments = useAudioStore((s) => s.setTranscriptSegments);

  const groqApiKey = useSettingsStore((s) => s.groqApiKey);

  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  const handleTranscribe = async () => {
    if (!audioBuffer) return;

    setLoading(true);
    setLoadingMessage('Converting audio to Whisper format…');

    try {
      if (!groqApiKey) {
        // Simulate local mock transcription if no API key is provided
        setLoadingMessage('Generating mock preview transcript…');
        await new Promise((resolve) => setTimeout(resolve, 1500));

        const duration = audioBuffer.duration;
        const mockTexts = [
          "Welcome to DecibelCut. This is a text-based transcript editor demonstration.",
          "You can review your speech transcript blocks side-by-side with timestamps.",
          "Notice the scissors icon next to each segment card in the list.",
          "Clicking it will automatically mark this text range as a deleted segment.",
          "The audio playback engine will skip the cut regions, and they are omitted on export!"
        ];

        const segmentCount = Math.min(5, Math.ceil(duration / 6));
        const mockSegments = Array.from({ length: segmentCount }).map((_, idx) => {
          const start = idx * (duration / segmentCount);
          const end = (idx + 1) * (duration / segmentCount);
          return {
            id: `seg-${idx}-${Date.now()}`,
            start,
            end,
            text: mockTexts[idx % mockTexts.length]
          };
        });

        setTranscriptSegments(mockSegments);
      } else {
        // Transcribe using real Groq API
        const wavBlob = await downsampleAudioBufferToWav16k(audioBuffer);
        setLoadingMessage('Transcribing audio trace via Groq Whisper…');
        const results = await transcribeWithGroq(wavBlob, groqApiKey);

        if (results.segments && results.segments.length > 0) {
          const formatted = results.segments.map((seg: any) => ({
            id: `seg-${seg.id}-${Date.now()}`,
            start: seg.start,
            end: seg.end,
            text: seg.text.trim()
          }));
          setTranscriptSegments(formatted);
        } else {
          // Fallback if no detailed segments returned
          setTranscriptSegments([
            {
              id: `seg-0-${Date.now()}`,
              start: 0,
              end: audioBuffer.duration,
              text: results.text
            }
          ]);
        }
      }
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Transcription failed');
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  // Check if a segment's time range is currently cut/deleted
  const getOverlappingCutRegion = (start: number, end: number) => {
    return activeRegions.find(
      (r) => r.type === 'silence' && Math.max(start, r.start) < Math.min(end, r.end)
    );
  };

  const handleCutSegment = (start: number, end: number, text: string) => {
    const existing = getOverlappingCutRegion(start, end);
    if (existing) {
      // Restore segment by removing the silence region
      deleteRegion(existing.id);
    } else {
      // Cut segment by adding a silence region
      const region = {
        start,
        end,
        type: 'silence' as const,
        color: 'rgba(239, 68, 68, 0.35)',
        label: `Transcript Cut: "${text.substring(0, 15)}..."`
      };
      addRegion(region);
    }
  };

  if (!fileInfo) {
    return (
      <div className={styles.emptyState}>
        <p>Upload an audio file to view the transcription editor.</p>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {!transcriptSegments ? (
        <div className={styles.setupCard}>
          <div className={styles.iconContainer}>
            <Sparkles className={styles.sparkIcon} size={28} />
          </div>
          <h3 className={styles.setupTitle}>Text-Based Transcript Editing</h3>
          <p className={styles.setupDesc}>
            Transcribe your audio file into text. Click on sentences to edit or remove sections
            directly from the timeline.
          </p>

          {!groqApiKey && (
            <div className={styles.warningBox}>
              <Key size={16} className={styles.warnIcon} />
              <div className={styles.warnText}>
                <strong>No Groq API Key found</strong>
                <p>
                  You can transcribe with a simulated mock text for preview. To transcribe real
                  audio, enter your free API key in Settings.
                </p>
              </div>
            </div>
          )}

          <Button
            variant="primary"
            onClick={handleTranscribe}
            isLoading={loading}
            className={styles.transcribeBtn}
          >
            {loading ? loadingMessage : 'Transcribe Audio (Free)'}
          </Button>
        </div>
      ) : (
        <div className={styles.editorArea}>
          <div className={styles.editorHeader}>
            <span>Episode Transcript ({transcriptSegments.length} segments)</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleTranscribe}
              isLoading={loading}
              leftIcon={<RefreshCw size={12} />}
            >
              Re-transcribe
            </Button>
          </div>

          <div className={styles.segmentsList}>
            {transcriptSegments.map((seg) => {
              const cutRegion = getOverlappingCutRegion(seg.start, seg.end);
              const isCut = !!cutRegion;

              return (
                <div
                  key={seg.id}
                  className={[styles.segmentCard, isCut ? styles.segmentCardCut : ''].join(' ')}
                >
                  <div className={styles.segmentMeta}>
                    <span className={styles.speakerTag}>Speaker 1</span>
                    <span className={styles.timestamp}>
                      {formatDuration(seg.start)} - {formatDuration(seg.end)}
                    </span>
                  </div>

                  <p className={[styles.segmentText, isCut ? styles.textCut : ''].join(' ')}>
                    {seg.text}
                  </p>

                  <button
                    type="button"
                    className={[styles.cutBtn, isCut ? styles.cutBtnRestore : ''].join(' ')}
                    onClick={() => handleCutSegment(seg.start, seg.end, seg.text)}
                    title={isCut ? 'Restore this segment' : 'Cut this segment'}
                  >
                    {isCut ? <Check size={14} /> : <Scissors size={14} />}
                    <span>{isCut ? 'Restored' : 'Cut Text'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
