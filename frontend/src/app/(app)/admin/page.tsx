'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useApp } from '@/context/app-context';
import { api } from '@/lib/api';
import { 
  Loader2, Shield, Users, Lock, Unlock, AlertTriangle, Info, Search, 
  UserX, UserCheck, Settings, Trash2, MoreHorizontal, Download, Filter, X
} from 'lucide-react';
import { RoleGuard } from '@/components/role-guard';
import { useIsSuperuser } from '@/components/role-guard';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface LockoutStats {
  totalLocked: number;
  autoLocked: number;
  manuallyLocked: number;
  expiredLocks: number;
}

interface LockedAccount {
  id: string;
  email: string;
  name: string | null;
  failedLoginAttempts: number;
  lastFailedAttempt: string | null;
  lockedUntil: string | null;
  lockoutReason: string | null;
  isManuallyLocked: boolean;
  isCurrentlyLocked: boolean;
  createdAt: string;
}

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isDisabled: boolean;
  isManuallyLocked: boolean;
  lockedUntil: string | null;
  lockoutReason: string | null;
  failedLoginAttempts: number;
  lastFailedAttempt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  component?: string;
  context?: any;
  file?: string;
}

interface ThreatStats {
  blockedIPs: number;
  suspiciousIPs: number;
  activeMonitoring: number;
  lastUpdate: string;
}

export default function AdminPage() {
  return (
    <RoleGuard allowedRoles={['admin', 'superuser']}>
      <AdminDashboard />
    </RoleGuard>
  );
}

function AdminDashboard() {
  const { toast } = useToast();
  const { currentUser } = useApp();
  const isSuperuser = useIsSuperuser();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<LockoutStats | null>(null);
  const [adminStats, setAdminStats] = useState<any | null>(null);
  const [lockedAccounts, setLockedAccounts] = useState<LockedAccount[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  // Dialog states
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [newRole, setNewRole] = useState('');
  const [roleChangeReason, setRoleChangeReason] = useState('');
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  
  // Log filtering states
  const [logSearch, setLogSearch] = useState('');
  const [logLevel, setLogLevel] = useState('all');
  const [logComponent, setLogComponent] = useState('all');
  const [logStartDate, setLogStartDate] = useState('');
  const [logEndDate, setLogEndDate] = useState('');
  const [logComponents, setLogComponents] = useState<string[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [threatStats, setThreatStats] = useState<ThreatStats | null>(null);
  const [realtimeAudit, setRealtimeAudit] = useState<any | null>(null);

  // Client-side mounting check
  useEffect(() => {
    setMounted(true);
  }, []);

  // Test backend connectivity
  const testConnection = async () => {
    try {
      await api.get('/realtime/health');
      return true;
    } catch (error) {
      console.error('Backend connectivity test failed:', error);
      return false;
    }
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      
      try {
        // First check if user is authenticated and has admin role
        const userInfo = await api.get('/auth/me');
        
        if (!userInfo.user || (userInfo.user.role !== 'admin' && userInfo.user.role !== 'superuser')) {
          toast({
            title: 'Access Denied',
            description: 'You need admin privileges to access this page.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }
        
        await Promise.all([
          fetchStats(),
          fetchLockedAccounts(),
          fetchThreatStats(),
          fetchRealtimeAudit()
        ]);
      } catch (error) {
        console.error('Error during authentication or data fetch:', error);
        toast({
          title: 'Authentication Error',
          description: 'Please log in with an admin account to access this page.',
          variant: 'destructive',
        });
      }
      
      setLoading(false);
    };
    
    fetchInitialData();
  }, []);

  const fetchRealtimeAudit = async () => {
    try {
      const data = await api.get('/realtime/audit');
      setRealtimeAudit(data.audit || data);
    } catch (error) {
      console.error('Failed to fetch realtime audit:', error);
      toast({ title: 'Error', description: 'Failed to fetch SSE audit', variant: 'destructive' });
    }
  };

  const fetchStats = async () => {
    try {
      const data = await api.get('/admin/lockouts');
      setStats(data.stats);
      // fetch overall admin stats
      try {
        const s = await api.get('/admin/stats');
        setAdminStats(s);
      } catch (e) {
        console.error('Failed to fetch admin stats:', e);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      toast({
        title: 'Connection Error',
        description: 'Failed to fetch statistics. Please check if the backend server is running.',
        variant: 'destructive',
      });
    }
  };

  const fetchLockedAccounts = async () => {
    try {
      const data = await api.get('/admin/lockouts/locked-accounts');
      setLockedAccounts(data.lockedAccounts);
    } catch (error) {
      console.error('Failed to fetch locked accounts:', error);
      toast({
        title: 'Connection Error',
        description: 'Failed to fetch locked accounts. Please check if the backend server is running.',
        variant: 'destructive',
      });
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await api.get('/admin/users');
      setUsers(data.users);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast({
        title: 'Connection Error',
        description: 'Failed to fetch users. Please check if the backend server is running.',
        variant: 'destructive',
      });
    }
  };

  const fetchLogs = async () => {
    try {
      const params = new URLSearchParams();
      if (logLevel && logLevel !== 'all') params.append('level', logLevel);
      if (logComponent && logComponent !== 'all') params.append('component', logComponent);
      if (logSearch) params.append('search', logSearch);
      if (logStartDate) params.append('startDate', logStartDate);
      if (logEndDate) params.append('endDate', logEndDate);
      
      const data = await api.get(`/admin/logs?${params.toString()}`);
      setLogs(data.logs);
      setFilteredLogs(data.logs);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      toast({
        title: 'Connection Error',
        description: 'Failed to fetch logs. Please check if the backend server is running.',
        variant: 'destructive',
      });
    }
  };

  const fetchLogComponents = async () => {
    try {
      const data = await api.get('/admin/logs/components');
      setLogComponents(data.components);
    } catch (error) {
      console.error('Failed to fetch log components:', error);
    }
  };

  const exportLogs = () => {
    const csvContent = [
      'Timestamp,Level,Component,Message',
      ...filteredLogs.map(log => 
        `"${log.timestamp}","${log.level}","${log.component || ''}","${log.message.replace(/"/g, '""')}"`
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-logs-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    toast({
      title: 'Success',
      description: 'Logs exported successfully',
    });
  };

  const clearLogFilters = () => {
    setLogSearch('');
    setLogLevel('all');
    setLogComponent('all');
    setLogStartDate('');
    setLogEndDate('');
  };

  const fetchThreatStats = async () => {
    try {
      const data = await api.get('/admin/threats/stats');
      setThreatStats(data.stats);
    } catch (error) {
      console.error('Failed to fetch threat stats:', error);
      toast({
        title: 'Connection Error',
        description: 'Failed to fetch threat statistics.',
        variant: 'destructive',
      });
    }
  };

  // User action functions
  const handleDisableUser = async () => {
    if (!selectedUser) return;
    
    setActionLoading(true);
    try {
      const endpoint = selectedUser.isDisabled ? 'enable' : 'disable';
      const reason = selectedUser.isDisabled 
        ? 'Enabled by admin via admin panel'
        : 'Disabled by admin via admin panel';
      
      await api.put(`/admin/users/${selectedUser.id}/${endpoint}`, { reason });
      
      toast({
        title: 'Success',
        description: `User ${selectedUser.isDisabled ? 'enabled' : 'disabled'} successfully`,
      });
      
      setShowDisableDialog(false);
      setSelectedUser(null);
      await fetchUsers();
    } catch (error: any) {
      console.error('Error disabling/enabling user:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to update user status',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser || deleteConfirmEmail !== selectedUser.email) return;
    
    setActionLoading(true);
    try {
      await api.delete(`/admin/users/${selectedUser.id}`, {
        body: { confirmEmail: deleteConfirmEmail }
      });
      
      toast({
        title: 'Success',
        description: 'User deleted successfully',
      });
      
      setShowDeleteDialog(false);
      setSelectedUser(null);
      setDeleteConfirmEmail('');
      await fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to delete user',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangeRole = async () => {
    if (!selectedUser || !newRole || !roleChangeReason.trim()) return;
    
    setActionLoading(true);
    try {
      await api.put(`/admin/users/${selectedUser.id}/role`, {
        role: newRole,
        reason: roleChangeReason.trim()
      });
      
      toast({
        title: 'Success',
        description: 'User role updated successfully',
      });
      
      setShowRoleDialog(false);
      setSelectedUser(null);
      setNewRole('');
      setRoleChangeReason('');
      await fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to update user role',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const openDisableDialog = (user: User) => {
    // Prevent admins from disabling/enabling superuser accounts
    if (currentUser?.role === 'admin' && user.role === 'superuser') {
      toast({
        variant: 'destructive',
        title: 'Access Denied',
        description: 'Admins cannot disable or enable superuser accounts. Only superusers can manage other superusers.',
      });
      return;
    }
    
    setSelectedUser(user);
    setShowDisableDialog(true);
  };

  const openDeleteDialog = (user: User) => {
    // Check role hierarchy - admins cannot delete superuser accounts
    if (currentUser?.role === 'admin' && user.role === 'superuser') {
      toast({
        title: "Access Denied",
        description: "Admins cannot delete superuser accounts",
        variant: "destructive",
      });
      return;
    }
    
    setSelectedUser(user);
    setDeleteConfirmEmail('');
    setShowDeleteDialog(true);
  };

  const openRoleDialog = (user: User) => {
    // Prevent admins from changing superuser roles
    if (currentUser?.role === 'admin' && user.role === 'superuser') {
      toast({
        variant: 'destructive',
        title: 'Access Denied',
        description: 'Admins cannot modify superuser accounts. Only superusers can manage other superusers.',
      });
      return;
    }
    
    setSelectedUser(user);
    setNewRole(user.role || '');
    setRoleChangeReason('');
    setShowRoleDialog(true);
  };

  useEffect(() => {
    if (activeTab === 'users' && users.length === 0) {
      fetchUsers();
    } else if (activeTab === 'logs') {
      if (logs.length === 0) {
        fetchLogs();
      }
      if (logComponents.length === 0) {
        fetchLogComponents();
      }
    }
  }, [activeTab]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'superuser': return 'bg-red-100 text-red-800';
      case 'admin': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (user: User) => {
    if (user.isDisabled) return 'bg-gray-100 text-gray-800';
    if (user.isManuallyLocked || (user.lockedUntil && new Date(user.lockedUntil) > new Date())) {
      return 'bg-red-100 text-red-800';
    }
    return 'bg-green-100 text-green-800';
  };

  const getUserStatus = (user: User) => {
    if (user.isDisabled) return 'Disabled';
    if (user.isManuallyLocked || (user.lockedUntil && new Date(user.lockedUntil) > new Date())) {
      return 'Locked';
    }
    return 'Active';
  };

  const getLevelColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'error': return 'bg-red-100 text-red-800';
      case 'warn': return 'bg-yellow-100 text-yellow-800';
      case 'info': return 'bg-blue-100 text-blue-800';
      case 'debug': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground">Manage users, security, and system logs</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="lockouts">Account Lockouts</TabsTrigger>
          <TabsTrigger value="security">Security & Threats</TabsTrigger>
          {isSuperuser && <TabsTrigger value="sse">SSE Audit</TabsTrigger>}
          <TabsTrigger value="logs">System Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Locked</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalLocked}</div>
                </CardContent>
              </Card>
                {/* SSE Audit moved to its own tab for superusers */}
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Auto Locked</CardTitle>
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.autoLocked}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Manually Locked</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.manuallyLocked}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Expired Locks</CardTitle>
                  <Unlock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.expiredLocks}</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* System-wide totals and per-user counts */}
          {adminStats && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{adminStats.totalUsers ?? 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
                    <Settings className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{adminStats.totalProjects ?? 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
                    <Download className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{adminStats.totalTasks ?? 0}</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Per-user counts</CardTitle>
                  <CardDescription>
                    Number of projects and tasks per user (top 50)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 flex items-center justify-end">
                    <Button size="sm" onClick={async () => {
                      try {
                        const s = await api.get('/admin/stats');
                        setAdminStats(s);
                        toast({ title: 'Refreshed', description: 'Admin stats refreshed' });
                      } catch (e) {
                        toast({ title: 'Error', description: 'Failed to refresh admin stats', variant: 'destructive' });
                      }
                    }}>
                      <Search className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                  </div>

                  <div className="max-h-72 overflow-y-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Projects</TableHead>
                          <TableHead>Tasks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(adminStats.perUser || []).slice(0, 50).map((u: any) => (
                          <TableRow key={u.id}>
                            <TableCell>
                              <div className="font-medium">{u.name || '—'}</div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                            <TableCell>{u.projectCount ?? 0}</TableCell>
                            <TableCell>{u.taskCount ?? 0}</TableCell>
                          </TableRow>
                        ))}
                        {(!adminStats.perUser || adminStats.perUser.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No user stats available</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Recent Locked Accounts</CardTitle>
              <CardDescription>
                Recently locked accounts that need attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lockedAccounts.length === 0 ? (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    No accounts are currently locked.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {lockedAccounts.slice(0, 5).map((account) => (
                    <div key={account.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{account.email}</h3>
                          <p className="text-sm text-muted-foreground">{account.name}</p>
                        </div>
                        <Badge variant={account.isManuallyLocked ? "destructive" : "secondary"}>
                          {account.isManuallyLocked ? "Manual" : "Auto"}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground grid grid-cols-2 gap-2">
                        <div>Failed Attempts: {account.failedLoginAttempts}</div>
                        <div>Last Attempt: {formatDate(account.lastFailedAttempt)}</div>
                        <div>Locked Until: {formatDate(account.lockedUntil)}</div>
                        <div>Reason: {account.lockoutReason || 'Failed login attempts'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Users ({users.length})</CardTitle>
              <CardDescription>Manage user accounts and permissions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Button onClick={fetchUsers}>
                  <Search className="h-4 w-4 mr-2" />
                  Load Users
                </Button>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{user.email}</div>
                          <div className="text-sm text-muted-foreground">{user.name}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getRoleColor(user.role)}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(user)}>
                          {getUserStatus(user)}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(user.createdAt)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {/* Hide actions that admins cannot perform on superuser accounts */}
                            {!(currentUser?.role === 'admin' && user.role === 'superuser') && (
                              <>
                                <DropdownMenuItem onClick={() => openDisableDialog(user)}>
                                  {user.isDisabled ? (
                                    <>
                                      <UserCheck className="mr-2 h-4 w-4" />
                                      Enable User
                                    </>
                                  ) : (
                                    <>
                                      <UserX className="mr-2 h-4 w-4" />
                                      Disable User
                                    </>
                                  )}
                                </DropdownMenuItem>

                                <DropdownMenuItem onClick={() => openRoleDialog(user)}>
                                  <Settings className="mr-2 h-4 w-4" />
                                  Change Role
                                </DropdownMenuItem>

                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-red-600" onClick={() => openDeleteDialog(user)}>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete User
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lockouts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Currently Locked Accounts</CardTitle>
              <CardDescription>
                Accounts that are currently locked due to failed attempts or manual intervention
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lockedAccounts.length === 0 ? (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    No accounts are currently locked.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {lockedAccounts.map((account) => (
                    <div key={account.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{account.email}</h3>
                          <p className="text-sm text-muted-foreground">{account.name}</p>
                        </div>
                        <Badge variant={account.isManuallyLocked ? "destructive" : "secondary"}>
                          {account.isManuallyLocked ? "Manual" : "Auto"}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground grid grid-cols-2 gap-2">
                        <div>Failed Attempts: {account.failedLoginAttempts}</div>
                        <div>Last Attempt: {formatDate(account.lastFailedAttempt)}</div>
                        <div>Locked Until: {formatDate(account.lockedUntil)}</div>
                        <div>Reason: {account.lockoutReason || 'Failed login attempts'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Blocked IPs</CardTitle>
                <Shield className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {threatStats?.blockedIPs || 0}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Suspicious IPs</CardTitle>
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {threatStats?.suspiciousIPs || 0}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Monitoring</CardTitle>
                <Search className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {threatStats?.activeMonitoring || 0}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Last Update</CardTitle>
                <Info className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  {threatStats?.lastUpdate ? formatDate(threatStats.lastUpdate) : 'Never'}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Threat Detection System</CardTitle>
              <CardDescription>
                Advanced threat detection monitors for suspicious activity including injection attempts, brute force attacks, and anomalous behavior patterns.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-green-500" />
                      Active Protections
                    </h3>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• SQL Injection Detection</li>
                      <li>• XSS Attack Prevention</li>
                      <li>• Path Traversal Blocking</li>
                      <li>• Brute Force Protection</li>
                      <li>• Anomalous Behavior Analysis</li>
                      <li>• Privilege Escalation Detection</li>
                    </ul>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      Detection Capabilities
                    </h3>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Real-time threat analysis</li>
                      <li>• Behavioral pattern learning</li>
                      <li>• IP reputation tracking</li>
                      <li>• Credential stuffing detection</li>
                      <li>• Admin account targeting</li>
                      <li>• Automated response actions</li>
                    </ul>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 pt-4">
                  <Button onClick={fetchThreatStats} size="sm">
                    <Search className="h-4 w-4 mr-2" />
                    Refresh Stats
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export Report
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Logs ({filteredLogs.length})</CardTitle>
              <CardDescription>View and search system logs with filtering options</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Log Filters */}
              <div className="space-y-4 mb-6 p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    <span className="font-medium">Filters</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={clearLogFilters}>
                      <X className="h-4 w-4 mr-2" />
                      Clear
                    </Button>
                    <Button size="sm" onClick={fetchLogs}>
                      <Search className="h-4 w-4 mr-2" />
                      Apply Filters
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportLogs} disabled={filteredLogs.length === 0}>
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div>
                    <Label htmlFor="log-search">Search</Label>
                    <Input
                      id="log-search"
                      placeholder="Search in messages..."
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="log-level">Level</Label>
                    <Select value={logLevel || "all"} onValueChange={setLogLevel}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="All levels" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All levels</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                        <SelectItem value="warn">Warning</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="debug">Debug</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="log-component">Component</Label>
                    <Select value={logComponent || "all"} onValueChange={setLogComponent}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="All components" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All components</SelectItem>
                        {logComponents.map((component) => (
                          <SelectItem key={component} value={component}>
                            {component}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="log-start-date">Start Date</Label>
                    <Input
                      id="log-start-date"
                      type="datetime-local"
                      value={logStartDate}
                      onChange={(e) => setLogStartDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="log-end-date">End Date</Label>
                    <Input
                      id="log-end-date"
                      type="datetime-local"
                      value={logEndDate}
                      onChange={(e) => setLogEndDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
              
              {/* Log Table */}
              <div className="max-h-96 overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader className="sticky top-0 bg-background border-b">
                    <TableRow>
                      <TableHead className="w-[180px] bg-background">Time</TableHead>
                      <TableHead className="w-[80px] bg-background">Level</TableHead>
                      <TableHead className="w-[120px] bg-background">Component</TableHead>
                      <TableHead className="bg-background">Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No logs found matching the current filters
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLogs.map((log, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono text-xs">
                            {new Date(log.timestamp).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge className={getLevelColor(log.level)}>
                              {log.level}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {log.component || log.context?.component || '-'}
                          </TableCell>
                          <TableCell className="text-sm max-w-md">
                            <div className="break-words">{log.message}</div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isSuperuser && (
          <TabsContent value="sse" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>SSE Audit</CardTitle>
                <CardDescription>Connected SSE clients and subscription counts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex items-center justify-end">
                  <Button size="sm" onClick={async () => { await fetchRealtimeAudit(); toast({ title: 'Refreshed', description: 'SSE audit refreshed' }); }}>
                    <Search className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>

                {!realtimeAudit ? (
                  <div className="text-sm text-muted-foreground">No SSE audit data available. Click Refresh.</div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Total Clients</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{realtimeAudit.totalClients ?? 0}</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Clients by User</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-sm">{Object.keys(realtimeAudit.clientsByUser || {}).length} users</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Clients by Project</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-sm">{Object.keys(realtimeAudit.clientsByProject || {}).length} projects</div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card>
                        <CardHeader>
                          <CardTitle>Top Projects</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="max-h-48 overflow-y-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Project ID</TableHead>
                                  <TableHead>Client Count</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {Object.entries(realtimeAudit.clientsByProject || {}).sort((a: any, b: any) => (b[1] as number) - (a[1] as number)).slice(0,50).map(([pid, cnt]) => (
                                  <TableRow key={pid}>
                                    <TableCell>{pid}</TableCell>
                                    <TableCell>{String(cnt)}</TableCell>
                                  </TableRow>
                                ))}
                                {(!realtimeAudit.clientsByProject || Object.keys(realtimeAudit.clientsByProject).length === 0) && (
                                  <TableRow>
                                    <TableCell colSpan={2} className="text-center text-muted-foreground">No project subscriptions</TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Top Users</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="max-h-48 overflow-y-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>User ID</TableHead>
                                  <TableHead>Client Count</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {Object.entries(realtimeAudit.clientsByUser || {}).sort((a: any, b: any) => (b[1] as number) - (a[1] as number)).slice(0,50).map(([uid, cnt]) => (
                                  <TableRow key={uid}>
                                    <TableCell>{uid}</TableCell>
                                    <TableCell>{String(cnt)}</TableCell>
                                  </TableRow>
                                ))}
                                {(!realtimeAudit.clientsByUser || Object.keys(realtimeAudit.clientsByUser).length === 0) && (
                                  <TableRow>
                                    <TableCell colSpan={2} className="text-center text-muted-foreground">No active users</TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle>Active Clients (sample)</CardTitle>
                        <CardDescription>First 200 clients</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="max-h-64 overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Client ID</TableHead>
                                <TableHead>User</TableHead>
                                <TableHead>Projects</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(realtimeAudit.clients || []).slice(0,200).map((c: any) => (
                                <TableRow key={c.id}>
                                  <TableCell className="break-all">{c.id}</TableCell>
                                  <TableCell className="break-all">{c.userId}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">{(c.projectIds || []).join(', ') || '—'}</TableCell>
                                </TableRow>
                              ))}
                              {(!realtimeAudit.clients || realtimeAudit.clients.length === 0) && (
                                <TableRow>
                                  <TableCell colSpan={3} className="text-center text-muted-foreground">No active clients</TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* User Action Dialogs */}
      
      {/* Disable/Enable User Dialog */}
      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedUser?.isDisabled ? 'Enable' : 'Disable'} User
            </DialogTitle>
            <DialogDescription>
              {selectedUser?.isDisabled 
                ? `Are you sure you want to enable ${selectedUser?.email}? They will be able to log in again.`
                : `Are you sure you want to disable ${selectedUser?.email}? They will not be able to log in.`
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisableDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleDisableUser}
              disabled={actionLoading}
              variant={selectedUser?.isDisabled ? "default" : "destructive"}
            >
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {selectedUser?.isDisabled ? 'Enable' : 'Disable'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the user account
              and all associated data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="confirmEmail">
                Type <strong>{selectedUser?.email}</strong> to confirm:
              </Label>
              <Input
                id="confirmEmail"
                value={deleteConfirmEmail}
                onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                placeholder="Enter email to confirm deletion"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleDeleteUser}
              disabled={actionLoading || deleteConfirmEmail !== selectedUser?.email}
              variant="destructive"
            >
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={(open) => {
        setShowRoleDialog(open);
        if (!open) {
          setRoleChangeReason('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Change the role for {selectedUser?.email}. This will affect their permissions
              in the system. Please provide a reason for this change for audit purposes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="newRole">New Role</Label>
              <Select value={newRole || ""} onValueChange={setNewRole}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  {currentUser?.role === 'superuser' && (
                    <SelectItem value="superuser">Superuser</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="roleChangeReason">Reason for Role Change</Label>
              <Input
                id="roleChangeReason"
                value={roleChangeReason}
                onChange={(e) => setRoleChangeReason(e.target.value)}
                placeholder="Explain why this role change is necessary..."
                className="mt-1"
                maxLength={500}
              />
              <p className="text-sm text-muted-foreground mt-1">
                {roleChangeReason.length}/500 characters
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowRoleDialog(false);
              setRoleChangeReason('');
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleChangeRole}
              disabled={actionLoading || !newRole || newRole === selectedUser?.role || !roleChangeReason.trim()}
            >
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}