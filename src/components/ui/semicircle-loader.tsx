
"use client";

import { cn } from "@/lib/utils";

interface SemicircleLoaderProps {
  className?: string;
  size?: number; // size in pixels
  strokeWidth?: number;
}

export function SemicircleLoader({
  className,
  size = 48, // Default size 48px
  strokeWidth = 5, // Default stroke width 5px
}: SemicircleLoaderProps) {
  const radius = (size - strokeWidth) / 2;
  // For a semicircle, the dash should be half the circumference.
  // The gap is the other half.
  const circumference = 2 * Math.PI * radius;
  const dash = circumference / 2;

  return (
    <div
      className={cn("flex items-center justify-center w-full h-full py-10", className)}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <svg
        className="animate-spin text-primary" // Tailwind's spin animation and primary color
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background circle (optional, for a track appearance) */}
        {/* <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          opacity="0.25"
        /> */}
        {/* Foreground arc/semicircle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="round"
          // Optional: Rotate the starting point of the arc if needed
          // transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
    </div>
  );
}
