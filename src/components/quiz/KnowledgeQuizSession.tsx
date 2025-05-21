
"use client";

import Image from 'next/image';
import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from 'react';
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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, PlayCircle, BookOpen, AlertTriangle, RefreshCw, Send, Lightbulb, MessageCircle, ArrowRight, Home, Bot, FileText, XCircle, Volume2, CheckCircle2, ThumbsUp, FileQuestion } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

const readFileAsDataURI = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const configFormSchema = z.object({
  topic: z.string().min(3, { message: "Topic must be at least 3 characters." }).max(100, {message: "Topic is too long."}),
  educationLevel: EducationLevels,
  language: SupportedLanguages.default("English"),
});
type ConfigFormData = z.infer<typeof configFormSchema>;

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
  
  const [topic, setTopic] = useState<string>(""); 
  const [educationLevel, setEducationLevel] = useState<EducationLevel>("HighSchool"); 
  const [language, setLanguage] = useState<SupportedLanguage>("English"); 

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [configPdfDataUri, setConfigPdfDataUri] = useState<string | null>(null);
  const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
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

  const configForm = useForm<ConfigFormData>({
    resolver: zodResolver(configFormSchema),
    defaultValues: {
      topic: "",
      educationLevel: "HighSchool",
      language: "English",
    },
  });

  const answerForm = useForm<AnswerFormData>({
    resolver: zodResolver(answerFormSchema),
    defaultValues: {
      answer: "",
    },
  });

  useEffect(() => {
    console.log("KnowledgeQuizSession: useEffect for audio playback triggered. currentAudioUri (first 50 chars):", currentAudioUri ? currentAudioUri.substring(0,50) + "..." : "NULL_AUDIO_URI");
    if (currentAudioUri && audioPlayerRef.current) {
      console.log("KnowledgeQuizSession: Attempting to play audio. Current audioPlayerRef.current.src (first 50 chars):", audioPlayerRef.current.src ? audioPlayerRef.current.src.substring(0,50) + "..." : "NO_SRC_YET");
      audioPlayerRef.current.src = currentAudioUri;
      audioPlayerRef.current.load(); // Ensure the new src is loaded
      audioPlayerRef.current.play().catch(e => console.error("KnowledgeQuizSession: Error playing audio:", e));
    } else if (!currentAudioUri) {
        console.log("KnowledgeQuizSession: currentAudioUri is null or empty, not playing audio.");
    } else if (!audioPlayerRef.current) {
        console.warn("KnowledgeQuizSession: audioPlayerRef.current is null, cannot play audio.");
    }
  }, [currentAudioUri]);

  const fetchAndPlayNarration = async (text: string, lang?: SupportedLanguage) => {
    console.log("KnowledgeQuizSession: fetchAndPlayNarration called with text (first 50 chars):", text ? text.substring(0, 50) + "..." : "EMPTY_TEXT", "Lang:", lang || language);
    if (!text || text.trim() === "") {
      console.warn("KnowledgeQuizSession: Empty or whitespace-only text received for narration. Skipping TTS call.");
      setCurrentAudioUri(null); 
      setIsFetchingAudio(false); 
      return;
    }
    const targetLanguage = lang || language || "English";
    setIsFetchingAudio(true);
    setCurrentAudioUri(null); 
    try {
      const ttsInput: TextToSpeechInput = {
        text,
        voiceId: ''
      };
      const { audioDataUri } = await textToSpeech(ttsInput);
      console.log("KnowledgeQuizSession: Received audioDataUri from textToSpeech flow (first 50 chars):", audioDataUri ? audioDataUri.substring(0,50) + "..." : "NO_URI_RECEIVED");
      if (audioDataUri) {
        setCurrentAudioUri(audioDataUri);
      } else {
        console.warn("KnowledgeQuizSession: Failed to fetch audio narration (audioDataUri is null or undefined from TTS flow).");
        toast({ title: "Narration Unavailable", description: `Could not generate audio for this content in ${targetLanguage}. The TTS service might be unavailable or the API key is missing/invalid. Please check server logs for specific TTS errors.`, variant: "default", duration: 3000 });
      }
    } catch (error) {
      console.error("KnowledgeQuizSession: Error fetching or playing narration:", error);
      toast({ title: "Narration Error", description: `Could not play audio in ${targetLanguage}.`, variant: "destructive", duration: 2000 });
    } finally {
      setIsFetchingAudio(false);
    }
  };


  const fetchTopicIntroduction = async (currentTopic: string, currentEducationLevel: EducationLevel, currentLanguage: SupportedLanguage, currentPdfDataUri: string | null) => {
    console.log("KnowledgeQuizSession: Fetching topic introduction:", { currentTopic, currentEducationLevel, currentLanguage, pdfPresent: !!currentPdfDataUri });
    setIsLoading(true);
    setCurrentStep('loading');
    setErrorMessage(null);
    try {
      const input: GetTopicIntroductionInput = {
        topic: currentTopic,
        educationLevel: currentEducationLevel,
        language: currentLanguage,
        pdfDataUri: currentPdfDataUri,
      };
      const output: GetTopicIntroductionOutput = await getTopicIntroduction(input);
      
      if (output.introductionText && !output.introductionText.toLowerCase().includes("unexpected server error") && !output.introductionText.toLowerCase().includes("model not found") && !output.introductionText.toLowerCase().includes("could not generate")) {
        setTopicIntroductionText(output.introductionText);
        fetchAndPlayNarration(output.introductionText, currentLanguage);
        setCurrentStep('introduction');
        toast({ title: "Topic Introduction Ready!", description: "Read the introduction below then start the quiz.", variant: "default" });
        if (currentPdfDataUri) { 
          setIsPdfViewerOpen(true);
        }
      } else {
        let displayError = output.introductionText || `An unknown error occurred generating the introduction for "${currentTopic}" in ${currentLanguage}.`;
        if (output.introductionText && output.introductionText.includes("Details: ")) { 
            displayError = `Error getting introduction: ${output.introductionText.substring(output.introductionText.indexOf("Details: "))}`;
        } else if (output.introductionText && output.introductionText.includes("could not generate")) {
             displayError = output.introductionText; 
        }
        setErrorMessage(displayError + " Please check server logs for more details or try again.");
        setCurrentStep('error');
        toast({ title: "Introduction Error", description: displayError, variant: "destructive" });
      }
    } catch (error) {
      console.error("KnowledgeQuizSession: Error fetching topic introduction:", error);
      const errorMsg = error instanceof Error ? error.message : "An unknown error occurred";
      let displayError = `Sorry, I couldn't get the topic introduction: ${errorMsg}.`;
      if (errorMsg.toLowerCase().includes("vercel") || errorMsg.toLowerCase().includes("server component") || errorMsg.toLowerCase().includes("server components render") || errorMsg.toLowerCase().includes("invocation") || errorMsg.toLowerCase().includes("server components render")) { 
         displayError = `Server error getting introduction: ${errorMsg}. Please check Vercel function logs for details.`;
      }
      setErrorMessage(displayError + " Try configuring again or check server logs if the problem persists.");
      setCurrentStep('error');
      toast({ title: "Introduction Error", description: displayError, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };


  const fetchInitialQuestion = async (currentTopic: string, currentEducationLevel: EducationLevel, currentLanguage: SupportedLanguage, currentPdfDataUri: string | null) => {
    console.log("KnowledgeQuizSession: Fetching initial question:", { currentTopic, currentEducationLevel, currentLanguage, pdfPresent: !!currentPdfDataUri });
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
        topic: currentTopic, 
        educationLevel: currentEducationLevel, 
        language: currentLanguage,
        pdfDataUri: currentPdfDataUri 
      };
      const output: KnowledgeQuizOutput = await knowledgeQuizFlow(input);
      if (output.nextQuestion && output.nextQuestion.trim() !== "") {
        setCurrentQuestionText(output.nextQuestion);
        fetchAndPlayNarration(output.nextQuestion, currentLanguage);
        setCurrentStep('questioning');
      } else {
        setErrorMessage(`Could not generate the first question for "${currentTopic}" in ${currentLanguage} at the ${currentEducationLevel} level${currentPdfDataUri ? '/PDF' : ''}. Please try another combination or check the PDF content.`);
        fetchQuizSummary(currentTopic, currentEducationLevel, currentLanguage, [], currentPdfDataUri);
      }
    } catch (error) {
      console.error("KnowledgeQuizSession: Error fetching initial question:", error);
      const errorMsg = error instanceof Error ? error.message : "An unknown error occurred";
      setErrorMessage(`Sorry, I couldn't start the quiz: ${errorMsg}. Please check server logs for more details or try configuring again.`);
      setCurrentStep('error');
      toast({ title: "Quiz Start Error", description: `Failed to start quiz: ${errorMsg}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfigSubmit: SubmitHandler<ConfigFormData> = async (data) => {
    console.log("KnowledgeQuizSession: Config form submitted with data:", JSON.stringify(data));
    setTopic(data.topic); 
    setEducationLevel(data.educationLevel); 
    setLanguage(data.language); 
    setHistory([]);
    setIncorrectlyAnsweredQuestions([]);
    setIsReviewMode(false);
    setCurrentReviewQuestionIndex(0);
    setErrorMessage(null);
    setCurrentUserScore(0);
    setCurrentTotalPossibleScore(0);
    setTopicIntroductionText(null);
    setCurrentAudioUri(null);
    
    let generatedPdfDataUri: string | null = null;
    if (pdfFile) {
      setIsLoading(true); 
      setCurrentStep('loading');
      setErrorMessage("Processing PDF..."); 
      try {
        generatedPdfDataUri = await readFileAsDataURI(pdfFile);
        setConfigPdfDataUri(generatedPdfDataUri); 
        toast({ title: "PDF Processed", description: `${pdfFile.name} will be used for context.`, variant: "default" });
        setErrorMessage(null); 
      } catch (error) {
        console.error("KnowledgeQuizSession: Error reading PDF file:", error);
        const errorMsg = error instanceof Error ? error.message : "Could not read file";
        toast({ title: "PDF Error", description: `${errorMsg}. Continuing without PDF.`, variant: "destructive" });
        setErrorMessage(`Could not process PDF: ${errorMsg}. Continuing without it.`); 
        setConfigPdfDataUri(null); 
        setPdfFile(null); 
      }
    } else {
        setConfigPdfDataUri(null); 
    }
    
    await fetchTopicIntroduction(data.topic, data.educationLevel, data.language, generatedPdfDataUri);
  };

  const handleProceedToQuestions = () => {
    const formConfig = configForm.getValues();
    fetchInitialQuestion(formConfig.topic, formConfig.educationLevel, formConfig.language, configPdfDataUri);
  };

  const fetchNextQuestion = async (currentTopic: string, currentEducationLevel: EducationLevel, currentLanguage: SupportedLanguage, updatedHistory: HistoryItem[], currentPdfDataUri: string | null) => {
    console.log("KnowledgeQuizSession: Fetching next question:", { currentTopic, currentEducationLevel, currentLanguage, historyLength: updatedHistory.length, pdfPresent: !!currentPdfDataUri });
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
        previousAnswers: updatedHistory.map(h => ({question: h.question, answer: h.answer})), 
        topic: currentTopic,
        educationLevel: currentEducationLevel,
        language: currentLanguage,
        pdfDataUri: currentPdfDataUri, 
      };
      const output: KnowledgeQuizOutput = await knowledgeQuizFlow(input);

      if (output.nextQuestion && output.nextQuestion.trim() !== "") {
        setCurrentQuestionText(output.nextQuestion);
        fetchAndPlayNarration(output.nextQuestion, currentLanguage);
        setCurrentStep('questioning');
      } else {
        setIncorrectlyAnsweredQuestions(updatedHistory.filter(item => typeof item.awardedPoints === 'number' && item.awardedPoints < REVIEW_SCORE_THRESHOLD)); 
        fetchQuizSummary(currentTopic, currentEducationLevel, currentLanguage, updatedHistory, currentPdfDataUri); 
      }
    } catch (error) {
      console.error("KnowledgeQuizSession: Error fetching next question:", error);
      const errorMsg = error instanceof Error ? error.message : "An unknown error occurred";
      setErrorMessage(`Sorry, I couldn't get the next question: ${errorMsg}. You can try to get the summary or restart.`);
      setCurrentStep('error');
      toast({ title: "Next Question Error", description: `Failed to get next question: ${errorMsg}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchQuizSummary = async (currentTopic: string, currentEducationLevel: EducationLevel, currentLanguage: SupportedLanguage, finalHistory: HistoryItem[], currentPdfDataUri: string | null) => {
    console.log("KnowledgeQuizSession: Fetching quiz summary:", { currentTopic, currentEducationLevel, currentLanguage, historyLength: finalHistory.length, pdfPresent: !!currentPdfDataUri });
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
      const responses = finalHistory.reduce((acc, item, index) => {
        acc[`q${index}_${item.question.substring(0,15).replace(/\s/g,'_')}`] = item.answer;
        return acc;
      }, {} as Record<string, string>);

      const input: QuizSummaryInput = { 
        topic: currentTopic, 
        educationLevel: currentEducationLevel, 
        language: currentLanguage, 
        pdfDataUri: currentPdfDataUri, 
        responses, 
        conversationHistory: finalHistory.map(item => ({
          question: item.question,
          answer: item.answer,
          explanation: item.explanation,
          imageSuggestion: item.detailedImagePrompt, 
        }))
      };
      const output: QuizSummaryOutput = await getQuizSummary(input);
      setSummaryText(output.summary);
      setFurtherLearningSuggestions(output.furtherLearningSuggestions);
      setIncorrectlyAnsweredQuestions(finalHistory.filter(item => typeof item.awardedPoints === 'number' && item.awardedPoints < REVIEW_SCORE_THRESHOLD)); 
      setCurrentStep('summary');
      toast({ title: "Quiz Complete!", description: "Personalized summary generated.", variant: "default" });
    } catch (error) {
      console.error("KnowledgeQuizSession: Error fetching quiz summary:", error);
      const errorMsg = error instanceof Error ? error.message : "An unknown error occurred";
      setErrorMessage(`Sorry, I couldn't generate your quiz summary: ${errorMsg}. Please try again or restart.`);
      setCurrentStep('error');
      toast({ title: "Summary Error", description: `Failed to generate summary: ${errorMsg}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerSubmit: SubmitHandler<AnswerFormData> = async (data) => {
    if (!currentQuestionText) return;
    console.log("KnowledgeQuizSession: handleAnswerSubmit called for question:", currentQuestionText.substring(0,50) + "...", "Answer:", data.answer.substring(0,50) + "...");
    setIsEvaluating(true);
    setIsGeneratingImage(false); 
    setCurrentGeneratedImageDataUri(null); 
    setShowExplanationSection(false);
    setCurrentExplanation(null);
    setCurrentDetailedImagePrompt(null);
    setCurrentAwardedPoints(null);
    setErrorMessage(null);
    setCurrentAudioUri(null);
    
    const formConfig = configForm.getValues(); 
    

    let awardedPointsForThisQuestion = 0;
    let explanationText = `Could not retrieve explanation for this answer in ${formConfig.language}.`;
    let aiDetailedImagePrompt: string | undefined = undefined;
    let generatedImageForHistory: string | undefined = undefined;

    try {
      const evalInput: EvaluateAnswerInput = {
        question: currentQuestionText,
        userAnswer: data.answer,
        topic: formConfig.topic,
        educationLevel: formConfig.educationLevel,
        language: formConfig.language,
        pdfDataUri: configPdfDataUri, 
      };
      console.log("KnowledgeQuizSession: Calling evaluateAnswer with input:", JSON.stringify(evalInput, null, 2));
      const evalOutput: EvaluateAnswerOutput = await evaluateAnswer(evalInput);
      console.log("KnowledgeQuizSession: AI Evaluation Output:", JSON.stringify(evalOutput, null, 2)); 
      
      awardedPointsForThisQuestion = evalOutput.awardedScore;
      explanationText = evalOutput.explanation || `Score: ${awardedPointsForThisQuestion}/${MAX_POINTS_PER_QUESTION}. No detailed explanation provided in ${formConfig.language}.`;
      if (explanationText) {
          fetchAndPlayNarration(explanationText, formConfig.language);
      }
      aiDetailedImagePrompt = evalOutput.detailedImagePrompt; 
      setCurrentDetailedImagePrompt(aiDetailedImagePrompt || null); 

      if (aiDetailedImagePrompt) {
        setIsGeneratingImage(true);
        try {
          const imageGenInput: GenerateImageInput = { detailedImageDescription: aiDetailedImagePrompt };
          console.log("KnowledgeQuizSession: Calling generateImage with input:", JSON.stringify(imageGenInput, null, 2));
          const imageGenOutput: GenerateImageOutput = await generateImage(imageGenInput);
          if (imageGenOutput.imageDataUri) {
            console.log("KnowledgeQuizSession: Image generated, URI starts with:", imageGenOutput.imageDataUri.substring(0, 50));
            setCurrentGeneratedImageDataUri(imageGenOutput.imageDataUri);
            generatedImageForHistory = imageGenOutput.imageDataUri;
          } else {
             console.warn("KnowledgeQuizSession: Image generation output did not contain imageDataUri.");
          }
        } catch (imgError) {
          console.error("KnowledgeQuizSession: Error generating image:", imgError);
          toast({ title: "Image Generation Error", description: "Could not generate an image for this explanation.", variant: "destructive", duration: 2000 });
        } finally {
          setIsGeneratingImage(false);
        }
      }

      toast({ 
        icon: <ThumbsUp className="mr-1 h-4 w-4 text-green-500" />, 
        title: "Answer Evaluated!", 
        description: `Score: ${awardedPointsForThisQuestion}/${MAX_POINTS_PER_QUESTION}. See explanation below.`, 
        variant: "default", 
        duration: 3500 
      });

    } catch (error) {
      console.error("KnowledgeQuizSession: Error evaluating answer:", error);
      const errorMsg = error instanceof Error ? error.message : "An unknown error occurred";
      explanationText = `An error occurred while evaluating your answer in ${formConfig.language}: ${errorMsg}`;
      if (explanationText) {
          fetchAndPlayNarration(explanationText, formConfig.language);
      }
      toast({ title: "Evaluation Error", description: `Couldn't evaluate answer: ${errorMsg}. See explanation section.`, variant: "destructive", duration: 2000 });
    } finally {
      setIsEvaluating(false); 
    }

    setCurrentUserScore(prevScore => prevScore + awardedPointsForThisQuestion);
    setCurrentTotalPossibleScore(prevTotal => prevTotal + MAX_POINTS_PER_QUESTION);
    setCurrentAwardedPoints(awardedPointsForThisQuestion);

    const newHistoryItem: HistoryItem = {
        question: currentQuestionText,
        answer: data.answer,
        explanation: explanationText,
        detailedImagePrompt: aiDetailedImagePrompt, 
        generatedImageDataUri: generatedImageForHistory,
        awardedPoints: awardedPointsForThisQuestion,
        possiblePoints: MAX_POINTS_PER_QUESTION,
    };

    if (isReviewMode) {
        const updatedReviewItems = [...incorrectlyAnsweredQuestions];
        const originalQuestionToUpdate = updatedReviewItems[currentReviewQuestionIndex];
        updatedReviewItems[currentReviewQuestionIndex] = {
            ...originalQuestionToUpdate, 
            answer: data.answer, 
            explanation: explanationText, 
            detailedImagePrompt: aiDetailedImagePrompt,
            generatedImageDataUri: generatedImageForHistory,
            awardedPoints: awardedPointsForThisQuestion,
            possiblePoints: MAX_POINTS_PER_QUESTION,
        };
        setIncorrectlyAnsweredQuestions(updatedReviewItems);
        
        const mainHistoryIndex = history.findIndex(h => h.question === originalQuestionToUpdate.question);
        if (mainHistoryIndex > -1) {
            const updatedMainHistory = [...history];
            updatedMainHistory[mainHistoryIndex] = { 
                ...updatedMainHistory[mainHistoryIndex], 
                answer: data.answer,
                explanation: explanationText,
                detailedImagePrompt: aiDetailedImagePrompt,
                generatedImageDataUri: generatedImageForHistory,
                awardedPoints: awardedPointsForThisQuestion, 
            }; 
            setHistory(updatedMainHistory);
        }
    } else {
        const updatedHistory = [...history, newHistoryItem];
        setHistory(updatedHistory);
    }

    setCurrentExplanation(explanationText);
    setShowExplanationSection(true);
  };

  const handleProceedToNextQuestion = () => {
    setShowExplanationSection(false);
    setCurrentExplanation(null);
    setCurrentDetailedImagePrompt(null);
    setCurrentGeneratedImageDataUri(null);
    setCurrentAwardedPoints(null);
    answerForm.reset(); 
    setErrorMessage(null);
    setCurrentAudioUri(null);
    
    const formConfig = configForm.getValues(); 

    if (isReviewMode) {
        const nextIndex = currentReviewQuestionIndex + 1;
        if (nextIndex < incorrectlyAnsweredQuestions.length) {
            setCurrentReviewQuestionIndex(nextIndex);
            const nextReviewQuestion = incorrectlyAnsweredQuestions[nextIndex].question;
            setCurrentQuestionText(nextReviewQuestion);
            fetchAndPlayNarration(nextReviewQuestion, formConfig.language);
            answerForm.setValue('answer', incorrectlyAnsweredQuestions[nextIndex].answer || ''); 
            setCurrentStep('questioning');
        } else {
            setIsReviewMode(false);
            fetchQuizSummary(formConfig.topic, formConfig.educationLevel, formConfig.language, history, configPdfDataUri); 
            toast({title: "Review Complete!", description: "You've reviewed all applicable answers.", variant: "default"});
        }
    } else {
        fetchNextQuestion(formConfig.topic, formConfig.educationLevel, formConfig.language, history, configPdfDataUri); 
    }
  };

  const handleStartReview = () => {
    const questionsToReview = history.filter(item => typeof item.awardedPoints === 'number' && item.awardedPoints < REVIEW_SCORE_THRESHOLD);
    if (questionsToReview.length > 0) {
        setIncorrectlyAnsweredQuestions(questionsToReview); 
        setIsReviewMode(true);
        setCurrentReviewQuestionIndex(0);
        const firstReviewQuestion = questionsToReview[0].question;
        setCurrentQuestionText(firstReviewQuestion);
        const formConfig = configForm.getValues();
        fetchAndPlayNarration(firstReviewQuestion, formConfig.language);
        answerForm.reset(); 
        setCurrentExplanation(null); 
        setCurrentDetailedImagePrompt(null); 
        setCurrentGeneratedImageDataUri(null);
        setShowExplanationSection(false); 
        setCurrentAwardedPoints(null);
        setCurrentStep('questioning');
        setErrorMessage(null);
        toast({title: "Review Mode", description: "Let's go over some of the questions again.", variant: "default"});
    } else {
        toast({title: "No Answers to Review", description: "Great job! Nothing to review based on current criteria.", variant: "default"});
    }
  };

  const handleRestartQuiz = () => {
    if (onGoToHome) {
      onGoToHome();
    } else {
      setCurrentStep('config');
      setCurrentQuestionText(null);
      setHistory([]);
      setSummaryText(null);
      setFurtherLearningSuggestions(null);
      setErrorMessage(null);
          
      setPdfFile(null);
      setConfigPdfDataUri(null);
      setTopicIntroductionText(null);
      setIsPdfViewerOpen(false);
      const fileInput = document.getElementById('pdf-upload-input') as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";

      setIncorrectlyAnsweredQuestions([]);
      setIsReviewMode(false);
      setCurrentReviewQuestionIndex(0);

      setCurrentUserScore(0);
      setCurrentTotalPossibleScore(0);
      setCurrentAwardedPoints(null);
      setCurrentGeneratedImageDataUri(null);
      setCurrentDetailedImagePrompt(null);
      setCurrentAudioUri(null);


      configForm.reset(); 
      answerForm.reset();
      setIsLoading(false);
      setIsEvaluating(false);
      setIsGeneratingImage(false);
      setShowExplanationSection(false);
      setCurrentExplanation(null);
    }
  };
  
  const handleClearPdf = () => {
    setPdfFile(null);
    setConfigPdfDataUri(null); 
    setIsPdfViewerOpen(false);
    const fileInput = document.getElementById('pdf-upload-input') as HTMLInputElement | null;
    if (fileInput) {
        fileInput.value = ""; 
    }
    toast({ title: "PDF Cleared", description: "The selected PDF has been removed.", variant: "default" });
  };

  const getLoadingMessage = () => {
    if (errorMessage && errorMessage.startsWith("Processing PDF...")) return errorMessage; 
    if (isFetchingAudio) return "Preparing audio narration...";
    if (isGeneratingImage && !showExplanationSection) return "Generating image for explanation...";
    if (isEvaluating && !showExplanationSection) return "Evaluating your answer...";
    if (currentStep === 'loading') {
        if (topicIntroductionText === null && currentQuestionText === null && history.length === 0 && !isReviewMode) return "Preparing topic introduction...";
        if (topicIntroductionText !== null && currentQuestionText === null && history.length === 0 && !isReviewMode) return "Preparing your quiz...";
        if (currentQuestionText && !summaryText && !isReviewMode) return "Getting next question...";
        if (isReviewMode && !summaryText) return "Preparing review question...";
        if (summaryText === null && history.length > 0 && !isReviewMode) return "Generating your summary...";
    }
    return "Loading...";
  };

  const formValuesForHeader = configForm.watch();

  if ((isLoading || (isEvaluating && !showExplanationSection) || (isGeneratingImage && !showExplanationSection) || isFetchingAudio) && currentStep !== 'questioning' && currentStep !== 'summary' && currentStep !== 'config' && currentStep !== 'error' && currentStep !== 'introduction') {
    return (
      <Card className="w-full shadow-xl rounded-lg overflow-hidden bg-card">
        <CardContent className="p-1 min-h-[300px] flex flex-col items-center justify-center text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mb-1" />
          <p className="text-lg text-muted-foreground">{getLoadingMessage()}</p>
          {errorMessage && errorMessage.startsWith("Processing PDF...") && (
             <p className="text-sm text-destructive mt-1">{errorMessage}</p>
          )}
        </CardContent>
      </Card>
    );
  }
  
  if (errorMessage && currentStep !== 'loading' && !(errorMessage && errorMessage.startsWith("Processing PDF..."))) { 
    return (
      <Card className="w-full shadow-xl rounded-lg overflow-hidden bg-card">
        <CardHeader className="bg-muted/50 p-1 border-b">
          <CardTitle className="text-xl text-destructive flex items-center gap-1"><AlertTriangle /> Error</CardTitle>
        </CardHeader>
        <CardContent className="p-1 min-h-[200px] flex flex-col items-center justify-center">
          <Alert variant="destructive" className="mx-auto">
            <AlertTriangle className="h-5 w-5" />
            <AlertTitle>An Error Occurred</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="p-1 border-t bg-muted/50 flex justify-center">
             <Button onClick={handleRestartQuiz} variant="outline" className="w-full sm:w-auto">
              {onGoToHome ? <Home className="mr-1 h-4 w-4" /> : <RefreshCw className="mr-1 h-4 w-4" />}
              {onGoToHome ? 'Go to Home' : 'Restart Quiz'}
            </Button>
        </CardFooter>
      </Card>
    );
  }


  return (
    <>
      <Dialog open={isPdfViewerOpen} onOpenChange={setIsPdfViewerOpen}>
        <DialogContent className="w-[90vw] max-w-[1200px] h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className='p-2 border-b'>
            <DialogTitle>PDF Document: {pdfFile?.name || 'Uploaded PDF'}</DialogTitle>
          </DialogHeader>
          {configPdfDataUri ? (
            <iframe
                src={configPdfDataUri}
                className="flex-grow w-full h-full border-0"
                title={pdfFile?.name || 'Uploaded PDF'}
            />
          ) : (
            <div className="flex-grow flex items-center justify-center text-muted-foreground p-1">
                <p>PDF will be displayed here once processed.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <audio ref={audioPlayerRef} className="hidden" />

      <Card className="w-full shadow-xl rounded-lg overflow-hidden bg-card">
        {currentStep === 'config' && (
          <>
            <CardHeader className="bg-muted/50 p-1 border-b">
              <div className="flex items-center space-x-1">
                <BookOpen className="w-8 h-8 text-primary mr-1" />
                <div>
                  <CardTitle className="text-2xl">Configure Your Quiz</CardTitle>
                  <CardDescription>Tell us what you want to learn about.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-1">
              <Form {...configForm}>
                <form onSubmit={configForm.handleSubmit(handleConfigSubmit)} className="space-y-1">
                  <FormField
                    control={configForm.control}
                    name="topic"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-lg">Topic</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 'Quantum Physics'" {...field} className="text-base shadow-sm focus:ring-2 focus:ring-primary" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={configForm.control}
                    name="educationLevel"
                    render={({ field }) => {
                      // console.log("[EducationLevel Field Render] field.value:", field.value);
                      return (
                        <FormItem>
                          <FormLabel className="text-lg">Education Level</FormLabel>
                          <Select
                            onValueChange={(value) => {
                              // console.log("[EducationLevel Select onValueChange] selected value:", value);
                              field.onChange(value as EducationLevel);
                            }}
                            value={field.value} 
                          >
                            <FormControl>
                              <SelectTrigger className="text-base shadow-sm focus:ring-2 focus:ring-primary">
                                <SelectValue placeholder="Select education level" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="max-h-72">
                              {EducationLevels.options.map((level) => (
                                <SelectItem key={level} value={level} className="text-base">
                                  {level.replace(/([A-Z])/g, ' $1').trim()}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                  <FormField
                    control={configForm.control}
                    name="language"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-lg">Language</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(value as SupportedLanguage)}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="text-base shadow-sm focus:ring-2 focus:ring-primary">
                              <SelectValue placeholder="Select language" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-72">
                            {SupportedLanguages.options.map((lang) => (
                              <SelectItem key={lang} value={lang} className="text-base">
                                {lang}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormItem>
                    <FormLabel className="text-lg">Optional PDF for Context</FormLabel>
                    <div className="flex items-center space-x-1">
                      <FormControl className="flex-grow">
                        <Input
                          id="pdf-upload-input"
                          type="file"
                          accept="application/pdf"
                          onChange={(e: ChangeEvent<HTMLInputElement>) => setPdfFile(e.target.files?.[0] || null)}
                          className="text-base shadow-sm focus:ring-2 focus:ring-primary file:mr-1 file:py-1 file:px-1 file:rounded-full file:border-0 file:text-xs file:bg-muted file:text-muted-foreground hover:file:bg-primary/10"
                          aria-describedby="pdf-description"
                        />
                      </FormControl>
                      {pdfFile && (
                        <Button type="button" variant="ghost" size="icon" onClick={handleClearPdf} aria-label="Clear selected PDF">
                          <XCircle className="h-5 w-5 text-muted-foreground hover:text-destructive" />
                        </Button>
                      )}
                    </div>
                    {pdfFile && <FormDescription id="pdf-description" className="text-xs">Selected: {pdfFile.name}</FormDescription>}
                    {!pdfFile && <FormDescription id="pdf-description" className="text-xs">Upload a PDF to base the quiz on its content.</FormDescription>}
                    <FormMessage />
                  </FormItem>
                  <Button type="submit" size="lg" className="w-full shadow-md" disabled={isLoading || isEvaluating || isGeneratingImage || isFetchingAudio}>
                    {isLoading || isEvaluating || isGeneratingImage || isFetchingAudio ? <Loader2 className="mr-1 h-5 w-5 animate-spin" /> : <FileQuestion className="mr-1 h-5 w-5" />}
                    Get Topic Introduction
                  </Button>
                </form>
              </Form>
            </CardContent>
            <CardFooter className="p-1 border-t bg-muted/50 flex justify-center">
              {onGoToHome && (
                <Button variant="ghost" size="sm" onClick={onGoToHome} className="text-muted-foreground hover:text-primary">
                  <Home className="mr-1 h-4 w-4" /> Go to Home
                </Button>
              )}
            </CardFooter>
          </>
        )}

        {currentStep === 'introduction' && topicIntroductionText && (
          <>
            <CardHeader className="bg-muted/50 p-1 border-b">
              <div className="flex justify-between items-center">
                  <div>
                      <CardTitle className="text-xl text-primary">
                          Topic Introduction: <span className="font-semibold">{formValuesForHeader.topic}</span>
                          {configPdfDataUri && <FileText className="inline h-5 w-5 ml-1 align-middle text-muted-foreground" title="PDF Context Active"/>}
                      </CardTitle>
                      <CardDescription className="text-xs">
                          Level: {formValuesForHeader.educationLevel.replace(/([A-Z])/g, ' $1').trim()} | Language: {formValuesForHeader.language}
                      </CardDescription>
                  </div>
                  <div className="flex items-center space-x-1">
                    {configPdfDataUri && (
                        <Button variant="outline" size="sm" className="ml-1" onClick={() => setIsPdfViewerOpen(true)}>
                            <FileText className="mr-1 h-4 w-4" /> View PDF
                        </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => topicIntroductionText && fetchAndPlayNarration(topicIntroductionText, formValuesForHeader.language)} disabled={isFetchingAudio} aria-label="Read introduction aloud">
                        <Volume2 className={`h-5 w-5 ${isFetchingAudio ? 'text-muted-foreground animate-pulse' : 'text-primary'}`} />
                    </Button>
                  </div>
              </div>
            </CardHeader>
            <CardContent className="p-1">
              <ScrollArea className="h-72 w-full rounded-md border p-1 shadow-inner bg-background/50">
                  <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap prose-p:my-1 p-1">
                      <ReactMarkdown>{topicIntroductionText}</ReactMarkdown>
                  </div>
              </ScrollArea>
            </CardContent>
            <CardFooter className="p-1 border-t bg-muted/50 flex flex-col space-y-1">
              <Button onClick={handleProceedToQuestions} size="lg" className="w-full shadow-md" disabled={isLoading || isFetchingAudio}>
                {isLoading || isFetchingAudio ? <Loader2 className="mr-1 h-5 w-5 animate-spin" /> : <PlayCircle className="mr-1 h-5 w-5" />}
                Start Quiz Questions
              </Button>
              <Button variant="outline" size="sm" onClick={handleRestartQuiz} className="w-full shadow-sm">
                  <RefreshCw className="mr-1 h-4 w-4" /> Change Topic/Settings
              </Button>
            </CardFooter>
          </>
        )}


        {currentStep === 'questioning' && currentQuestionText && (
          <>
            <CardHeader className="bg-muted/50 p-1 border-b">
              <div className="flex justify-between items-center">
                  <div>
                      <CardTitle className="text-xl text-primary">
                          {isReviewMode ? "Reviewing: " : ""}
                          <span className="font-semibold">{formValuesForHeader.topic}</span>
                          {configPdfDataUri && <FileText className="inline h-5 w-5 ml-1 align-middle text-muted-foreground" title="PDF Context Active"/>}
                      </CardTitle>
                      <CardDescription className="text-xs">
                          Level: {formValuesForHeader.educationLevel.replace(/([A-Z])/g, ' $1').trim()} | Language: {formValuesForHeader.language} |
                          {isReviewMode ? ` Review Question ${currentReviewQuestionIndex + 1} of ${incorrectlyAnsweredQuestions.length}` : ` Question ${history.length + (showExplanationSection ? 0 : 1)}`}
                      </CardDescription>
                  </div>
                  <div className="flex items-center space-x-1">
                    {configPdfDataUri && (
                        <Button variant="outline" size="sm" className="ml-1" onClick={() => setIsPdfViewerOpen(true)}>
                            <FileText className="mr-1 h-4 w-4" /> View PDF
                        </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => currentQuestionText && fetchAndPlayNarration(currentQuestionText, formValuesForHeader.language)} disabled={isFetchingAudio || showExplanationSection} aria-label="Read question aloud">
                        <Volume2 className={`h-5 w-5 ${isFetchingAudio || showExplanationSection ? 'text-muted-foreground animate-pulse' : 'text-primary'}`} />
                    </Button>
                  </div>
              </div>
            </CardHeader>

            {history.length > 0 && !showExplanationSection && !isReviewMode && (
               <CardContent className="p-1 max-h-60 overflow-y-auto bg-card z-10 sticky top-0 py-1 px-1 shadow-sm border-b">
                <h3 className="text-md font-semibold text-muted-foreground mb-1 sticky top-0 bg-card z-10 py-1 px-1">Previous Questions:</h3>
                <div className="space-y-1 pt-1">
                  {history.map((item, index) => (
                    <div key={`hist-${index}-${item.question.substring(0,10)}`} className="text-sm p-1 rounded-md bg-background/70 border border-border/70 shadow-sm">
                      <div className="flex items-start space-x-1">
                        <MessageCircle className="w-4 h-4 mr-1 text-primary shrink-0 mt-[3px]"/>
                        <div className="flex-1">
                          <span className="font-medium text-card-foreground whitespace-pre-wrap">{item.question}</span>
                          {typeof item.awardedPoints === 'number' && (
                              <span className={`ml-1 text-xs font-semibold ${item.awardedPoints >= REVIEW_SCORE_THRESHOLD ? 'text-green-600' : 'text-orange-600'}`}>
                                  ({item.awardedPoints}/{item.possiblePoints})
                              </span>
                          )}
                        </div>
                      </div>
                      <p className="mt-1 text-muted-foreground pl-[calc(1rem+0.25rem)] whitespace-pre-wrap prose prose-sm prose-p:my-1">
                        <span className="font-semibold">Your Answer: </span>{item.answer}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}

            <CardContent className="p-1">
              <Form {...answerForm}>
                <form onSubmit={answerForm.handleSubmit(handleAnswerSubmit)} className="space-y-1">
                  <FormField
                    control={answerForm.control}
                    name="answer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xl font-medium text-card-foreground mb-1 block whitespace-pre-wrap">
                          {currentQuestionText}
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Type your answer here..."
                            className="min-h-[100px] text-base resize-none shadow-sm focus:ring-2 focus:ring-primary"
                            {...field}
                            aria-label="Your answer"
                            disabled={isLoading || isEvaluating || showExplanationSection || isGeneratingImage || isFetchingAudio}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {showExplanationSection && (currentExplanation || currentGeneratedImageDataUri || isGeneratingImage) && (
                    <Alert variant="default" className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700/40 shadow-sm rounded-md p-1 my-1">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center">
                          <Lightbulb className="h-5 w-5 text-green-600 dark:text-green-400 mr-1" />
                          <AlertTitle className="font-semibold text-green-700 dark:text-green-300">Explanation</AlertTitle>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => currentExplanation && fetchAndPlayNarration(currentExplanation, formValuesForHeader.language)} disabled={isFetchingAudio} aria-label="Read explanation aloud">
                           <Volume2 className={`h-5 w-5 ${isFetchingAudio ? 'text-muted-foreground animate-pulse' : 'text-green-600 dark:text-green-400'}`} />
                        </Button>
                      </div>
                      {currentAwardedPoints !== null && (
                          <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">
                              Score: {currentAwardedPoints}/{MAX_POINTS_PER_QUESTION}
                          </p>
                      )}
                      {isGeneratingImage && !currentGeneratedImageDataUri && (
                        <div className="flex items-center justify-center p-1 my-1">
                          <Loader2 className="h-6 w-6 text-green-600 dark:text-green-400 animate-spin mr-1" />
                          <p className="text-sm text-green-700/90 dark:text-green-400/90">Generating image...</p>
                        </div>
                      )}
                      {currentGeneratedImageDataUri && !isGeneratingImage && (
                        <div className="my-1 aspect-video bg-gray-200 dark:bg-gray-700 rounded overflow-hidden shadow-md border border-green-300 dark:border-green-600 relative">
                           <Image
                                src={currentGeneratedImageDataUri}
                                alt="Visual aid for explanation"
                                layout="fill"
                                objectFit="contain"
                                className="rounded"
                                unoptimized={currentGeneratedImageDataUri.startsWith('data:image')} 
                            />
                        </div>
                      )}
                      {currentExplanation && (
                        <AlertDescription className="text-green-700/90 dark:text-green-400/90">
                            <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap prose-p:my-1 p-1">
                                <ReactMarkdown>{currentExplanation}</ReactMarkdown>
                            </div>
                        </AlertDescription>
                      )}
                    </Alert>
                  )}

                  {showExplanationSection ? (
                    <Button onClick={handleProceedToNextQuestion} className="w-full shadow-md" disabled={isLoading || isGeneratingImage || isFetchingAudio}>
                      {isLoading || isGeneratingImage || isFetchingAudio ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-1 h-4 w-4" />}
                      {isReviewMode && currentReviewQuestionIndex >= incorrectlyAnsweredQuestions.length -1 ? "Finish Review" : "Next Question"}
                    </Button>
                  ) : (
                    <Button type="submit" className="w-full shadow-md" disabled={isLoading || isEvaluating || answerForm.formState.isSubmitting || isGeneratingImage || isFetchingAudio}>
                      {isFetchingAudio ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : (isGeneratingImage ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : (isEvaluating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />))}
                      {isFetchingAudio ? 'Preparing Audio...' : (isGeneratingImage ? 'Generating Image...' : (isEvaluating ? 'Evaluating...' : 'Submit Answer'))}
                    </Button>
                  )}
                </form>
              </Form>
            </CardContent>
            <CardFooter className="p-1 border-t bg-muted/50 flex justify-center">
              <Button variant="ghost" size="sm" onClick={handleRestartQuiz} className="text-muted-foreground hover:text-destructive" disabled={isLoading || isEvaluating || isGeneratingImage || isFetchingAudio}>
                {onGoToHome ? <Home className="mr-1 h-4 w-4" /> : <RefreshCw className="mr-1 h-4 w-4" />}
                {onGoToHome ? 'Go to Home' : 'Restart Quiz'}
              </Button>
            </CardFooter>
          </>
        )}

        {currentStep === 'summary' && (
          <>
            <CardHeader className="bg-muted/50 p-1 border-b text-center">
              <div className="flex items-center justify-center space-x-1 mb-1">
                  <CheckCircle2 className="w-10 h-10 text-accent mr-1" />
                  <CardTitle className="text-2xl">Quiz Summary</CardTitle>
              </div>
              <div className="font-semibold text-lg text-primary">
                  Final Score: {currentUserScore} / {currentTotalPossibleScore}
              </div>
              <div className="flex justify-center items-center space-x-1">
                  <CardDescription>
                      Topic: <span className="font-semibold">{formValuesForHeader.topic}</span> 
                      {configPdfDataUri && <FileText className="inline h-4 w-4 ml-1 align-middle text-muted-foreground" title="PDF Context Active"/>} | 
                      Level: {formValuesForHeader.educationLevel.replace(/([A-Z])/g, ' $1').trim()} | 
                      Language: {formValuesForHeader.language}
                  </CardDescription>
                  {configPdfDataUri && (
                      <Button variant="outline" size="xs" className="ml-1 px-1 py-0.5 h-auto text-xs" onClick={() => setIsPdfViewerOpen(true)}>
                          <FileText className="mr-0.5 h-3 w-3" /> View PDF
                      </Button>
                  )}
              </div>

            </CardHeader>
            <CardContent className="p-1 space-y-1">
              {history.length > 0 && (
                  <Card className="bg-background/50 shadow-md m-1">
                      <CardHeader className="p-1">
                          <CardTitle className="text-lg text-primary flex items-center space-x-1 gap-1"><MessageCircle className="w-5 h-5"/>Your Answers & Explanations:</CardTitle>
                      </CardHeader>
                      <CardContent className="max-h-96 p-1">
                          <ScrollArea className="h-full pr-1">
                              <div className="space-y-1">
                              {history.map((item, index) => (
                              <div key={`summary-hist-${index}-${item.question.substring(0,10)}`} className="text-sm p-1 rounded-md bg-muted/30 border border-border/50 shadow-inner">
                                  <div className="font-medium text-card-foreground flex items-start space-x-1 gap-1">
                                      <span className="mr-1 flex-1 whitespace-pre-wrap">{index+1}. {item.question}</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground pl-1 mt-1 whitespace-pre-wrap prose prose-p:my-1"><span className="font-semibold">Your Answer: </span>{item.answer}</p>
                                  {typeof item.awardedPoints === 'number' && typeof item.possiblePoints === 'number' && (
                                      <p className="text-xs font-medium text-primary pl-1">Score: {item.awardedPoints}/{item.possiblePoints}</p>
                                  )}
                                  {item.explanation && (
                                    <div className="mt-1 p-1 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/30 text-xs">
                                      {item.generatedImageDataUri && (
                                        <div className="my-1 aspect-video bg-gray-200 dark:bg-gray-700 rounded overflow-hidden relative">
                                          <Image
                                            src={item.generatedImageDataUri}
                                            alt="Visual aid for explanation"
                                            layout="fill"
                                            objectFit="contain"
                                            className="rounded"
                                            unoptimized={item.generatedImageDataUri.startsWith('data:image')}
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
                  <Card className="bg-background/50 shadow-md m-1">
                  <CardHeader className="p-1">
                      <CardTitle className="text-xl text-primary flex items-center space-x-1 gap-1"><Lightbulb className="w-5 h-5"/>Main Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="p-1">
                      <div className="text-card-foreground whitespace-pre-wrap prose dark:prose-invert max-w-none prose-p:my-1 p-1">
                          <ReactMarkdown>{summaryText}</ReactMarkdown>
                      </div>
                  </CardContent>
                  </Card>
              )}
              {furtherLearningSuggestions && furtherLearningSuggestions.length > 0 && (
                  <Card className="bg-background/50 shadow-md m-1">
                      <CardHeader className="p-1">
                          <CardTitle className="text-xl text-accent flex items-center space-x-1 gap-1"><BookOpen className="w-5 h-5"/>Further Learning</CardTitle>
                      </CardHeader>
                      <CardContent className="p-1">
                          <ul className="list-disc pl-1 space-y-1 text-card-foreground">
                          {furtherLearningSuggestions.map((suggestion, index) => (
                              <li key={`learn-${index}`} className="whitespace-pre-wrap">{suggestion}</li>
                          ))}
                          </ul>
                      </CardContent>
                  </Card>
              )}
              {(!summaryText && (!furtherLearningSuggestions || furtherLearningSuggestions.length === 0)) && history.length > 0 && (
                  <div className="text-muted-foreground text-center p-1">No summary or learning suggestions were generated for this session.</div>
              )}
              {incorrectlyAnsweredQuestions.length > 0 && !isReviewMode && (
                  <Card className="bg-orange-50 dark:bg-orange-900/30 shadow-md m-1 border-orange-300 dark:border-orange-700">
                      <CardHeader className="p-1">
                          <CardTitle className="text-xl text-orange-600 dark:text-orange-400 flex items-center space-x-1 gap-1">
                              <RefreshCw className="w-5 h-5"/>Review Your Answers
                          </CardTitle>
                      </CardHeader>
                      <CardContent className="p-1">
                          <p className="text-card-foreground mb-1">You had {incorrectlyAnsweredQuestions.length} answer(s) with a score below {REVIEW_SCORE_THRESHOLD}/{MAX_POINTS_PER_QUESTION}. Would you like to review them?</p>
                          <Button onClick={handleStartReview} className="w-full sm:w-auto shadow-md bg-orange-500 hover:bg-orange-600 text-white">
                              <RefreshCw className="mr-1 h-4 w-4" /> Start Review Session
                          </Button>
                      </CardContent>
                  </Card>
              )}
              {incorrectlyAnsweredQuestions.length === 0 && history.length > 0 && !isReviewMode && (
                  <Alert variant="default" className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700/40 shadow-sm rounded-md p-1 my-1">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mr-1" />
                      <AlertTitle className="font-semibold text-green-700 dark:text-green-300">All Answers Scored Well!</AlertTitle>
                      <AlertDescription className="text-green-700/90 dark:text-green-400/90">
                          Congratulations! You scored {REVIEW_SCORE_THRESHOLD} or more on all questions.
                      </AlertDescription>
                  </Alert>
              )}
            </CardContent>
            <CardFooter className="p-1 border-t bg-muted/50 flex justify-center">
              <Button onClick={handleRestartQuiz} variant="outline" className="w-full sm:w-auto shadow-md">
                  {onGoToHome ? <Home className="mr-1 h-4 w-4" /> : <RefreshCw className="mr-1 h-4 w-4" />}
                  {onGoToHome ? 'Go to Home' : 'Restart New Quiz'}
              </Button>
            </CardFooter>
          </>
        )}
      </Card>
    </>
  );
}
