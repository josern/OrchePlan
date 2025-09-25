
'use client';

import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useApp } from '@/context/app-context';
import { useToast } from '@/hooks/use-toast';
import { FirebaseError } from 'firebase/app';


const formSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

export default function SignUpForm() {
  const router = useRouter();
  const { createUser } = useApp();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
        await createUser({
            name: values.name,
            email: values.email,
            avatarUrl: `https://i.pravatar.cc/150?u=${values.email}`
        }, values.password);
        
        toast({
            title: 'Account Created!',
            description: 'Welcome to CollectiveFlow.',
        });
        router.push('/dashboard');
    } catch (error) {
        let description = 'There was a problem creating your account.';
        if (error instanceof FirebaseError) {
          if (error.code === 'auth/operation-not-allowed') {
            description = 'Email/Password sign-in is not enabled. Please enable it in your Firebase console under Authentication > Sign-in method.';
          } else if (error.code === 'auth/email-already-in-use') {
            description = 'This email address is already in use. Please use a different email or sign in.';
          }
        }
        
        toast({
            variant: 'destructive',
            title: 'Uh oh! Something went wrong.',
            description: description,
        });
        console.error('Sign up error:', error);
    }
  }

  return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Your Name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
            Create Account
          </Button>
        </form>
      </Form>
  );
}
