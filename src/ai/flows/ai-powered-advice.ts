'use server';

/**
 * @fileOverview AI-powered advice and risk assessment flow based on user responses.
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
  return personalizedAdviceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'personalizedAdvicePrompt',
  input: {schema: PersonalizedAdviceInputSchema},
  output: {schema: PersonalizedAdviceOutputSchema},
  prompt: `You are an AI-powered HIV counseling assistant. Based on the user's responses to the following questions, provide personalized advice and a risk assessment.

Responses: {{responses}}

Demographics (if available): {{demographics}}

Provide the advice in a supportive and easy-to-understand manner. Be direct, but empathetic.

Risk Assessment:
Assess the user's risk factors based on their responses. Consider factors such as sexual activity, drug use, and medical history. Provide a clear and concise risk assessment.

Advice:
Provide personalized advice based on the user's responses and risk assessment. Suggest steps the user can take to reduce their risk and improve their health. Be specific and actionable.

Output the risk assessment and advice in the following format:
{
  "advice": "[Personalized advice here]",
  "riskAssessment": "[Risk assessment here]"
}
`,
});

const personalizedAdviceFlow = ai.defineFlow(
  {
    name: 'personalizedAdviceFlow',
    inputSchema: PersonalizedAdviceInputSchema,
    outputSchema: PersonalizedAdviceOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
