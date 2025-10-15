'use client';

import { useApp } from '@/context/app-context';
import { Folder, ChevronDown, ChevronRight, Settings, Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import { cn, truncate } from '@/lib/utils';
import type { Project } from '@/lib/types';
import dynamic from 'next/dynamic';
import { useSidebar } from '@/components/ui/sidebar';

const AddProjectDialog = dynamic(() => import('./add-project-dialog'), { ssr: false });

interface ProjectListItemProps {
  project: Project;
}

export function ProjectListItem({ project }: ProjectListItemProps) {
  const { currentUser, isSidebarOpenByDefault } = useApp();
  const { isMobile, setOpen, setOpenMobile } = useSidebar();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(true);
  const isActive = pathname === `/project/${project.id}`;
  const isSettingsActive = pathname === `/project/${project.id}/settings`;

  const canEdit = useMemo(() => {
    if (!project || !currentUser || !project.members) return false;
    const userRole = project.members[currentUser.id];
    return userRole === 'owner' || userRole === 'editor';
  }, [project, currentUser]);

  const hasSubProjects = project.subProjects && project.subProjects.length > 0;

  const handleClick = () => {
    if (isMobile) {
        setOpenMobile(false);
    } else if (!isSidebarOpenByDefault) {
        setOpen(false);
    }
  };

  return (
    <div>
      <div className={cn(
          'flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors',
          isActive ? 'bg-primary/10 text-primary' : isSettingsActive ? 'bg-muted/50' : 'hover:bg-muted/50',
          'group'
      )}>
        <Link onClick={handleClick} href={`/project/${project.id}`} className="flex items-center gap-2 flex-grow">
          {hasSubProjects && (
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(!isOpen); }} className="p-0.5 rounded-sm hover:bg-muted">
                {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          )}
          <Folder size={16} className={cn(!hasSubProjects && 'ml-[22px]')} />
          <span className="flex-grow">{truncate(project.name, 16)}</span>
        </Link>
        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
            {canEdit && (
                <AddProjectDialog parentProjectId={project.id}>
                    <button className="p-1 hover:bg-muted rounded-md"><Plus size={14} /></button>
                </AddProjectDialog>
            )}
            <Link href={`/project/${project.id}/settings`} passHref>
                <button className={cn("p-1 hover:bg-muted rounded-md", isSettingsActive && "bg-primary/10 text-primary")}><Settings size={14} /></button>
            </Link>
        </div>
      </div>
      {isOpen && hasSubProjects && (
        <div className="ml-6 pl-2 border-l border-dashed">
          {project.subProjects!.map(subProject => (
            <ProjectListItem key={subProject.id} project={subProject} />
          ))}
        </div>
      )}
    </div>
  );
}
