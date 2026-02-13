'use client';

import { DataTable } from './data-table';
import { PageHeader } from './page-header';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';

interface CrudListProps<T> {
  title: string;
  description: string;
  data: T[];
  columns: ColumnDef<T>[];
  onCreateClick: () => void;
  isLoading?: boolean;
  createLabel?: string;
}

export function CrudList<T>({
  title,
  description,
  data,
  columns,
  onCreateClick,
  isLoading,
  createLabel = 'Créer',
}: CrudListProps<T>) {
  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        description={description}
        actions={
          <Button onClick={onCreateClick}>
            <Plus className="mr-2 h-4 w-4" />
            {createLabel}
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      ) : (
        <DataTable columns={columns} data={data} />
      )}
    </div>
  );
}
