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
import { DataTable } from '@/components/admin/data-table';
import { PageHeader } from '@/components/admin/page-header';
import { apiClient } from '@/lib/api-client';

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
        <Button
          variant="outline"
          size="sm"
          onClick={() => openResetDialog(row.original)}
        >
          Réinitialiser MDP
        </Button>
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
            {isSyncing ? 'Sync en cours...' : 'Synchroniser les utilisateurs'}
          </Button>
        </div>
      </div>
      <DataTable columns={columns} data={users} />

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
