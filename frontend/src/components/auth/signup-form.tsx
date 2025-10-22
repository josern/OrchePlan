
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
import { logger } from '@/lib/logger';


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
        
        // Extract error message from backend response
        const errAny = error as any;
        if (errAny?.body?.error) {
            description = errAny.body.error;
        } else if (errAny?.message) {
            description = errAny.message;
        }
        
        toast({
            variant: 'destructive',
            title: 'Sign Up Failed',
            description: description,
        });
        
        // Log signup errors appropriately - expected errors get debug level
        if (errAny?.isExpected || errAny?.status === 400 || errAny?.status === 409) {
            logger.debug('Signup form error - user input issue', {
                action: 'signup_form_submission',
                errorType: 'user_input_error',
                message: description
            });
        } else {
            logger.error('Signup form error - unexpected', {
                action: 'signup_form_submission',
                errorType: 'unexpected_error'
            }, error);
        }
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
