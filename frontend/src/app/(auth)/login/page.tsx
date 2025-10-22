
'use client';

import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Leaf } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { ComponentErrorBoundary } from '@/components/error-boundary';

const LoginForm = dynamic(() => import('@/components/auth/login-form').then(mod => mod.LoginForm), { 
    ssr: false,
    loading: () => (
        <div className="w-full max-w-sm space-y-4">
            <div className="space-y-2 text-left">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
            </div>
            <div className="space-y-2">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-10 w-full" />
            </div>
             <div className="space-y-2">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-10 w-full" />
        </div>
    )
});

export default function LoginPage() {
  const loginImage = PlaceHolderImages.find(p => p.id === 'login-background');

  return (
    <div className="w-full h-screen grid grid-cols-1 lg:grid-cols-2">
      <div className="relative hidden lg:block">
        {loginImage && (
          <Image
            src={loginImage.url}
            alt={loginImage.alt}
            fill
            sizes="(max-width: 1024px) 0, 50vw"
            className="object-cover"
            priority
          />
        )}
        <div className="relative z-10 flex flex-col justify-between h-full p-8 bg-black/20">
            <div className="flex items-center gap-2 text-primary-foreground/80">
                <Leaf className="w-8 h-8 text-primary-foreground/80" />
                <h1 className="text-2xl font-bold font-headline">CollectiveFlow</h1>
            </div>
            <blockquote className="text-primary-foreground/80">
                <p className="text-lg">\"The key is not to prioritize what's on your schedule, but to schedule your priorities.\"</p>
                <footer className="mt-2 text-sm">- Stephen Covey</footer>
            </blockquote>
        </div>
      </div>
      <div className="flex items-center justify-center p-8 bg-background">
        <ComponentErrorBoundary>
          <LoginForm />
        </ComponentErrorBoundary>
      </div>
    </div>
  );
}
