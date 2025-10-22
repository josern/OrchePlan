'use client';

import React from 'react';
import { SidebarProvider, Sidebar } from '@/components/ui/sidebar';
import ProjectSidebar from '@/components/dashboard/project-sidebar';
import MainHeader from '@/components/dashboard/main-header';
import { useApp } from '@/context/app-context';
import { PageErrorBoundary, ComponentErrorBoundary } from '@/components/error-boundary';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isSidebarOpenByDefault } = useApp();
  
  return (
    <SidebarProvider key={String(isSidebarOpenByDefault)} defaultOpen={isSidebarOpenByDefault}>
      <div className="flex h-screen w-full">
        <ComponentErrorBoundary>
          <Sidebar>
            <ProjectSidebar />
          </Sidebar>
        </ComponentErrorBoundary>
        <div className="flex flex-1 flex-col overflow-hidden">
          <ComponentErrorBoundary>
            <MainHeader />
          </ComponentErrorBoundary>
          <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background p-4 md:p-6">
            <PageErrorBoundary>
              {children}
            </PageErrorBoundary>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
