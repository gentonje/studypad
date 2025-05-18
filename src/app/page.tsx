
"use client";

import { useState } from 'react';
import { KnowledgeQuizSession } from '@/components/quiz/KnowledgeQuizSession';
import { LandingPage } from '@/components/landing/LandingPage';

// SC Logo
const StudentCompanionLogo = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="text-primary"
    aria-label="Student Companion Logo"
  >
    <rect x="10" y="10" width="80" height="80" rx="10" stroke="currentColor" strokeWidth="8" />
    <text
      x="50%"
      y="50%"
      dominantBaseline="central"
      textAnchor="middle"
      fontSize="42"
      fontWeight="bold"
      fill="currentColor"
      fontFamily="var(--font-geist-sans), Arial, sans-serif"
    >
      SC
    </text>
  </svg>
);

export default function HomePage() {
  const [currentView, setCurrentView] = useState<'landing' | 'quiz'>('landing');

  const handleStartQuiz = () => {
    setCurrentView('quiz');
  };

  const handleGoToHome = () => {
    setCurrentView('landing');
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-background text-foreground p-2 md:p-4 space-y-4">
      <header className="w-full max-w-xl mx-auto text-center space-y-2">
        <div className="flex items-center justify-center space-x-2 mb-2">
          <StudentCompanionLogo />
          <h1 className="text-3xl md:text-4xl font-bold text-primary">Student Companion</h1>
        </div>
        {currentView === 'landing' && (
          <p className="text-md md:text-lg text-muted-foreground">
            Your AI-powered partner for learning and knowledge discovery.
          </p>
        )}
      </header>

      <main className="w-full max-w-xl mx-auto p-1">
        {currentView === 'landing' && <LandingPage onStartQuiz={handleStartQuiz} />}
        {currentView === 'quiz' && <KnowledgeQuizSession onGoToHome={handleGoToHome} />}
      </main>

      <footer className="w-full max-w-xl mx-auto text-center text-sm text-muted-foreground p-2 space-y-1">
        <p>&copy; {new Date().getFullYear()} Student Companion. All rights reserved.</p>
        <p className="mt-1">
          This tool is for educational and informational purposes.
        </p>
      </footer>
    </div>
  );
}
