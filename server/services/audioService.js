import { EdgeTTS } from 'edge-tts-universal';
import fs from 'fs';
import path from 'path';

export class AudioService {
  /**
   * Synthesizes text to an MP3 file and returns timing metadata in milliseconds.
   * @param {string} text - The text to speak
   * @param {string} voiceStyle - 'deep-cinematic' or 'female-narrator'
   * @param {string} outputDir - Directory to save the generated audio file
   * @param {string} filename - Output audio filename
   * @returns {Promise<{audioPath: string, words: Array<{word: string, start: number, end: number}>}>}
   */
  async generateVoiceover(text, voiceStyle, outputDir, filename) {
    // Select the appropriate neural voice
    let voice = 'en-US-AndrewNeural'; // Default deep cinematic male voice
    if (voiceStyle === 'female-narrator') {
      voice = 'en-US-AriaNeural';
    }

    try {
      // Clean up the text (remove double spaces, basic sanitization)
      const cleanText = text.replace(/\s+/g, ' ').trim();
      
      const tts = new EdgeTTS(cleanText, voice);
      const result = await tts.synthesize();

      // Convert Blob to Buffer
      const arrayBuffer = await result.audio.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Ensure output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const audioPath = path.join(outputDir, filename);
      fs.writeFileSync(audioPath, buffer);

      // Convert word boundaries from ticks (100-nanosecond units) to milliseconds
      const words = result.subtitle.map(item => {
        const startMs = Math.round(item.offset / 10000);
        const durationMs = Math.round(item.duration / 10000);
        return {
          word: item.text,
          start: startMs,
          end: startMs + durationMs
        };
      });

      return {
        audioPath,
        words
      };
    } catch (error) {
      console.error('Error generating voiceover:', error);
      throw error;
    }
  }
}
