
'use server';
/**
 * @fileOverview An AI agent that evaluates a user's answer to a quiz question,
 * providing detailed explanations and suggesting images for clarity.
 *
 * - evaluateAnswer - A function that handles the answer evaluation.
 * - EvaluateAnswerInput - The input type for the evaluateAnswer function.
 * - EvaluateAnswerOutput - The return type for the evaluateAnswer function.
 */

import {ai} from '@/ai/genkit';
import {z}from 'genkit';
import { EducationLevels, type EducationLevel } from './types';

const EvaluateAnswerInputSchema = z.object({
  question: z.string().describe('The quiz question that was asked.'),
  userAnswer: z.string().describe("The user's answer to the question."),
  topic: z.string().describe('The general topic of the quiz.'),
  educationLevel: EducationLevels.describe('The target education level for the quiz.'),
});
export type EvaluateAnswerInput = z.infer<typeof EvaluateAnswerInputSchema>;

const EvaluateAnswerOutputSchema = z.object({
  isCorrect: z.boolean().describe('Whether the user answer is considered correct for the given question, topic, and education level.'),
  explanation: z.string().describe('A detailed, teacher-like explanation for why the answer is correct or incorrect, tailored to the education level. This should always be provided and aim to help the student understand the underlying concept thoroughly.'),
  imageSuggestion: z.string().optional().describe("A one or two-word search term for an image that could visually clarify the explanation, if applicable. Max two words. E.g., 'photosynthesis diagram' or 'volcano eruption'.")
});
export type EvaluateAnswerOutput = z.infer<typeof EvaluateAnswerOutputSchema>;

export async function evaluateAnswer(input: EvaluateAnswerInput): Promise<EvaluateAnswerOutput> {
  return evaluateAnswerGenkitFlow(input);
}

const evaluateAnswerPrompt = ai.definePrompt({
  name: 'evaluateAnswerPrompt',
  input: {schema: EvaluateAnswerInputSchema},
  output: {schema: EvaluateAnswerOutputSchema},
  prompt: `You are an expert AI educator evaluating a student's answer to a quiz question. Your goal is not just to mark it right or wrong, but to help the student truly understand the concept.

Topic: {{{topic}}}
Education Level: {{{educationLevel}}}

Question: {{{question}}}
User's Answer: {{{userAnswer}}}

Please provide:
1.  \`isCorrect\`: A boolean indicating if the user's answer is substantially correct for the given question, topic, and education level. Be reasonably flexible with phrasing if the core concept is correct. If the answer is too vague, or clearly wrong, mark it as incorrect.
2.  \`explanation\`: A detailed, teacher-like explanation.
    *   If correct: Explain *why* it's correct, perhaps reinforcing the key concepts or adding a bit more relevant detail.
    *   If incorrect: Clearly explain the misunderstanding or error. Provide the correct information and explain the reasoning behind it.
    *   The explanation MUST be tailored to the student's specified education level and should help them understand the concept better. Use analogies or simpler terms if appropriate for the level.
3.  \`imageSuggestion\`: If a simple image, diagram, or pictorial could significantly help in understanding the explanation (e.g., for visual concepts like a cell structure, a historical map, a type of rock), provide a one or two-word search term for such an image. Examples: "cell mitosis", "roman aqueduct", "igneous rock". If no image is particularly helpful, omit this field. Maximum two words.

Ensure your output strictly adheres to the requested JSON format and that the explanation is thorough and pedagogical.
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
            explanation: "Could not determine correctness or provide a detailed explanation at this time. Please ensure your answer is clear.",
            imageSuggestion: undefined
        };
    }
    return output;
  }
);
