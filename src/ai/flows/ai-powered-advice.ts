
'use server';

/**
 * @fileOverview This file is OBSOLETE. Its functionality has been moved to quiz-summary-flow.ts
 * AI-powered advice and risk assessment flow based on user responses.
 *
 * - getPersonalizedAdvice - A function that generates personalized advice and risk assessments.
 * - PersonalizedAdviceInput - The input type for the getPersonalizedAdvice function.
 * - PersonalizedAdviceOutput - The return type for the getPersonalizedAdvice function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PersonalizedAdviceInputSchema = z.object({
  responses: z
    .record(z.string())
    .describe('A record of question IDs to user responses.'),
  demographics: z
    .object({
      age: z.number().optional().describe('The age of the user.'),
      gender: z.string().optional().describe('The gender of the user.'),
    })
    .optional()
    .describe('Optional demographic information about the user.'),
});
export type PersonalizedAdviceInput = z.infer<typeof PersonalizedAdviceInputSchema>;

const PersonalizedAdviceOutputSchema = z.object({
  advice: z.string().describe('Personalized advice based on user responses.'),
  riskAssessment: z.string().describe('A risk assessment based on user responses.'),
});
export type PersonalizedAdviceOutput = z.infer<typeof PersonalizedAdviceOutputSchema>;

export async function getPersonalizedAdvice(input: PersonalizedAdviceInput): Promise<PersonalizedAdviceOutput> {
  // This flow is obsolete.
  console.warn("Obsolete flow getPersonalizedAdvice called. Please use getQuizSummary from quiz-summary-flow.ts instead.");
  return {
    advice: "This advice flow is obsolete.",
    riskAssessment: "This risk assessment flow is obsolete."
  };
}

const prompt = ai.definePrompt({
  name: 'personalizedAdvicePrompt_OBSOLETE',
  input: {schema: PersonalizedAdviceInputSchema},
  output: {schema: PersonalizedAdviceOutputSchema},
  prompt: `This prompt is obsolete.`,
});

const personalizedAdviceFlow = ai.defineFlow(
  {
    name: 'personalizedAdviceFlow_OBSOLETE',
    inputSchema: PersonalizedAdviceInputSchema,
    outputSchema: PersonalizedAdviceOutputSchema,
  },
  async input => {
    return {
      advice: "This advice flow is obsolete.",
      riskAssessment: "This risk assessment flow is obsolete."
    };
  }
);
