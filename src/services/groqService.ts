import { audioBufferToWav } from './audioEngine';

export interface GroqAIResults {
  transcript: string;
  summary: string;
  showNotes: string;
  chapters: Array<{ time: string; title: string }>;
  fillerWordsRemovedCount: number;
}

/**
 * Downsamples an AudioBuffer to mono 16kHz WAV format (optimal size for Whisper API)
 */
export async function downsampleAudioBufferToWav16k(buffer: AudioBuffer): Promise<Blob> {
  const targetSampleRate = 16000;
  const targetChannels = 1;
  const duration = buffer.duration;
  
  const offlineCtx = new OfflineAudioContext(
    targetChannels,
    Math.floor(duration * targetSampleRate),
    targetSampleRate
  );
  
  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(offlineCtx.destination);
  source.start();
  
  const downsampledBuffer = await offlineCtx.startRendering();
  const wav = audioBufferToWav(downsampledBuffer);
  return new Blob([wav], { type: 'audio/wav' });
}

/**
 * Formats seconds into MM:SS format
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Transcribes audio blob using Groq Whisper API
 */
export async function transcribeWithGroq(
  audioBlob: Blob,
  apiKey: string,
  language?: string,
  prompt?: string,
  temperature?: number
): Promise<{ text: string; segmentsText: string; segments?: any[] }> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.wav');
  formData.append('model', 'whisper-large-v3');
  formData.append('response_format', 'verbose_json');
  
  if (language && language !== 'auto') {
    formData.append('language', language);
  }
  if (prompt) {
    formData.append('prompt', prompt);
  }
  if (temperature !== undefined) {
    formData.append('temperature', temperature.toString());
  }

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    },
    body: formData
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Transcription failed with status ${response.status}`);
  }

  const result = await response.json();
  
  // Format segments with timestamps
  let segmentsText = '';
  if (result.segments && Array.isArray(result.segments)) {
    segmentsText = result.segments
      .map((seg: any) => `[${formatTime(seg.start)}] ${seg.text.trim()}`)
      .join('\n');
  } else {
    segmentsText = result.text;
  }

  return {
    text: result.text,
    segmentsText,
    segments: result.segments
  };
}

/**
 * Processes transcript using LLM to generate summary, show notes, chapters, and clean transcript
 */
export async function postProcessTranscriptWithGroq(
  rawSegmentsText: string,
  projectName: string,
  apiKey: string
): Promise<GroqAIResults> {
  const prompt = `You are a professional podcast producer and audio engineer.
You are given a raw transcript of a podcast episode titled "${projectName}". The transcript has timestamps in the format [MM:SS] at the beginning of segments.

Analyze the transcript and perform the following tasks:
1. Format a clean transcript, assigning speaker labels (e.g. "[Host]", "[Guest]", "[Speaker 1]") dynamically based on the conversation flow. Add speaker tags next to the timestamps like "[00:25] [Host]: ...". Remove unnecessary verbal stutters and obvious filler words (like "uh", "um", "like", "you know") while preserving the content.
2. Create a concise summary paragraph of the episode.
3. Write detailed markdown Show Notes, including a summary, key takeaways list, and links/resources mentioned.
4. Extract significant milestone chapters with their timestamps (e.g. intro, main discussion topics, conclusion) in the format "MM:SS" (at least 3-5 chapters depending on duration).
5. Estimate the number of filler words that were removed during cleaning.

You MUST respond in JSON format matching this exact schema:
{
  "diarizedTranscript": "string containing the full cleaned, diarized transcript with timestamps and speaker tags",
  "summary": "string containing the summary paragraph",
  "showNotes": "string containing the markdown show notes",
  "chapters": [
    { "time": "MM:SS", "title": "Chapter Title" }
  ],
  "fillerWordsCount": number
}

Here is the raw transcript:
${rawSegmentsText}`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Groq LLM processing failed with status ${response.status}`);
  }

  const data = await response.json();
  const rawJsonContent = data.choices[0]?.message?.content;
  if (!rawJsonContent) {
    throw new Error('Groq returned an empty response.');
  }

  const parsed = JSON.parse(rawJsonContent);
  return {
    transcript: parsed.diarizedTranscript || rawSegmentsText,
    summary: parsed.summary || 'Summary generation failed.',
    showNotes: parsed.showNotes || 'Show notes generation failed.',
    chapters: parsed.chapters || [],
    fillerWordsRemovedCount: parsed.fillerWordsCount || 0
  };
}

/**
 * Main orchestrator: generates real AI transcript, summary, chapters, etc., using Groq APIs
 */
export async function generateRealGroqAIContent(
  buffer: AudioBuffer,
  projectName: string,
  apiKey: string,
  onProgress?: (msg: string) => void,
  language?: string,
  prompt?: string
): Promise<GroqAIResults> {
  onProgress?.('Optimizing audio file…');
  const tinyWav = await downsampleAudioBufferToWav16k(buffer);
  
  onProgress?.('Transcribing speech to text…');
  const { segmentsText } = await transcribeWithGroq(tinyWav, apiKey, language, prompt);
  
  onProgress?.('Generating summary and notes…');
  const results = await postProcessTranscriptWithGroq(segmentsText, projectName, apiKey);
  
  return results;
}
