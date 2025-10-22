'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { useApp } from '@/context/app-context';
import { findProjectById } from '@/lib/projects';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Copy, ArrowLeft, Edit } from 'lucide-react';
import ManageAccess from '@/components/dashboard/manage-access';
import ProjectManageStatuses from '@/components/settings/project-manage-statuses';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { ComponentErrorBoundary } from '@/components/error-boundary';

export default function ProjectSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  if (!params || !params.projectId) return <div>Project not found</div>;
  const { projectId } = params;
  const { projects, currentUser, deleteProject, duplicateProject, updateProject } = useApp();
  const { toast } = useToast();

  const project = findProjectById(projects, projectId as string);
  
  const [projectName, setProjectName] = useState('');

  useEffect(() => {
    if (project) {
      setProjectName(project.name);
    }
  }, [project]);

  const canEdit = useMemo(() => {
    if (!project || !currentUser || !project.members) return false;
    const userRole = project.members[currentUser.id];
    return userRole === 'owner' || userRole === 'editor';
  }, [project, currentUser]);

  const isOwner = useMemo(() => {
    if (!project || !currentUser || !project.members) return false;
    const userRole = project.members[currentUser.id];
    return userRole === 'owner';
  }, [project, currentUser]);

  const handleDelete = () => {
    if (project) {
        deleteProject(project.id, (pathname || '/') as string);
    }
  };

  const handleDuplicate = () => {
    if (project) {
      duplicateProject(project.id);
      toast({ title: 'Project duplicated', description: `A copy of "${project.name}" has been created.` });
    }
  };

  const handleNameChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (project && projectName && projectName !== project.name) {
      try {
        await updateProject(project.id, { name: projectName });
        toast({ title: 'Project name updated', description: `The project name has been changed to "${projectName}".` });
      } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not update the project name.' });
      }
    }
  };

  if (!project) {
    return <div>Project not found</div>;
  }

  return (
    <div className="space-y-6">
       <div className="flex items-center gap-4">
        <Link href={`/project/${projectId}`} passHref>
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold font-headline">Project Settings</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit Project Name</CardTitle>
          <CardDescription>Change the name of your project.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleNameChange} className="flex gap-2">
            <Input 
              value={projectName} 
              onChange={(e) => setProjectName(e.target.value)} 
              disabled={!canEdit}
              className="max-w-xs"
            />
            <Button type="submit" disabled={!canEdit || projectName === project.name}>
              <Edit className="mr-2 h-4 w-4" /> Save
            </Button>
          </form>
          {!canEdit && <p className="text-sm text-muted-foreground mt-2">Only project owners and editors can change the name.</p>}
        </CardContent>
      </Card>

      {isOwner && (
        <ComponentErrorBoundary>
          <ProjectManageStatuses />
        </ComponentErrorBoundary>
      )}

      <ComponentErrorBoundary>
        <Card>
          <CardHeader>
            <CardTitle>Manage Access</CardTitle>
            <CardDescription>
              Add, remove, and manage roles for project members.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ManageAccess projectId={project.id} />
          </CardContent>
        </Card>
      </ComponentErrorBoundary>

      <Card>
        <CardHeader>
          <CardTitle>Project Actions</CardTitle>
          <CardDescription>
            Other actions you can perform on this project.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold">Duplicate Project</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Create a copy of this project, including its tasks.
            </p>
            <Button variant="outline" onClick={handleDuplicate} disabled={!canEdit}>
              <Copy className="mr-2 h-4 w-4" />
              Duplicate Project
            </Button>
            {!canEdit && <p className="text-sm text-muted-foreground mt-2">Only project owners and editors can duplicate projects.</p>}
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle>Danger Zone</CardTitle>
          <CardDescription>
            These actions are irreversible. Please proceed with caution.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={!isOwner}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete Project
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the
                  project and all its tasks.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>
                  Continue
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {!isOwner && <p className="text-sm text-muted-foreground mt-2">Only project owners can delete projects.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
