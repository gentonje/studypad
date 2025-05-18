
"use client";

import type { StaticImageData } from 'next/image';
import Image from 'next/image';
import { useState, useEffect, type FormEvent } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { knowledgeQuizFlow, type KnowledgeQuizInput, type KnowledgeQuizOutput } from '@/ai/flows/knowledge-quiz-flow';
import { getQuizSummary, type QuizSummaryInput, type QuizSummaryOutput } from '@/ai/flows/quiz-summary-flow';
import { evaluateAnswer, type EvaluateAnswerInput, type EvaluateAnswerOutput } from '@/ai/flows/evaluate-answer-flow';
import { EducationLevels, type EducationLevel } from '@/ai/flows/types';
import ReactMarkdown from 'react-markdown';

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, PlayCircle, BookOpen, CheckCircle2, AlertTriangle, RefreshCw, Send, Lightbulb, MessageCircle, Check, ArrowRight, Image as ImageIcon, ExternalLink, ThumbsUp } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

const configFormSchema = z.object({
  topic: z.string().min(3, { message: "Topic must be at least 3 characters." }).max(100, {message: "Topic is too long."}),
  educationLevel: EducationLevels,
});
type ConfigFormData = z.infer<typeof configFormSchema>;

const answerFormSchema = z.object({
  answer: z.string().min(1, { message: "Please provide an answer to continue." }).max(500, {message: "Answer is too long."}),
});
type AnswerFormData = z.infer<typeof answerFormSchema>;

interface HistoryItem {
  question: string;
  answer: string;
  isCorrect?: boolean;
  explanation?: string;
  imageSuggestion?: string;
}

export function KnowledgeQuizSession() {
  const [currentStep, setCurrentStep] = useState<'config' | 'questioning' | 'summary' | 'loading' | 'error'>('config');
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
  const [isLoading, setIsLoading] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [currentExplanation, setCurrentExplanation] = useState<string | null>(null);
  const [currentImageSuggestion, setCurrentImageSuggestion] = useState<string | null>(null);
  const [showExplanationSection, setShowExplanationSection] = useState(false);


  const { toast } = useToast();

  const configForm = useForm<ConfigFormData>({
    resolver: zodResolver(configFormSchema),
    defaultValues: {
      topic: "",
      educationLevel: "HighSchool",
    },
  });

  const answerForm = useForm<AnswerFormData>({
    resolver: zodResolver(answerFormSchema),
    defaultValues: {
      answer: "",
    },
  });

  useEffect(() => {
    // console.log("KnowledgeQuizSession: Education level from component state:", educationLevel);
  }, [educationLevel]);

  const fetchInitialQuestion = async (currentTopic: string, currentEducationLevel: EducationLevel) => {
    setIsLoading(true);
    setCurrentStep('loading');
    setErrorMessage(null);
    setShowExplanationSection(false);
    setCurrentExplanation(null);
    setCurrentImageSuggestion(null);
    try {
      const input: KnowledgeQuizInput = { previousAnswers: [], topic: currentTopic, educationLevel: currentEducationLevel };
      const output: KnowledgeQuizOutput = await knowledgeQuizFlow(input);
      if (output.nextQuestion && output.nextQuestion.trim() !== "") {
        setCurrentQuestionText(output.nextQuestion);
        setCurrentStep('questioning');
      } else {
        setErrorMessage("Could not generate the first question for this topic/level. Please try another.");
        fetchQuizSummary(currentTopic, currentEducationLevel, []);
      }
    } catch (error) {
      console.error("KnowledgeQuizSession: Error fetching initial question:", error);
      setErrorMessage("Sorry, I couldn't start the quiz for that topic. Please try configuring again.");
      setCurrentStep('error');
      toast({ title: "Error", description: "Failed to start quiz.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfigSubmit: SubmitHandler<ConfigFormData> = (data) => {
    setTopic(data.topic);
    setEducationLevel(data.educationLevel);
    setHistory([]);
    setIncorrectlyAnsweredQuestions([]);
    setIsReviewMode(false);
    setCurrentReviewQuestionIndex(0);
    fetchInitialQuestion(data.topic, data.educationLevel);
  };

  const fetchNextQuestion = async (currentTopic: string, currentEducationLevel: EducationLevel, updatedHistory: HistoryItem[]) => {
    setIsLoading(true);
    setCurrentStep('loading');
    setErrorMessage(null);
    setShowExplanationSection(false);
    setCurrentExplanation(null);
    setCurrentImageSuggestion(null);
    try {
      const input: KnowledgeQuizInput = { previousAnswers: updatedHistory.map(h => ({question: h.question, answer: h.answer})), topic: currentTopic, educationLevel: currentEducationLevel };
      const output: KnowledgeQuizOutput = await knowledgeQuizFlow(input);

      if (output.nextQuestion && output.nextQuestion.trim() !== "") {
        setCurrentQuestionText(output.nextQuestion);
        setCurrentStep('questioning');
      } else {
        setIncorrectlyAnsweredQuestions(updatedHistory.filter(item => !item.isCorrect));
        fetchQuizSummary(currentTopic, currentEducationLevel, updatedHistory);
      }
    } catch (error) {
      console.error("KnowledgeQuizSession: Error fetching next question:", error);
      setErrorMessage("Sorry, I couldn't get the next question. You can try to get the summary or restart.");
      setCurrentStep('error');
      toast({ title: "Error", description: "Failed to get next question.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchQuizSummary = async (currentTopic: string, currentEducationLevel: EducationLevel, finalHistory: HistoryItem[]) => {
    setIsLoading(true);
    setCurrentStep('loading');
    setErrorMessage(null);
    setShowExplanationSection(false);
    setCurrentExplanation(null);
    setCurrentImageSuggestion(null);
    try {
      const responses = finalHistory.reduce((acc, item, index) => {
        acc[`q${index}_${item.question.substring(0,15).replace(/\s/g,'_')}`] = item.answer;
        return acc;
      }, {} as Record<string, string>);

      const input: QuizSummaryInput = { topic: currentTopic, educationLevel: currentEducationLevel, responses, conversationHistory: finalHistory.map(h => ({question: h.question, answer: h.answer})) };
      const output: QuizSummaryOutput = await getQuizSummary(input);
      setSummaryText(output.summary);
      setFurtherLearningSuggestions(output.furtherLearningSuggestions);
      setIncorrectlyAnsweredQuestions(finalHistory.filter(item => !item.isCorrect));
      setCurrentStep('summary');
      toast({ title: "Quiz Complete!", description: "Personalized summary generated.", variant: "default" });
    } catch (error) {
      console.error("KnowledgeQuizSession: Error fetching quiz summary:", error);
      setErrorMessage("Sorry, I couldn't generate your quiz summary. Please try again or restart.");
      setCurrentStep('error');
      toast({ title: "Error", description: "Failed to generate summary.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerSubmit: SubmitHandler<AnswerFormData> = async (data) => {
    if (!currentQuestionText) return;
    setIsEvaluating(true);
    setShowExplanationSection(false);
    setCurrentExplanation(null);
    setCurrentImageSuggestion(null);

    let isCorrect = false;
    let explanationText = "Could not retrieve explanation for this answer.";
    let imgSuggestion: string | undefined = undefined;

    try {
      const evalInput: EvaluateAnswerInput = {
        question: currentQuestionText,
        userAnswer: data.answer,
        topic: topic,
        educationLevel: educationLevel,
      };
      const evalOutput: EvaluateAnswerOutput = await evaluateAnswer(evalInput);
      // console.log("AI Evaluation Output:", evalOutput); 
      isCorrect = evalOutput.isCorrect;
      explanationText = evalOutput.explanation || (isCorrect ? "Great job!" : "That's not quite right, let's look at why.");
      imgSuggestion = evalOutput.imageSuggestion;

      if (isCorrect) {
        toast({ icon: <ThumbsUp className="text-green-500" />, title: "Correct! 🎉", description: evalOutput.explanation ? "See explanation below." : "Well done!", variant: "default", duration: 3000 });
      } else {
        toast({ icon: <span className="text-xl">🤔</span>, title: "Let's review", description: evalOutput.explanation ? "See explanation below." : "Take a look at the explanation.", variant: "default", duration: 3500 });
      }
    } catch (error) {
      console.error("KnowledgeQuizSession: Error evaluating answer:", error);
      explanationText = "An error occurred while evaluating your answer.";
      toast({ title: "Evaluation Error", description: "Couldn't evaluate answer. See explanation section.", variant: "destructive", duration: 2000 });
    } finally {
      setIsEvaluating(false);
    }

    const newHistoryItem: HistoryItem = {
        question: currentQuestionText,
        answer: data.answer,
        isCorrect,
        explanation: explanationText,
        imageSuggestion: imgSuggestion
    };

    if (isReviewMode) {
        const updatedReviewItems = [...incorrectlyAnsweredQuestions];
        updatedReviewItems[currentReviewQuestionIndex] = {
            ...updatedReviewItems[currentReviewQuestionIndex],
            answer: data.answer, // User's new answer during review
            isCorrect: isCorrect, // Updated correctness
            explanation: explanationText, // Updated explanation
            imageSuggestion: imgSuggestion // Updated image suggestion
        };
        setIncorrectlyAnsweredQuestions(updatedReviewItems);
        // Also update the main history if this question exists there
        const mainHistoryIndex = history.findIndex(h => h.question === updatedReviewItems[currentReviewQuestionIndex].question);
        if (mainHistoryIndex > -1) {
            const updatedHistory = [...history];
            updatedHistory[mainHistoryIndex] = { ...updatedHistory[mainHistoryIndex], ...updatedReviewItems[currentReviewQuestionIndex]}; // update with new answer, isCorrect, explanation
            setHistory(updatedHistory);
        }

    } else {
        const updatedHistory = [...history, newHistoryItem];
        setHistory(updatedHistory);
    }

    setCurrentExplanation(explanationText);
    setCurrentImageSuggestion(imgSuggestion || null);
    // console.log("KnowledgeQuizSession: AI Evaluation Output:", { isCorrect, explanationText, imgSuggestion });
    setShowExplanationSection(true);
  };

  const handleProceedToNextQuestion = () => {
    setShowExplanationSection(false);
    setCurrentExplanation(null);
    setCurrentImageSuggestion(null);
    answerForm.reset(); // Reset the answer form

    if (isReviewMode) {
        const nextIndex = currentReviewQuestionIndex + 1;
        if (nextIndex < incorrectlyAnsweredQuestions.length) {
            setCurrentReviewQuestionIndex(nextIndex);
            setCurrentQuestionText(incorrectlyAnsweredQuestions[nextIndex].question);
            // Pre-fill with their previous incorrect answer for re-attempt
            answerForm.setValue('answer', incorrectlyAnsweredQuestions[nextIndex].answer || ''); 
            setCurrentStep('questioning');
        } else {
            // Review finished
            setIsReviewMode(false);
            // Potentially re-fetch summary if answers changed, or just go to summary
            fetchQuizSummary(topic, educationLevel, history); 
            toast({title: "Review Complete!", description: "You've reviewed all incorrect answers.", variant: "default"});
        }
    } else {
        fetchNextQuestion(topic, educationLevel, history);
    }
  };

  const handleStartReview = () => {
    // Filter for questions that are still marked incorrect in the main history
    const questionsToReview = history.filter(item => !item.isCorrect);
    if (questionsToReview.length > 0) {
        setIncorrectlyAnsweredQuestions(questionsToReview);
        setIsReviewMode(true);
        setCurrentReviewQuestionIndex(0);
        setCurrentQuestionText(questionsToReview[0].question);
        answerForm.setValue('answer', questionsToReview[0].answer || ''); // Pre-fill with their original incorrect answer
        setCurrentExplanation(null); // Clear previous explanation
        setCurrentImageSuggestion(null); // Clear previous image suggestion
        setShowExplanationSection(false); // Hide explanation section for the new question
        setCurrentStep('questioning');
        toast({title: "Review Mode", description: "Let's go over the questions you missed.", variant: "default"});
    } else {
        toast({title: "No Incorrect Answers", description: "Great job! Nothing to review.", variant: "default"});
    }
  };

  const handleRestartQuiz = () => {
    setCurrentStep('config');
    setCurrentQuestionText(null);
    setHistory([]);
    setSummaryText(null);
    setFurtherLearningSuggestions(null);
    setErrorMessage(null);
    setTopic("");
    // educationLevel is reset by configForm.reset
    setIncorrectlyAnsweredQuestions([]);
    setIsReviewMode(false);
    setCurrentReviewQuestionIndex(0);
    configForm.reset({ topic: "", educationLevel: "HighSchool" });
    answerForm.reset();
    setIsLoading(false);
    setIsEvaluating(false);
    setShowExplanationSection(false);
    setCurrentExplanation(null);
    setCurrentImageSuggestion(null);
  };

  const getLoadingMessage = () => {
    if (isEvaluating && !showExplanationSection) return "Evaluating your answer...";
    if (currentStep === 'loading') {
        if (!currentQuestionText && !summaryText && history.length === 0 && !isReviewMode) return "Preparing your quiz...";
        if (currentQuestionText && !summaryText) return "Getting next question...";
        if (summaryText === null && history.length > 0 && !isReviewMode) return "Generating your summary...";
    }
    return "Loading...";
  };

  if ((isLoading || (isEvaluating && !showExplanationSection)) && currentStep !== 'questioning' && currentStep !== 'summary' && currentStep !== 'config' && currentStep !== 'error') {
    return (
      <Card className="w-full shadow-xl rounded-lg overflow-hidden bg-card">
        <CardContent className="p-1 min-h-[300px] flex flex-col items-center justify-center text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mb-1" />
          <p className="text-lg text-muted-foreground">{getLoadingMessage()}</p>
        </CardContent>
      </Card>
    );
  }

  if (currentStep === 'error') {
    return (
      <Card className="w-full shadow-xl rounded-lg overflow-hidden bg-card">
        <CardContent className="p-1 min-h-[300px] flex flex-col items-center justify-center">
          <Alert variant="destructive" className="max-w-md mx-auto">
            <AlertTriangle className="h-5 w-5" />
            <AlertTitle>An Error Occurred</AlertTitle>
            <AlertDescription>{errorMessage || "Something went wrong. Please try again."}</AlertDescription>
            <Button onClick={handleRestartQuiz} variant="outline" className="mt-1 w-full sm:w-auto">
              <RefreshCw className="mr-1 h-4 w-4" /> Restart Quiz
            </Button>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
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
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-lg">Education Level</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value as EducationLevel);
                          // console.log("KnowledgeQuizSession: Education Level Select onChange:", value);
                        }}
                        value={field.value}
                        // defaultValue={field.value} // Using value instead of defaultValue for controlled component
                      >
                        <FormControl>
                          <SelectTrigger className="text-base shadow-sm focus:ring-2 focus:ring-primary">
                            <SelectValue placeholder="Select education level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {EducationLevels.options.map((level) => (
                            <SelectItem key={level} value={level} className="text-base">
                              {level.replace(/([A-Z])/g, ' $1').trim()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" size="lg" className="w-full shadow-md" disabled={isLoading || isEvaluating}>
                  {isLoading || isEvaluating ? <Loader2 className="mr-1 h-5 w-5 animate-spin" /> : <PlayCircle className="mr-1 h-5 w-5" />}
                  Start Quiz
                </Button>
              </form>
            </Form>
          </CardContent>
        </>
      )}

      {currentStep === 'questioning' && currentQuestionText && (
        <>
          <CardHeader className="bg-muted/50 p-1 border-b">
             <CardTitle className="text-xl text-center sm:text-left text-primary">
                {isReviewMode ? "Reviewing: " : "Topic: "}{topic}
             </CardTitle>
             <CardDescription className="text-center sm:text-left">
                Level: {educationLevel.replace(/([A-Z])/g, ' $1').trim()} |
                {isReviewMode ? ` Review Question ${currentReviewQuestionIndex + 1} of ${incorrectlyAnsweredQuestions.length}` : ` Question ${history.length + (showExplanationSection ? 0 : 1)}`}
             </CardDescription>
          </CardHeader>

          {history.length > 0 && !showExplanationSection && !isReviewMode && (
            <CardContent className="p-1 max-h-60 overflow-y-auto bg-muted/20">
              <h3 className="text-md font-semibold text-muted-foreground mb-1 sticky top-0 bg-card z-10 py-1 px-1">Previous Questions:</h3>
              <div className="space-y-1 pt-1">
                {history.map((item, index) => (
                  <div key={`hist-${index}-${item.question.substring(0,10)}`} className="text-sm p-1 rounded-md bg-background/70 border border-border/70 shadow-sm">
                    <div className="flex items-start space-x-1">
                      <MessageCircle className="w-4 h-4 mr-1 text-primary shrink-0 mt-[3px]"/>
                      <div className="flex-1">
                        <span className="font-medium text-card-foreground whitespace-pre-wrap">{item.question}</span>
                      </div>
                      {typeof item.isCorrect === 'boolean' ? (
                        item.isCorrect ? <ThumbsUp className="ml-1 text-green-500 w-4 h-4 self-start"/> : <span className="ml-1 text-xl self-start">🤔</span>
                      ) : <span className="ml-1 text-xl self-start">🤔</span>}
                    </div>
                    <p className="mt-1 text-muted-foreground pl-[calc(1rem+0.25rem)] whitespace-pre-wrap">
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
                          disabled={isLoading || isEvaluating || showExplanationSection}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {showExplanationSection && currentExplanation && (
                  <Alert variant="default" className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700/40 shadow-sm rounded-md p-1 my-1">
                    <Lightbulb className="h-5 w-5 text-green-600 dark:text-green-400 mr-1" />
                    <AlertTitle className="font-semibold text-green-700 dark:text-green-300">Explanation</AlertTitle>
                    <AlertDescription className="text-green-700/90 dark:text-green-400/90">
                        <ReactMarkdown className="prose dark:prose-invert max-w-none whitespace-pre-wrap prose-p:my-1">
                            {currentExplanation}
                        </ReactMarkdown>
                      {currentImageSuggestion && (
                        <div className="mt-1 p-1 border-t border-green-200 dark:border-green-700/30">
                            <p className="text-xs text-green-600 dark:text-green-400/80 mb-1 italic">Suggested image for clarity:</p>
                             {/* console.log("Rendering image with suggestion:", currentImageSuggestion); */}
                            <Image
                                src={`https://placehold.co/300x200.png`}
                                alt={currentImageSuggestion || "Visual aid for explanation"}
                                width={300}
                                height={200}
                                className="rounded shadow-md border border-green-300 dark:border-green-600"
                                data-ai-hint={currentImageSuggestion}
                            />
                             <a
                                href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(currentImageSuggestion)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center mt-1"
                              >
                                Search for this image <ExternalLink className="w-3 h-3 ml-1" />
                              </a>
                        </div>
                    )}
                    </AlertDescription>
                  </Alert>
                )}

                {showExplanationSection ? (
                   <Button onClick={handleProceedToNextQuestion} className="w-full shadow-md" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-1 h-4 w-4" />}
                    {isReviewMode && currentReviewQuestionIndex >= incorrectlyAnsweredQuestions.length -1 ? "Finish Review" : "Next Question"}
                  </Button>
                ) : (
                  <Button type="submit" className="w-full shadow-md" disabled={isLoading || isEvaluating || answerForm.formState.isSubmitting}>
                    {isEvaluating ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-1 h-4 w-4" />
                    )}
                    {isEvaluating ? 'Evaluating...' : 'Submit Answer'}
                  </Button>
                )}
              </form>
            </Form>
          </CardContent>
          <CardFooter className="p-1 border-t bg-muted/50 flex justify-center">
            <Button variant="ghost" size="sm" onClick={handleRestartQuiz} className="text-muted-foreground hover:text-destructive" disabled={isLoading || isEvaluating}>
              <RefreshCw className="mr-1 h-4 w-4" /> Restart Quiz
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
            <CardDescription>Topic: {topic} | Level: {educationLevel.replace(/([A-Z])/g, ' $1').trim()}</CardDescription>
          </CardHeader>
          <CardContent className="p-1 space-y-1">
            {history.length > 0 && (
                <Card className="bg-background/50 shadow-md m-1">
                    <CardHeader className="p-1">
                        <CardTitle className="text-lg text-primary flex items-center space-x-1"><Check className="w-5 h-5 mr-1"/>Your Answers & Explanations:</CardTitle>
                    </CardHeader>
                    <CardContent className="max-h-96 p-1">
                         <ScrollArea className="h-full pr-1">
                            <div className="space-y-1">
                            {history.map((item, index) => (
                            <div key={`summary-hist-${index}-${item.question.substring(0,10)}`} className="text-sm p-1 rounded-md bg-muted/30 border border-border/50 shadow-inner">
                                <div className="font-medium text-card-foreground flex items-start space-x-1">
                                    <span className="mr-1 flex-1 whitespace-pre-wrap">{index+1}. {item.question}</span>
                                    {typeof item.isCorrect === 'boolean' ? (
                                      item.isCorrect ? <ThumbsUp className="ml-1 text-green-500 w-4 h-4 self-start"/> : <span className="ml-1 text-xl self-start">🤔</span>
                                    ) : <span className="ml-1 text-xl self-start">🤔</span> }
                                </div>
                                <p className="text-xs text-muted-foreground pl-1 mt-1 whitespace-pre-wrap"><span className="font-semibold">Your Answer: </span>{item.answer}</p>
                                {item.explanation && (
                                  <div className="mt-1 p-1 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/30 text-xs">
                                    <p className="font-semibold text-green-700 dark:text-green-300">Explanation:</p>
                                    <div className="text-green-700/90 dark:text-green-400/90">
                                      <ReactMarkdown className="prose dark:prose-invert max-w-none whitespace-pre-wrap prose-p:my-1">
                                        {item.explanation}
                                      </ReactMarkdown>
                                    </div>
                                    {item.imageSuggestion && (
                                        <div className="mt-1 pt-1 border-t border-green-200 dark:border-green-700/30">
                                             <Image
                                                src={`https://placehold.co/200x150.png`}
                                                alt={item.imageSuggestion || "Visual aid for explanation"}
                                                width={200}
                                                height={150}
                                                className="rounded shadow-sm border border-green-300 dark:border-green-600 my-1"
                                                data-ai-hint={item.imageSuggestion}
                                            />
                                            <a
                                              href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(item.imageSuggestion)}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center"
                                            >
                                              Search for: "{item.imageSuggestion}" <ExternalLink className="w-3 h-3 ml-1" />
                                            </a>
                                        </div>
                                    )}
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
                    <CardTitle className="text-xl text-primary flex items-center space-x-1"><Lightbulb className="w-5 h-5 mr-1"/>Main Summary</CardTitle>
                </CardHeader>
                <CardContent className="p-1">
                    <div className="text-card-foreground whitespace-pre-wrap">
                        <ReactMarkdown className="prose dark:prose-invert max-w-none prose-p:my-1">
                            {summaryText}
                        </ReactMarkdown>
                    </div>
                </CardContent>
                </Card>
            )}
            {furtherLearningSuggestions && furtherLearningSuggestions.length > 0 && (
                 <Card className="bg-background/50 shadow-md m-1">
                    <CardHeader className="p-1">
                        <CardTitle className="text-xl text-accent flex items-center space-x-1"><BookOpen className="w-5 h-5 mr-1"/>Further Learning</CardTitle>
                    </CardHeader>
                    <CardContent className="p-1">
                        <ul className="list-disc pl-5 space-y-1 text-card-foreground">
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
                        <CardTitle className="text-xl text-orange-600 dark:text-orange-400 flex items-center space-x-1">
                            <RefreshCw className="w-5 h-5 mr-1"/>Review Your Answers
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-1">
                        <p className="text-card-foreground mb-1">You had {incorrectlyAnsweredQuestions.length} incorrect answer(s). Would you like to review them?</p>
                        <Button onClick={handleStartReview} className="w-full sm:w-auto shadow-md bg-orange-500 hover:bg-orange-600 text-white">
                            <RefreshCw className="mr-1 h-4 w-4" /> Start Review Session
                        </Button>
                    </CardContent>
                </Card>
            )}
             {incorrectlyAnsweredQuestions.length === 0 && history.length > 0 && !isReviewMode &&(
                <Alert variant="default" className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700/40 shadow-sm rounded-md p-1 my-1">
                    <ThumbsUp className="h-5 w-5 text-green-600 dark:text-green-400 mr-1" />
                    <AlertTitle className="font-semibold text-green-700 dark:text-green-300">All Correct!</AlertTitle>
                    <AlertDescription className="text-green-700/90 dark:text-green-400/90">
                        Congratulations! You answered all questions correctly.
                    </AlertDescription>
                </Alert>
            )}
          </CardContent>
          <CardFooter className="p-1 border-t bg-muted/50 flex justify-center">
            <Button onClick={handleRestartQuiz} variant="outline" className="w-full sm:w-auto shadow-md">
                <RefreshCw className="mr-1 h-4 w-4" /> Start New Quiz
            </Button>
          </CardFooter>
        </>
      )}
    </Card>
  );
}
