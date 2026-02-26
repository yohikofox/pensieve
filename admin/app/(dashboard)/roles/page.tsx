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
import { DataTable } from '@/components/admin/data-table';
import { PageHeader } from '@/components/admin/page-header';
import { FeatureFlagAssignments } from '@/components/admin/feature-flag-assignments';
import { apiClient } from '@/lib/api-client';

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
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFeaturesRoleTarget(row.original)}
        >
          Feature Flags
        </Button>
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
