
'use server';
/**
 * @fileOverview An AI agent that generates an image based on a detailed textual description.
 *
 * - generateImage - A function that handles image generation.
 * - GenerateImageInput - The input type for the generateImage function.
 * - GenerateImageOutput - The return type for the generateImage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateImageInputSchema = z.object({
  detailedImageDescription: z.string().describe('A detailed textual description (around 100-150 words) of the image to be generated. This prompt should vividly describe the educational image or diagram needed.'),
});
export type GenerateImageInput = z.infer<typeof GenerateImageInputSchema>;

const GenerateImageOutputSchema = z.object({
  imageDataUri: z.string().optional().describe('The generated image as a data URI (e.g., data:image/png;base64,...). Undefined if generation failed or was not possible.'),
});
export type GenerateImageOutput = z.infer<typeof GenerateImageOutputSchema>;

export async function generateImage(input: GenerateImageInput): Promise<GenerateImageOutput> {
  console.log("generateImage: Input received:", JSON.stringify(input, null, 2));
  if (!input.detailedImageDescription || input.detailedImageDescription.trim() === "") {
    console.warn("generateImage: Empty or invalid detailedImageDescription received. Skipping image generation.");
    return { imageDataUri: undefined };
  }
  return generateImageGenkitFlow(input);
}

const generateImageGenkitFlow = ai.defineFlow(
  {
    name: 'generateImageGenkitFlow',
    inputSchema: GenerateImageInputSchema,
    outputSchema: GenerateImageOutputSchema,
  },
  async (input: GenerateImageInput) => {
    try {
      const {media} = await ai.generate({
        model: 'googleai/gemini-2.0-flash-exp', // IMPORTANT: Use exactly this model for image generation
        prompt: `Generate an image based on the following detailed description: "${input.detailedImageDescription}".
The image MUST be a **crystal clear, sharp (not blurry)**, simple, educational diagram or pictorial representation.
The image should be suitable for a quiz explanation.
If applicable, include **clearly legible text labels** directly on the image pointing to key parts of the diagram. **Ensure all text labels have correct spelling.**
Use a simple and clean color scheme.
The style should be similar to a textbook diagram.
Focus on **clarity, legibility, correct spelling, and educational value.**`,
        config: {
          responseModalities: ['TEXT', 'IMAGE'], // MUST provide both TEXT and IMAGE
        },
      });

      if (media && media.url) {
        console.log("generateImage: Image generated successfully.");
        return { imageDataUri: media.url };
      } else {
        console.warn("generateImage: Image generation did not return a media URL.");
        return { imageDataUri: undefined };
      }
    } catch (error) {
      console.error('generateImage: Error during image generation flow:', error);
      return { imageDataUri: undefined };
    }
  }
);
