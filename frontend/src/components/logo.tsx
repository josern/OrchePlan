
import React from 'react';

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
        <defs>
            <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#A8B47D" />
                <stop offset="100%" stopColor="#B2BEB5" />
            </linearGradient>
        </defs>
        <path
            d="M8 4H16C18.2091 4 20 5.79086 20 8V16C20 18.2091 18.2091 20 16 20H8C5.79086 20 4 18.2091 4 16V8C4 5.79086 5.79086 4 8 4Z"
            fill="url(#logo-gradient)"
        />
        <path
            d="M8 10C10.5 8.5 13.5 8.5 16 10"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
        />
        <path
            d="M8 14C10.5 12.5 13.5 12.5 16 14"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
        />
    </svg>
  );
}
