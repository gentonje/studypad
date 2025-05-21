"use client";

import { type ChangeEvent } from 'react';
import { type UseFormReturn, type SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { EducationLevels, SupportedLanguages, type EducationLevel, type SupportedLanguage } from '@/ai/flows/types';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Loader2, BookOpen, FileQuestion, Home, XCircle } from 'lucide-react';

// Schema needs to be accessible by this component or passed in some way if it varies.
// For now, let's redefine it here or ensure it's imported if static.
export const configFormSchema = z.object({
  topic: z.string().min(3, { message: "Topic must be at least 3 characters." }).max(100, {message: "Topic is too long."}),
  educationLevel: EducationLevels,
  language: SupportedLanguages.default("English"),
});
export type ConfigFormData = z.infer<typeof configFormSchema>;

interface QuizConfigFormProps {
  configForm: UseFormReturn<ConfigFormData>;
  handleConfigSubmit: SubmitHandler<ConfigFormData>;
  isLoading: boolean;
  isEvaluating: boolean; // Added to match disabled logic
  isGeneratingImage: boolean; // Added to match disabled logic
  isFetchingAudio: boolean; // Added to match disabled logic
  pdfFile: File | null;
  setPdfFile: (file: File | null) => void;
  handleClearPdf: () => void;
  onGoToHome?: () => void;
}

export function QuizConfigForm({
  configForm,
  handleConfigSubmit,
  isLoading,
  isEvaluating,
  isGeneratingImage,
  isFetchingAudio,
  pdfFile,
  setPdfFile,
  handleClearPdf,
  onGoToHome,
}: QuizConfigFormProps) {
  return (
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
                    onValueChange={(value) => field.onChange(value as EducationLevel)}
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
              )}
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
  );
} 