'use client';

import { useApp } from '@/context/app-context';
import { ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield } from 'lucide-react';

interface RoleGuardProps {
  allowedRoles: string[];
  children: ReactNode;
  fallback?: ReactNode;
  showError?: boolean;
}

export function RoleGuard({ 
  allowedRoles, 
  children, 
  fallback = null, 
  showError = true 
}: RoleGuardProps) {
  const { currentUser } = useApp();

  if (!currentUser) {
    if (showError) {
      return (
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            You must be logged in to access this page.
          </AlertDescription>
        </Alert>
      );
    }
    return fallback;
  }

  const userRole = currentUser.role || 'user';
  
  // Superuser has access to everything
  if (userRole === 'superuser') {
    return <>{children}</>;
  }

  // Check if user has required role
  if (!allowedRoles.includes(userRole)) {
    if (showError) {
      return (
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access this page. Required role: {allowedRoles.join(' or ')}.
            Your role: {userRole}.
          </AlertDescription>
        </Alert>
      );
    }
    return fallback;
  }

  return <>{children}</>;
}

// Helper hooks for role checking
export function useHasRole(role: string | string[]): boolean {
  const { currentUser } = useApp();
  
  if (!currentUser) return false;
  
  const userRole = currentUser.role || 'user';
  
  // Superuser has all roles
  if (userRole === 'superuser') return true;
  
  const allowedRoles = Array.isArray(role) ? role : [role];
  return allowedRoles.includes(userRole);
}

export function useIsAdmin(): boolean {
  return useHasRole(['admin', 'superuser']);
}

export function useIsSuperuser(): boolean {
  return useHasRole('superuser');
}