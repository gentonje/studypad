
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
    console.log("textToSpeechGenkitFlow: Received input:", input.text.substring(0, 50) + "...");
    try {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        console.error('textToSpeechGenkitFlow: CRITICAL - ELEVENLABS_API_KEY is not set in environment variables.');
        // Double check the key value itself if this log appears
        console.log('textToSpeechGenkitFlow: Current value of process.env.ELEVENLABS_API_KEY is:', apiKey === undefined ? 'undefined' : 'an empty string or other falsy value');
        return { audioDataUri: undefined };
      }
      console.log('textToSpeechGenkitFlow: ELEVENLABS_API_KEY is set (at least, it is not undefined or null).');

      if (!input.text || input.text.trim() === "") {
        console.warn('textToSpeechGenkitFlow: Received empty or whitespace-only text for TTS. Skipping.');
        return { audioDataUri: undefined };
      }

      const elevenLabs = new ElevenLabsClient({
        apiKey: apiKey, // Use the checked apiKey variable
      });

      console.log('textToSpeechGenkitFlow: Calling ElevenLabs API with voiceId:', input.voiceId, 'and model_id: eleven_multilingual_v2');
      const audioStream = await elevenLabs.generate({
        voice: input.voiceId!, // voiceId has a default, so it should be present
        text: input.text,
        model_id: 'eleven_multilingual_v2', 
      });
      
      console.log('textToSpeechGenkitFlow: Received audio stream from ElevenLabs.');
      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(chunk);
      }

      if (chunks.length === 0) {
        console.warn('textToSpeechGenkitFlow: No audio data received in chunks from ElevenLabs. This could be due to an API error or an issue with the input text/voice.');
        return { audioDataUri: undefined };
      }

      const buffer = Buffer.concat(chunks);
      const audioDataUri = `data:audio/mpeg;base64,${buffer.toString('base64')}`;
      console.log('textToSpeechGenkitFlow: Successfully converted audio to data URI (length approx):', audioDataUri.length);
      
      return { audioDataUri };

    } catch (error) {
      console.error('textToSpeechGenkitFlow: Error during ElevenLabs TTS generation:', error);
      if (error instanceof Error) {
        console.error('textToSpeechGenkitFlow: Error name:', error.name);
        console.error('textToSpeechGenkitFlow: Error message:', error.message);
        // Log more details if available, like response status from ElevenLabs
        // This might be vendor-specific, checking for common error properties
        if ('status' in error) {
           console.error('textToSpeechGenkitFlow: Error status (if available):', (error as any).status);
        }
        if ('response' in error && (error as any).response && 'data' in (error as any).response) {
           console.error('textToSpeechGenkitFlow: Error response data (if available):', (error as any).response.data);
        }

      }
      return { audioDataUri: undefined };
    }
  }
);
