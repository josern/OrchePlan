

import React from 'react';
import { SidebarProvider, Sidebar } from '@/components/ui/sidebar';
import ProjectSidebar from '@/components/dashboard/project-sidebar';
import MainHeader from '@/components/dashboard/main-header';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex h-screen w-full">
          <Sidebar>
            <ProjectSidebar />
          </Sidebar>
          <div className="flex flex-1 flex-col overflow-hidden">
              <MainHeader />
              <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background p-4 md:p-6">
                  {children}
              </main>
          </div>
      </div>
    </SidebarProvider>
  );
}
