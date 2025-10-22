'use client';

import { UserNav } from './user-nav';
import { Button } from '../ui/button';
import { Plus, Eye, EyeOff } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useApp } from '@/context/app-context';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import type { Project } from '@/lib/types';
import dynamic from 'next/dynamic';
import { findProjectById } from '@/lib/projects';
import MainPageSidebarTrigger from './main-page-sidebar-trigger';

const AddTaskDialog = dynamic(() => import('./add-task-dialog'), { ssr: false });

const MainHeader = React.memo(function MainHeader() {
  const pathname = usePathname();
  const { projects, currentUser, isKanbanHeaderVisible, toggleKanbanHeader } = useApp();
  const [title, setTitle] = useState('Today\'s Focus');
  const [currentProjectId, setCurrentProjectId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!pathname) {
      setTitle('Today\'s Focus');
      setCurrentProjectId(undefined);
      return;
    }
    if (pathname === '/dashboard') {
        setTitle('Today\'s Focus');
        setCurrentProjectId(undefined);
    } else if (pathname.startsWith('/project/')) {
        const projectId = pathname.split('/')[2];
        const project = findProjectById(projects, projectId);
        if (project) {
            setTitle(project.name);
            setCurrentProjectId(project.id);
        } else {
            setTitle('Project');
            setCurrentProjectId(undefined);
        }
    } else if (pathname === '/settings') {
        setTitle('Settings');
        setCurrentProjectId(undefined);
    } else {
      setCurrentProjectId(undefined);
    }
  }, [pathname, projects]);

  const canEditProject = useMemo(() => {
    if (!currentProjectId) return true; // Always show on dashboard
    const project = findProjectById(projects, currentProjectId);
    if (!project || !currentUser) return false;
    if (!project.members) return false; // Add a check for members
    const userRole = project.members[currentUser.id];
    return userRole === 'owner' || userRole === 'editor';
  }, [currentProjectId, projects, currentUser]);


  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6 flex-shrink-0">
      <MainPageSidebarTrigger />
      <h1 className="text-lg font-semibold md:text-xl font-headline">{title}</h1>
      <div className="ml-auto flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={toggleKanbanHeader}>
          {isKanbanHeaderVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        {canEditProject && (
            <AddTaskDialog defaultProjectId={currentProjectId}>
                <Button>
                    <Plus className="mr-2 h-4 w-4"/>
                    Add Task
                </Button>
            </AddTaskDialog>
        )}
        <div className="hidden md:block">
            <UserNav />
        </div>
      </div>
    </header>
  );
});

export default MainHeader;
