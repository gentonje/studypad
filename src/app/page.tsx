import { CounsellingSession } from '@/components/counselling/CounsellingSession';

// Simple CA (CounsellorAI) SVG Logo
const CounsellorAiLogo = () => (
  <svg
    width="48" // Increased size for better visibility
    height="48"
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="text-primary" // Use Tailwind class for color
    aria-label="CounsellorAI Logo"
  >
    <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="8" />
    <text 
      x="50%" 
      y="50%" 
      dominantBaseline="central" // Corrected from middle for SVG 1.1+
      textAnchor="middle" 
      fontSize="38" // Adjusted for better fit
      fontWeight="bold" 
      fill="currentColor"
      fontFamily="var(--font-geist-sans), Arial, sans-serif" // Ensure consistent font
    >
      CA
    </text>
  </svg>
);


export default function HomePage() {
  return (
    <div className="flex flex-col items-center min-h-screen bg-background text-foreground p-4 md:p-8">
      <header className="w-full max-w-3xl mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-3"> {/* Increased gap */}
          <CounsellorAiLogo />
          <h1 className="text-3xl md:text-4xl font-bold text-primary">CounsellorAI</h1>
        </div>
        <p className="text-md md:text-lg text-muted-foreground">
          Your compassionate AI guide through HIV counseling.
        </p>
      </header>
      <main className="w-full max-w-3xl p-1"> {/* Added small padding to main */}
        <CounsellingSession />
      </main>
      <footer className="w-full max-w-3xl mt-12 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} CounsellorAI. All rights reserved.</p>
        <p className="mt-1">
          This tool is for informational purposes and does not replace professional medical advice.
        </p>
      </footer>
    </div>
  );
}
