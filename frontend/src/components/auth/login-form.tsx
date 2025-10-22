
'use client';

import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { Leaf } from 'lucide-react';
import Link from 'next/link';
import { useApp } from '@/context/app-context';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

export function LoginForm() {
  const router = useRouter();
  const { login } = useApp();
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const result = await login(values.email, values.password);
    if (result.success) {
      router.push('/dashboard');
    } else {
        toast({
            variant: 'destructive',
            title: 'Login Failed',
            description: result.error || 'Invalid email or password.',
        });
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="flex flex-col items-center text-center mb-8 lg:hidden">
        <Leaf className="w-10 h-10 text-primary mb-2" />
        <h1 className="text-3xl font-bold font-headline">CollectiveFlow</h1>
        <p className="text-muted-foreground">Welcome back! Please sign in to continue.</p>
      </div>
      <div className="text-left mb-6 hidden lg:block">
        <h2 className="text-2xl font-bold">Sign In</h2>
        <p className="text-muted-foreground">Enter your credentials to access your account.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="name@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full font-bold" disabled={form.formState.isSubmitting}>
            Sign In
          </Button>
        </form>
      </Form>
      
      <div className="mt-4 text-center text-sm">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="underline">
              Sign up
          </Link>
      </div>

      <div className="relative my-6">
        <Separator />
        <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-background px-2 text-sm text-muted-foreground">OR</span>
      </div>
      
      <div className="space-y-2">
        <Button variant="outline" className="w-full">
           <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 126 23.4 172.9 61.9l-76.2 64.5C307.4 99.4 280.7 86 248 86c-84.3 0-152.3 67.8-152.3 151.4s68 151.4 152.3 151.4c99.9 0 127.9-81.5 133.7-120.9H248v-85.3h236.1c2.3 12.7 3.9 26.9 3.9 41.4z"></path></svg>
          Sign in with Google
        </Button>
      </div>
    </div>
  );
}
