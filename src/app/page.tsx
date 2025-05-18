
import { KnowledgeQuizSession } from '@/components/quiz/KnowledgeQuizSession';
import { BookOpenText } from 'lucide-react';

// Simple KQ (Knowledge Quiz AI) SVG Logo
const KnowledgeQuizAiLogo = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="text-primary"
    aria-label="Knowledge Quiz AI Logo"
  >
    <rect x="10" y="10" width="80" height="80" rx="10" stroke="currentColor" strokeWidth="8" />
    <text
      x="50%"
      y="50%"
      dominantBaseline="central"
      textAnchor="middle"
      fontSize="38"
      fontWeight="bold"
      fill="currentColor"
      fontFamily="var(--font-geist-sans), Arial, sans-serif"
    >
      KQ
    </text>
  </svg>
);


export default function HomePage() {
  return (
    <div className="flex flex-col items-center min-h-screen bg-background text-foreground m-1 p-1 space-y-1">
      <header className="w-full max-w-md mx-auto text-center p-1 space-y-1">
        <div className="flex items-center justify-center space-x-1 mb-1">
          <KnowledgeQuizAiLogo />
          <h1 className="text-3xl md:text-4xl font-bold text-primary">Knowledge Quiz AI</h1>
        </div>
        <p className="text-md md:text-lg text-muted-foreground">
          Test your knowledge on any topic, at any level.
        </p>
      </header>
      <main className="w-full max-w-md mx-auto p-1">
        <KnowledgeQuizSession />
      </main>
      <footer className="w-full max-w-md mx-auto text-center text-sm text-muted-foreground p-1 space-y-1">
        <p>&copy; {new Date().getFullYear()} Knowledge Quiz AI. All rights reserved.</p>
        <p className="mt-1">
          This tool is for educational and informational purposes.
        </p>
      </footer>
    </div>
  );
}
