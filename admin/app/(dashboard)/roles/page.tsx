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
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable } from '@/components/admin/data-table';
import { PageHeader } from '@/components/admin/page-header';
import { FeatureFlagAssignments } from '@/components/admin/feature-flag-assignments';
import { apiClient, type Permission } from '@/lib/api-client';

interface Role {
  id: string;
  name: string;
  displayName: string;
  isSystem: boolean;
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [featuresRoleTarget, setFeaturesRoleTarget] = useState<Role | null>(null);

  // Permissions dialog state
  const [permsRoleTarget, setPermsRoleTarget] = useState<Role | null>(null);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [assignedPermIds, setAssignedPermIds] = useState<Set<string>>(new Set());
  const [permsLoading, setPermsLoading] = useState(false);
  const [permsError, setPermsError] = useState<string | null>(null);

  useEffect(() => {
    loadRoles();
  }, []);

  async function loadRoles() {
    try {
      const data = await apiClient.getRoles();
      setRoles(data);
    } catch (error) {
      console.error('Failed to load roles:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function openPermsDialog(role: Role) {
    setPermsRoleTarget(role);
    setPermsLoading(true);
    setPermsError(null);
    try {
      const [all, assigned] = await Promise.all([
        apiClient.getPermissions(),
        apiClient.getRolePermissions(role.id),
      ]);
      setAllPermissions(all);
      setAssignedPermIds(new Set(assigned.map((p) => p.id)));
    } catch {
      setPermsError('Erreur lors du chargement des permissions');
    } finally {
      setPermsLoading(false);
    }
  }

  async function handleTogglePermission(permId: string, checked: boolean) {
    if (!permsRoleTarget) return;
    try {
      if (checked) {
        await apiClient.assignRolePermissions(permsRoleTarget.id, { permissionIds: [permId] });
        setAssignedPermIds((prev) => new Set([...prev, permId]));
      } else {
        await apiClient.revokeRolePermission(permsRoleTarget.id, permId);
        setAssignedPermIds((prev) => {
          const next = new Set(prev);
          next.delete(permId);
          return next;
        });
      }
    } catch {
      setPermsError('Erreur lors de la mise à jour');
    }
  }

  const permissionsByResource = allPermissions.reduce<Record<string, Permission[]>>(
    (acc, p) => {
      if (!acc[p.resourceType]) acc[p.resourceType] = [];
      acc[p.resourceType].push(p);
      return acc;
    },
    {}
  );

  const columns: ColumnDef<Role>[] = [
    {
      accessorKey: 'displayName',
      header: 'Nom',
    },
    {
      accessorKey: 'name',
      header: 'Identifiant',
      cell: ({ row }) => <code className="text-xs">{row.original.name}</code>,
    },
    {
      accessorKey: 'isSystem',
      header: 'Type',
      cell: ({ row }) => (
        <Badge variant={row.original.isSystem ? 'secondary' : 'outline'}>
          {row.original.isSystem ? 'Système' : 'Custom'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openPermsDialog(row.original)}
          >
            Permissions
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFeaturesRoleTarget(row.original)}
          >
            Feature Flags
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Rôles" description="Gérer les rôles et permissions" />
      {isLoading ? (
        <p className="text-muted-foreground">Chargement...</p>
      ) : (
        <DataTable columns={columns} data={roles} />
      )}

      {/* Permissions Dialog */}
      <Dialog
        open={!!permsRoleTarget}
        onOpenChange={(open) => { if (!open) setPermsRoleTarget(null); }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Permissions — {permsRoleTarget?.displayName}</DialogTitle>
          </DialogHeader>
          {permsLoading && <p className="text-muted-foreground text-sm">Chargement...</p>}
          {permsError && <p className="text-destructive text-sm">{permsError}</p>}
          {!permsLoading && !permsError && (
            <div className="space-y-4">
              {Object.entries(permissionsByResource).map(([resource, perms]) => (
                <div key={resource}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">{resource}</p>
                  <div className="space-y-2">
                    {perms.map((perm) => (
                      <label key={perm.id} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={assignedPermIds.has(perm.id)}
                          onCheckedChange={(checked) =>
                            handleTogglePermission(perm.id, checked === true)
                          }
                        />
                        <span className="text-sm">{perm.displayName}</span>
                        <code className="text-xs text-muted-foreground ml-auto">{perm.action}</code>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermsRoleTarget(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feature Flags Dialog */}
      <Dialog
        open={!!featuresRoleTarget}
        onOpenChange={(open) => { if (!open) setFeaturesRoleTarget(null); }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Feature Flags — {featuresRoleTarget?.displayName}</DialogTitle>
          </DialogHeader>
          {featuresRoleTarget && (
            <FeatureFlagAssignments
              targetId={featuresRoleTarget.id}
              targetType="role"
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeaturesRoleTarget(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
