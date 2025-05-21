
"use client";

import { useState } from 'react';
import { KnowledgeQuizSession } from '@/components/quiz/KnowledgeQuizSession';
import { LandingPage } from '@/components/landing/LandingPage';

export default function HomePage() {
  const [currentView, setCurrentView] = useState<'landing' | 'quiz'>('landing');

  const handleStartQuiz = () => {
    setCurrentView('quiz');
  };

  const handleGoToHome = () => {
    setCurrentView('landing');
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-background text-foreground m-1 p-1 space-y-1">
      {/* Header element removed as per request */}

      <main className="w-full max-w-md mx-auto p-1">
        {currentView === 'landing' && <LandingPage onStartQuiz={handleStartQuiz} />}
        {currentView === 'quiz' && <KnowledgeQuizSession onGoToHome={handleGoToHome} />}
      </main>

      <footer className="w-full max-w-md mx-auto text-center text-sm text-muted-foreground p-1 space-y-1">
        <p>&copy; {new Date().getFullYear()} My Study Pad. All rights reserved.</p>
        <p className="mt-1">
          This tool is for educational and informational purposes.
        </p>
      </footer>
    </div>
  );
}
