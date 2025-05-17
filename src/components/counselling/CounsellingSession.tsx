"use client";

import { useState, useEffect, type FormEvent } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { adaptiveQuestioning, type AdaptiveQuestioningInput, type AdaptiveQuestioningOutput } from '@/ai/flows/adaptive-questioning';
import { getPersonalizedAdvice, type PersonalizedAdviceInput, type PersonalizedAdviceOutput } from '@/ai/flows/ai-powered-advice';

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ProgressTracker } from "./ProgressTracker";
import { Loader2, PlayCircle, MessageSquare, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

const TOTAL_QUESTIONS_TARGET = 5; // Target number of questions before giving advice

const answerFormSchema = z.object({
  answer: z.string().min(1, { message: "Please provide an answer to continue." }).max(500, {message: "Answer is too long."}),
});
type AnswerFormData = z.infer<typeof answerFormSchema>;

interface HistoryItem {
  question: string;
  answer: string;
}

export function CounsellingSession() {
  const [currentStep, setCurrentStep] = useState<'welcome' | 'questioning' | 'advice' | 'loading' | 'error'>('welcome');
  const [currentQuestionText, setCurrentQuestionText] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [adviceText, setAdviceText] = useState<string | null>(null);
  const [riskAssessmentText, setRiskAssessmentText] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<AnswerFormData>({
    resolver: zodResolver(answerFormSchema),
    defaultValues: {
      answer: "",
    },
  });

  const progressValue = currentStep === 'advice' ? 100 : (history.length / TOTAL_QUESTIONS_TARGET) * 100;

  const fetchInitialQuestion = async () => {
    setCurrentStep('loading');
    setErrorMessage(null);
    try {
      const input: AdaptiveQuestioningInput = { previousAnswers: [] };
      const output: AdaptiveQuestioningOutput = await adaptiveQuestioning(input);
      if (output.nextQuestion) {
        setCurrentQuestionText(output.nextQuestion);
        setCurrentStep('questioning');
      } else {
        throw new Error("Failed to get an initial question from the AI.");
      }
    } catch (error) {
      console.error("Error fetching initial question:", error);
      setErrorMessage("Sorry, I couldn't start the session. Please try again.");
      setCurrentStep('error');
      toast({ title: "Error", description: "Failed to start session.", variant: "destructive" });
    }
  };

  const handleStartSession = () => {
    fetchInitialQuestion();
  };

  const fetchNextQuestion = async (updatedHistory: HistoryItem[]) => {
    setCurrentStep('loading');
    setErrorMessage(null);
    try {
      const input: AdaptiveQuestioningInput = { previousAnswers: updatedHistory };
      const output: AdaptiveQuestioningOutput = await adaptiveQuestioning(input);
      if (output.nextQuestion) {
        setCurrentQuestionText(output.nextQuestion);
        setCurrentStep('questioning');
      } else {
        // If AI returns no next question, consider it end of questioning
        fetchAdvice(updatedHistory);
      }
    } catch (error) {
      console.error("Error fetching next question:", error);
      setErrorMessage("Sorry, I couldn't get the next question. Please try again or restart.");
      setCurrentStep('error');
      toast({ title: "Error", description: "Failed to get next question.", variant: "destructive" });
    }
  };

  const fetchAdvice = async (finalHistory: HistoryItem[]) => {
    setCurrentStep('loading');
    setErrorMessage(null);
    try {
      const responses = finalHistory.reduce((acc, item) => {
        // Use question text as key, might need to be more robust if questions can be identical
        acc[item.question] = item.answer;
        return acc;
      }, {} as Record<string, string>);

      const input: PersonalizedAdviceInput = { responses };
      // Add demographics if collected, e.g. input.demographics = { age: 30, gender: 'male' };
      const output: PersonalizedAdviceOutput = await getPersonalizedAdvice(input);
      setAdviceText(output.advice);
      setRiskAssessmentText(output.riskAssessment);
      setCurrentStep('advice');
      toast({ title: "Session Complete", description: "Personalized advice generated.", variant: "default" });
    } catch (error) {
      console.error("Error fetching advice:", error);
      setErrorMessage("Sorry, I couldn't generate your advice. Please try again or restart.");
      setCurrentStep('error');
      toast({ title: "Error", description: "Failed to generate advice.", variant: "destructive" });
    }
  };

  const onSubmit: SubmitHandler<AnswerFormData> = async (data) => {
    if (!currentQuestionText) return;

    const newHistoryItem: HistoryItem = { question: currentQuestionText, answer: data.answer };
    const updatedHistory = [...history, newHistoryItem];
    setHistory(updatedHistory);
    form.reset(); // Clear the form field

    if (updatedHistory.length >= TOTAL_QUESTIONS_TARGET) {
      fetchAdvice(updatedHistory);
    } else {
      fetchNextQuestion(updatedHistory);
    }
  };
  
  const handleRestartSession = () => {
    setCurrentStep('welcome');
    setCurrentQuestionText(null);
    setHistory([]);
    setAdviceText(null);
    setRiskAssessmentText(null);
    setErrorMessage(null);
    form.reset();
  };


  return (
    <Card className="w-full shadow-xl rounded-lg overflow-hidden bg-card">
      <CardHeader className="bg-muted/50 p-4 md:p-6 border-b">
        {currentStep !== 'welcome' && (
          <ProgressTracker 
            value={progressValue} 
            totalSteps={TOTAL_QUESTIONS_TARGET} 
            currentStepNumber={history.length + (currentStep === 'questioning' || (currentStep === 'loading' && currentQuestionText) ? 1 : 0)} 
          />
        )}
      </CardHeader>

      <CardContent className="p-6 md:p-8 min-h-[300px] flex flex-col justify-center">
        {currentStep === 'welcome' && (
          <div className="text-center">
            <MessageSquare className="w-16 h-16 mx-auto text-primary mb-4" />
            <h2 className="text-2xl font-semibold mb-2 text-card-foreground">Welcome to Your Counseling Session</h2>
            <p className="text-muted-foreground mb-6">
              This is a safe space to discuss HIV and related concerns. Your answers will help us provide personalized guidance.
            </p>
            <Button size="lg" onClick={handleStartSession} className="shadow-md">
              <PlayCircle className="mr-2 h-5 w-5" />
              Start Session
            </Button>
          </div>
        )}

        {currentStep === 'loading' && (
          <div className="flex flex-col items-center justify-center text-center">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <p className="text-lg text-muted-foreground">
              {currentQuestionText ? "Getting next question..." : adviceText === null ? "Preparing your session..." : "Generating your advice..."}
            </p>
          </div>
        )}
        
        {currentStep === 'error' && (
          <Alert variant="destructive" className="max-w-md mx-auto">
            <AlertTriangle className="h-5 w-5" />
            <AlertTitle>An Error Occurred</AlertTitle>
            <AlertDescription>{errorMessage || "Something went wrong. Please try again."}</AlertDescription>
            <Button onClick={handleRestartSession} variant="outline" className="mt-4">
              <RefreshCw className="mr-2 h-4 w-4" /> Restart Session
            </Button>
          </Alert>
        )}

        {currentStep === 'questioning' && currentQuestionText && (
          <div className="animate-fadeIn">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="answer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xl font-medium text-card-foreground mb-3 block text-center md:text-left">
                        {currentQuestionText}
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Type your answer here..."
                          className="min-h-[100px] text-base resize-none shadow-sm focus:ring-2 focus:ring-primary"
                          {...field}
                          aria-label="Your answer"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full md:w-auto shadow-md" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    "Submit Answer"
                  )}
                </Button>
              </form>
            </Form>
          </div>
        )}

        {currentStep === 'advice' && adviceText && riskAssessmentText && (
          <div className="animate-fadeIn space-y-6">
            <div className="text-center mb-6">
              <CheckCircle2 className="w-16 h-16 mx-auto text-accent mb-4" />
              <h2 className="text-2xl font-semibold text-card-foreground">Your Personalized Summary</h2>
              <p className="text-muted-foreground">Here's a summary based on our session.</p>
            </div>

            <Card className="bg-background/50 shadow-md">
              <CardHeader>
                <CardTitle className="text-xl text-primary">Risk Assessment</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-card-foreground whitespace-pre-wrap">{riskAssessmentText}</p>
              </CardContent>
            </Card>

            <Card className="bg-background/50 shadow-md">
              <CardHeader>
                <CardTitle className="text-xl text-accent">Personalized Advice</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-card-foreground whitespace-pre-wrap">{adviceText}</p>
              </CardContent>
            </Card>
             <Button onClick={handleRestartSession} variant="outline" className="w-full md:w-auto mt-6 shadow-md">
                <RefreshCw className="mr-2 h-4 w-4" /> Start New Session
            </Button>
          </div>
        )}
      </CardContent>
      {currentStep !== 'welcome' && currentStep !== 'loading' && (
         <CardFooter className="p-4 md:p-6 border-t bg-muted/50 flex justify-center">
          {currentStep !== 'advice' && currentStep !== 'error' && (
            <Button variant="ghost" size="sm" onClick={handleRestartSession} className="text-muted-foreground hover:text-destructive">
              Cancel Session
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}

// Basic fadeIn animation for tailwind.config.js if needed:
// keyframes: { fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } } },
// animation: { fadeIn: 'fadeIn 0.5s ease-in-out forwards' },
// Add to tailwind.config.ts:
// theme: { extend: { keyframes: { fadeIn: ... }, animation: { fadeIn: ... } } }
// For now, using a simple class 'animate-fadeIn' assuming it's defined or for future use.
// It's better to rely on Shadcn's animation capabilities or pure CSS for simplicity.
// Will remove explicit 'animate-fadeIn' if not standard with Shadcn/Tailwind.
// Shadcn components often have their own data-state based animations.
// Let's assume components naturally transition or fade slightly.
// For smooth transitions, could wrap sections in motion.div from framer-motion if installed.
// Keeping it simple for now.
