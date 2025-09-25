'use client';

import { ProjectList } from './project-list';
import { Button } from '@/components/ui/button';
import { Plus, Calendar } from 'lucide-react';
import dynamic from 'next/dynamic';
import UserAccount from './user-account';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { SidebarHeader, SidebarTrigger } from '@/components/ui/sidebar';
import { Logo } from '@/components/logo';

const AddProjectDialog = dynamic(() => import('./add-project-dialog'), { ssr: false });

export default function ProjectSidebar() {
    const pathname = usePathname();
    const isTodayActive = pathname === '/';

    return (
        <div className="h-full flex flex-col">
            <SidebarHeader className="p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Logo className="h-6 w-6" />
                        <h1 className="text-lg font-semibold font-headline">OrchePlan</h1>
                    </div>
                    <SidebarTrigger />
                </div>
            </SidebarHeader>
            <Separator />
            <div className="p-4">
                <Link href="/" className={cn(
                    "flex items-center gap-2 rounded-md p-2 transition-colors text-sm font-medium",
                    isTodayActive 
                        ? "bg-primary/10 text-primary" 
                        : "hover:bg-muted/50"
                )}>
                    <Calendar size={16} />
                    <span>Today</span>
                </Link>
            </div>
            <Separator />
            <div className="p-4">
                <h2 className="text-lg font-semibold">Projects</h2>
            </div>
            <div className="flex-grow overflow-auto px-4">
                <ProjectList />
            </div>
            <div className="p-4 mt-auto space-y-4">
                <AddProjectDialog>
                    <Button className="w-full">
                        <Plus className="mr-2 h-4 w-4" />
                        New Project
                    </Button>
                </AddProjectDialog>
                <UserAccount />
            </div>
        </div>
    );
}
