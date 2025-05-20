
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Lightbulb, Languages, PlayCircle } from "lucide-react";

interface LandingPageProps {
  onStartQuiz: () => void;
}

export function LandingPage({ onStartQuiz }: LandingPageProps) {
  return (
    <div className="animate-fade-in space-y-6 p-2">
      {/* Section to be removed was here */}
      <div className="grid grid-cols-1 md:grid-cols-1 gap-4 max-w-md mx-auto">
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader className="pb-2">
            <div className="flex items-center space-x-3">
              <Brain className="w-8 h-8 text-primary" />
              <CardTitle className="text-xl">Start a New Quiz</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-4">
              Test your knowledge on any topic, at any education level, and in your preferred language.
            </CardDescription>
            <Button onClick={onStartQuiz} className="w-full" size="lg">
              <PlayCircle className="mr-2 h-5 w-5" />
              Begin Quiz
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-lg opacity-70">
          <CardHeader className="pb-2">
            <div className="flex items-center space-x-3">
              <Lightbulb className="w-8 h-8 text-accent" />
              <CardTitle className="text-xl">Explore Topics & Concepts</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Dive deeper into various subjects, discover new areas of interest, and expand your understanding.
              <span className="block mt-2 text-xs font-semibold text-blue-500">(Coming Soon!)</span>
            </CardDescription>
             {/* <Button className="w-full mt-4" disabled>Explore (Coming Soon)</Button> */}
          </CardContent>
        </Card>

        <Card className="shadow-lg opacity-70">
          <CardHeader className="pb-2">
            <div className="flex items-center space-x-3">
              <Languages className="w-8 h-8 text-orange-500" />
              <CardTitle className="text-xl">Multilingual Learning</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Engage with quiz content in multiple languages. Select your preferred language in the quiz setup.
            </CardDescription>
            {/* <Button className="w-full mt-4" disabled>Language Options</Button> */}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
