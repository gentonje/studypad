
"use client";

import { useState, useEffect, type FormEvent } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { knowledgeQuizFlow, type KnowledgeQuizInput, type KnowledgeQuizOutput } from '@/ai/flows/knowledge-quiz-flow';
import { getQuizSummary, type QuizSummaryInput, type QuizSummaryOutput } from '@/ai/flows/quiz-summary-flow';
import { evaluateAnswer, type EvaluateAnswerInput, type EvaluateAnswerOutput } from '@/ai/flows/evaluate-answer-flow';
import { EducationLevels, type EducationLevel } from '@/ai/flows/types';

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, PlayCircle, BookOpen, CheckCircle2, AlertTriangle, RefreshCw, Send, Lightbulb, MessageCircle, Check } from 'lucide-react';
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
}

export function KnowledgeQuizSession() {
  const [currentStep, setCurrentStep] = useState<'config' | 'questioning' | 'summary' | 'loading' | 'error'>('config');
  const [currentQuestionText, setCurrentQuestionText] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [furtherLearningSuggestions, setFurtherLearningSuggestions] = useState<string[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [topic, setTopic] = useState<string>("");
  const [educationLevel, setEducationLevel] = useState<EducationLevel>("HighSchool");
  const [isLoading, setIsLoading] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);


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

  const fetchInitialQuestion = async (currentTopic: string, currentEducationLevel: EducationLevel) => {
    setIsLoading(true);
    setCurrentStep('loading');
    setErrorMessage(null);
    try {
      const input: KnowledgeQuizInput = { previousAnswers: [], topic: currentTopic, educationLevel: currentEducationLevel };
      const output: KnowledgeQuizOutput = await knowledgeQuizFlow(input);
      if (output.nextQuestion && output.nextQuestion.trim() !== "") {
        setCurrentQuestionText(output.nextQuestion);
        setCurrentStep('questioning');
      } else {
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
    fetchInitialQuestion(data.topic, data.educationLevel);
  };

  const fetchNextQuestion = async (currentTopic: string, currentEducationLevel: EducationLevel, updatedHistory: HistoryItem[]) => {
    setIsLoading(true);
    setCurrentStep('loading');
    setErrorMessage(null);
    try {
      const input: KnowledgeQuizInput = { previousAnswers: updatedHistory.map(h => ({question: h.question, answer: h.answer})), topic: currentTopic, educationLevel: currentEducationLevel };
      const output: KnowledgeQuizOutput = await knowledgeQuizFlow(input);

      if (output.nextQuestion && output.nextQuestion.trim() !== "") {
        setCurrentQuestionText(output.nextQuestion);
        setCurrentStep('questioning');
      } else {
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
    try {
      const responses = finalHistory.reduce((acc, item, index) => {
        acc[`q${index}_${item.question.substring(0,15).replace(/\s/g,'_')}`] = item.answer;
        return acc;
      }, {} as Record<string, string>);

      const input: QuizSummaryInput = { topic: currentTopic, educationLevel: currentEducationLevel, responses, conversationHistory: finalHistory.map(h => ({question: h.question, answer: h.answer})) };
      const output: QuizSummaryOutput = await getQuizSummary(input);
      setSummaryText(output.summary);
      setFurtherLearningSuggestions(output.furtherLearningSuggestions);
      setCurrentStep('summary');
      toast({ title: "Quiz Complete", description: "Personalized summary generated.", variant: "default" });
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
    let isCorrect = false;

    try {
      const evalInput: EvaluateAnswerInput = {
        question: currentQuestionText,
        userAnswer: data.answer,
        topic: topic,
        educationLevel: educationLevel,
      };
      const evalOutput: EvaluateAnswerOutput = await evaluateAnswer(evalInput);
      isCorrect = evalOutput.isCorrect;
      if (isCorrect) {
        toast({ title: "Correct!", description: evalOutput.explanation || "Great job!", variant: "default", duration: 2000 });
      } else {
        toast({ title: "Incorrect", description: evalOutput.explanation || "Let's keep trying!", variant: "destructive", duration: 2500 });
      }
    } catch (error) {
      console.error("KnowledgeQuizSession: Error evaluating answer:", error);
      toast({ title: "Evaluation Error", description: "Couldn't evaluate answer, moving on.", variant: "destructive", duration: 2000 });
      // isCorrect remains false
    } finally {
      setIsEvaluating(false);
    }

    const newHistoryItem: HistoryItem = { question: currentQuestionText, answer: data.answer, isCorrect };
    const updatedHistory = [...history, newHistoryItem];
    setHistory(updatedHistory);
    answerForm.reset();

    // Fetch next question or summary after evaluation and history update
    fetchNextQuestion(topic, educationLevel, updatedHistory);
  };
  
  const handleRestartQuiz = () => {
    setCurrentStep('config');
    setCurrentQuestionText(null);
    setHistory([]);
    setSummaryText(null);
    setFurtherLearningSuggestions(null);
    setErrorMessage(null);
    setTopic("");
    configForm.reset({ topic: "", educationLevel: "HighSchool" });
    answerForm.reset();
    setIsLoading(false);
    setIsEvaluating(false);
  };

  const getLoadingMessage = () => {
    if (isEvaluating) return "Evaluating your answer...";
    if (currentStep === 'loading') {
        if (!currentQuestionText && !summaryText && history.length === 0) return "Preparing your quiz...";
        if (currentQuestionText && !summaryText) return "Getting next question...";
        if (summaryText === null && history.length > 0) return "Generating your summary...";
    }
    return "Loading...";
  };
  
  if ((isLoading || isEvaluating) && currentStep !== 'questioning' && currentStep !== 'summary' && currentStep !== 'config' && currentStep !== 'error') {
    return (
      <Card className="w-full shadow-xl rounded-lg overflow-hidden bg-card">
        <CardContent className="p-6 md:p-8 min-h-[300px] flex flex-col items-center justify-center text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
          <p className="text-lg text-muted-foreground">{getLoadingMessage()}</p>
        </CardContent>
      </Card>
    );
  }

  if (currentStep === 'error') {
    return (
      <Card className="w-full shadow-xl rounded-lg overflow-hidden bg-card">
        <CardContent className="p-6 md:p-8 min-h-[300px] flex flex-col items-center justify-center">
          <Alert variant="destructive" className="max-w-md mx-auto">
            <AlertTriangle className="h-5 w-5" />
            <AlertTitle>An Error Occurred</AlertTitle>
            <AlertDescription>{errorMessage || "Something went wrong. Please try again."}</AlertDescription>
            <Button onClick={handleRestartQuiz} variant="outline" className="mt-4">
              <RefreshCw className="mr-2 h-4 w-4" /> Restart Quiz
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
          <CardHeader className="bg-muted/50 p-4 md:p-6 border-b">
            <div className="flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-primary" />
              <div>
                <CardTitle className="text-2xl">Configure Your Knowledge Quiz</CardTitle>
                <CardDescription>Tell us what you want to learn about.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 md:p-8">
             <Form {...configForm}>
              <form onSubmit={configForm.handleSubmit(handleConfigSubmit)} className="space-y-6">
                <FormField
                  control={configForm.control}
                  name="topic"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-lg">Topic</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 'Quantum Physics', 'Roman History'" {...field} className="text-base shadow-sm focus:ring-2 focus:ring-primary" />
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                  {isLoading || isEvaluating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <PlayCircle className="mr-2 h-5 w-5" />}
                  Start Quiz
                </Button>
              </form>
            </Form>
          </CardContent>
        </>
      )}

      {currentStep === 'questioning' && currentQuestionText && (
        <>
          <CardHeader className="bg-muted/50 p-4 md:p-6 border-b">
             <CardTitle className="text-xl text-center md:text-left text-primary">Topic: {topic}</CardTitle>
             <CardDescription className="text-center md:text-left">Level: {educationLevel.replace(/([A-Z])/g, ' $1').trim()} | Question {history.length + 1}</CardDescription>
          </CardHeader>
          
          {history.length > 0 && (
            <CardContent className="p-4 md:p-6 max-h-60">
              <ScrollArea className="h-full pr-3">
                <div className="space-y-4"> {/* Increased space-y for better separation */}
                <h3 className="text-md font-semibold text-muted-foreground mb-2">Previous Questions:</h3>
                {history.map((item, index) => (
                  <div key={index} className="text-sm p-3 rounded-md bg-muted/30 border border-border/70 shadow-sm">
                    <div className="flex items-start">
                      <MessageCircle className="w-4 h-4 mr-2 text-primary shrink-0 mt-[3px]"/>
                      <div className="flex-1">
                        <span className="font-medium text-card-foreground">Question: </span>
                        <span className="font-medium text-card-foreground whitespace-pre-wrap">{item.question}</span>
                      </div>
                      {item.isCorrect && <span className="ml-2 text-xl self-start">🎉</span>}
                      {item.isCorrect === false && <span className="ml-2 text-xl self-start">🤔</span>}
                    </div>
                    <p className="mt-2 text-muted-foreground pl-[calc(1rem+0.5rem)] whitespace-pre-wrap"> {/* 1rem for icon width + 0.5rem for margin = 22px; pl-6 is 24px. mt-2 for clear separation */}
                      <span className="font-semibold">Your Answer: </span>{item.answer}
                    </p>
                  </div>
                ))}
                </div>
              </ScrollArea>
            </CardContent>
          )}

          <CardContent className={`p-6 md:p-8 ${history.length > 0 ? 'pt-3' : ''}`}>
            <Form {...answerForm}>
              <form onSubmit={answerForm.handleSubmit(handleAnswerSubmit)} className="space-y-6">
                <FormField
                  control={answerForm.control}
                  name="answer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xl font-medium text-card-foreground mb-3 block whitespace-pre-wrap">
                        {currentQuestionText}
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Type your answer here..."
                          className="min-h-[100px] text-base resize-none shadow-sm focus:ring-2 focus:ring-primary"
                          {...field}
                          aria-label="Your answer"
                          disabled={isLoading || isEvaluating}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full md:w-auto shadow-md" disabled={isLoading || isEvaluating || answerForm.formState.isSubmitting}>
                  {isLoading || isEvaluating || answerForm.formState.isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  {isEvaluating ? 'Evaluating...' : 'Submit Answer'}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="p-4 md:p-6 border-t bg-muted/50 flex justify-center">
            <Button variant="ghost" size="sm" onClick={handleRestartQuiz} className="text-muted-foreground hover:text-destructive" disabled={isLoading || isEvaluating}>
              Cancel Quiz
            </Button>
          </CardFooter>
        </>
      )}

      {currentStep === 'summary' && (
        <>
          <CardHeader className="bg-muted/50 p-4 md:p-6 border-b text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
                <CheckCircle2 className="w-10 h-10 text-accent" />
                <CardTitle className="text-2xl">Quiz Summary</CardTitle>
            </div>
            <CardDescription>Topic: {topic} | Level: {educationLevel.replace(/([A-Z])/g, ' $1').trim()}</CardDescription>
          </CardHeader>
          <CardContent className="p-6 md:p-8 space-y-6">
            {history.length > 0 && (
                <Card className="bg-background/50 shadow-md">
                    <CardHeader>
                        <CardTitle className="text-lg text-primary flex items-center gap-2"><Check className="w-5 h-5"/>Your Answers:</CardTitle>
                    </CardHeader>
                    <CardContent className="max-h-72">
                         <ScrollArea className="h-full pr-3">
                            <div className="space-y-3">
                            {history.map((item, index) => (
                            <div key={index} className="text-sm p-2 rounded-md bg-muted/30 border border-border/50">
                                <div className="font-medium text-card-foreground flex items-start">
                                    <span className="mr-1 flex-1 whitespace-pre-wrap">{index+1}. {item.question}</span>
                                    {item.isCorrect && <span className="ml-2 text-xl self-start">🎉</span>}
                                    {item.isCorrect === false && <span className="ml-2 text-xl self-start">🤔</span>}
                                </div>
                                <p className="text-xs text-muted-foreground pl-4 mt-1 whitespace-pre-wrap"><span className="font-semibold">Your Answer: </span>{item.answer}</p>
                            </div>
                            ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            )}
            {summaryText && (
                <Card className="bg-background/50 shadow-md">
                <CardHeader>
                    <CardTitle className="text-xl text-primary flex items-center gap-2"><Lightbulb className="w-5 h-5"/>Main Summary</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-card-foreground whitespace-pre-wrap">{summaryText}</p>
                </CardContent>
                </Card>
            )}
            {furtherLearningSuggestions && furtherLearningSuggestions.length > 0 && (
                 <Card className="bg-background/50 shadow-md">
                    <CardHeader>
                        <CardTitle className="text-xl text-accent flex items-center gap-2"><BookOpen className="w-5 h-5"/>Further Learning</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="list-disc pl-5 space-y-1 text-card-foreground">
                        {furtherLearningSuggestions.map((suggestion, index) => (
                            <li key={index} className="whitespace-pre-wrap">{suggestion}</li>
                        ))}
                        </ul>
                    </CardContent>
                </Card>
            )}
            {!summaryText && (!furtherLearningSuggestions || furtherLearningSuggestions.length === 0) && (
                <p className="text-muted-foreground text-center">No summary or learning suggestions were generated for this session.</p>
            )}
          </CardContent>
          <CardFooter className="p-4 md:p-6 border-t bg-muted/50 flex justify-center">
            <Button onClick={handleRestartQuiz} variant="outline" className="w-full md:w-auto shadow-md">
                <RefreshCw className="mr-2 h-4 w-4" /> Start New Quiz
            </Button>
          </CardFooter>
        </>
      )}
    </Card>
  );
}

