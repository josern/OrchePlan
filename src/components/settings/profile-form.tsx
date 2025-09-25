
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useApp } from '@/context/app-context';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';

const profileFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Please enter a valid email.'),
  avatarUrl: z.string().url('Please enter a valid URL.').optional().or(z.literal('')),
});

export default function ProfileForm() {
  const { currentUser, loading, updateUser } = useApp();
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    values: {
        name: currentUser?.name ?? '',
        email: currentUser?.email ?? '',
        avatarUrl: currentUser?.avatarUrl ?? '',
    },
    disabled: loading || !currentUser,
  });

  const onSubmit = async (values: z.infer<typeof profileFormSchema>) => {
    if (!currentUser) return;
    try {
        await updateUser(currentUser.id, values);
        toast({
            title: 'Profile Updated',
            description: 'Your profile information has been successfully updated.',
        });
    } catch(e) {
        toast({
            variant: 'destructive',
            title: 'Uh oh! Something went wrong.',
            description: 'There was a problem with your request.',
        });
    }
  };

  if (loading || !currentUser) {
    return (
       <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>This is how others will see you on the site. You can update your information here.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
                <div className="flex items-center space-x-4">
                    <Skeleton className="h-16 w-16 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                </div>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            <Button disabled>Save Changes</Button>
          </CardFooter>
        </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>This is how others will see you on the site. You can update your information here.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
                <Avatar className="h-16 w-16">
                    <AvatarImage src={form.watch('avatarUrl') || currentUser.avatarUrl} alt={currentUser.name} />
                    <AvatarFallback>{currentUser.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <FormField
                control={form.control}
                name="avatarUrl"
                render={({ field }) => (
                    <FormItem className="flex-grow">
                    <FormLabel>Avatar URL</FormLabel>
                    <FormControl>
                        <Input placeholder="https://example.com/image.png" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
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
                    <Input placeholder="your@email.com" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
              Save Changes
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
