
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
  introductionText: z.string().describe('A concise introductory text about the topic, suitable for the specified education level and language. This text should prepare the user for a quiz on the topic. Provide in plain text, suitable for Markdown rendering.'),
});
export type GetTopicIntroductionOutput = z.infer<typeof GetTopicIntroductionOutputSchema>;

export async function getTopicIntroduction(input: GetTopicIntroductionInput): Promise<GetTopicIntroductionOutput> {
  console.log("getTopicIntroduction: Input received:", JSON.stringify(input, null, 2));
  return getTopicIntroductionGenkitFlow(input);
}

const getTopicIntroductionPrompt = ai.definePrompt({
  name: 'getTopicIntroductionPrompt',
  input: {schema: GetTopicIntroductionInputSchema},
  output: {schema: GetTopicIntroductionOutputSchema},
  prompt: `You are an AI assistant that generates concise and informative introductory study text for a specific topic, tailored to a given education level and language. This text should prepare a user for a quiz on this topic.
{{#if pdfDataUri}}
The user has provided the following PDF document for context. Your introduction MUST be consistent with and, where appropriate, draw key information from this document: {{media url=pdfDataUri}}.
If the stated topic seems unrelated to the document, prioritize generating an introduction based on the document's actual content, perhaps trying to link it to the user's topic if a connection exists.
{{else}}
Generate the introduction based on general knowledge about the topic.
{{/if}}

Topic: {{{topic}}}
Education Level: {{{educationLevel}}}
Language for introduction: {{#if language}}{{language}}{{else}}English{{/if}}.

Please provide the 'introductionText' in {{#if language}}{{language}}{{else}}English{{/if}}.
The text should be:
- Informative and cover key concepts or an overview relevant to the topic and education level.
- Engaging and easy to understand for the target {{{educationLevel}}}.
- Not too long; aim for a few paragraphs that can be read quickly.
- Formatted in **PLAIN TEXT**. Do NOT use Markdown formatting like \`**bold**\`, \`*italics*\`, or table structures. Use natural language and paragraphs for clear separation of ideas. This text will be rendered using Markdown, so well-structured plain text is ideal.
- Directly address the user as if preparing them for a quiz. For example, "Before we start the quiz on {{{topic}}}, let's quickly go over some key points..." or "To get you ready for your quiz on {{{topic}}}, here's a brief introduction...".
`,
});

const getTopicIntroductionGenkitFlow = ai.defineFlow(
  {
    name: 'getTopicIntroductionGenkitFlow',
    inputSchema: GetTopicIntroductionInputSchema,
    outputSchema: GetTopicIntroductionOutputSchema,
  },
  async (input: GetTopicIntroductionInput) => {
    const {output} = await getTopicIntroductionPrompt(input);
    if (!output || typeof output.introductionText !== 'string' || output.introductionText.trim() === '') {
        console.error('AI output for getTopicIntroductionFlow was invalid or empty:', output);
        const langForMessage = input.language || 'English';
        let errorMessageText = `Could not generate an introduction for "${input.topic}" in ${langForMessage} at the ${input.educationLevel} level.`;
        if (langForMessage === 'Spanish') {
          errorMessageText = `No se pudo generar una introducción para "${input.topic}" en ${langForMessage} para el nivel ${input.educationLevel}.`;
        }
        // Add more languages as needed
        return { 
            introductionText: errorMessageText,
        };
    }
    return output;
  }
);
