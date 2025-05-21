"use client";

import Image from 'next/image';
import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { knowledgeQuizFlow, type KnowledgeQuizInput, type KnowledgeQuizOutput } from '@/ai/flows/knowledge-quiz-flow';
import { getQuizSummary, type QuizSummaryInput, type QuizSummaryOutput } from '@/ai/flows/quiz-summary-flow';
import { evaluateAnswer, type EvaluateAnswerInput, type EvaluateAnswerOutput } from '@/ai/flows/evaluate-answer-flow';
import { getTopicIntroduction, type GetTopicIntroductionInput, type GetTopicIntroductionOutput } from '@/ai/flows/get-topic-introduction-flow';
import { generateImage, type GenerateImageInput, type GenerateImageOutput } from '@/ai/flows/generate-image-flow';
import { textToSpeech, type TextToSpeechInput, type TextToSpeechOutput } from '@/ai/flows/text-to-speech-flow';
import { EducationLevels, SupportedLanguages, type EducationLevel, type SupportedLanguage } from '@/ai/flows/types';
import ReactMarkdown from 'react-markdown';

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
// Input from "@/components/ui/input" is used in QuizConfigForm
// Select components are used in QuizConfigForm
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Form } from "@/components/ui/form"; // FormField, FormItem etc. are used in subcomponents
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, PlayCircle, BookOpen, AlertTriangle, RefreshCw, Send, Lightbulb, MessageCircle, ArrowRight, Home, Bot, FileText, XCircle, Volume2, CheckCircle2, ThumbsUp, FileQuestion } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { PdfViewerDialog } from "./subcomponents/PdfViewerDialog";
import { QuizConfigForm, type ConfigFormData, configFormSchema } from "./subcomponents/QuizConfigForm";

const readFileAsDataURI = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// answerFormSchema and AnswerFormData are specific to the answer form in this component
const answerFormSchema = z.object({
  answer: z.string().min(1, { message: "Please provide an answer to continue." }).max(500, {message: "Answer is too long."}),
});
type AnswerFormData = z.infer<typeof answerFormSchema>;

interface HistoryItem {
  question: string;
  answer: string;
  explanation?: string;
  detailedImagePrompt?: string;
  generatedImageDataUri?: string;
  awardedPoints?: number;
  possiblePoints?: number;
}

interface KnowledgeQuizSessionProps {
  onGoToHome?: () => void;
}

const MAX_POINTS_PER_QUESTION = 5;
const REVIEW_SCORE_THRESHOLD = 3; 

export function KnowledgeQuizSession({ onGoToHome }: KnowledgeQuizSessionProps) {
  const [currentStep, setCurrentStep] = useState<'config' | 'introduction' | 'questioning' | 'summary' | 'loading' | 'error'>('config');
  const [topicIntroductionText, setTopicIntroductionText] = useState<string | null>(null);
  const [currentQuestionText, setCurrentQuestionText] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [incorrectlyAnsweredQuestions, setIncorrectlyAnsweredQuestions] = useState<HistoryItem[]>([]);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [currentReviewQuestionIndex, setCurrentReviewQuestionIndex] = useState(0);
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [furtherLearningSuggestions, setFurtherLearningSuggestions] = useState<string[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // These state variables hold the current quiz settings after config submission
  const [topic, setTopic] = useState<string>(""); 
  const [educationLevel, setEducationLevel] = useState<EducationLevel>("HighSchool"); 
  const [language, setLanguage] = useState<SupportedLanguage>("English"); 

  const [pdfFile, setPdfFile] = useState<File | null>(null); // From QuizConfigForm
  const [configPdfDataUri, setConfigPdfDataUri] = useState<string | null>(null); // Derived from pdfFile
  const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(false); // General loading for async operations
  const [isEvaluating, setIsEvaluating] = useState(false); // Specific to answer evaluation
  const [isGeneratingImage, setIsGeneratingImage] = useState(false); // Specific to image generation
  const [currentExplanation, setCurrentExplanation] = useState<string | null>(null);
  const [currentDetailedImagePrompt, setCurrentDetailedImagePrompt] = useState<string | null>(null); 
  const [currentGeneratedImageDataUri, setCurrentGeneratedImageDataUri] = useState<string | null>(null);
  const [showExplanationSection, setShowExplanationSection] = useState(false);
  const [currentAwardedPoints, setCurrentAwardedPoints] = useState<number | null>(null);

  const [currentUserScore, setCurrentUserScore] = useState(0);
  const [currentTotalPossibleScore, setCurrentTotalPossibleScore] = useState(0);

  const [currentAudioUri, setCurrentAudioUri] = useState<string | null>(null);
  const [isFetchingAudio, setIsFetchingAudio] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);

  const { toast } = useToast();

  // Form instance for quiz configuration (passed to QuizConfigForm)
  const configForm = useForm<ConfigFormData>({
    resolver: zodResolver(configFormSchema), // Imported schema
    defaultValues: {
      topic: "",
      educationLevel: "HighSchool",
      language: "English",
      // pdfFile is handled by QuizConfigForm's local state, not react-hook-form
    },
  });

  // Form instance for answers
  const answerForm = useForm<AnswerFormData>({
    resolver: zodResolver(answerFormSchema), // Local schema
    defaultValues: {
      answer: "",
    },
  });

  const handleConfigSubmit: SubmitHandler<ConfigFormData> = async (data) => {
    console.log("KnowledgeQuizSession: handleConfigSubmit called with data:", data, "PDF File:", pdfFile);
    setIsLoading(true);
    setCurrentStep('loading');
    setErrorMessage(null);
    setTopicIntroductionText(null); 
    setCurrentAudioUri(null); 
    setHistory([]); // Reset history for new quiz
    setIncorrectlyAnsweredQuestions([]);
    setIsReviewMode(false);
    setCurrentReviewQuestionIndex(0);
    setCurrentUserScore(0);
    setCurrentTotalPossibleScore(0);

    let pdfDataUriToUse: string | null = null;

    if (pdfFile) { // pdfFile state is managed here, set by QuizConfigForm
      setErrorMessage("Processing PDF..."); 
      try {
        pdfDataUriToUse = await readFileAsDataURI(pdfFile);
        setConfigPdfDataUri(pdfDataUriToUse); // Store for use in flows
        console.log("KnowledgeQuizSession: PDF processed.");
        setErrorMessage(null); 
      } catch (error) {
        console.error("KnowledgeQuizSession: Error processing PDF:", error);
        const errorMsg = error instanceof Error ? error.message : "Unknown PDF processing error";
        setErrorMessage(`Failed to process PDF: ${errorMsg}. Please try again or proceed without it.`);
        toast({ title: "PDF Processing Error", description: `Could not read PDF: ${errorMsg}`, variant: "destructive" });
        setIsLoading(false);
        setCurrentStep('config'); 
        return;
      }
    } else {
      setConfigPdfDataUri(null); 
    }

    // Set the main state for topic, educationLevel, language from the form data
    setTopic(data.topic);
    setEducationLevel(data.educationLevel);
    setLanguage(data.language);

    await fetchTopicIntroduction(data.topic, data.educationLevel, data.language, pdfDataUriToUse);
  };

  const handleProceedToQuestions = async () => {
    console.log("KnowledgeQuizSession: handleProceedToQuestions called.");
    // Uses topic, educationLevel, language, and configPdfDataUri from state
    await fetchInitialQuestion(topic, educationLevel, language, configPdfDataUri);
  };

  useEffect(() => {
    if (!currentAudioUri || !audioPlayerRef.current) {
      return;
    }
    try {
      console.log("KnowledgeQuizSession: Attempting to play audio:", currentAudioUri.substring(0,50));
      audioPlayerRef.current.src = currentAudioUri;
      audioPlayerRef.current.load(); // Important for some browsers
      // Short delay to ensure src is set and loaded before play command
      setTimeout(() => {
        audioPlayerRef.current?.play().catch(e => {
          console.error("KnowledgeQuizSession: Error playing audio:", e);
          toast({ 
            title: "Audio Playback Error", 
            description: "Failed to play the generated audio. Please check your audio settings.", 
            variant: "destructive", 
            duration: 2000 
          });
        });
      }, 100); 
    } catch (error) {
      console.error("KnowledgeQuizSession: Error in audio playback effect:", error);
    }
  }, [currentAudioUri]); // audioPlayerRef is stable

  const getVoiceIdForLanguage = (langParam: SupportedLanguage): string | undefined => {
    const voiceIds: Record<SupportedLanguage, string> = {
      'English': 'pNInz6obpgDQGcFmaJgB', // Adam - strong male voice
      'Spanish': 'EXAVITQu4vr4xnSDxMaL', 
      'French': 'MF3mGyEYCl7XYWbV9V6O', 
      'German': 'AZnzlk1XvdvUeBnXmlld', 
      // Assuming other languages default to a general voice if not specified
      'Chinese (Simplified)': '21m00Tcm4TlvDq8ikWAM', 
      'Japanese': '21m00Tcm4TlvDq8ikWAM', 
      'Korean': '21m00Tcm4TlvDq8ikWAM', 
      'Arabic': '21m00Tcm4TlvDq8ikWAM', 
      'Hindi': '21m00Tcm4TlvDq8ikWAM', 
      'Swahili': '21m00Tcm4TlvDq8ikWAM', 
      'Portuguese': '21m00Tcm4TlvDq8ikWAM', 
    };
    return voiceIds[langParam];
  };

  const fetchAndPlayNarration = async (textToNarrate: string, langOverride?: SupportedLanguage) => {
    const effectiveLanguage = langOverride || language || "English";
    console.log("KnowledgeQuizSession: fetchAndPlayNarration. Text (start):", textToNarrate?.substring(0, 50), "Lang:", effectiveLanguage);
    if (!textToNarrate || textToNarrate.trim() === "") {
      console.warn("KnowledgeQuizSession: Empty text for narration. Skipping.");
      setCurrentAudioUri(null); 
      setIsFetchingAudio(false); 
      return;
    }
    
    setIsFetchingAudio(true);
    setCurrentAudioUri(null); 
    try {
      const voiceId = getVoiceIdForLanguage(effectiveLanguage);
      if (!voiceId) {
        console.warn(`No voice ID for language: ${effectiveLanguage}. Using default.`);
      }
      const ttsInput: TextToSpeechInput = {
        text: textToNarrate,
        voiceId: voiceId || '21m00Tcm4TlvDq8ikWAM' // Fallback voice
      };
      const { audioDataUri } = await textToSpeech(ttsInput);
      if (!audioDataUri) {
        console.warn("KnowledgeQuizSession: TTS returned no audioDataUri.");
        if (!process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY) { // Only check the public env var
          toast({ 
            title: "TTS Service Not Configured", 
            description: "The text-to-speech service API key is missing.", 
            variant: "destructive", 
            duration: 5000 
          });
        } else {
          toast({ title: "Narration Error", description: "Could not generate audio.", variant: "default", duration: 3000 });
        }
        setCurrentAudioUri(null);
        return; // Explicitly return if no audio URI
      }
      setCurrentAudioUri(audioDataUri); // This will trigger the useEffect for playback
    } catch (error) {
      console.error("KnowledgeQuizSession: Error fetching or playing narration:", error);
      toast({ 
        title: "Narration Error", 
        description: `Could not play audio in ${effectiveLanguage}. ${error instanceof Error ? error.message : 'Unknown error'}`, 
        variant: "destructive", 
        duration: 3000 
      });
      setCurrentAudioUri(null);
    } finally {
      setIsFetchingAudio(false);
    }
  };

  const fetchTopicIntroduction = async (currentTopicParam: string, currentEducationLevelParam: EducationLevel, currentLanguageParam: SupportedLanguage, currentPdfDataUriParam: string | null) => {
    console.log("KnowledgeQuizSession: Fetching topic intro:", { currentTopicParam, currentEducationLevelParam, currentLanguageParam, pdfPresent: !!currentPdfDataUriParam });
    setIsLoading(true);
    setCurrentStep('loading');
    setErrorMessage(null);
    try {
      const input: GetTopicIntroductionInput = {
        topic: currentTopicParam,
        educationLevel: currentEducationLevelParam,
        language: currentLanguageParam,
        pdfDataUri: currentPdfDataUriParam,
      };
      const output: GetTopicIntroductionOutput = await getTopicIntroduction(input);
      if (output.introductionText && !output.introductionText.toLowerCase().includes("unexpected server error") && !output.introductionText.toLowerCase().includes("model not found") && !output.introductionText.toLowerCase().includes("could not generate")) {
        setTopicIntroductionText(output.introductionText);
        fetchAndPlayNarration(output.introductionText, currentLanguageParam);
        setCurrentStep('introduction');
        toast({ title: "Topic Introduction Ready!", description: "Read the introduction, then start the quiz.", variant: "default" });
        if (currentPdfDataUriParam) { 
          // setIsPdfViewerOpen(true); // Optionally auto-open PDF viewer
        }
      } else {
        let displayError = output.introductionText || `Error generating introduction for "${currentTopicParam}" in ${currentLanguageParam}.`;
        if (output.introductionText && output.introductionText.includes("Details: ")) { 
            displayError = `Introduction Error: ${output.introductionText.substring(output.introductionText.indexOf("Details: "))}`;
        } else if (output.introductionText && output.introductionText.includes("could not generate")) {
             displayError = output.introductionText; 
        }
        setErrorMessage(displayError + " Check server logs or try again.");
        setCurrentStep('error');
        toast({ title: "Introduction Error", description: displayError, variant: "destructive" });
      }
    } catch (error) {
      console.error("KnowledgeQuizSession: Error fetching topic introduction:", error);
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      setErrorMessage(`Sorry, couldn't get topic introduction: ${errorMsg}. Try again or check logs.`);
      setCurrentStep('error');
      toast({ title: "Introduction Error", description: `Error: ${errorMsg}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInitialQuestion = async (currentTopicParam: string, currentEducationLevelParam: EducationLevel, currentLanguageParam: SupportedLanguage, currentPdfDataUriParam: string | null) => {
    console.log("KnowledgeQuizSession: Fetching initial question:", { currentTopicParam, currentEducationLevelParam, currentLanguageParam, pdfPresent: !!currentPdfDataUriParam });
    setIsLoading(true);
    setCurrentStep('loading');
    setErrorMessage(null); 
    setShowExplanationSection(false);
    setCurrentExplanation(null);
    setCurrentDetailedImagePrompt(null);
    setCurrentGeneratedImageDataUri(null);
    setCurrentAwardedPoints(null);
    setCurrentAudioUri(null);
    try {
      const input: KnowledgeQuizInput = { 
        previousAnswers: [], 
        topic: currentTopicParam, 
        educationLevel: currentEducationLevelParam, 
        language: currentLanguageParam,
        pdfDataUri: currentPdfDataUriParam 
      };
      const output: KnowledgeQuizOutput = await knowledgeQuizFlow(input);
      if (output.nextQuestion && output.nextQuestion.trim() !== "") {
        setCurrentQuestionText(output.nextQuestion);
        fetchAndPlayNarration(output.nextQuestion, currentLanguageParam);
        setCurrentStep('questioning');
      } else {
        // If no first question, go to summary or error
        setErrorMessage(`Could not generate first question for "${currentTopicParam}".`);
        await handleQuizEnd(currentTopicParam, currentEducationLevelParam, currentLanguageParam, [], currentPdfDataUriParam);
      }
    } catch (error) {
      console.error("KnowledgeQuizSession: Error fetching initial question:", error);
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      setErrorMessage(`Sorry, couldn't start quiz: ${errorMsg}. Try again or check logs.`);
      setCurrentStep('error');
      toast({ title: "Quiz Start Error", description: `Error: ${errorMsg}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchNextQuestion = async (currentTopicParam: string, currentEducationLevelParam: EducationLevel, currentLanguageParam: SupportedLanguage, currentHistoryParam: HistoryItem[], currentPdfDataUriParam: string | null) => {
    console.log("KnowledgeQuizSession: Fetching next question. History length:", currentHistoryParam.length);
    setIsLoading(true);
    setCurrentStep('loading'); // Or keep questioning and show inline loader?
    setErrorMessage(null);
    // Reset for next question - explanation section is hidden by handleProceedToNextQuestion
    try {
      const input: KnowledgeQuizInput = { 
        previousAnswers: currentHistoryParam.map(item => ({ question: item.question, answer: item.answer })), 
        topic: currentTopicParam, 
        educationLevel: currentEducationLevelParam, 
        language: currentLanguageParam,
        pdfDataUri: currentPdfDataUriParam 
      };
      const output: KnowledgeQuizOutput = await knowledgeQuizFlow(input);
      if (output.nextQuestion && output.nextQuestion.trim() !== "") {
        setCurrentQuestionText(output.nextQuestion);
        fetchAndPlayNarration(output.nextQuestion, currentLanguageParam);
        setCurrentStep('questioning');
      } else {
        // No more questions, proceed to summary
        console.log("KnowledgeQuizSession: No next question from flow, proceeding to summary.");
        await handleQuizEnd(currentTopicParam, currentEducationLevelParam, currentLanguageParam, currentHistoryParam, currentPdfDataUriParam);
      }
    } catch (error) {
      console.error("KnowledgeQuizSession: Error fetching next question:", error);
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      setErrorMessage(`Sorry, couldn't get next question: ${errorMsg}. Try again or check logs.`);
      setCurrentStep('error');
      toast({ title: "Question Error", description: `Error: ${errorMsg}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleQuizEnd = async (currentTopicParam: string, currentEducationLevelParam: EducationLevel, currentLanguageParam: SupportedLanguage, finalHistory: HistoryItem[], currentPdfDataUriParam: string | null) => {
    console.log("KnowledgeQuizSession: handleQuizEnd called. History items:", finalHistory.length);
    setIsLoading(true); // Indicate loading for summary generation
    setCurrentStep('loading');
    setErrorMessage(null);
    try {
        const summaryInput: QuizSummaryInput = {
            topic: currentTopicParam,
            educationLevel: currentEducationLevelParam,
            language: currentLanguageParam,
            responses: Object.fromEntries(finalHistory.map(item => [item.question, item.answer])),
            conversationHistory: finalHistory, // Pass full history for context
            pdfDataUri: currentPdfDataUriParam
        };
        const summaryOutput: QuizSummaryOutput = await getQuizSummary(summaryInput);
        if (summaryOutput.summary && summaryOutput.summary.trim() !== "") {
            setSummaryText(summaryOutput.summary);
            setFurtherLearningSuggestions(summaryOutput.furtherLearningSuggestions || null);
            // Update final scores based on the history passed to summary
            setCurrentUserScore(finalHistory.reduce((acc, curr) => acc + (curr.awardedPoints || 0), 0));
            setCurrentTotalPossibleScore(finalHistory.length * MAX_POINTS_PER_QUESTION);
            fetchAndPlayNarration(summaryOutput.summary, currentLanguageParam);
            setCurrentStep('summary');
            toast({ title: "Quiz Complete!", description: "Here is your summary.", variant: "default" });
        } else {
            setErrorMessage(`Could not generate a summary for "${currentTopicParam}".` + (finalHistory.length === 0 ? " No questions were answered." : " An issue occurred."));
            setCurrentStep('error'); // Fallback to error if summary is empty
            toast({ title: "Summary Error", description: "Failed to generate quiz summary.", variant: "destructive" });
        }
    } catch (summaryError) {
        console.error("KnowledgeQuizSession: Error fetching summary:", summaryError);
        setErrorMessage(`Failed to get quiz summary: ${summaryError instanceof Error ? summaryError.message : 'Unknown error'}`);
        setCurrentStep('error');
        toast({ title: "Summary Error", description: "An error occurred while generating the summary.", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  };

  const handleAnswerSubmit = async (data: AnswerFormData) => {
    console.log("KnowledgeQuizSession: handleAnswerSubmit called with data:", data.answer.substring(0,50));
    setIsEvaluating(true);
    // Don't hide explanation section immediately, show evaluation inline or update it
    setCurrentAudioUri(null); // Stop any current audio (e.g. question narration)

    const currentConfigValues = configForm.getValues(); // Get latest config

    try {
      const evalInput: EvaluateAnswerInput = {
        userAnswer: data.answer,
        question: currentQuestionText || "", // Ensure currentQuestionText is not null
        topic: currentConfigValues.topic || topic, // Fallback to state if form not fully updated
        educationLevel: currentConfigValues.educationLevel || educationLevel,
        language: currentConfigValues.language || language,
        pdfDataUri: configPdfDataUri
      };
      const output: EvaluateAnswerOutput = await evaluateAnswer(evalInput);
      
      setCurrentExplanation(output.explanation);
      setCurrentDetailedImagePrompt(output.detailedImagePrompt || null);
      setCurrentAwardedPoints(output.awardedScore);
      setShowExplanationSection(true); // Now show the explanation section

      let finalGeneratedImageDataUri = output.generatedImageDataUri || null;

      if (output.detailedImagePrompt && (!output.generatedImageDataUri || output.generatedImageDataUri.trim() === "")) {
        setIsGeneratingImage(true);
        setCurrentGeneratedImageDataUri(null); 
        try {
            const imageInput: GenerateImageInput = { detailedImageDescription: output.detailedImagePrompt || "" };
            const imageOutput: GenerateImageOutput = await generateImage(imageInput);
            if (imageOutput.imageDataUri) {
                setCurrentGeneratedImageDataUri(imageOutput.imageDataUri);
                finalGeneratedImageDataUri = imageOutput.imageDataUri; // Update for history
            } else {
                toast({ title: "Image Generation Issue", description: "Could not generate visual aid.", variant: "default" });
            }
        } catch (imgError) {
            console.error("KnowledgeQuizSession: Error generating image:", imgError);
            toast({ title: "Image Generation Error", description: "Failed to generate image.", variant: "destructive" });
        } finally {
            setIsGeneratingImage(false);
        }
      } else if (output.generatedImageDataUri) {
         setCurrentGeneratedImageDataUri(output.generatedImageDataUri);
      } else {
        setCurrentGeneratedImageDataUri(null);
      }
      
      if (output.explanation) { // Only narrate if explanation exists
        fetchAndPlayNarration(output.explanation, currentConfigValues.language || language);
      }

      const newHistoryItem: HistoryItem = {
        question: currentQuestionText || "",
        answer: data.answer,
        explanation: output.explanation,
        detailedImagePrompt: output.detailedImagePrompt,
        generatedImageDataUri: finalGeneratedImageDataUri || undefined, 
        awardedPoints: output.awardedScore,
        possiblePoints: MAX_POINTS_PER_QUESTION
      };
      
      setHistory(prev => [...prev, newHistoryItem]);

      if (output.awardedScore !== undefined && output.awardedScore !== null) {
        // Scores are updated based on the newHistoryItem added above
        setCurrentUserScore(prevScore => prevScore + (output.awardedScore || 0));
        setCurrentTotalPossibleScore(prevTotal => prevTotal + MAX_POINTS_PER_QUESTION);

        if (output.awardedScore < REVIEW_SCORE_THRESHOLD) {
            setIncorrectlyAnsweredQuestions(prevIncorrect => [...prevIncorrect, newHistoryItem]);
        }
      }
      // NOTE: Do not fetch next question immediately. User clicks "Next Question" button after reviewing explanation.
    } catch (error) {
      console.error("Error in handleAnswerSubmit:", error);
      const errorMsg = error instanceof Error ? error.message : "Unknown error.";
      setErrorMessage(`Error processing answer: ${errorMsg}. Try again.`);
      setCurrentStep('questioning'); // Stay on question, show error locally
      setShowExplanationSection(false); // Hide potentially incomplete explanation
      toast({ title: "Answer Processing Error", description: `Error: ${errorMsg}`, variant: "destructive" });
    } finally {
      setIsEvaluating(false); 
      // Do not reset answerForm here, user might want to see their answer along with the explanation
    }
  };

  const handleProceedToNextQuestion = async () => {
    console.log("KnowledgeQuizSession: handleProceedToNextQuestion. Review Mode:", isReviewMode);
    setShowExplanationSection(false); // Hide current explanation
    setCurrentExplanation(null);
    setCurrentDetailedImagePrompt(null);
    setCurrentGeneratedImageDataUri(null);
    setCurrentAwardedPoints(null);
    setCurrentAudioUri(null); // Stop any current audio
    answerForm.reset(); // Reset for next question/answer

    const formConfValues = configForm.getValues(); // Use latest form config for language etc.

    if (isReviewMode) {
      const nextReviewIdx = currentReviewQuestionIndex + 1;
      if (nextReviewIdx < incorrectlyAnsweredQuestions.length) {
        setCurrentReviewQuestionIndex(nextReviewIdx);
        const nextReviewQItem = incorrectlyAnsweredQuestions[nextReviewIdx];
        setCurrentQuestionText(nextReviewQItem.question);
        fetchAndPlayNarration(nextReviewQItem.question, formConfValues.language || language);
        setCurrentStep('questioning'); // Stay in questioning for review
      } else {
        // Finished review mode
        setIsReviewMode(false);
        toast({ title: "Review Complete!", description: "All reviewed. Let's see the summary.", variant: "default" });
        await handleQuizEnd(formConfValues.topic || topic, formConfValues.educationLevel || educationLevel, formConfValues.language || language, history, configPdfDataUri);
      }
    } else {
      // Not in review mode, fetch the next regular question using main state topic, eduLevel, lang
      await fetchNextQuestion(topic, educationLevel, language, history, configPdfDataUri);
    }
  };

  const handleStartReview = () => {
    const questionsToReviewNow = history.filter(item => typeof item.awardedPoints === 'number' && item.awardedPoints < REVIEW_SCORE_THRESHOLD && !incorrectlyAnsweredQuestions.find(reviewedItem => reviewedItem.question === item.question));
    
    if (questionsToReviewNow.length > 0) {
        setIncorrectlyAnsweredQuestions(prev => [...prev, ...questionsToReviewNow].filter((v,i,a)=>a.findIndex(t=>(t.question === v.question))===i)); // Add new, ensure unique
        setIsReviewMode(true);
        setCurrentReviewQuestionIndex(0); // Start review from the first of this new batch
        const firstReviewQuestionItem = questionsToReviewNow[0];
        setCurrentQuestionText(firstReviewQuestionItem.question);
        
        const formConfValues = configForm.getValues();
        fetchAndPlayNarration(firstReviewQuestionItem.question, formConfValues.language || language);
        
        answerForm.reset(); 
        setCurrentExplanation(null); 
        setCurrentDetailedImagePrompt(null); 
        setCurrentGeneratedImageDataUri(null);
        setShowExplanationSection(false); 
        setCurrentAwardedPoints(null);
        setCurrentAudioUri(null);
        setCurrentStep('questioning');
        setErrorMessage(null);
        toast({title: "Review Mode Started", description: "Let's review some questions.", variant: "default"});
    } else {
        toast({title: "No New Answers to Review", description: "You've reviewed all applicable items or performed well!", variant: "default"});
        // If no new items, and currently in summary, stay there.
        // If triggered from questioning and no items, consider going to summary if appropriate.
        if (currentStep !== 'summary') {
             const formConfValues = configForm.getValues();
             handleQuizEnd(formConfValues.topic || topic, formConfValues.educationLevel || educationLevel, formConfValues.language || language, history, configPdfDataUri);
        }
    }
  };

  const handleRestartQuiz = () => {
    if (onGoToHome) {
      onGoToHome(); // Callback to navigate away
    } else {
      // Reset all state for a new quiz session in the same component instance
      setCurrentStep('config');
      setTopicIntroductionText(null);
      setCurrentQuestionText(null);
      setHistory([]);
      setIncorrectlyAnsweredQuestions([]);
      setIsReviewMode(false);
      setCurrentReviewQuestionIndex(0);
      setSummaryText(null);
      setFurtherLearningSuggestions(null);
      setErrorMessage(null);
      
      setTopic(""); 
      setEducationLevel("HighSchool"); 
      setLanguage("English"); 

      setPdfFile(null); // Clear the file object
      setConfigPdfDataUri(null);
      setIsPdfViewerOpen(false);
      // Attempt to reset the actual file input field in the DOM (if it's part of QuizConfigForm, this might need to be handled there)
      const fileInput = document.getElementById('pdf-upload') as HTMLInputElement | null; // Ensure ID matches QuizConfigForm
      if (fileInput) fileInput.value = "";

      setIsLoading(false);
      setIsEvaluating(false);
      setIsGeneratingImage(false);
      setCurrentExplanation(null);
      setCurrentDetailedImagePrompt(null);
      setCurrentGeneratedImageDataUri(null);
      setShowExplanationSection(false);
      setCurrentAwardedPoints(null);
      setCurrentUserScore(0);
      setCurrentTotalPossibleScore(0);
      setCurrentAudioUri(null);

      configForm.reset({ topic: "", educationLevel: "HighSchool", language: "English" }); 
      answerForm.reset({ answer: "" });
      toast({title: "Quiz Reset", description: "Configure your new quiz."})
    }
  };
  
  const handleClearPdf = () => { // This function is passed to QuizConfigForm
    setPdfFile(null);
    setConfigPdfDataUri(null); 
    // If QuizConfigForm has its own internal display of the PDF name, that needs reset too.
    // This function primarily clears the state in KnowledgeQuizSession.
    toast({ title: "PDF Cleared", description: "The selected PDF has been removed for this session.", variant: "default" });
  };

  const getLoadingMessage = () => {
    if (isEvaluating && !showExplanationSection) return "Evaluating your answer...";
    if (isGeneratingImage && showExplanationSection) return "Generating image for explanation...";
    if (isFetchingAudio && currentStep !== 'questioning') return "Preparing audio narration...";
    
    if (currentStep === 'loading') { // More generic loading messages based on what's happening
        if (isLoading && topicIntroductionText === null && currentQuestionText === null && history.length === 0 && !isReviewMode) return "Preparing topic introduction...";
        if (isLoading && topicIntroductionText !== null && currentQuestionText === null && history.length === 0 && !isReviewMode) return "Preparing your first question...";
        if (isLoading && currentQuestionText && !summaryText && !isReviewMode) return "Getting next question...";
        if (isLoading && isReviewMode && !summaryText) return "Preparing review question...";
        if (isLoading && summaryText === null && history.length > 0 && !isReviewMode) return "Generating your quiz summary...";
    }
    if (isLoading) return "Loading, please wait..."; // General fallback if isLoading is true
    return "Loading..."; // Default
  };

  const formValuesForHeader = configForm.watch(); // For displaying config in headers

  // Prioritized Loading State Display (covers full-screen loading scenarios)
  if (isLoading && (currentStep === 'loading' || (currentStep === 'config' && pdfFile && errorMessage?.startsWith("Processing PDF")))) {
    return (
      <Card className="w-full shadow-xl rounded-lg overflow-hidden bg-card">
        <CardContent className="p-6 min-h-[300px] flex flex-col items-center justify-center text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
          <p className="text-lg text-muted-foreground">{getLoadingMessage()}</p>
          {errorMessage && errorMessage.startsWith("Processing PDF...") && (
             <p className="text-sm text-destructive mt-2">{errorMessage}</p>
          )}
        </CardContent>
      </Card>
    );
  }
  
  // Prioritized Error State Display (full-screen error)
  if (currentStep === 'error' && errorMessage) { 
    return (
      <Card className="w-full shadow-xl rounded-lg overflow-hidden bg-card">
        <CardHeader className="bg-destructive/10 p-4 border-b border-destructive/30">
          <CardTitle className="text-xl text-destructive flex items-center gap-2"><AlertTriangle /> Error Occurred</CardTitle>
        </CardHeader>
        <CardContent className="p-6 min-h-[200px] flex flex-col items-center justify-center">
          <Alert variant="destructive" className="w-full max-w-md text-center">
            <AlertTriangle className="h-5 w-5" />
            <AlertTitle>An Error Occurred</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="p-4 border-t bg-muted/20 flex justify-center">
             <Button onClick={handleRestartQuiz} variant="outline" className="w-full sm:w-auto shadow-sm">
              {onGoToHome ? <Home className="mr-2 h-4 w-4" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {onGoToHome ? 'Return Home' : 'Try Again / Restart'}
            </Button>
        </CardFooter>
      </Card>
    );
  }

  // Main render logic based on currentStep
  return (
    <>
      <PdfViewerDialog 
        isOpen={isPdfViewerOpen}
        onOpenChange={setIsPdfViewerOpen}
        pdfDataUri={configPdfDataUri}
        pdfFileName={pdfFile?.name} // Pass the name of the file object
      />
      <audio ref={audioPlayerRef} className="hidden" />

      <Card className="w-full max-w-3xl mx-auto shadow-xl rounded-lg overflow-hidden bg-card">
        {currentStep === 'config' && (
          <QuizConfigForm
            configForm={configForm}
            handleConfigSubmit={handleConfigSubmit}
            isLoading={isLoading}
            isEvaluating={isEvaluating}
            isGeneratingImage={isGeneratingImage}
            isFetchingAudio={isFetchingAudio}
            pdfFile={pdfFile}
            setPdfFile={setPdfFile}
            handleClearPdf={handleClearPdf}
            onGoToHome={onGoToHome}
          />
        )}

        {currentStep === 'introduction' && topicIntroductionText && (
          <>
            <CardHeader className="bg-muted/30 p-3 sm:p-4 border-b">
              <div className="flex justify-between items-center gap-2">
                  <div>
                      <CardTitle className="text-xl sm:text-2xl text-primary flex items-center gap-1.5">
                          <BookOpen className="w-6 h-6"/> 
                          <span>Topic Introduction: <span className="font-semibold">{formValuesForHeader.topic || topic}</span></span>
                          {configPdfDataUri && <FileText className="inline h-5 w-5 ml-1.5 align-middle text-muted-foreground flex-shrink-0" aria-label="PDF Context Active"/>}
                      </CardTitle>
                      <CardDescription className="text-xs sm:text-sm mt-1">
                          Level: {(formValuesForHeader.educationLevel || educationLevel).replace(/([A-Z])/g, ' $1').trim()} | Language: {formValuesForHeader.language || language}
                      </CardDescription>
                  </div>
                  <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
                    {configPdfDataUri && (
                        <Button variant="outline" size="sm" className="ml-auto" onClick={() => setIsPdfViewerOpen(true)} title="View linked PDF">
                            <FileText className="mr-1.5 h-4 w-4" /> View PDF
                        </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => topicIntroductionText && fetchAndPlayNarration(topicIntroductionText, formValuesForHeader.language || language)} disabled={isFetchingAudio} aria-label="Read introduction aloud" title="Read introduction aloud">
                        <Volume2 className={`h-5 w-5 sm:h-6 sm:w-6 ${isFetchingAudio ? 'text-muted-foreground animate-pulse' : 'text-primary'}`} />
                    </Button>
                  </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-4">
              <ScrollArea className="h-72 w-full rounded-md border p-3 shadow-inner bg-background/30">
                  <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap prose-p:my-2 p-1 text-sm sm:text-base">
                      <ReactMarkdown>{topicIntroductionText}</ReactMarkdown>
                  </div>
              </ScrollArea>
            </CardContent>
            <CardFooter className="p-3 sm:p-4 border-t bg-muted/30 flex flex-col sm:flex-row gap-2 sm:justify-between">
              <Button onClick={handleProceedToQuestions} size="lg" className="w-full sm:w-auto shadow-md order-1 sm:order-2" disabled={isLoading || isFetchingAudio}>
                {isLoading || isFetchingAudio ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <PlayCircle className="mr-2 h-5 w-5" />}
                Start Quiz
              </Button>
              <Button variant="outline" size="sm" onClick={handleRestartQuiz} className="w-full sm:w-auto shadow-sm order-2 sm:order-1">
                  <RefreshCw className="mr-2 h-4 w-4" /> Change Settings
              </Button>
            </CardFooter>
          </>
        )}


        {currentStep === 'questioning' && currentQuestionText && (
          <>
            <CardHeader className="bg-muted/30 p-3 sm:p-4 border-b">
              <div className="flex justify-between items-center gap-2">
                  <div>
                      <CardTitle className="text-xl sm:text-2xl text-primary flex items-center gap-1.5">
                          <FileQuestion className="w-6 h-6"/>
                          <span>
                            {isReviewMode ? "Reviewing: " : ""}
                            <span className="font-semibold">{formValuesForHeader.topic || topic}</span>
                          </span>
                          {configPdfDataUri && <FileText className="inline h-5 w-5 ml-1.5 align-middle text-muted-foreground flex-shrink-0" aria-label="PDF Context Active"/>}
                      </CardTitle>
                      <CardDescription className="text-xs sm:text-sm mt-1">
                          Level: {(formValuesForHeader.educationLevel || educationLevel).replace(/([A-Z])/g, ' $1').trim()} | Language: {formValuesForHeader.language || language} |
                          {isReviewMode ? ` Review ${currentReviewQuestionIndex + 1} of ${incorrectlyAnsweredQuestions.length}` : ` Question ${history.length + (showExplanationSection ? 0 : 1)}`}
                      </CardDescription>
                  </div>
                  <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
                    {configPdfDataUri && (
                        <Button variant="outline" size="sm" className="ml-auto" onClick={() => setIsPdfViewerOpen(true)} title="View linked PDF">
                            <FileText className="mr-1.5 h-4 w-4" /> View PDF
                        </Button>
                    )}
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => !showExplanationSection && currentQuestionText && fetchAndPlayNarration(currentQuestionText, formValuesForHeader.language || language)} 
                        disabled={isFetchingAudio || showExplanationSection} 
                        aria-label="Read question aloud"
                        title="Read question aloud"
                    >
                        <Volume2 className={`h-5 w-5 sm:h-6 sm:w-6 ${isFetchingAudio || showExplanationSection ? 'text-muted-foreground animate-pulse' : 'text-primary'}`} />
                    </Button>
                  </div>
              </div>
            </CardHeader>

            {history.length > 0 && !showExplanationSection && !isReviewMode && (
               <CardContent className="p-2 sm:p-3 max-h-60 overflow-y-auto bg-card z-10 sticky top-0 shadow-sm border-b">
                <h3 className="text-base sm:text-lg font-semibold text-muted-foreground mb-1.5 sticky top-0 bg-card z-10 py-1">Previous Answers:</h3>
                <div className="space-y-1.5 pt-1">
                  {history.map((item, index) => (
                    <div key={`hist-${index}-${item.question?.substring(0,10)}`} className="text-sm p-2 rounded-md bg-background/50 border border-border/70 shadow-sm">
                      <div className="flex items-start space-x-1.5">
                        <MessageCircle className="w-4 h-4 text-primary shrink-0 mt-0.5"/>
                        <div className="flex-1">
                          <span className="font-medium text-card-foreground whitespace-pre-wrap">{item.question}</span>
                          {typeof item.awardedPoints === 'number' && (
                              <span className={`ml-1.5 text-xs font-semibold ${item.awardedPoints >= REVIEW_SCORE_THRESHOLD ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                                  ({item.awardedPoints}/{item.possiblePoints})
                              </span>
                          )}
                        </div>
                      </div>
                      <p className="mt-1 text-muted-foreground pl-[calc(1rem+0.375rem)] whitespace-pre-wrap prose prose-sm dark:prose-invert prose-p:my-1">
                        <span className="font-semibold">Your Answer: </span>{item.answer}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}

            <CardContent className="p-3 sm:p-4">
              <Form {...answerForm}>
                <form onSubmit={answerForm.handleSubmit(handleAnswerSubmit)} className="space-y-3 sm:space-y-4">
                  <div>
                    <label htmlFor="currentAnswerTextarea" className="text-lg sm:text-xl font-medium text-card-foreground mb-2 block whitespace-pre-wrap">
                      {currentQuestionText}
                    </label>
                    <Textarea
                      id="currentAnswerTextarea"
                      placeholder="Type your answer here..."
                      className="min-h-[120px] text-base resize-y shadow-sm focus:ring-2 focus:ring-primary"
                      {...answerForm.register("answer")}
                      aria-label="Your answer"
                      disabled={isLoading || isEvaluating || showExplanationSection || isGeneratingImage || isFetchingAudio}
                    />
                    {answerForm.formState.errors.answer && <p className="text-sm font-medium text-destructive mt-1">{answerForm.formState.errors.answer.message}</p>}
                  </div>

                  {showExplanationSection && (currentExplanation || currentGeneratedImageDataUri || isGeneratingImage || currentAwardedPoints !== null) && (
                    <Alert variant="default" className="bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700/50 shadow-sm rounded-md p-3 sm:p-4 my-2">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-1.5">
                          <Lightbulb className="h-5 w-5 text-green-600 dark:text-green-400" />
                          <AlertTitle className="font-semibold text-lg text-green-700 dark:text-green-300">Explanation</AlertTitle>
                        </div>
                        {currentExplanation && (
                            <Button variant="ghost" size="icon" onClick={() => currentExplanation && fetchAndPlayNarration(currentExplanation, formValuesForHeader.language || language)} disabled={isFetchingAudio} aria-label="Read explanation" title="Read explanation">
                               <Volume2 className={`h-5 w-5 ${isFetchingAudio ? 'text-muted-foreground animate-pulse' : 'text-green-600 dark:text-green-400'}`} />
                            </Button>
                        )}
                      </div>
                      {currentAwardedPoints !== null && (
                          <p className="text-base font-medium text-green-700 dark:text-green-300 mb-2">
                              Score: <span className="font-bold">{currentAwardedPoints}</span>/{MAX_POINTS_PER_QUESTION}
                          </p>
                      )}
                      {isGeneratingImage && !currentGeneratedImageDataUri && (
                        <div className="flex items-center justify-center p-4 my-2 bg-green-100/50 dark:bg-green-800/30 rounded-md">
                          <Loader2 className="h-6 w-6 text-green-600 dark:text-green-400 animate-spin mr-2" />
                          <p className="text-sm text-green-700/90 dark:text-green-400/90">Generating image...</p>
                        </div>
                      )}
                      {currentGeneratedImageDataUri && !isGeneratingImage && (
                        <div className="my-2 aspect-video bg-gray-200 dark:bg-gray-800 rounded overflow-hidden shadow-md border border-green-300 dark:border-green-600/50 relative cursor-pointer" onClick={() => window.open(currentGeneratedImageDataUri, '_blank')}>
                           <Image
                                src={currentGeneratedImageDataUri}
                                alt={currentDetailedImagePrompt || "Visual aid for explanation"}
                                layout="fill"
                                objectFit="contain"
                                className="rounded"
                                unoptimized={currentGeneratedImageDataUri.startsWith('data:image')} 
                                title={currentDetailedImagePrompt || "Click to view full size"}
                            />
                        </div>
                      )}
                      {currentExplanation && (
                        <AlertDescription className="text-green-700/90 dark:text-green-400/90 prose dark:prose-invert max-w-none whitespace-pre-wrap prose-p:my-1.5 text-sm sm:text-base">
                            <ReactMarkdown>{currentExplanation}</ReactMarkdown>
                        </AlertDescription>
                      )}
                      {!currentExplanation && !isGeneratingImage && !currentGeneratedImageDataUri && <p className="text-muted-foreground text-sm">No detailed explanation provided for this answer.</p>}
                    </Alert>
                  )}

                  {showExplanationSection ? (
                    <Button onClick={handleProceedToNextQuestion} className="w-full shadow-md" disabled={isLoading || isGeneratingImage || isFetchingAudio || isEvaluating}>
                      {isLoading || isGeneratingImage || isFetchingAudio || isEvaluating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                      {isReviewMode && currentReviewQuestionIndex >= incorrectlyAnsweredQuestions.length -1 ? "Finish Review & Get Summary" : "Next Question"}
                    </Button>
                  ) : (
                    <Button type="submit" className="w-full shadow-md" disabled={isLoading || isEvaluating || answerForm.formState.isSubmitting || isGeneratingImage || isFetchingAudio || !currentQuestionText}>
                      {(isEvaluating || (isLoading && !isFetchingAudio && !isGeneratingImage) )? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      {isEvaluating ? 'Evaluating...' : (isLoading && !isFetchingAudio && !isGeneratingImage ? 'Loading...' : 'Submit Answer')}
                    </Button>
                  )}
                </form>
              </Form>
            </CardContent>
            <CardFooter className="p-3 sm:p-4 border-t bg-muted/30 flex justify-center">
              <Button variant="ghost" size="sm" onClick={handleRestartQuiz} className="text-muted-foreground hover:text-destructive" disabled={isLoading || isEvaluating || isGeneratingImage || isFetchingAudio}>
                {onGoToHome ? <Home className="mr-1.5 h-4 w-4" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
                {onGoToHome ? 'Return Home' : 'Restart Quiz'}
              </Button>
            </CardFooter>
          </>
        )}

        {currentStep === 'summary' && (
          <>
            <CardHeader className="bg-muted/30 p-4 sm:p-6 border-b text-center">
              <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-3 mb-2">
                  <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-green-500 dark:text-green-400" />
                  <CardTitle className="text-2xl sm:text-3xl">Quiz Summary</CardTitle>
              </div>
              <div className="font-semibold text-xl sm:text-2xl text-primary mt-1">
                  Final Score: {currentUserScore} / {currentTotalPossibleScore}
              </div>
              <div className="flex flex-col sm:flex-row justify-center items-center space-y-1 sm:space-y-0 sm:space-x-2 mt-2 text-xs sm:text-sm">
                  <CardDescription>
                      Topic: <span className="font-semibold">{formValuesForHeader.topic || topic}</span> 
                      {configPdfDataUri && <FileText className="inline h-4 w-4 ml-1 align-middle text-muted-foreground" aria-label="PDF Context Active"/>}
                  </CardDescription>
                  <span className="hidden sm:inline">|</span>
                  <CardDescription>Level: {(formValuesForHeader.educationLevel || educationLevel).replace(/([A-Z])/g, ' $1').trim()}</CardDescription>
                  <span className="hidden sm:inline">|</span>
                  <CardDescription>Language: {formValuesForHeader.language || language}</CardDescription>
                  {configPdfDataUri && (
                      <Button variant="outline" size="sm" className="ml-0 sm:ml-2 px-2 py-1 h-auto text-xs" onClick={() => setIsPdfViewerOpen(true)} title="View linked PDF">
                          <FileText className="mr-1 h-3 w-3" /> PDF
                      </Button>
                  )}
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 space-y-3 sm:space-y-4">
              {history.length > 0 && (
                  <Card className="bg-background/30 shadow-md">
                      <CardHeader className="p-2 sm:p-3">
                          <CardTitle className="text-lg sm:text-xl text-primary flex items-center gap-1.5"><MessageCircle className="w-5 h-5"/>Your Answers & Explanations:</CardTitle>
                      </CardHeader>
                      <CardContent className="max-h-96 p-2 sm:p-3">
                          <ScrollArea className="h-full pr-2">
                              <div className="space-y-2 sm:space-y-3">
                              {history.map((item, index) => (
                              <div key={`summary-hist-${index}-${item.question?.substring(0,10)}`} className="text-sm p-2 sm:p-3 rounded-md bg-muted/20 dark:bg-muted/40 border border-border/50 shadow-inner">
                                  <div className="font-medium text-card-foreground flex items-start gap-1.5">
                                      <span className="text-primary font-semibold">{index+1}.</span>
                                      <span className="flex-1 whitespace-pre-wrap">{item.question}</span>
                                  </div>
                                  <p className="text-xs sm:text-sm text-muted-foreground pl-5 mt-1 whitespace-pre-wrap prose prose-p:my-0.5 dark:prose-invert"><span className="font-semibold">Your Answer: </span>{item.answer}</p>
                                  {typeof item.awardedPoints === 'number' && typeof item.possiblePoints === 'number' && (
                                      <p className="text-xs sm:text-sm font-medium text-primary pl-5 mt-0.5">Score: {item.awardedPoints}/{item.possiblePoints}</p>
                                  )}
                                  {item.explanation && (
                                    <div className="mt-1.5 p-2 rounded bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700/40 text-xs sm:text-sm">
                                      {item.generatedImageDataUri && (
                                        <div className="my-1.5 aspect-video bg-gray-200 dark:bg-gray-700 rounded overflow-hidden relative cursor-pointer" onClick={() => window.open(item.generatedImageDataUri, '_blank')}>
                                          <Image
                                            src={item.generatedImageDataUri}
                                            alt={item.detailedImagePrompt || "Visual aid for explanation"}
                                            layout="fill"
                                            objectFit="contain"
                                            className="rounded"
                                            unoptimized={item.generatedImageDataUri.startsWith('data:image')}
                                            title={item.detailedImagePrompt || "Click to view full size"}
                                          />
                                        </div>
                                      )}
                                      <p className="font-semibold text-green-700 dark:text-green-300">Explanation:</p>
                                      <div className="text-green-700/90 dark:text-green-400/90 prose dark:prose-invert max-w-none whitespace-pre-wrap prose-p:my-1 p-1">
                                          <ReactMarkdown>{item.explanation}</ReactMarkdown>
                                      </div>
                                    </div>
                                  )}
                              </div>
                              ))}
                              </div>
                          </ScrollArea>
                      </CardContent>
                  </Card>
              )}
              {summaryText && (
                  <Card className="bg-background/30 shadow-md">
                  <CardHeader className="p-2 sm:p-3">
                      <CardTitle className="text-lg sm:text-xl text-primary flex items-center gap-1.5"><Lightbulb className="w-5 h-5"/>Main Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="p-2 sm:p-3">
                      <div className="text-card-foreground whitespace-pre-wrap prose dark:prose-invert max-w-none prose-p:my-1.5 text-sm sm:text-base">
                          <ReactMarkdown>{summaryText}</ReactMarkdown>
                      </div>
                  </CardContent>
                  </Card>
              )}
              {furtherLearningSuggestions && furtherLearningSuggestions.length > 0 && (
                  <Card className="bg-background/30 shadow-md">
                      <CardHeader className="p-2 sm:p-3">
                          <CardTitle className="text-lg sm:text-xl text-accent flex items-center gap-1.5"><BookOpen className="w-5 h-5"/></CardTitle>
                      </CardHeader>
                      <CardContent className="p-2 sm:p-3">
                          <ul className="list-disc pl-5 space-y-1 text-card-foreground text-sm sm:text-base">
                          {furtherLearningSuggestions.map((suggestion, index) => (
                              <li key={`learn-${index}`} className="whitespace-pre-wrap">{suggestion}</li>
                          ))}\n                          </ul>
                      </CardContent>
                  </Card>
              )}
              {(!summaryText && (!furtherLearningSuggestions || furtherLearningSuggestions.length === 0)) && history.length > 0 && (
                  <div className="text-muted-foreground text-center p-4 text-sm">No overall summary or learning suggestions were generated for this session.</div>
              )}
              {incorrectlyAnsweredQuestions.length > 0 && !isReviewMode && ( // Only show if there are items that *were* incorrect and we are not currently in review.
                  <Card className="bg-orange-50 dark:bg-orange-900/40 shadow-md border-orange-300 dark:border-orange-600/50">
                      <CardHeader className="p-2 sm:p-3">
                          <CardTitle className="text-lg sm:text-xl text-orange-600 dark:text-orange-400 flex items-center gap-1.5">
                              <RefreshCw className="w-5 h-5"/>Review Your Answers
                          </CardTitle>
                      </CardHeader>
                      <CardContent className="p-2 sm:p-3">
                          <p className="text-card-foreground mb-2 text-sm sm:text-base">You had {incorrectlyAnsweredQuestions.length} answer(s) with a score below {REVIEW_SCORE_THRESHOLD}/{MAX_POINTS_PER_QUESTION}. Would you like to review them?</p>
                          <Button onClick={handleStartReview} className="w-full sm:w-auto shadow-md bg-orange-500 hover:bg-orange-600 text-white">
                              <RefreshCw className="mr-2 h-4 w-4" /> Start Review Session
                          </Button>
                      </CardContent>
                  </Card>
              )}
              {incorrectlyAnsweredQuestions.length === 0 && history.length > 0 && !isReviewMode && (
                  <Alert variant="default" className="bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700/50 shadow-sm rounded-md p-3 sm:p-4">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
                      <AlertTitle className="font-semibold text-lg text-green-700 dark:text-green-300">All Answers Scored Well!</AlertTitle>
                      <AlertDescription className="text-green-700/90 dark:text-green-400/90 text-sm sm:text-base">
                          Congratulations! You scored {REVIEW_SCORE_THRESHOLD} or more on all questions.
                      </AlertDescription>
                  </Alert>
              )}
            </CardContent>
            <CardFooter className="p-3 sm:p-4 border-t bg-muted/30 flex flex-col sm:flex-row gap-2 justify-center">
              <Button onClick={handleRestartQuiz} variant="outline" className="w-full sm:w-auto shadow-md">
                  {onGoToHome ? <Home className="mr-2 h-4 w-4" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  {onGoToHome ? 'Return Home' : 'Start New Quiz'}
              </Button>
            </CardFooter>
          </>
        )}
      </Card>
    </>
  );
} 