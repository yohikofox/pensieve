'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
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
import { Separator } from '@/components/ui/separator';
import {
  apiClient,
  type PatView,
  type PATAuditLogView,
  type UserDetails,
} from '@/lib/api-client';

const AVAILABLE_SCOPES = [
  'captures:read',
  'captures:write',
  'thoughts:read',
  'todos:read',
  'todos:write',
];

export default function UserPatPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);

  const [pats, setPats] = useState<PatView[]>([]);
  const [auditLogs, setAuditLogs] = useState<PATAuditLogView[]>([]);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Création
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createScopes, setCreateScopes] = useState<string[]>(['captures:read']);
  const [createExpiresInDays, setCreateExpiresInDays] = useState(30);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Révocation
  const [revokeTargetId, setRevokeTargetId] = useState<string | null>(null);
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  // Renouvellement
  const [renewTargetId, setRenewTargetId] = useState<string | null>(null);
  const [renewExpiresInDays, setRenewExpiresInDays] = useState(30);
  const [renewedToken, setRenewedToken] = useState<string | null>(null);
  const [renewLoading, setRenewLoading] = useState(false);
  const [renewError, setRenewError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const [patsData, logsData, details] = await Promise.all([
          apiClient.adminGetUserPats(userId),
          apiClient.adminGetPatAuditLogs(userId),
          apiClient.getUserDetails(userId),
        ]);
        if (cancelled) return;
        setPats(patsData);
        setAuditLogs(logsData);
        setUserDetails(details);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Erreur de chargement';
        if (msg.includes('403') || msg.includes('administrateur')) {
          setError("Impossible de gérer les PATs d'un administrateur");
        } else {
          setError(msg);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [userId]);

  async function loadData() {
    setIsLoading(true);
    setError(null);
    try {
      const [patsData, logsData, details] = await Promise.all([
        apiClient.adminGetUserPats(userId),
        apiClient.adminGetPatAuditLogs(userId),
        apiClient.getUserDetails(userId),
      ]);
      setPats(patsData);
      setAuditLogs(logsData);
      setUserDetails(details);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur de chargement';
      if (msg.includes('403') || msg.includes('administrateur')) {
        setError("Impossible de gérer les PATs d'un administrateur");
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  }

  // ── Création ────────────────────────────────────────────────────────────────

  function openCreateForm() {
    setShowCreateForm(true);
    setCreateName('');
    setCreateScopes(['captures:read']);
    setCreateExpiresInDays(30);
    setNewToken(null);
    setCreateError(null);
  }

  function closeCreateForm() {
    setShowCreateForm(false);
    setNewToken(null);
    setCreateError(null);
  }

  async function handleCreate() {
    if (!createName.trim()) { setCreateError('Le nom est requis.'); return; }
    if (createScopes.length === 0) { setCreateError('Au moins un scope requis.'); return; }

    setCreateLoading(true);
    setCreateError(null);
    try {
      const result = await apiClient.adminCreateUserPat(userId, {
        name: createName,
        scopes: createScopes,
        expiresInDays: createExpiresInDays,
      });
      setNewToken(result.token);
      await loadData();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Erreur lors de la création.');
    } finally {
      setCreateLoading(false);
    }
  }

  function toggleScope(scope: string) {
    setCreateScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  }

  // ── Révocation ──────────────────────────────────────────────────────────────

  async function handleRevoke() {
    if (!revokeTargetId) return;
    setRevokeLoading(true);
    setRevokeError(null);
    try {
      await apiClient.adminRevokeUserPat(userId, revokeTargetId);
      setRevokeTargetId(null);
      await loadData();
    } catch (err) {
      setRevokeError(err instanceof Error ? err.message : 'Erreur lors de la révocation.');
    } finally {
      setRevokeLoading(false);
    }
  }

  // ── Renouvellement ──────────────────────────────────────────────────────────

  function openRenewDialog(patId: string) {
    setRenewTargetId(patId);
    setRenewExpiresInDays(30);
    setRenewedToken(null);
    setRenewError(null);
  }

  async function handleRenew() {
    if (!renewTargetId) return;
    setRenewLoading(true);
    setRenewError(null);
    try {
      const result = await apiClient.adminRenewUserPat(userId, renewTargetId, {
        expiresInDays: renewExpiresInDays,
      });
      setRenewedToken(result.token);
      await loadData();
    } catch (err) {
      setRenewError(err instanceof Error ? err.message : 'Erreur lors du renouvellement.');
    } finally {
      setRenewLoading(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-4xl">
      {/* En-tête */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/users">← Retour</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Accès API</h1>
          {userDetails ? (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">{userDetails.user.email}</span>
              <span className="ml-2 font-mono text-xs opacity-60">{userId}</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground font-mono">{userId}</p>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Chargement...</p>
      ) : !error && (
        <>
          {/* ── PATs ── */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Tokens d&apos;accès personnel</h2>
              <Button size="sm" onClick={openCreateForm} disabled={showCreateForm}>
                Créer un token
              </Button>
            </div>

            {pats.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Aucun token créé.</p>
            ) : (
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Nom</th>
                      <th className="text-left px-4 py-2 font-medium">Préfixe</th>
                      <th className="text-left px-4 py-2 font-medium">Scopes</th>
                      <th className="text-left px-4 py-2 font-medium">Expiration</th>
                      <th className="text-left px-4 py-2 font-medium">Statut</th>
                      <th className="text-left px-4 py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pats.map((pat) => {
                      const isRevoked = !!pat.revokedAt;
                      const isExpired = !isRevoked && new Date(pat.expiresAt) < new Date();
                      const status = isRevoked ? 'révoqué' : isExpired ? 'expiré' : 'actif';
                      return (
                        <tr key={pat.id} className="border-t">
                          <td className="px-4 py-2 font-medium">{pat.name}</td>
                          <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                            {pat.prefix ?? '—'}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex flex-wrap gap-1">
                              {pat.scopes.map((s) => (
                                <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {new Date(pat.expiresAt).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="px-4 py-2">
                            <Badge variant={status === 'actif' ? 'default' : 'secondary'}>
                              {status}
                            </Badge>
                          </td>
                          <td className="px-4 py-2">
                            {!isRevoked && (
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openRenewDialog(pat.id)}
                                >
                                  Renouveler
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => setRevokeTargetId(pat.id)}
                                >
                                  Révoquer
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Formulaire de création inline */}
            {showCreateForm && (
              <div className="rounded-lg border p-4 space-y-4 bg-muted/20">
                <h3 className="font-medium">Nouveau token</h3>

                {newToken ? (
                  <div className="space-y-2">
                    <p className="text-sm text-green-700 font-medium">
                      Token créé. Transmettez-le de manière sécurisée — il ne sera plus affiché.
                    </p>
                    <code className="block bg-muted rounded p-2 text-xs font-mono break-all">
                      {newToken}
                    </code>
                    <Button variant="outline" size="sm" onClick={closeCreateForm}>
                      Fermer
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <Label>Nom</Label>
                      <Input
                        value={createName}
                        onChange={(e) => setCreateName(e.target.value)}
                        placeholder="Ex: MCP Integration"
                        disabled={createLoading}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Scopes</Label>
                      <div className="flex flex-wrap gap-2">
                        {AVAILABLE_SCOPES.map((scope) => (
                          <label key={scope} className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={createScopes.includes(scope)}
                              onChange={() => toggleScope(scope)}
                              disabled={createLoading}
                            />
                            <span className="text-sm">{scope}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label>Durée de validité (jours)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        value={createExpiresInDays}
                        onChange={(e) => setCreateExpiresInDays(Number(e.target.value))}
                        disabled={createLoading}
                        className="w-32"
                      />
                    </div>

                    {createError && <p className="text-sm text-destructive">{createError}</p>}

                    <div className="flex gap-2">
                      <Button onClick={handleCreate} disabled={createLoading}>
                        {createLoading ? 'Création...' : 'Créer'}
                      </Button>
                      <Button variant="outline" onClick={closeCreateForm} disabled={createLoading}>
                        Annuler
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </section>

          <Separator />

          {/* ── Historique d'audit ── */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Historique des actions admin</h2>

            {auditLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Aucune action admin enregistrée.</p>
            ) : (
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Action</th>
                      <th className="text-left px-4 py-2 font-medium">Date</th>
                      <th className="text-left px-4 py-2 font-medium">Admin ID</th>
                      <th className="text-left px-4 py-2 font-medium">PAT ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="border-t">
                        <td className="px-4 py-2">
                          <Badge
                            variant={
                              log.action === 'create'
                                ? 'default'
                                : log.action === 'revoke'
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {log.action}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString('fr-FR')}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-muted-foreground truncate max-w-32">
                          {log.adminId}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-muted-foreground truncate max-w-32">
                          {log.patId}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* ── Dialog révocation ── */}
      <Dialog open={!!revokeTargetId} onOpenChange={(open) => { if (!open) { setRevokeTargetId(null); setRevokeError(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Révoquer ce token ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Cette action est irréversible. Le token ne pourra plus être utilisé.
          </p>
          {revokeError && <p className="text-sm text-destructive">{revokeError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRevokeTargetId(null); setRevokeError(null); }} disabled={revokeLoading}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={revokeLoading}>
              {revokeLoading ? 'Révocation...' : 'Révoquer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog renouvellement ── */}
      <Dialog open={!!renewTargetId} onOpenChange={(open) => { if (!open) { setRenewTargetId(null); setRenewedToken(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Renouveler le token</DialogTitle>
          </DialogHeader>

          {renewedToken ? (
            <div className="space-y-2">
              <p className="text-sm text-green-700 font-medium">
                Token renouvelé. Transmettez-le de manière sécurisée — il ne sera plus affiché.
              </p>
              <code className="block bg-muted rounded p-2 text-xs font-mono break-all">
                {renewedToken}
              </code>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Durée de validité (jours)</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={renewExpiresInDays}
                  onChange={(e) => setRenewExpiresInDays(Number(e.target.value))}
                  disabled={renewLoading}
                  className="w-32"
                />
              </div>
              {renewError && <p className="text-sm text-destructive">{renewError}</p>}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setRenewTargetId(null); setRenewedToken(null); }}
              disabled={renewLoading}
            >
              {renewedToken ? 'Fermer' : 'Annuler'}
            </Button>
            {!renewedToken && (
              <Button onClick={handleRenew} disabled={renewLoading}>
                {renewLoading ? 'Renouvellement...' : 'Renouveler'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
