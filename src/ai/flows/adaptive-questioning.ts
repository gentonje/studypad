
'use server';

/**
 * @fileOverview An AI agent that adaptively asks HIV counseling questions based on user input.
 *
 * - adaptiveQuestioning - A function that handles the adaptive questioning process.
 * - AdaptiveQuestioningInput - The input type for the adaptiveQuestioning function.
 * - AdaptiveQuestioningOutput - The return type for the adaptiveQuestioning function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AdaptiveQuestioningInputSchema = z.object({
  previousAnswers: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).describe('An array of previous questions and answers in the counseling session.'),
  currentQuestion: z.string().optional().describe('The current question to ask the user.'),
});
export type AdaptiveQuestioningInput = z.infer<typeof AdaptiveQuestioningInputSchema>;

const AdaptiveQuestioningOutputSchema = z.object({
  nextQuestion: z.string().describe('The next question to ask the user, adapted based on previous answers.'),
});
export type AdaptiveQuestioningOutput = z.infer<typeof AdaptiveQuestioningOutputSchema>;

export async function adaptiveQuestioning(input: AdaptiveQuestioningInput): Promise<AdaptiveQuestioningOutput> {
  return adaptiveQuestioningFlow(input);
}

const prompt = ai.definePrompt({
  name: 'adaptiveQuestioningPrompt',
  input: {schema: AdaptiveQuestioningInputSchema},
  output: {schema: AdaptiveQuestioningOutputSchema},
  prompt: `You are an AI counselor specializing in HIV prevention and education. Your role is to ask questions that adapt to the user's previous answers, providing a personalized and relevant counseling experience. Based on the previous questions and answers, determine the most appropriate next question to ask. Focus on gathering information relevant to assessing risk factors, understanding the user's knowledge, and identifying areas where education or support may be needed.  If there are no previous answers, start with a general question about their knowledge of HIV.

Previous Questions and Answers:
{{#each previousAnswers}}
Question: {{{this.question}}}
Answer: {{{this.answer}}}
{{/each}}


{{#if currentQuestion}}
Current Question: {{{currentQuestion}}}
{{/if}}

Next Question:`,  
});

const adaptiveQuestioningFlow = ai.defineFlow(
  {
    name: 'adaptiveQuestioningFlow',
    inputSchema: AdaptiveQuestioningInputSchema,
    outputSchema: AdaptiveQuestioningOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output || typeof output.nextQuestion !== 'string' || output.nextQuestion.trim() === '') {
      console.error('AI output for adaptiveQuestioningFlow was invalid or empty:', output);
      throw new Error('AI did not provide a valid next question.');
    }
    return output;
  }
);

