import React from 'react';
import { useApp } from '@/context/app-context';
import { ProjectListItem } from './project-list-item';
import { Skeleton } from '../ui/skeleton';
import { ComponentErrorBoundary } from '../error-boundary';

export const ProjectList = React.memo(function ProjectList() {
  const { projects, loading } = useApp();

  if (loading) {
    return <ProjectListSkeleton />;
  }

  return (
    <div className="space-y-1">
      {projects.map((project) => (
        <ComponentErrorBoundary key={project.id}>
          <ProjectListItem project={project} />
        </ComponentErrorBoundary>
      ))}
    </div>
  );
});

function ProjectListSkeleton() {
    return (
        <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 p-1.5">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-5 flex-grow" />
                </div>
            ))}
        </div>
    )
}
