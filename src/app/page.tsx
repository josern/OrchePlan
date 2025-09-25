'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/app-context';
import { Loader2 } from 'lucide-react';

export default function RootPage() {
  const { currentUser, loading } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (currentUser) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [currentUser, loading, router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}
