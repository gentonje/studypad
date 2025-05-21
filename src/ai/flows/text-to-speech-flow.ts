
'use server';
/**
 * @fileOverview An AI agent that converts text to speech using ElevenLabs.
 *
 * - textToSpeech - A function that handles the text-to-speech conversion.
 * - TextToSpeechInput - The input type for the textToSpeech function.
 * - TextToSpeechOutput - The return type for the textToSpeech function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {ElevenLabsClient} from 'elevenlabs';

const TextToSpeechInputSchema = z.object({
  text: z.string().describe('The text to convert to speech.'),
  voiceId: z.string().optional().default('21m00Tcm4TlvDq8ikWAM').describe('Optional ElevenLabs voice ID. Defaults to "Rachel".'),
});
export type TextToSpeechInput = z.infer<typeof TextToSpeechInputSchema>;

const TextToSpeechOutputSchema = z.object({
  audioDataUri: z.string().optional().describe('The generated audio as a data URI (e.g., data:audio/mpeg;base64,...). Undefined if generation failed.'),
});
export type TextToSpeechOutput = z.infer<typeof TextToSpeechOutputSchema>;

export async function textToSpeech(input: TextToSpeechInput): Promise<TextToSpeechOutput> {
  return textToSpeechGenkitFlow(input);
}

const textToSpeechGenkitFlow = ai.defineFlow(
  {
    name: 'textToSpeechGenkitFlow',
    inputSchema: TextToSpeechInputSchema,
    outputSchema: TextToSpeechOutputSchema,
  },
  async (input: TextToSpeechInput) => {
    try {
      if (!process.env.ELEVENLABS_API_KEY) {
        console.error('textToSpeechGenkitFlow: ELEVENLABS_API_KEY is not set.');
        return { audioDataUri: undefined };
      }
      if (!input.text.trim()) {
        console.warn('textToSpeechGenkitFlow: Received empty text for TTS.');
        return { audioDataUri: undefined };
      }

      const elevenLabs = new ElevenLabsClient({
        apiKey: process.env.ELEVENLABS_API_KEY,
      });

      const audioStream = await elevenLabs.generate({
        voice: input.voiceId,
        text: input.text,
        model_id: 'eleven_multilingual_v2', // Or another suitable model
      });
      
      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      const audioDataUri = `data:audio/mpeg;base64,${buffer.toString('base64')}`;
      
      return { audioDataUri };

    } catch (error) {
      console.error('textToSpeechGenkitFlow: Error during ElevenLabs TTS generation:', error);
      return { audioDataUri: undefined };
    }
  }
);
