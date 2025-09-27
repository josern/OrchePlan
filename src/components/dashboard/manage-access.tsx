'use client';

import { useState, useMemo } from 'react';
import { useApp } from '@/context/app-context';
import { findProjectById } from '@/lib/projects';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, ProjectRole } from '@/lib/types';
import { ChevronsUpDown, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ManageAccessProps {
  projectId: string;
}

export default function ManageAccess({ projectId }: ManageAccessProps) {
  const { projects, users, currentUser, updateProject, findUserByEmail } = useApp();
  const { toast } = useToast();

  const project = useMemo(() => findProjectById(projects, projectId), [projects, projectId]);

  const [isComboboxOpen, setComboboxOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const projectMembers = useMemo(() => {
      if (!project || !project.members) return [];
      return Object.keys(project.members).map(userId => {
          const user = users.find(u => u.id === userId);
          return user ? { ...user, role: project.members[userId] } : null;
      }).filter(Boolean) as (User & { role: ProjectRole })[];
  }, [project, users]);

  const isOwner = useMemo(() => {
    if (!project || !currentUser || !project.members) return false;
    return project.members[currentUser.id] === 'owner';
  }, [project, currentUser]);

  const filteredUsers = useMemo(() => {
      const memberIds = new Set(projectMembers.map(m => m.id));
      return users.filter(u => !memberIds.has(u.id) && u.email.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [users, projectMembers, searchQuery]);

  const handleRoleChange = async (userId: string, newRole: ProjectRole) => {
      if (!project || !project.members) return;
      const updatedMembers = { ...project.members, [userId]: newRole };
      try {
          await updateProject(project.id, { members: updatedMembers });
          toast({ title: 'Success', description: "Member's role has been updated." });
      } catch (error) {
          toast({ variant: 'destructive', title: 'Error', description: 'Failed to update member role.' });
      }
  };

  const handleRemoveMember = async (userId: string) => {
      if (!project || !project.members) return;
      const { [userId]: _, ...remainingMembers } = project.members;
      try {
          await updateProject(project.id, { members: remainingMembers });
          toast({ title: 'Success', description: 'Member has been removed from the project.' });
      } catch (error) {
          toast({ variant: 'destructive', title: 'Error', description: 'Failed to remove member.' });
      }
  };

  const handleAddMember = async () => {
    if (!searchQuery || !project) return;

    const userToAdd = await findUserByEmail(searchQuery);
    if (!userToAdd) {
        toast({ variant: 'destructive', title: 'Error', description: 'User not found.' });
        return;
    }

    if (project.members && project.members[userToAdd.id]) {
        toast({ variant: 'destructive', title: 'Error', description: 'User is already a member of this project.' });
        return;
    }

    const updatedMembers = { ...(project.members || {}), [userToAdd.id]: 'viewer' as ProjectRole };
    try {
        await updateProject(project.id, { members: updatedMembers });
        toast({ title: 'Success', description: `${userToAdd.email} has been added to the project.` });
        setSearchQuery('');
        setComboboxOpen(false);
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to add member.' });
    }
  };

  if (!project) return <div>Loading...</div>;

  return (
    <div>
        {isOwner && (
            <div className="flex gap-2 mb-4">
                <Popover open={isComboboxOpen} onOpenChange={setComboboxOpen}>
                    <div className="relative w-full">
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={isComboboxOpen}
                                className="w-full justify-between text-muted-foreground"
                            >
                                {searchQuery || "Enter user email..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                                <CommandInput 
                                    placeholder="Search for user by email..." 
                                    value={searchQuery}
                                    onValueChange={setSearchQuery}
                                />
                                <CommandEmpty>No users found.</CommandEmpty>
                                <CommandGroup>
                                    {filteredUsers.map(user => (
                                        <CommandItem
                                            key={user.id}
                                            onSelect={() => {
                                                setSearchQuery(user.email);
                                                setComboboxOpen(false);
                                            }}
                                        >
                                            {user.email}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </Command>
                        </PopoverContent>
                    </div>
                </Popover>
                <Button onClick={handleAddMember}>Add</Button>
            </div>
        )}

        <div className="space-y-4">
            {projectMembers.map(member => (
                <div key={member.id} className="flex items-center justify-between">
                    <div>
                        <p className="font-medium">{member.name}</p>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {isOwner ? (
                            <Select
                                value={member.role}
                                onValueChange={(newRole: ProjectRole) => handleRoleChange(member.id, newRole)}
                                disabled={currentUser?.id === member.id} // Owner can't change their own role
                            >
                                <SelectTrigger className="w-[110px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="owner">Owner</SelectItem>
                                    <SelectItem value="editor">Editor</SelectItem>
                                    <SelectItem value="viewer">Viewer</SelectItem>
                                </SelectContent>
                            </Select>
                        ) : (
                            <span className="text-sm capitalize bg-muted px-2 py-1 rounded-md">{member.role}</span>
                        )}
                        
                        {isOwner && currentUser?.id !== member.id && (
                           <Button variant="ghost" size="icon" onClick={() => handleRemoveMember(member.id)}>
                               <Trash2 className="h-4 w-4 text-destructive" />
                           </Button>
                        )}
                    </div>
                </div>
            ))}
        </div>
        {!isOwner && <p className="text-sm text-muted-foreground mt-4">Only project owners can manage access.</p>}
    </div>
  );
}
