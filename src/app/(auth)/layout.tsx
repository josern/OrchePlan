
'use client';

import React from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="w-full min-h-screen">
        {children}
    </main>
  );
}
