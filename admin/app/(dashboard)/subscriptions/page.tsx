'use client';

import { useState, useEffect } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/admin/data-table';
import { PageHeader } from '@/components/admin/page-header';
import { apiClient } from '@/lib/api-client';

interface Tier {
  id: string;
  name: string;
  priceMonthly: number;
  isActive: boolean;
}

export default function SubscriptionsPage() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTiers();
  }, []);

  async function loadTiers() {
    try {
      const data = await apiClient.getTiers();
      setTiers(data);
    } catch (error) {
      console.error('Failed to load tiers:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const columns: ColumnDef<Tier>[] = [
    {
      accessorKey: 'name',
      header: 'Nom',
    },
    {
      accessorKey: 'priceMonthly',
      header: 'Prix/mois',
      cell: ({ row }) => `€${row.original.priceMonthly}`,
    },
    {
      accessorKey: 'isActive',
      header: 'Statut',
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? 'default' : 'secondary'}>
          {row.original.isActive ? 'Actif' : 'Inactif'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Abonnements" description="Gérer les tiers d'abonnement" />
      {isLoading ? (
        <p className="text-muted-foreground">Chargement...</p>
      ) : (
        <DataTable columns={columns} data={tiers} />
      )}
    </div>
  );
}
