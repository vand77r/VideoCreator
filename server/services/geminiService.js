import { GoogleGenAI } from '@google/genai';

export class GeminiService {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('Gemini API key is required');
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Generates a viral script outline divided into scenes with voiceover text and image prompts.
   * @param {string} userPrompt 
   * @param {string} voiceStyle 
   * @returns {Promise<object>} Structured script JSON
   */
  async generateScript(userPrompt, voiceStyle) {
    const prompt = `You are a top 0.1% Instagram content creator specializing in high-engagement, viral reels and posts in the 4:5 vertical format (1080x1350).
Write a highly engaging, scroll-stopping script based on the following topic or prompt: "${userPrompt}".
The voiceover style chosen is: "${voiceStyle}".

Requirements:
1. Start with a powerful visual and verbal hook in the first 3 seconds to stop the scroll.
2. Provide a high-value body, keeping sentences concise and punchy.
3. End with a strong Call to Action (CTA).
4. Divide the script into 3 to 6 logical scenes. Total duration should be 15 to 30 seconds.
5. For each scene, write:
   - The exact voiceover text (narration) to be spoken (around 8-15 words). Keep it highly conversational and impactful.
   - A detailed image generation prompt for Imagen 3. Describe the scene, subjects, colors, cinematic lighting, and mood. Avoid text in the images.
   - The duration of the scene in seconds (typically 3 to 5 seconds).

Return the response strictly in JSON format matching the schema.`;

    const responseSchema = {
      type: "OBJECT",
      properties: {
        title: { type: "STRING" },
        scenes: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              text: { type: "STRING" },
              imagePrompt: { type: "STRING" },
              duration: { type: "INTEGER" }
            },
            required: ["text", "imagePrompt", "duration"]
          }
        }
      },
      required: ["title", "scenes"]
    };

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema
        }
      });

      return JSON.parse(response.text);
    } catch (error) {
      console.error('Error generating script:', error);
      throw error;
    }
  }

  /**
   * Generates a high-quality image using Imagen 3 based on the prompt.
   * @param {string} imagePrompt 
   * @returns {Promise<string>} Base64 image data
   */
  async generateImage(imagePrompt) {
    try {
      const response = await this.ai.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt: `${imagePrompt}, cinematic lighting, photorealistic, premium quality, depth of field, instagram aesthetic`,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: '3:4', // 3:4 is close to 4:5. We'll crop/pad to 4:5 (1080x1350) in FFmpeg.
        },
      });

      if (response.generatedImages && response.generatedImages.length > 0) {
        // Return base64 string
        return response.generatedImages[0].image.imageBytes;
      }
      throw new Error('No images returned from Imagen API');
    } catch (error) {
      console.error('Error generating image:', error);
      throw error;
    }
  }

  /**
   * Generates a list of viral quotes/hooks for bulk video generation.
   * @param {string} topic - The topic of the quotes
   * @param {number} count - The number of quotes to generate
   * @returns {Promise<Array<{title: string, quote: string}>>}
   */
  async generateQuotes(topic, count) {
    const prompt = `You are a top 0.1% Instagram content creator.
Generate a list of exactly ${count} highly engaging, scroll-stopping video ideas for vertical posts.
For each item, generate:
1. A short, high-impact Title (3-5 words) representing the visual hook.
2. The exact Quote/Dialogue (10-25 words) that will be read aloud as voiceover. It should be punchy, value-packed, and viral in style.

Topic: "${topic}"

Return the response strictly in JSON format matching the schema.`;

    const responseSchema = {
      type: "OBJECT",
      properties: {
        ideas: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING" },
              quote: { type: "STRING" }
            },
            required: ["title", "quote"]
          }
        }
      },
      required: ["ideas"]
    };

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema
        }
      });

      const parsed = JSON.parse(response.text);
      return parsed.ideas || [];
    } catch (error) {
      console.error('Error generating quotes:', error);
      throw error;
    }
  }
}
