
'use server';
/**
 * @fileOverview An AI agent that generates introductory text for a given topic,
 * tailored to an education level and language, optionally using a PDF for context.
 *
 * - getTopicIntroduction - A function that handles generating the topic introduction.
 * - GetTopicIntroductionInput - The input type for the getTopicIntroduction function.
 * - GetTopicIntroductionOutput - The return type for the getTopicIntroduction function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { EducationLevels, SupportedLanguages } from './types';

const GetTopicIntroductionInputSchema = z.object({
  topic: z.string().describe('The general topic for which to generate an introduction.'),
  educationLevel: EducationLevels.describe('The target education level for the introductory text.'),
  language: SupportedLanguages.optional().describe('The desired language for the introduction. Defaults to English.'),
  pdfDataUri: z.string().optional().nullable().describe("An optional PDF document provided by the user, as a data URI, to be used as context. Expected format: 'data:application/pdf;base64,<encoded_data>'."),
});
export type GetTopicIntroductionInput = z.infer<typeof GetTopicIntroductionInputSchema>;

const GetTopicIntroductionOutputSchema = z.object({
  introductionText: z.string().describe('A detailed and comprehensive introductory study text about the topic, suitable for the specified education level and language. This text should thoroughly prepare the user for a quiz on the topic, covering key concepts in depth. Provide in plain text, suitable for Markdown rendering.'),
});
export type GetTopicIntroductionOutput = z.infer<typeof GetTopicIntroductionOutputSchema>;

export async function getTopicIntroduction(input: GetTopicIntroductionInput): Promise<GetTopicIntroductionOutput> {
  console.log("getTopicIntroduction: Input received:", JSON.stringify(input, null, 2));
  return getTopicIntroductionGenkitFlow(input);
}

const getTopicIntroductionPrompt = ai.definePrompt({
  name: 'getTopicIntroductionPrompt',
  model: 'googleai/gemini-1.5-flash-latest',
  input: {schema: GetTopicIntroductionInputSchema},
  output: {schema: GetTopicIntroductionOutputSchema},
  prompt: `You are an AI assistant that generates detailed and comprehensive introductory study text for a specific topic, tailored to a given education level and language. This text should serve as a primary study material to prepare a user thoroughly for a quiz on this topic.
{{#if pdfDataUri}}
The user has provided the following PDF document for context. Your introduction MUST be consistent with, draw key information from, and comprehensively summarize the relevant sections of this document: {{media url=pdfDataUri}}.
If the stated topic seems unrelated to the document, prioritize generating an introduction based on the document's actual content, perhaps trying to link it to the user's topic if a connection exists. The introduction should reflect the depth of the provided document.
{{else}}
Generate the introduction based on general knowledge about the topic, ensuring it is thorough and covers foundational concepts comprehensively for the specified education level.
{{/if}}

Topic: {{{topic}}}
Education Level: {{{educationLevel}}}
Language for introduction: {{#if language}}{{language}}{{else}}English{{/if}}.

Please provide the 'introductionText' in {{#if language}}{{language}}{{else}}English{{/if}}.
The text should be:
-   **Detailed and Comprehensive**: Cover key concepts, definitions, important facts, and fundamental principles related to the topic, appropriate for the {{{educationLevel}}}. It should be more than just a brief overview; aim to provide enough substance for the user to learn from.
-   **Well-Structured and Clear**: Organize the information logically. Use clear language, suitable for the target {{{educationLevel}}}.
-   **Sufficiently Long**: The length should be adequate to cover the topic thoroughly for quiz preparation. This might be several paragraphs or more, depending on the topic's complexity and the education level.
-   **Engaging and Educational**: The tone should be informative and encouraging.
-   **Formatted in PLAIN TEXT**: Do NOT use Markdown formatting like \`**bold**\`, \`*italics*\`, or table structures. Use natural language and paragraphs for clear separation of ideas. This text will be rendered using Markdown, so well-structured plain text is ideal.
-   **Directly address the user**: As if preparing them for a quiz. For example, "To help you prepare for your quiz on {{{topic}}}, let's dive into the key concepts..." or "Here's a detailed introduction to {{{topic}}} that will cover what you need to know...".
`,
});

const getTopicIntroductionGenkitFlow = ai.defineFlow(
  {
    name: 'getTopicIntroductionGenkitFlow',
    inputSchema: GetTopicIntroductionInputSchema,
    outputSchema: GetTopicIntroductionOutputSchema,
  },
  async (input: GetTopicIntroductionInput) => {
    const langForMessage = input.language || 'English';
    try {
      const {output} = await getTopicIntroductionPrompt(input);
      if (!output || typeof output.introductionText !== 'string' || output.introductionText.trim() === '') {
          console.error('AI output for getTopicIntroductionFlow was invalid or empty:', output);
          let errorMessageText = `The AI response for the topic introduction ("${input.topic}") was incomplete or empty in ${langForMessage}.`;
          if (langForMessage === 'Spanish') errorMessageText = `La respuesta de la IA para la introducción del tema ("${input.topic}") estaba incompleta o vacía en ${langForMessage}.`;
          // Add more languages as needed
          throw new Error(errorMessageText);
      }
      return output;
    } catch (error: any) {
      console.error('getTopicIntroductionFlow: Error during AI prompt execution or processing:', error);
      let detail = error.message || "An unknown error occurred while generating the topic introduction.";
      if (error.cause && error.cause.message) detail += ` Cause: ${error.cause.message}`;
      
      let errorMessageText = `An unexpected server error occurred while generating the introduction for "${input.topic}" in ${langForMessage}. (Details: ${detail})`;
      if (langForMessage === 'Spanish') errorMessageText = `Ocurrió un error inesperado en el servidor al generar la introducción para "${input.topic}" en ${langForMessage}. (Detalles: ${detail})`;
      // Add more languages as needed
      throw new Error(errorMessageText);
    }
  }
);
