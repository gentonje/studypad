
'use server';

/**
 * @fileOverview An AI agent that summarizes a knowledge quiz and provides further learning suggestions.
 *
 * - getQuizSummary - A function that generates a summary of the quiz.
 * - QuizSummaryInput - The input type for the getQuizSummary function.
 * - QuizSummaryOutput - The return type for the getQuizSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { EducationLevels, SupportedLanguages, type EducationLevel, type SupportedLanguage } from './types';


const QuizSummaryInputSchema = z.object({
  topic: z.string().describe('The topic of the quiz.'),
  educationLevel: EducationLevels.describe('The education level for which the quiz was taken.'),
  language: SupportedLanguages.optional().describe('The language for the summary and suggestions. Defaults to English.'),
  responses: z
    .record(z.string())
    .describe('A record of question IDs (or truncated questions) to user responses.'),
  conversationHistory: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).describe('The full list of questions asked and answers given during the quiz.'),
});
export type QuizSummaryInput = z.infer<typeof QuizSummaryInputSchema>;

const QuizSummaryOutputSchema = z.object({
  summary: z.string().describe('A summary of the user\'s performance and understanding based on their answers, in the specified language.'),
  furtherLearningSuggestions: z.array(z.string()).describe('A list of suggestions for further learning related to the topic, in the specified language.'),
});
export type QuizSummaryOutput = z.infer<typeof QuizSummaryOutputSchema>;

export async function getQuizSummary(input: QuizSummaryInput): Promise<QuizSummaryOutput> {
  return quizSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'quizSummaryPrompt',
  input: {schema: QuizSummaryInputSchema},
  output: {schema: QuizSummaryOutputSchema},
  prompt: `You are an AI assistant designed to summarize a user's performance on a knowledge quiz and provide suggestions for further learning, in their chosen language.
The quiz was on the topic: {{{topic}}}
The target education level was: {{{educationLevel}}}
The desired language for this summary is: {{#if language}}{{language}}{{else}}English{{/if}}.

Conversation History (questions might be in the user's language, answers are from the user):
{{#each conversationHistory}}
Question: {{{this.question}}}
User's Answer: {{{this.answer}}}
---
{{/each}}

Based on the conversation history, please provide in {{#if language}}{{language}}{{else}}English{{/if}}:
1.  A concise "summary" of the user's apparent understanding of the topic. Highlight areas where they showed good knowledge and areas where there might be gaps. Be constructive and encouraging. The summary must be in {{#if language}}{{language}}{{else}}English{{/if}}.
2.  A list of "furtherLearningSuggestions" (between 3 to 5 suggestions) for topics or concepts the user might want to explore next to deepen their understanding, relevant to the quiz topic and their education level. These suggestions must be in {{#if language}}{{language}}{{else}}English{{/if}}.

Ensure your output strictly adheres to the requested JSON format.
`,
});

const quizSummaryFlow = ai.defineFlow(
  {
    name: 'quizSummaryFlow',
    inputSchema: QuizSummaryInputSchema,
    outputSchema: QuizSummaryOutputSchema,
  },
  async (input: QuizSummaryInput) => {
    const {output} = await prompt(input);
    if (!output || 
        typeof output.summary !== 'string' || 
        output.summary.trim() === '' || 
        !Array.isArray(output.furtherLearningSuggestions)) {
      console.error('AI output for quizSummaryFlow was invalid or incomplete:', output);
      return {
        summary: `I encountered an issue generating the summary in ${input.language || 'English'}. Please try again later.`,
        furtherLearningSuggestions: [`Review the quiz topic.`, `Explore related introductory materials.`]
      };
    }
    return output;
  }
);
