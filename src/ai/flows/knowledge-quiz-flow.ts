
'use server';

/**
 * @fileOverview An AI agent that asks knowledge-based questions based on user input topic, education level, and an optional PDF document.
 *
 * - knowledgeQuizFlow - A function that handles the adaptive questioning process.
 * - KnowledgeQuizInput - The input type for the knowledgeQuizFlow function.
 * - KnowledgeQuizOutput - The return type for the knowledgeQuizFlow function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { EducationLevels, SupportedLanguages, type EducationLevel, type SupportedLanguage } from './types';

const KnowledgeQuizInputSchema = z.object({
  topic: z.string().describe('The general topic for the quiz.'),
  educationLevel: EducationLevels.describe('The target education level for the questions.'),
  language: SupportedLanguages.optional().describe('The desired language for the quiz questions and content. Defaults to English if not provided.'),
  pdfDataUri: z.string().optional().nullable().describe("A PDF document provided by the user, as a data URI. Expected format: 'data:application/pdf;base64,<encoded_data>'."),
  previousAnswers: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).optional().describe('An array of previous questions and user answers in the current quiz session.'),
  currentQuestion: z.string().optional().describe('The current question being posed to the user (if re-prompting or refining).'),
});
export type KnowledgeQuizInput = z.infer<typeof KnowledgeQuizInputSchema>;

const KnowledgeQuizOutputSchema = z.object({
  nextQuestion: z.string().optional().describe('The next question to ask the user, adapted based on previous answers, topic, education level, language, and PDF content. If empty, null, or not provided, it signals the end of the questioning phase.'),
});
export type KnowledgeQuizOutput = z.infer<typeof KnowledgeQuizOutputSchema>;

export async function knowledgeQuizFlow(input: KnowledgeQuizInput): Promise<KnowledgeQuizOutput> {
  console.log("knowledgeQuizFlow: Input received:", JSON.stringify(input, null, 2));
  const flowOutput = await knowledgeQuizGenkitFlow(input);
  
  if (!flowOutput || typeof flowOutput.nextQuestion === 'undefined' || flowOutput.nextQuestion === null) {
    console.log("knowledgeQuizFlow: AI signaled end of quiz (output undefined or null).");
    return { nextQuestion: "" }; 
  }
  if (typeof flowOutput.nextQuestion === 'string' && flowOutput.nextQuestion.trim() === '') {
    console.log("knowledgeQuizFlow: AI signaled end of quiz (empty string).");
  } else if (typeof flowOutput.nextQuestion !== 'string') {
    console.error('knowledgeQuizFlow: AI output for nextQuestion was not a string:', flowOutput.nextQuestion, '- Forcing end of quiz.');
    return { nextQuestion: "" }; 
  }
  return flowOutput;
}

const knowledgeQuizPrompt = ai.definePrompt({
  name: 'knowledgeQuizPrompt',
  input: {schema: KnowledgeQuizInputSchema},
  output: {schema: KnowledgeQuizOutputSchema},
  prompt: `You are an AI quiz master. Your goal is to test knowledge on a given topic, tailoring questions to the specified education level and language.
{{#if pdfDataUri}}
You MUST primarily base your questions and derive information from the content of the provided document: {{media url=pdfDataUri}}.
If the topic seems unrelated to the document, ask questions based on the document's content anyway, trying to link it to the user's topic if possible, or focus on general knowledge extractable from the document.
{{/if}}

The topic is: {{{topic}}}
The education level is: {{{educationLevel}}}
The desired language for the questions is: {{#if language}}{{language}}{{else}}English{{/if}}. All questions you generate MUST be in this language.

{{#if previousAnswers.length}}
So far, the conversation has been:
{{#each previousAnswers}}
Q: {{{this.question}}}
A: {{{this.answer}}}
{{/each}}
{{else}}
This is the first question. Start with a foundational question appropriate for the topic, education level, specified language{{#if pdfDataUri}}, and the provided document{{/if}}.
{{/if}}

Based on the topic, education level, language, the conversation history (if any){{#if pdfDataUri}}, and critically, the provided document content{{/if}}, formulate the next most relevant and insightful question.
The question should be clear, concise, and appropriate for the {{{educationLevel}}} level, and strictly in the specified language ({{#if language}}{{language}}{{else}}English{{/if}}).
Avoid yes/no questions; aim for questions that require a short explanation or factual recall.

IMPORTANT: Adjust the number of questions based on the education level.
-   For 'Preschool' and 'ElementarySchool', aim for approximately 5-8 high-quality questions.
-   For 'MiddleSchool', aim for approximately 8-12 high-quality questions.
-   For 'HighSchool', aim for approximately 12-18 high-quality questions.
-   For 'College', 'Graduate', 'Masters', and 'PhD', aim for a comprehensive quiz of approximately 15-25 questions, or more if the topic (and document content, if provided) is rich and supports further exploration.

Your primary objective is to conduct a comprehensive quiz appropriate for the level.
Do not stop asking just because a certain number of questions have been asked if the topic still has facets to explore appropriate for the user's level and the guidelines above.
However, prioritize relevance and depth. If, after thorough exploration, you find that the topic (and document content, if provided) is genuinely exhausted for the given education level and language, and you cannot formulate further distinct, high-quality, and meaningful questions, then you may set 'nextQuestion' to an empty string ("") to signal the end of the quiz, even if the target question count for that level hasn't been reached.

Do not repeat questions.
Generate only the next question. Ensure it is in {{#if language}}{{language}}{{else}}English{{/if}}.
`,
});

const knowledgeQuizGenkitFlow = ai.defineFlow(
  {
    name: 'knowledgeQuizGenkitFlow', 
    inputSchema: KnowledgeQuizInputSchema,
    outputSchema: KnowledgeQuizOutputSchema,
  },
  async (input: KnowledgeQuizInput) => {
    const {output} = await knowledgeQuizPrompt(input);
    return output!; 
  }
);

