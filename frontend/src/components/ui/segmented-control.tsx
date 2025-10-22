"use client";

import React from 'react';

type SegmentedControlProps = {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
};

export default function SegmentedControl({ value, onChange, options }: SegmentedControlProps) {
  return (
    <div role="tablist" aria-label="Card density" className="inline-flex rounded-md bg-muted p-1">
      {options.map((opt, idx) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={selected}
            aria-controls={`seg-${opt.value}`}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1 text-sm rounded-md focus:outline-none transition-colors duration-150 ${selected ? 'bg-white dark:bg-gray-700 text-black dark:text-white shadow-sm' : 'text-muted-foreground hover:bg-white/50 dark:hover:bg-white/5' } ${idx > 0 ? 'ml-1' : ''}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
