
'use server';
/**
 * @fileOverview An AI agent that evaluates a user's answer to a quiz question,
 * providing a score (0-5), detailed explanations, and suggesting images for clarity. Considers an optional PDF for context.
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
  awardedScore: z.number().min(0).max(5).describe('The score awarded to the user answer, on a scale of 0 to 5. 0: incorrect, 1-2: basic/partially correct, 3: mostly correct with minor issues, 4: very good, 5: excellent/fully comprehensive for the level.'),
  explanation: z.string().describe('A detailed, teacher-like explanation for the score, tailored to the education level and specified language. This should always be provided and aim to help the student understand the underlying concept thoroughly. Provide the explanation in PLAIN TEXT, without Markdown formatting for bold, italics, or tables. Use natural language for structure.'),
  imageSuggestion: z.string().optional().describe("A one or two-word search term for an image that could visually clarify the specific explanation being provided. Max two words. E.g., 'wave interference' or 'photon slit' if explaining wave-particle duality.")
});
export type EvaluateAnswerOutput = z.infer<typeof EvaluateAnswerOutputSchema>;

export async function evaluateAnswer(input: EvaluateAnswerInput): Promise<EvaluateAnswerOutput> {
  console.log("evaluateAnswer: Input received:", JSON.stringify(input, null, 2));
  return evaluateAnswerGenkitFlow(input);
}

const evaluateAnswerPrompt = ai.definePrompt({
  name: 'evaluateAnswerPrompt',
  model: 'googleai/gemini-1.5-flash-latest', // Explicitly set the model
  input: {schema: EvaluateAnswerInputSchema},
  output: {schema: EvaluateAnswerOutputSchema},
  prompt: `You are an expert AI educator evaluating a student's answer to a quiz question. Your goal is to provide a fair score (0-5) and a comprehensive, teacher-like explanation to help the student understand the concept in their chosen language.
{{#if pdfDataUri}}
The student may have been referring to the following document for context. If the question or answer relates to it, ensure your evaluation, score, and explanation are consistent with this document: {{media url=pdfDataUri}}.
{{/if}}

Topic: {{{topic}}}
Education Level: {{{educationLevel}}}
Language for explanation: {{#if language}}{{language}}{{else}}English{{/if}}.

Question (this question was presented to the user in {{#if language}}{{language}}{{else}}English{{/if}}): {{{question}}}
User's Answer: {{{userAnswer}}}

Please provide your response in {{#if language}}{{language}}{{else}}English{{/if}}.
1.  \`awardedScore\`: An integer score from 0 to 5 based on the correctness and completeness of the user's answer relative to the question, topic, education level{{#if pdfDataUri}}, and provided document context{{/if}}.
    *   **Adapt your scoring strictness to the student's \`educationLevel\`.**
        *   For lower levels (e.g., Preschool, ElementarySchool, MiddleSchool), be more lenient. Focus on whether the core concept is grasped, even if the answer is simple or uses basic language. A partially correct or very simple but relevant answer might still earn a 2 or 3.
        *   For higher levels (e.g., College, Graduate, PhD), be stricter. Expect more depth, precision, use of specific terminology, and comprehensive understanding. Minor inaccuracies or lack of detail will result in a lower score compared to the same answer at a lower education level.
    *   General Scoring Guide (apply with education level in mind):
        *   0: Completely incorrect, irrelevant, or nonsensical.
        *   1: Shows minimal understanding, perhaps a relevant keyword but fundamentally flawed or very incomplete.
        *   2: Basic understanding, some correct points but significant inaccuracies or omissions for the level.
        *   3: Partially correct; understands the main concepts but has some inaccuracies or lacks depth/detail expected for the level.
        *   4: Mostly correct and well-understood; minor inaccuracies or could be slightly more detailed/clearer for the level.
        *   5: Fully correct, comprehensive for the education level, and clearly articulated.
2.  \`explanation\`: A detailed, teacher-like explanation.
    *   Regardless of the score, explain the reasoning behind it in {{#if language}}{{language}}{{else}}English{{/if}}.
    *   If the score is less than 5, clearly explain the misunderstanding, errors, or omissions, keeping the student's \`educationLevel\` in mind. Provide the correct information and explain the reasoning behind it in an age-appropriate manner.
    *   If the score is 5, reinforce why the answer is excellent, perhaps adding a bit more relevant detail or context suitable for the \`educationLevel\`.
    *   The explanation MUST be tailored to the student's specified education level and language ({{#if language}}{{language}}{{else}}English{{/if}}). It should help them understand the concept better. Use analogies or simpler terms if appropriate for the level and language.
    *   IMPORTANT: The explanation should be in **PLAIN TEXT** only. Do NOT use Markdown formatting like \`**bold**\`, \`*italics*\`, or table structures. Use natural language and paragraphs for clear separation of ideas.
3.  \`imageSuggestion\`: If a simple image, diagram, or pictorial representation of the **specific concept being discussed in YOUR explanation** could significantly help the student understand it better, provide a one or two-word search term for such an image. The term should be **highly relevant to the core idea of your explanation for THIS specific question and answer**. Examples: If explaining wave-particle duality for a double-slit experiment, "wave interference" or "photon slit" might be appropriate. If explaining cell mitosis, "mitotic spindle" or "chromosome alignment". If explaining osmosis, "semipermeable membrane" or "solute concentration". **If no image is particularly helpful for clarifying THIS specific explanation, omit this field.** Maximum two words. These terms should be in English or a broadly understandable format for image search.

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
    try {
      const {output} = await evaluateAnswerPrompt(input);
      if (!output || typeof output.awardedScore !== 'number' || !output.explanation) {
          console.error('AI output for evaluateAnswerFlow was invalid or incomplete:', output);
          const langForMessage = input.language || 'English';
          let errorMessageText = `Could not determine the score or provide a detailed explanation in ${langForMessage} at this time. Please ensure your answer is clear.`;
          // Add more languages as needed based on SupportedLanguages enum
          if (langForMessage === 'Spanish') errorMessageText = `No se pudo determinar la puntuación ni proporcionar una explicación detallada en ${langForMessage} en este momento. Por favor, asegúrese de que su respuesta sea clara.`;
          else if (langForMessage === 'French') errorMessageText = `Impossible de déterminer le score ou de fournir une explication détaillée en ${langForMessage} pour le moment. Veuillez vous assurer que votre réponse est claire.`;
          else if (langForMessage === 'German') errorMessageText = `Die Punktzahl konnte nicht ermittelt oder eine detaillierte Erklärung in ${langForMessage} erstellt werden. Bitte stellen Sie sicher, dass Ihre Antwort klar ist.`;
          else if (langForMessage === 'Chinese (Simplified)') errorMessageText = `目前无法确定分数或提供${langForMessage}的详细解释。请确保您的回答清晰。`;
          else if (langForMessage === 'Japanese') errorMessageText = `現時点ではスコアを決定したり、${langForMessage}での詳細な説明を提供したりすることができませんでした。回答が明確であることを確認してください。`;
          else if (langForMessage === 'Korean') errorMessageText = `현재 점수를 결정하거나 ${langForMessage}로 자세한 설명을 제공할 수 없습니다. 답변을 명확히 해주십시오.`;
          else if (langForMessage === 'Arabic') errorMessageText = `تعذر تحديد النتيجة أو تقديم شرح مفصل بـ ${langForMessage} في الوقت الحالي. يرجى التأكد من أن إجابتك واضحة.`;
          else if (langForMessage === 'Hindi') errorMessageText = `अभी स्कोर निर्धारित नहीं किया जा सका या ${langForMessage} में विस्तृत स्पष्टीकरण प्रदान नहीं किया जा सका। कृपया सुनिश्चित करें कि आपका उत्तर स्पष्ट है।`;
          else if (langForMessage === 'Swahili') errorMessageText = `Imeshindwa kubaini alama au kutoa maelezo ya kina kwa ${langForMessage} kwa wakati huu. Tafadhali hakikisha jibu lako liko wazi.`;
          else if (langForMessage === 'Portuguese') errorMessageText = `Não foi possível determinar a pontuação ou fornecer uma explicação detalhada em ${langForMessage} neste momento. Por favor, certifique-se de que sua resposta está clara.`;
          else if (langForMessage === 'Luganda') errorMessageText = `Tetusobodde kufuna buwendo oba kuwa nnyinnyonnyola ya mu ${langForMessage} mu kiseera kino. Fuba okulaba nga eddamu lyo litegeerekeka.`;
          else if (langForMessage === 'Kinyarwanda') errorMessageText = `Ntibishoboye kumenya amanota cyangwa gutanga ibisobanuro birambuye mu ${langForMessage} muri iki gihe. Nyabuneka reba neza ko igisubizo cyawe gisobanutse.`;
          else if (langForMessage === 'Amharic') errorMessageText = `በ${langForMessage} ውጤቱን መወሰን ወይም ዝርዝር ማብራሪያ መስጠት አልተቻለም። እባክዎ መልስዎ ግልጽ መሆኑን ያረጋግጡ።`;


          return { 
              awardedScore: 0, 
              explanation: errorMessageText,
              imageSuggestion: undefined
          };
      }
      return output;
    } catch (error) {
        console.error('evaluateAnswerFlow: Error during AI prompt execution:', error);
        const langForMessage = input.language || 'English';
        let detail = error instanceof Error ? error.message : "An unknown error occurred";
        // Sanitize detail to prevent injecting unwanted HTML or script
        detail = detail.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        let errorMessageText = `An unexpected server error occurred while evaluating your answer for "${input.topic}" in ${langForMessage}. This might be due to a temporary issue with the AI service (e.g., model overloaded), configuration, or a function timeout. Please check server logs if the problem persists. (Details: ${detail})`;
        
        if (langForMessage === 'Spanish') errorMessageText = `Ocurrió un error inesperado en el servidor al evaluar su respuesta para "${input.topic}" en ${langForMessage}. Esto podría deberse a un problema temporal con el servicio de IA, la configuración o un tiempo de espera de la función. Por favor, revise los registros del servidor si el problema persiste. (Detalles: ${detail})`;
        // Add more language-specific error messages as needed
        
        return {
            awardedScore: 0,
            explanation: errorMessageText,
            imageSuggestion: undefined
        };
    }
  }
);


    
