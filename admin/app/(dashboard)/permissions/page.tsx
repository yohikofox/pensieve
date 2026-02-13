'use client';

import { useState, useEffect } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/admin/data-table';
import { PageHeader } from '@/components/admin/page-header';
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
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Permissions" description="Gérer les permissions système" />
      {isLoading ? (
        <p className="text-muted-foreground">Chargement...</p>
      ) : (
        <DataTable columns={columns} data={permissions} />
      )}
    </div>
  );
}
