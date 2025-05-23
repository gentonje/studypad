
'use server';

/**
 * @fileOverview An AI agent that summarizes a knowledge quiz and provides further learning suggestions.
 * Considers an optional PDF document that might have been used for context.
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
  pdfDataUri: z.string().optional().nullable().describe("A PDF document provided by the user, as a data URI. Expected format: 'data:application/pdf;base64,<encoded_data>'."),
  responses: z
    .record(z.string())
    .describe('A record of question IDs (or truncated questions) to user responses.'),
  conversationHistory: z.array(z.object({
    question: z.string(),
    answer: z.string(),
    isCorrect: z.boolean().optional(),
    explanation: z.string().optional(),
    imageSuggestion: z.string().optional(),
  })).describe('The full list of questions asked and answers given during the quiz, including evaluation results.'),
});
export type QuizSummaryInput = z.infer<typeof QuizSummaryInputSchema>;

const QuizSummaryOutputSchema = z.object({
  summary: z.string().describe('A summary of the user\'s performance and understanding based on their answers, in the specified language. This should be in PLAIN TEXT without Markdown formatting for bold, italics, or tables. Use natural language for structure.'),
  furtherLearningSuggestions: z.array(z.string()).describe('A list of suggestions for further learning related to the topic, in the specified language.'),
});
export type QuizSummaryOutput = z.infer<typeof QuizSummaryOutputSchema>;

export async function getQuizSummary(input: QuizSummaryInput): Promise<QuizSummaryOutput> {
  console.log("getQuizSummary: Input received:", JSON.stringify(input, null, 2));
  return quizSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'quizSummaryPrompt',
  input: {schema: QuizSummaryInputSchema},
  output: {schema: QuizSummaryOutputSchema},
  prompt: `You are an AI assistant designed to summarize a user's performance on a knowledge quiz and provide suggestions for further learning, in their chosen language.
{{#if pdfDataUri}}
The quiz questions may have been based on the content of this document, which the user provided: {{media url=pdfDataUri}}.
Please consider this document context if it seems relevant to the questions and answers when forming your summary and suggestions.
{{/if}}

The quiz was on the topic: {{{topic}}}
The target education level was: {{{educationLevel}}}
The desired language for this summary is: {{#if language}}{{language}}{{else}}English{{/if}}.

Conversation History (questions might be in the user's language, answers are from the user, correctness and explanations are from prior AI evaluation):
{{#each conversationHistory}}
Question: {{{this.question}}}
User's Answer: {{{this.answer}}}
{{#if this.isCorrect}}
Evaluation: Correct.
{{else if (eq this.isCorrect false)}}
Evaluation: Incorrect.
{{else}}
Evaluation: Not explicitly evaluated or unknown.
{{/if}}
{{#if this.explanation}}
Explanation provided: {{{this.explanation}}}
{{/if}}
---
{{/each}}

Based on the conversation history, please provide in {{#if language}}{{language}}{{else}}English{{/if}}:
1.  A concise "summary" of the user's apparent understanding of the topic. Highlight areas where they showed good knowledge and areas where there might be gaps. Be constructive and encouraging. The summary must be in {{#if language}}{{language}}{{else}}English{{/if}}. **IMPORTANT: The summary should be in PLAIN TEXT only. Do NOT use Markdown formatting like \`**bold**\`, \`*italics*\`, or table structures. Use natural language and paragraphs for clear separation of ideas.**
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
      // Provide a more informative default message in the requested language
      const lang = input.language || 'English';
      let defaultSummary = `I encountered an issue generating the summary in ${lang}. Please try again later.`;
      if (lang === "Spanish") defaultSummary = `Encontré un problema al generar el resumen en ${lang}. Por favor, inténtalo de nuevo más tarde.`;
      // Add more language defaults as needed

      return {
        summary: defaultSummary,
        furtherLearningSuggestions: [`Review the quiz topic in ${lang}.`, `Explore related introductory materials in ${lang}.`]
      };
    }
    return output;
  }
);
