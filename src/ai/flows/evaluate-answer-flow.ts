
'use server';
/**
 * @fileOverview An AI agent that evaluates a user's answer to a quiz question.
 *
 * - evaluateAnswer - A function that handles the answer evaluation.
 * - EvaluateAnswerInput - The input type for the evaluateAnswer function.
 * - EvaluateAnswerOutput - The return type for the evaluateAnswer function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
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
  explanation: z.string().optional().describe('A brief explanation for why the answer is correct or incorrect (optional).'),
});
export type EvaluateAnswerOutput = z.infer<typeof EvaluateAnswerOutputSchema>;

export async function evaluateAnswer(input: EvaluateAnswerInput): Promise<EvaluateAnswerOutput> {
  return evaluateAnswerGenkitFlow(input);
}

const evaluateAnswerPrompt = ai.definePrompt({
  name: 'evaluateAnswerPrompt',
  input: {schema: EvaluateAnswerInputSchema},
  output: {schema: EvaluateAnswerOutputSchema},
  prompt: `You are an AI quiz evaluator. Your task is to determine if the user's answer is correct for the given question, considering the topic and education level.
Provide a boolean \`isCorrect\` and an optional \`explanation\`.

Topic: {{{topic}}}
Education Level: {{{educationLevel}}}

Question: {{{question}}}
User's Answer: {{{userAnswer}}}

Based on this information, evaluate the user's answer. Be reasonably flexible with phrasing if the core concept is correct for the given education level.
If the answer is too vague, or clearly wrong, mark it as incorrect.
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
    if (!output || typeof output.isCorrect !== 'boolean') {
        console.error('AI output for evaluateAnswerFlow was invalid or incomplete:', output);
        // Fallback if AI fails to provide a clear boolean
        return { isCorrect: false, explanation: "Could not determine correctness." };
    }
    return output;
  }
);
