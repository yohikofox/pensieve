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
import { Switch } from '@/components/ui/switch';
import { DataTable } from '@/components/admin/data-table';
import { PageHeader } from '@/components/admin/page-header';
import { apiClient, type UserDetails, type Role, type Permission } from '@/lib/api-client';

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

  // Manage roles & permissions dialog state
  const [accessTarget, setAccessTarget] = useState<User | null>(null);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  // Role assign state
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [assignRoleLoading, setAssignRoleLoading] = useState(false);
  const [revokeRoleLoadingId, setRevokeRoleLoadingId] = useState<string | null>(null);

  // Permission grant state
  const [selectedPermissionId, setSelectedPermissionId] = useState<string>('');
  const [grantLoading, setGrantLoading] = useState(false);
  const [revokePermLoadingId, setRevokePermLoadingId] = useState<string | null>(null);

  // Debug mode state
  const [debugModeAccess, setDebugModeAccess] = useState(false);
  const [debugToggleLoading, setDebugToggleLoading] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      setIsLoading(true);
      const response = await apiClient.getUsers({ page: 1, limit: 50 });
      setUsers(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
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

  // ── Reset password ──────────────────────────────────────────────────────────

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
    if (newPassword.length < 8) { setResetError('Min. 8 caractères.'); return; }
    if (!/[A-Z]/.test(newPassword)) { setResetError('Min. 1 majuscule.'); return; }
    if (!/[0-9]/.test(newPassword)) { setResetError('Min. 1 chiffre.'); return; }
    if (newPassword !== confirmPassword) { setResetError('Mots de passe différents.'); return; }

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

  // ── Roles & permissions dialog ──────────────────────────────────────────────

  async function openAccessDialog(user: User) {
    setAccessTarget(user);
    setUserDetails(null);
    setAllRoles([]);
    setAllPermissions([]);
    setAccessError(null);
    setSelectedRoleId('');
    setSelectedPermissionId('');
    setAccessLoading(true);
    try {
      const [details, roles, perms, features] = await Promise.all([
        apiClient.getUserDetails(user.id),
        apiClient.getRoles(),
        apiClient.getPermissions(),
        apiClient.getUserFeatures(user.id),
      ]);
      setUserDetails(details);
      setAllRoles(roles);
      setAllPermissions(perms);
      setDebugModeAccess(features.debug_mode_access);
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : 'Erreur lors du chargement.');
    } finally {
      setAccessLoading(false);
    }
  }

  function closeAccessDialog() {
    setAccessTarget(null);
    setUserDetails(null);
    setAllRoles([]);
    setAllPermissions([]);
    setAccessError(null);
    setSelectedRoleId('');
    setSelectedPermissionId('');
    setDebugModeAccess(false);
  }

  async function handleToggleDebugMode(enabled: boolean) {
    if (!accessTarget) return;
    setDebugToggleLoading(true);
    setAccessError(null);
    try {
      const result = await apiClient.updateUserFeatures(accessTarget.id, {
        debug_mode_access: enabled,
      });
      setDebugModeAccess(result.debug_mode_access);
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour.');
    } finally {
      setDebugToggleLoading(false);
    }
  }

  async function refreshUserDetails() {
    if (!accessTarget) return;
    const details = await apiClient.getUserDetails(accessTarget.id);
    setUserDetails(details);
  }

  // Roles

  async function handleAssignRole() {
    if (!accessTarget || !selectedRoleId) return;
    setAssignRoleLoading(true);
    setAccessError(null);
    try {
      await apiClient.assignRole(accessTarget.id, { roleId: selectedRoleId });
      await refreshUserDetails();
      setSelectedRoleId('');
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : "Erreur lors de l'assignation.");
    } finally {
      setAssignRoleLoading(false);
    }
  }

  async function handleRevokeRole(roleId: string) {
    if (!accessTarget) return;
    setRevokeRoleLoadingId(roleId);
    setAccessError(null);
    try {
      await apiClient.revokeRole(accessTarget.id, roleId);
      await refreshUserDetails();
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : 'Erreur lors de la révocation.');
    } finally {
      setRevokeRoleLoadingId(null);
    }
  }

  // Permissions

  async function handleGrantPermission() {
    if (!accessTarget || !selectedPermissionId) return;
    setGrantLoading(true);
    setAccessError(null);
    try {
      await apiClient.grantPermission(accessTarget.id, {
        permissionId: selectedPermissionId,
        granted: true,
      });
      await refreshUserDetails();
      setSelectedPermissionId('');
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : "Erreur lors de l'accord de permission.");
    } finally {
      setGrantLoading(false);
    }
  }

  async function handleRevokePermission(permissionId: string) {
    if (!accessTarget) return;
    setRevokePermLoadingId(permissionId);
    setAccessError(null);
    try {
      await apiClient.revokePermission(accessTarget.id, permissionId);
      await refreshUserDetails();
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : 'Erreur lors de la révocation.');
    } finally {
      setRevokePermLoadingId(null);
    }
  }

  // Derived

  const assignedRoleIds = new Set(userDetails?.roles.map((r) => r.id) ?? []);
  const availableRoles = allRoles.filter((r) => !assignedRoleIds.has(r.id));

  const assignedPermissionIds = new Set(
    userDetails?.permissions.map((p) => p.id) ?? [],
  );
  const availablePermissions = allPermissions.filter(
    (p) => !assignedPermissionIds.has(p.id),
  );

  // ── Table columns ───────────────────────────────────────────────────────────

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
          <Button variant="outline" size="sm" onClick={() => openAccessDialog(row.original)}>
            Rôles &amp; Permissions
          </Button>
          <Button variant="outline" size="sm" onClick={() => openResetDialog(row.original)}>
            Réinitialiser MDP
          </Button>
        </div>
      ),
    },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────

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

      {/* ── Roles & Permissions Dialog ── */}
      <Dialog open={!!accessTarget} onOpenChange={(open) => { if (!open) closeAccessDialog(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rôles &amp; Permissions</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Utilisateur : <span className="font-medium">{accessTarget?.email}</span>
          </p>

          {accessLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Chargement...</p>
          ) : (
            <div className="space-y-5 py-2">

              {/* ── Rôles ── */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">Rôles</Label>

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
                          disabled={revokeRoleLoadingId === role.id}
                        >
                          {revokeRoleLoadingId === role.id ? '...' : 'Révoquer'}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}

                {availableRoles.length > 0 && (
                  <div className="flex gap-2 pt-1">
                    <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Assigner un rôle…" />
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
                    <Button onClick={handleAssignRole} disabled={!selectedRoleId || assignRoleLoading}>
                      {assignRoleLoading ? '...' : 'Assigner'}
                    </Button>
                  </div>
                )}
              </div>

              <Separator />

              {/* ── Permissions directes ── */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">Permissions directes</Label>
                <p className="text-xs text-muted-foreground">
                  Surcharge individuelle — priorité maximale sur les rôles et abonnements.
                </p>

                {userDetails?.permissions.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Aucune permission directe.</p>
                ) : (
                  <ul className="space-y-1">
                    {userDetails?.permissions.map((perm) => (
                      <li key={perm.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                        <div>
                          <Badge variant={perm.granted ? 'default' : 'destructive'} className="mr-2 text-xs">
                            {perm.granted ? 'Accordée' : 'Refusée'}
                          </Badge>
                          <span className="text-sm font-medium">{perm.displayName}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{perm.name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleRevokePermission(perm.id)}
                          disabled={revokePermLoadingId === perm.id}
                        >
                          {revokePermLoadingId === perm.id ? '...' : 'Révoquer'}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}

                {availablePermissions.length > 0 && (
                  <div className="flex gap-2 pt-1">
                    <Select value={selectedPermissionId} onValueChange={setSelectedPermissionId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Accorder une permission…" />
                      </SelectTrigger>
                      <SelectContent>
                        {availablePermissions.map((perm) => (
                          <SelectItem key={perm.id} value={perm.id}>
                            {perm.displayName}
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({perm.resourceType}/{perm.action})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={handleGrantPermission} disabled={!selectedPermissionId || grantLoading}>
                      {grantLoading ? '...' : 'Accorder'}
                    </Button>
                  </div>
                )}
              </div>

              <Separator />

              {/* ── Fonctionnalités ── */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">Fonctionnalités</Label>
                <div className="flex items-center justify-between rounded-md border px-3 py-3">
                  <div>
                    <p className="text-sm font-medium">Mode debug</p>
                    <p className="text-xs text-muted-foreground">
                      Accès au Dev Panel et aux outils de diagnostic
                    </p>
                  </div>
                  <Switch
                    checked={debugModeAccess}
                    onCheckedChange={handleToggleDebugMode}
                    disabled={debugToggleLoading}
                  />
                </div>
              </div>

              {accessError && (
                <p className="text-sm text-destructive">{accessError}</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeAccessDialog}>Fermer</Button>
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
            {resetError && <p className="text-sm text-destructive">{resetError}</p>}
            {resetSuccess && <p className="text-sm text-green-600">Mot de passe réinitialisé avec succès.</p>}
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
