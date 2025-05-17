
'use server';

/**
 * @fileOverview An AI agent that asks knowledge-based questions based on user input topic and education level.
 *
 * - knowledgeQuizFlow - A function that handles the adaptive questioning process for a given topic and education level.
 * - KnowledgeQuizInput - The input type for the knowledgeQuizFlow function.
 * - KnowledgeQuizOutput - The return type for the knowledgeQuizFlow function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { EducationLevels, type EducationLevel } from './types';

const KnowledgeQuizInputSchema = z.object({
  topic: z.string().describe('The general topic for the quiz.'),
  educationLevel: EducationLevels.describe('The target education level for the questions.'),
  previousAnswers: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).optional().describe('An array of previous questions and user answers in the current quiz session.'),
  currentQuestion: z.string().optional().describe('The current question being posed to the user (if re-prompting or refining).'),
});
export type KnowledgeQuizInput = z.infer<typeof KnowledgeQuizInputSchema>;

const KnowledgeQuizOutputSchema = z.object({
  nextQuestion: z.string().optional().describe('The next question to ask the user, adapted based on previous answers, topic, and education level. If empty, null, or not provided, it signals the end of the questioning phase for the current topic and education level.'),
});
export type KnowledgeQuizOutput = z.infer<typeof KnowledgeQuizOutputSchema>;

export async function knowledgeQuizFlow(input: KnowledgeQuizInput): Promise<KnowledgeQuizOutput> {
  console.log('knowledgeQuizFlow: Input received:', JSON.stringify(input, null, 2));
  const flowOutput = await knowledgeQuizGenkitFlow(input);
  
  // Ensure output structure is valid, especially nextQuestion
  if (!flowOutput || typeof flowOutput.nextQuestion === 'undefined' || flowOutput.nextQuestion === null) {
    // If AI provides no nextQuestion field at all, or it's null, treat as end of quiz.
     console.warn('knowledgeQuizFlow: AI output was missing nextQuestion field or it was null. Returning empty nextQuestion.');
    return { nextQuestion: "" }; // Explicitly return empty string
  }
  if (typeof flowOutput.nextQuestion === 'string' && flowOutput.nextQuestion.trim() === '') {
     console.log('knowledgeQuizFlow: AI returned an empty string for nextQuestion. Ending quiz.');
  } else if (typeof flowOutput.nextQuestion !== 'string') {
    // If nextQuestion is present but not a string (e.g. if schema validation failed silently)
    console.error('knowledgeQuizFlow: AI output for nextQuestion was not a string:', flowOutput.nextQuestion, '- Forcing end of quiz.');
    return { nextQuestion: "" }; // Explicitly return empty string
  }

  console.log('knowledgeQuizFlow: Output to be sent:', JSON.stringify(flowOutput, null, 2));
  return flowOutput;
}

const knowledgeQuizPrompt = ai.definePrompt({
  name: 'knowledgeQuizPrompt',
  input: {schema: KnowledgeQuizInputSchema},
  output: {schema: KnowledgeQuizOutputSchema},
  prompt: `You are an AI quiz master. Your goal is to test knowledge on a given topic, tailoring questions to the specified education level.
The topic is: {{{topic}}}
The education level is: {{{educationLevel}}}

{{#if previousAnswers.length}}
So far, the conversation has been:
{{#each previousAnswers}}
Q: {{{this.question}}}
A: {{{this.answer}}}
{{/each}}
{{else}}
This is the first question. Start with a foundational question appropriate for the topic and education level.
{{/if}}

Based on the topic, education level, and the conversation history (if any), formulate the next most relevant and insightful question.
The question should be clear, concise, and appropriate for the {{{educationLevel}}} level.
Avoid yes/no questions; aim for questions that require a short explanation or factual recall.

IMPORTANT: Do not stop after a fixed number of questions. Continue asking questions to explore different facets of the topic.
If you determine that the topic has been sufficiently explored for the given education level, or if you cannot formulate a relevant follow-up question based on the previous interactions and topic scope, then set 'nextQuestion' to an empty string ("") to signal the end of the quiz.

Do not repeat questions.
Generate only the next question.
`,
});

const knowledgeQuizGenkitFlow = ai.defineFlow(
  {
    name: 'knowledgeQuizGenkitFlow', // Renamed to avoid conflict with exported wrapper
    inputSchema: KnowledgeQuizInputSchema,
    outputSchema: KnowledgeQuizOutputSchema,
  },
  async (input: KnowledgeQuizInput) => {
    const {output} = await knowledgeQuizPrompt(input);
    // The prompt already asks the AI to return an empty string for nextQuestion to end the quiz.
    // The schema allows nextQuestion to be optional or a string.
    // If the AI returns nothing for nextQuestion (undefined in output object), or an empty string, it signals end.
    // The wrapper function `knowledgeQuizFlow` handles potential null/undefined from the AI more robustly.
    return output!; // The '!' asserts that output is not null/undefined, which definePrompt guarantees if no error.
  }
);
