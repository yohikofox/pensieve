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

interface Permission {
  id: string;
  name: string;
  displayName: string;
  resourceType: string;
  action: string;
  isPaidFeature: boolean;
}

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [featuresPermTarget, setFeaturesPermTarget] = useState<Permission | null>(null);

  useEffect(() => {
    loadPermissions();
  }, []);

  async function loadPermissions() {
    try {
      const data = await apiClient.getPermissions();
      setPermissions(data);
    } catch (error) {
      console.error('Failed to load permissions:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const columns: ColumnDef<Permission>[] = [
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
      accessorKey: 'resourceType',
      header: 'Resource',
      cell: ({ row }) => (
        <Badge variant="outline">{row.original.resourceType}</Badge>
      ),
    },
    {
      accessorKey: 'action',
      header: 'Action',
    },
    {
      accessorKey: 'isPaidFeature',
      header: 'Payant',
      cell: ({ row }) => (
        row.original.isPaidFeature ? <Badge>Premium</Badge> : <Badge variant="secondary">Free</Badge>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFeaturesPermTarget(row.original)}
        >
          Feature Flags
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Permissions" description="Gérer les permissions système" />
      {isLoading ? (
        <p className="text-muted-foreground">Chargement...</p>
      ) : (
        <DataTable columns={columns} data={permissions} />
      )}

      <Dialog
        open={!!featuresPermTarget}
        onOpenChange={(open) => { if (!open) setFeaturesPermTarget(null); }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Feature Flags — {featuresPermTarget?.displayName}</DialogTitle>
          </DialogHeader>
          {featuresPermTarget && (
            <FeatureFlagAssignments
              targetId={featuresPermTarget.id}
              targetType="permission"
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeaturesPermTarget(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
