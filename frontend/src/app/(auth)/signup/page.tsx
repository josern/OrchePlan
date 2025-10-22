
'use client';

import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Leaf } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import SignUpForm from '@/components/auth/signup-form';
import { ComponentErrorBoundary } from '@/components/error-boundary';

export default function SignUpPage() {
  const loginImage = PlaceHolderImages.find(p => p.id === 'login-background');

  return (
    <div className="w-full h-screen grid grid-cols-1 lg:grid-cols-2">
      <div className="flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-sm">
            <div className="flex flex-col items-center text-center mb-8">
                <Link href="/login" className="flex items-center gap-2 mb-2">
                    <Leaf className="w-10 h-10 text-primary" />
                    <h1 className="text-3xl font-bold font-headline">CollectiveFlow</h1>
                </Link>
                <p className="text-muted-foreground">Create your account to start collaborating.</p>
            </div>
            <ComponentErrorBoundary>
                <SignUpForm />
            </ComponentErrorBoundary>
             <div className="mt-4 text-center text-sm">
                Already have an account?{" "}
                <Link href="/login" className="underline">
                    Sign in
                </Link>
            </div>
        </div>
      </div>
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
    </div>
  );
}
