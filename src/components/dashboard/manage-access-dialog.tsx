'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/context/app-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '../ui/skeleton';
import type { Project, User, ProjectRole } from '@/lib/types';
import { ScrollArea } from '../ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { ChevronsUpDown } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';

type ManageAccessDialogProps = {
    children?: React.ReactNode;
    projectId: string;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
};

type MemberWithRole = {
    user: User;
    role: ProjectRole;
}

export default function ManageAccessDialog({ children, projectId, open: controlledOpen, onOpenChange: setControlledOpen }: ManageAccessDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const { users, getProject, updateProject, findUserByEmail, currentUser } = useApp();
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<MemberWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isComboboxOpen, setComboboxOpen] = useState(false);

  const { toast } = useToast();

  const open = controlledOpen ?? internalOpen;
  const setOpen = setControlledOpen ?? setInternalOpen;

  useEffect(() => {
    if (open) {
      const fetchProjectData = async () => {
        setLoading(true);
        const fetchedProject = await getProject(projectId);
        if (fetchedProject) {
            setProject(fetchedProject);
            const projectMembers = Object.entries(fetchedProject.members).map(([userId, role]) => {
                const user = users.find(u => u.id === userId);
                return user ? { user, role } : null;
            }).filter((m): m is MemberWithRole => m !== null);
            setMembers(projectMembers);
        }
        setLoading(false);
      };
      fetchProjectData();
    } else {
        setSelectedUser(null);
    }
  }, [projectId, open, getProject, users]);

  const projectOwner = members.find(m => m.role === 'owner');
  const isOwner = projectOwner?.user.id === currentUser?.id;

  const handleAddMember = async () => {
    if (!selectedUser || !isOwner) return;

    if (members.some(m => m.user.id === selectedUser.id)) {
        toast({
            variant: 'destructive',
            title: 'User already a member',
            description: 'This user is already part of the project.',
        });
        return;
    }
    
    const userToAdd = await findUserByEmail(selectedUser.email);
    
    if (userToAdd) {
        setMembers(prev => [...prev, { user: userToAdd, role: 'viewer' }]);
        setSelectedUser(null);
    } else {
        toast({
            variant: 'destructive',
            title: 'User not found',
            description: `No user with the email "${selectedUser.email}" found.`
        });
    }
  };

  const handleRemoveMember = (userId: string) => {
    if (userId === projectOwner?.user.id || !isOwner) return;
    setMembers(prev => prev.filter(m => m.user.id !== userId));
  };
    
  const handleRoleChange = (userId: string, role: ProjectRole) => {
    if (!isOwner) return;
    setMembers(prev => prev.map(m => m.user.id === userId ? { ...m, role } : m));
  };

  const handleSaveChanges = async () => {
    if (project && isOwner) {
      const newMembers = members.reduce((acc, member) => {
          acc[member.user.id] = member.role;
          return acc;
      }, {} as Record<string, ProjectRole>);

      await updateProject(project.id, { members: newMembers });
      setOpen(false);
      toast({
        title: 'Access Updated',
        description: `Member list for "${project.name}" has been saved.`,
      });
    }
  };

  const availableUsers = users.filter(u => !members.some(m => m.user.id === u.id));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
        {children && <DialogTrigger asChild>{children}</DialogTrigger>}
        <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Access for "{project?.name || 'Project'}"</DialogTitle>
          <DialogDescription>
            {isOwner ? "Add, remove, and manage roles for project members." : "View members of this project."}
          </DialogDescription>
        </DialogHeader>
        
        {isOwner && (
            <div className="flex gap-2 mt-4">
                <Popover open={isComboboxOpen} onOpenChange={setComboboxOpen}>
                    <div className="relative w-full">
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={isComboboxOpen}
                                className="w-full justify-between font-normal"
                                onClick={() => setComboboxOpen(prev => !prev)}
                            >
                                <span className="truncate">{selectedUser?.name || 'user@example.com'}</span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                    </div>
                    <PopoverContent className="p-0 w-[330px]">
                        <Command>
                            <CommandInput placeholder="Search by name or email..." />
                            <CommandEmpty>No users found.</CommandEmpty>
                            <CommandGroup>
                                {availableUsers.map(user => (
                                    <CommandItem
                                        key={user.id}
                                        value={`${user.name} ${user.email}`}
                                        onSelect={() => {
                                            if (selectedUser?.id === user.id) {
                                                setSelectedUser(null);
                                            } else {
                                                setSelectedUser(user);
                                            }
                                            setComboboxOpen(false);
                                        }}
                                    >
                                        {user.name} <span className="text-xs text-muted-foreground ml-2">({user.email})</span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </Command>
                    </PopoverContent>
                </Popover>
                <Button onClick={handleAddMember}>Add</Button>
            </div>
        )}

        <h3 className="text-sm font-medium mt-4 mb-2">Project Members</h3>
        <ScrollArea className="max-h-[240px] pr-3">
            <div className="space-y-3">
            {loading ? (
                Array.from({length: 3}).map((_, i) => <UserSkeleton key={i}/>)
            ) : (
                members.map(({ user, role }) => (
                <div key={user.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                            <AvatarImage src={user.avatarUrl} alt={user.name} />
                            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                    </div>
                    {isOwner ? (
                        role === 'owner' ? (
                            <p className="text-xs text-muted-foreground pr-2">Owner</p>
                        ) : (
                            <Select value={role} onValueChange={(newRole) => {
                                if (newRole === 'remove') {
                                    handleRemoveMember(user.id);
                                } else {
                                    handleRoleChange(user.id, newRole as ProjectRole);
                                }
                            }}>
                                <SelectTrigger className="w-[110px]">
                                    <SelectValue placeholder="Role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="editor">Editor</SelectItem>
                                    <SelectItem value="viewer">Viewer</SelectItem>
                                    <SelectItem value="remove">Remove</SelectItem>
                                </SelectContent>
                            </Select>
                        )
                    ) : (
                         <p className="text-xs text-muted-foreground pr-2 capitalize">{role}</p>
                    )}
                </div>
                ))
            )}
            </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          {isOwner && <Button onClick={handleSaveChanges}>Save Changes</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserSkeleton() {
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="space-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                </div>
            </div>
            <Skeleton className="h-8 w-24" />
        </div>
    )
}
