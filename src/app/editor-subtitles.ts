import { EditingSchema } from "@/features/ai-editing/types/editingSchema";
import {
  SubtitleGenerationPreferences,
  SubtitleVisualStylePreferences,
  TranscriptSegment,
  TranscriptWord,
} from "./editor-types";
import { TimelineSequence } from "@/features/timeline/types/timeline";

const TRANSCRIPTION_SAMPLE_RATE = 16000;
const WORD_BY_WORD_PATTERN =
  /(word by word|single word|one word|каждое слово|по словам|по одному слову|быстрые субтитры)/i;
const KARAOKE_STYLE_PATTERN = /(karaoke|караоке|tiktok|shorts|reels)/i;
const MINIMAL_STYLE_PATTERN = /(minimal|минимал|plain|simple)/i;
const NO_OUTLINE_PATTERN = /(без обводки|no outline|outline off)/i;
const NO_BACKGROUND_PATTERN = /(без фона|no background|transparent bg)/i;
const TOP_POSITION_PATTERN = /(top|сверху|верх)/i;
const CENTER_POSITION_PATTERN = /(center|центр|по центру)/i;

const COLOR_NAME_MAP: Record<string, string> = {
  white: "#ffffff",
  black: "#000000",
  yellow: "#ffd400",
  red: "#ff3b30",
  green: "#34c759",
  blue: "#3b82f6",
  orange: "#ff8a00",
  pink: "#ff4fb3",
  purple: "#7c4dff",
  cyan: "#00c7d9",
  бел: "#ffffff",
  черн: "#000000",
  желт: "#ffd400",
  крас: "#ff3b30",
  зелен: "#34c759",
  син: "#3b82f6",
  оранж: "#ff8a00",
  розов: "#ff4fb3",
  фиолет: "#7c4dff",
  бирюз: "#00c7d9",
};

const splitSubtitleText = (text: string, maxCharsPerChunk = 44): string[] => {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length === 0) {
    return [];
  }

  const chunks: string[] = [];
  let currentChunk = "";

  for (const word of words) {
    const candidateChunk = currentChunk ? `${currentChunk} ${word}` : word;
    if (candidateChunk.length <= maxCharsPerChunk) {
      currentChunk = candidateChunk;
      continue;
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }
    currentChunk = word;
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
};

const parseColorFromMessage = (message: string): string | null => {
  const hexMatch = message.match(/#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})\b/i);
  if (hexMatch) {
    return hexMatch[0];
  }

  const loweredMessage = message.toLowerCase();
  for (const [name, color] of Object.entries(COLOR_NAME_MAP)) {
    if (loweredMessage.includes(name)) {
      return color;
    }
  }

  return null;
};

export const parseSubtitleGenerationPreferences = (
  userMessage: string,
): SubtitleGenerationPreferences => {
  const wantsWordByWord = WORD_BY_WORD_PATTERN.test(userMessage);
  const isKaraokeStyle = KARAOKE_STYLE_PATTERN.test(userMessage);
  const isMinimalStyle = MINIMAL_STYLE_PATTERN.test(userMessage);
  const wantsNoOutline = NO_OUTLINE_PATTERN.test(userMessage);
  const wantsNoBackground = NO_BACKGROUND_PATTERN.test(userMessage);
  const requestedColor = parseColorFromMessage(userMessage);
  const backgroundColor = wantsNoBackground ? null : isKaraokeStyle ? "#000000" : null;
  const previewWidth = wantsWordByWord ? 0.64 : 0.78;
  const isTop = TOP_POSITION_PATTERN.test(userMessage);
  const isCenter = !isTop && CENTER_POSITION_PATTERN.test(userMessage);

  return {
    timingMode: wantsWordByWord ? "word" : "phrase",
    previewX: (1 - previewWidth) / 2,
    previewY: isTop ? 0.08 : isCenter ? 0.4 : 0.74,
    previewWidth,
    previewHeight: wantsWordByWord ? 0.16 : 0.2,
    maxCharsPerChunk: wantsWordByWord ? 18 : 42,
    style: {
      textColor: requestedColor ?? "#ffffff",
      outlineColor: wantsNoOutline ? null : "#000000",
      outlineWidth: wantsNoOutline ? 0 : isKaraokeStyle ? 4 : 3,
      backgroundColor,
      backgroundOpacity: wantsNoBackground ? 0 : isKaraokeStyle ? 0.6 : 0,
      fontWeight: isMinimalStyle ? 600 : 700,
      fontSizePx: wantsWordByWord ? 44 : isKaraokeStyle ? 40 : 34,
      borderRadiusPx: backgroundColor ? 10 : 0,
      paddingXPx: backgroundColor ? 12 : 0,
      paddingYPx: backgroundColor ? 8 : 0,
    },
  };
};

const buildSubtitleStyleFields = (style: SubtitleVisualStylePreferences) => ({
  subtitleTextColor: style.textColor,
  subtitleOutlineColor: style.outlineColor,
  subtitleOutlineWidth: style.outlineWidth,
  subtitleBackgroundColor: style.backgroundColor,
  subtitleBackgroundOpacity: style.backgroundOpacity,
  subtitleFontWeight: style.fontWeight,
  subtitleFontSizePx: style.fontSizePx,
  subtitleBorderRadiusPx: style.borderRadiusPx,
  subtitlePaddingXPx: style.paddingXPx,
  subtitlePaddingYPx: style.paddingYPx,
});

export const createSubtitleEditingSchemaFromTranscript = (
  transcriptSegments: TranscriptSegment[],
  transcriptWords: TranscriptWord[],
  sequence: TimelineSequence,
  preferences: SubtitleGenerationPreferences,
): EditingSchema => {
  const toFrame = (seconds: number) => Math.max(0, Math.round(seconds * sequence.frameRate));

  const normalizedWords = transcriptWords
    .map((word) => ({
      startSeconds: Math.max(0, word.startSeconds),
      endSeconds: Math.max(word.endSeconds, word.startSeconds + 0.01),
      text: word.text.replace(/\s+/g, " ").trim(),
    }))
    .filter((word) => word.text.length > 0)
    .sort((left, right) => left.startSeconds - right.startSeconds);

  const subtitleClipsFromWords = (() => {
    if (normalizedWords.length === 0) {
      return [];
    }

    if (preferences.timingMode === "word") {
      return normalizedWords.map((word) => ({
        name: word.text,
        startFrame: toFrame(word.startSeconds),
        durationFrames: Math.max(1, toFrame(word.endSeconds) - toFrame(word.startSeconds)),
        source: "element" as const,
        mediaUrl: null,
        previewX: preferences.previewX,
        previewY: preferences.previewY,
        previewWidth: preferences.previewWidth,
        previewHeight: preferences.previewHeight,
        ...buildSubtitleStyleFields(preferences.style),
      }));
    }

    const groups: Array<{ startSeconds: number; endSeconds: number; text: string }> = [];
    let currentGroup: { startSeconds: number; endSeconds: number; text: string } | null = null;
    const maxDurationSeconds = 2.8;
    const maxGapSeconds = 0.32;

    for (const word of normalizedWords) {
      if (!currentGroup) {
        currentGroup = { startSeconds: word.startSeconds, endSeconds: word.endSeconds, text: word.text };
        continue;
      }

      const nextText: string = `${currentGroup.text} ${word.text}`;
      const nextDuration = word.endSeconds - currentGroup.startSeconds;
      const gap = Math.max(0, word.startSeconds - currentGroup.endSeconds);

      if (
        nextText.length <= preferences.maxCharsPerChunk &&
        nextDuration <= maxDurationSeconds &&
        gap <= maxGapSeconds
      ) {
        currentGroup = {
          startSeconds: currentGroup.startSeconds,
          endSeconds: word.endSeconds,
          text: nextText,
        };
        continue;
      }

      groups.push(currentGroup);
      currentGroup = { startSeconds: word.startSeconds, endSeconds: word.endSeconds, text: word.text };
    }

    if (currentGroup) {
      groups.push(currentGroup);
    }

    return groups.map((group) => ({
      name: group.text,
      startFrame: toFrame(group.startSeconds),
      durationFrames: Math.max(1, toFrame(group.endSeconds) - toFrame(group.startSeconds)),
      source: "element" as const,
      mediaUrl: null,
      previewX: preferences.previewX,
      previewY: preferences.previewY,
      previewWidth: preferences.previewWidth,
      previewHeight: preferences.previewHeight,
      ...buildSubtitleStyleFields(preferences.style),
    }));
  })();

  const subtitleClipsFromSegments = transcriptSegments
    .flatMap((segment) => {
      const text = segment.text.replace(/\s+/g, " ").trim();
      const durationSeconds = Math.max(segment.endSeconds - segment.startSeconds, 0.05);
      if (!text) {
        return [];
      }

      const chunks = splitSubtitleText(text, preferences.maxCharsPerChunk);
      if (chunks.length <= 1) {
        return [
          {
            name: text,
            startFrame: toFrame(segment.startSeconds),
            durationFrames: Math.max(1, toFrame(segment.endSeconds) - toFrame(segment.startSeconds)),
            source: "element" as const,
            mediaUrl: null,
            previewX: preferences.previewX,
            previewY: preferences.previewY,
            previewWidth: preferences.previewWidth,
            previewHeight: preferences.previewHeight,
            ...buildSubtitleStyleFields(preferences.style),
          },
        ];
      }

      let wordsPassed = 0;
      const totalWords = Math.max(text.split(" ").filter(Boolean).length, 1);

      return chunks.map((chunk, index) => {
        const wordsInChunk = Math.max(chunk.split(" ").filter(Boolean).length, 1);
        const chunkStart = segment.startSeconds + (durationSeconds * wordsPassed) / totalWords;
        wordsPassed += wordsInChunk;
        const chunkEnd =
          index === chunks.length - 1
            ? segment.endSeconds
            : segment.startSeconds + (durationSeconds * wordsPassed) / totalWords;

        return {
          name: chunk,
          startFrame: toFrame(chunkStart),
          durationFrames: Math.max(1, toFrame(chunkEnd) - toFrame(chunkStart)),
          source: "element" as const,
          mediaUrl: null,
          previewX: preferences.previewX,
          previewY: preferences.previewY,
          previewWidth: preferences.previewWidth,
          previewHeight: preferences.previewHeight,
          ...buildSubtitleStyleFields(preferences.style),
        };
      });
    })
    .map((clip) => {
      const maxStart = Math.max(sequence.durationFrames - 1, 0);
      const safeStart = Math.min(Math.max(clip.startFrame, 0), maxStart);
      const safeDuration = Math.max(1, Math.min(clip.durationFrames, sequence.durationFrames - safeStart));

      return {
        ...clip,
        startFrame: safeStart,
        durationFrames: safeDuration,
      };
    })
    .filter((clip) => clip.durationFrames > 0)
    .sort((left, right) => left.startFrame - right.startFrame);

  const subtitleClips =
    subtitleClipsFromWords.length > 0 ? subtitleClipsFromWords : subtitleClipsFromSegments;

  return {
    version: "1.0",
    assistantMessage:
      preferences.timingMode === "word"
        ? "Subtitles were added word by word with timing from the transcript."
        : "Subtitles were added as phrase groups with timing from the transcript.",
    durationFrames: null,
    tracks: [
      {
        type: "subtitle",
        index: 0,
        clips: subtitleClips,
      },
    ],
  };
};

const downmixToMono = (audioBuffer: AudioBuffer): Float32Array => {
  const { length, numberOfChannels } = audioBuffer;
  if (numberOfChannels <= 1) {
    return audioBuffer.getChannelData(0).slice();
  }

  const mono = new Float32Array(length);
  for (let channel = 0; channel < numberOfChannels; channel += 1) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      mono[index] += channelData[index] / numberOfChannels;
    }
  }

  return mono;
};

const resampleLinear = (
  input: Float32Array,
  inputSampleRate: number,
  targetSampleRate: number,
): Float32Array => {
  if (inputSampleRate === targetSampleRate) {
    return input;
  }

  const ratio = inputSampleRate / targetSampleRate;
  const outputLength = Math.max(1, Math.floor(input.length / ratio));
  const output = new Float32Array(outputLength);

  for (let index = 0; index < outputLength; index += 1) {
    const sourceIndex = index * ratio;
    const left = Math.floor(sourceIndex);
    const right = Math.min(left + 1, input.length - 1);
    const mix = sourceIndex - left;
    output[index] = input[left] * (1 - mix) + input[right] * mix;
  }

  return output;
};

const encodeMono16BitWav = (samples: Float32Array, sampleRate: number): Blob => {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let index = 0; index < samples.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[index] ?? 0));
    const pcmValue = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    view.setInt16(offset, Math.round(pcmValue), true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
};

export const createTranscriptionAudioFile = async (file: File): Promise<File> => {
  const isVideoOrAudio = file.type.startsWith("video/") || file.type.startsWith("audio/");
  if (!isVideoOrAudio) {
    return file;
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new AudioContext();
    try {
      const decodedAudio = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      const mono = downmixToMono(decodedAudio);
      const resampled = resampleLinear(mono, decodedAudio.sampleRate, TRANSCRIPTION_SAMPLE_RATE);
      const wavBlob = encodeMono16BitWav(resampled, TRANSCRIPTION_SAMPLE_RATE);

      return new File([wavBlob], `${file.name.replace(/\.[^/.]+$/, "")}-transcribe.wav`, {
        type: "audio/wav",
        lastModified: Date.now(),
      });
    } finally {
      await audioContext.close();
    }
  } catch {
    return file;
  }
};
