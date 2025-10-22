
'use client';

import React, { memo } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/app-context';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Skeleton } from '../ui/skeleton';
import { Settings, Bell, LogOut } from 'lucide-react';

const UserAccount = memo(function UserAccount() {
    const { currentUser, loading, logout } = useApp();

    if (loading || !currentUser) {
        return (
            <div className="flex items-center gap-3 p-2 -mx-2">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex flex-col gap-1 min-w-0">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                </div>
            </div>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <div className="flex items-center gap-3 cursor-pointer p-2 rounded-md hover:bg-accent -mx-2">
                    <Avatar className="h-9 w-9">
                        <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} />
                        <AvatarFallback>{currentUser.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold truncate">{currentUser.name}</span>
                        <span className="text-xs text-muted-foreground truncate">{currentUser.email}</span>
                    </div>
                </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 mb-2" side="top" align="start">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link href="/settings">
                        <Settings className="mr-2 h-4 w-4" /><span>Settings</span>
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem><Bell className="mr-2 h-4 w-4" /><span>Notifications</span></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => logout()}>
                    <LogOut className="mr-2 h-4 w-4" /><span>Log out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
});

export default UserAccount;
