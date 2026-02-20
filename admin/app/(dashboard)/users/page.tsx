'use client';

import { useState, useEffect } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { DataTable } from '@/components/admin/data-table';
import { PageHeader } from '@/components/admin/page-header';
import { apiClient, type UserDetails, type Role } from '@/lib/api-client';

interface User {
  id: string;
  email: string;
  status: string;
  created_at: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ created: number; updated: number; unchanged: number } | null>(null);

  // Reset password dialog state
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Manage roles dialog state
  const [rolesTarget, setRolesTarget] = useState<User | null>(null);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [revokeLoadingId, setRevokeLoadingId] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      setIsLoading(true);
      const response = await apiClient.getUsers({ page: 1, limit: 50 });
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to load users:', error);
      setError(error instanceof Error ? error.message : 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSync() {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const result = await apiClient.syncUsers();
      setSyncResult({ created: result.created, updated: result.updated, unchanged: result.unchanged });
      await loadUsers();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  }

  function openResetDialog(user: User) {
    setResetTarget(user);
    setNewPassword('');
    setConfirmPassword('');
    setResetError(null);
    setResetSuccess(false);
  }

  function closeResetDialog() {
    setResetTarget(null);
    setNewPassword('');
    setConfirmPassword('');
    setResetError(null);
    setResetSuccess(false);
  }

  async function handleResetPassword() {
    if (!resetTarget) return;

    if (newPassword.length < 8) {
      setResetError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setResetError('Le mot de passe doit contenir au moins une majuscule.');
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      setResetError('Le mot de passe doit contenir au moins un chiffre.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError('Les mots de passe ne correspondent pas.');
      return;
    }

    setResetLoading(true);
    setResetError(null);
    try {
      await apiClient.resetUserPassword(resetTarget.id, newPassword);
      setResetSuccess(true);
      setTimeout(() => closeResetDialog(), 1500);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Erreur lors de la réinitialisation.');
    } finally {
      setResetLoading(false);
    }
  }

  async function openRolesDialog(user: User) {
    setRolesTarget(user);
    setUserDetails(null);
    setAllRoles([]);
    setRolesError(null);
    setSelectedRoleId('');
    setRolesLoading(true);
    try {
      const [details, roles] = await Promise.all([
        apiClient.getUserDetails(user.id),
        apiClient.getRoles(),
      ]);
      setUserDetails(details);
      setAllRoles(roles);
    } catch (err) {
      setRolesError(err instanceof Error ? err.message : 'Erreur lors du chargement.');
    } finally {
      setRolesLoading(false);
    }
  }

  function closeRolesDialog() {
    setRolesTarget(null);
    setUserDetails(null);
    setAllRoles([]);
    setRolesError(null);
    setSelectedRoleId('');
  }

  async function handleAssignRole() {
    if (!rolesTarget || !selectedRoleId) return;
    setAssignLoading(true);
    setRolesError(null);
    try {
      await apiClient.assignRole(rolesTarget.id, { roleId: selectedRoleId });
      // Reload user details to reflect new role
      const details = await apiClient.getUserDetails(rolesTarget.id);
      setUserDetails(details);
      setSelectedRoleId('');
    } catch (err) {
      setRolesError(err instanceof Error ? err.message : "Erreur lors de l'assignation.");
    } finally {
      setAssignLoading(false);
    }
  }

  async function handleRevokeRole(roleId: string) {
    if (!rolesTarget) return;
    setRevokeLoadingId(roleId);
    setRolesError(null);
    try {
      await apiClient.revokeRole(rolesTarget.id, roleId);
      const details = await apiClient.getUserDetails(rolesTarget.id);
      setUserDetails(details);
    } catch (err) {
      setRolesError(err instanceof Error ? err.message : 'Erreur lors de la révocation.');
    } finally {
      setRevokeLoadingId(null);
    }
  }

  // Roles already assigned to the user (by id)
  const assignedRoleIds = new Set(userDetails?.roles.map((r) => r.id) ?? []);

  // Only show roles not yet assigned
  const availableRoles = allRoles.filter((r) => !assignedRoleIds.has(r.id));

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: 'email',
      header: 'Email',
    },
    {
      accessorKey: 'status',
      header: 'Statut',
      cell: ({ row }) => (
        <Badge variant={row.original.status === 'active' ? 'default' : 'secondary'}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'created_at',
      header: 'Date création',
      cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString('fr-FR'),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openRolesDialog(row.original)}
          >
            Gérer les rôles
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openResetDialog(row.original)}
          >
            Réinitialiser MDP
          </Button>
        </div>
      ),
    },
  ];

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader title="Utilisateurs" description="Gérer les utilisateurs de l'application" />
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">Erreur: {error}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Utilisateurs" description="Gérer les utilisateurs de l'application" />
        <div className="flex items-center justify-center h-32">
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <PageHeader title="Utilisateurs" description="Gérer les utilisateurs de l'application" />
        <div className="flex items-center gap-3">
          {syncResult && (
            <p className="text-sm text-muted-foreground">
              Sync : +{syncResult.created} créés, {syncResult.updated} mis à jour, {syncResult.unchanged} inchangés
            </p>
          )}
          <Button variant="outline" onClick={handleSync} disabled={isSyncing}>
            {isSyncing ? 'Sync en cours...' : 'Sync rétroactif (migration)'}
          </Button>
        </div>
      </div>
      <DataTable columns={columns} data={users} />

      {/* ── Manage Roles Dialog ── */}
      <Dialog open={!!rolesTarget} onOpenChange={(open) => { if (!open) closeRolesDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gérer les rôles</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Utilisateur : <span className="font-medium">{rolesTarget?.email}</span>
          </p>

          {rolesLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Chargement...</p>
          ) : (
            <div className="space-y-4 py-2">
              {/* Current roles */}
              <div className="space-y-2">
                <Label>Rôles actuels</Label>
                {userDetails?.roles.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Aucun rôle assigné.</p>
                ) : (
                  <ul className="space-y-1">
                    {userDetails?.roles.map((role) => (
                      <li key={role.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                        <div>
                          <span className="text-sm font-medium">{role.displayName}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{role.name}</span>
                          {role.expiresAt && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              (exp. {new Date(role.expiresAt).toLocaleDateString('fr-FR')})
                            </span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleRevokeRole(role.id)}
                          disabled={revokeLoadingId === role.id}
                        >
                          {revokeLoadingId === role.id ? '...' : 'Révoquer'}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <Separator />

              {/* Assign new role */}
              <div className="space-y-2">
                <Label>Assigner un rôle</Label>
                {availableRoles.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Tous les rôles sont déjà assignés.</p>
                ) : (
                  <div className="flex gap-2">
                    <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Choisir un rôle…" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableRoles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.displayName}
                            {role.isSystem && (
                              <span className="ml-1 text-xs text-muted-foreground">(système)</span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleAssignRole}
                      disabled={!selectedRoleId || assignLoading}
                    >
                      {assignLoading ? '...' : 'Assigner'}
                    </Button>
                  </div>
                )}
              </div>

              {rolesError && (
                <p className="text-sm text-destructive">{rolesError}</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeRolesDialog}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reset Password Dialog ── */}
      <Dialog open={!!resetTarget} onOpenChange={(open) => { if (!open) closeResetDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Utilisateur : <span className="font-medium">{resetTarget?.email}</span>
          </p>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="newPassword">Nouveau mot de passe</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 8 caractères, 1 majuscule, 1 chiffre"
                disabled={resetLoading || resetSuccess}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Répéter le mot de passe"
                disabled={resetLoading || resetSuccess}
              />
            </div>

            {resetError && (
              <p className="text-sm text-destructive">{resetError}</p>
            )}
            {resetSuccess && (
              <p className="text-sm text-green-600">Mot de passe réinitialisé avec succès.</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeResetDialog} disabled={resetLoading}>
              Annuler
            </Button>
            <Button onClick={handleResetPassword} disabled={resetLoading || resetSuccess}>
              {resetLoading ? 'En cours...' : 'Réinitialiser'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
