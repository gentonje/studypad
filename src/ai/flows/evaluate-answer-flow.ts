
'use server';
/**
 * @fileOverview An AI agent that evaluates a user's answer to a quiz question,
 * providing detailed explanations and suggesting images for clarity. Considers an optional PDF for context.
 *
 * - evaluateAnswer - A function that handles the answer evaluation.
 * - EvaluateAnswerInput - The input type for the evaluateAnswer function.
 * - EvaluateAnswerOutput - The return type for the evaluateAnswer function.
 */

import {ai} from '@/ai/genkit';
import {z}from 'genkit';
import { EducationLevels, SupportedLanguages, type EducationLevel, type SupportedLanguage } from './types';

const EvaluateAnswerInputSchema = z.object({
  question: z.string().describe('The quiz question that was asked.'),
  userAnswer: z.string().describe("The user's answer to the question."),
  topic: z.string().describe('The general topic of the quiz.'),
  educationLevel: EducationLevels.describe('The target education level for the quiz.'),
  language: SupportedLanguages.optional().describe('The language for the explanation. Defaults to English.'),
  pdfDataUri: z.string().optional().nullable().describe("A PDF document provided by the user, as a data URI. Expected format: 'data:application/pdf;base64,<encoded_data>'."),
});
export type EvaluateAnswerInput = z.infer<typeof EvaluateAnswerInputSchema>;

const EvaluateAnswerOutputSchema = z.object({
  isCorrect: z.boolean().describe('Whether the user answer is considered correct for the given question, topic, and education level.'),
  explanation: z.string().describe('A detailed, teacher-like explanation for why the answer is correct or incorrect, tailored to the education level and specified language. This should always be provided and aim to help the student understand the underlying concept thoroughly. Provide the explanation in PLAIN TEXT, without Markdown formatting for bold, italics, or tables. Use natural language for structure.'),
  imageSuggestion: z.string().optional().describe("A one or two-word search term for an image that could visually clarify the explanation, if applicable. Max two words. E.g., 'photosynthesis diagram' or 'volcano eruption'.")
});
export type EvaluateAnswerOutput = z.infer<typeof EvaluateAnswerOutputSchema>;

export async function evaluateAnswer(input: EvaluateAnswerInput): Promise<EvaluateAnswerOutput> {
  console.log("evaluateAnswer: Input received:", JSON.stringify(input, null, 2));
  return evaluateAnswerGenkitFlow(input);
}

const evaluateAnswerPrompt = ai.definePrompt({
  name: 'evaluateAnswerPrompt',
  input: {schema: EvaluateAnswerInputSchema},
  output: {schema: EvaluateAnswerOutputSchema},
  prompt: `You are an expert AI educator evaluating a student's answer to a quiz question. Your goal is not just to mark it right or wrong, but to help the student truly understand the concept in their chosen language.
{{#if pdfDataUri}}
The student may have been referring to the following document for context. If the question or answer relates to it, ensure your evaluation and explanation are consistent with this document: {{media url=pdfDataUri}}.
{{/if}}

Topic: {{{topic}}}
Education Level: {{{educationLevel}}}
Language for explanation: {{#if language}}{{language}}{{else}}English{{/if}}.

Question (this question was presented to the user in {{#if language}}{{language}}{{else}}English{{/if}}): {{{question}}}
User's Answer: {{{userAnswer}}}

Please provide your response in {{#if language}}{{language}}{{else}}English{{/if}}.
1.  \`isCorrect\`: A boolean indicating if the user's answer is substantially correct for the given question, topic, education level{{#if pdfDataUri}}, and the provided document context{{/if}}. Be reasonably flexible with phrasing if the core concept is correct. If the answer is too vague, or clearly wrong, mark it as incorrect.
2.  \`explanation\`: A detailed, teacher-like explanation.
    *   If correct: Explain *why* it's correct in {{#if language}}{{language}}{{else}}English{{/if}}, perhaps reinforcing the key concepts or adding a bit more relevant detail.
    *   If incorrect: Clearly explain the misunderstanding or error in {{#if language}}{{language}}{{else}}English{{/if}}. Provide the correct information and explain the reasoning behind it.
    *   The explanation MUST be tailored to the student's specified education level and language ({{#if language}}{{language}}{{else}}English{{/if}}). It should help them understand the concept better. Use analogies or simpler terms if appropriate for the level and language.
    *   IMPORTANT: The explanation should be in **PLAIN TEXT** only. Do NOT use Markdown formatting like \`**bold**\`, \`*italics*\`, or table structures. Use natural language and paragraphs for clear separation of ideas.
3.  \`imageSuggestion\`: If a simple image, diagram, or pictorial could significantly help in understanding the explanation (e.g., for visual concepts like a cell structure, a historical map, a type of rock), provide a one or two-word search term for such an image. Examples: "cell mitosis", "roman aqueduct", "igneous rock". If no image is particularly helpful, omit this field. Maximum two words. These terms should be in English or a broadly understandable format for image search.

Ensure your output strictly adheres to the requested JSON format and that the explanation is thorough, pedagogical, plain text, and in the specified language ({{#if language}}{{language}}{{else}}English{{/if}}).
`,
});

const evaluateAnswerGenkitFlow = ai.defineFlow(
  {
    name: 'evaluateAnswerGenkitFlow',
    inputSchema: EvaluateAnswerInputSchema,
    outputSchema: EvaluateAnswerOutputSchema,
  },
  async (input: EvaluateAnswerInput) => {
    const {output} = await evaluateAnswerPrompt(input);
    if (!output || typeof output.isCorrect !== 'boolean' || !output.explanation) {
        console.error('AI output for evaluateAnswerFlow was invalid or incomplete:', output);
        return { 
            isCorrect: false, 
            explanation: `Could not determine correctness or provide a detailed explanation in ${input.language || 'English'} at this time. Please ensure your answer is clear.`,
            imageSuggestion: undefined
        };
    }
    return output;
  }
);
