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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { DataTable } from '@/components/admin/data-table';
import { PageHeader } from '@/components/admin/page-header';
import { apiClient, FeatureItem } from '@/lib/api-client';

/**
 * Page catalogue Feature Flags
 * Story 24.2: AC5 — Liste des features avec key / description / defaultValue
 * Permet de créer et modifier des features.
 */
export default function FeaturesPage() {
  const [features, setFeatures] = useState<FeatureItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // État pour le formulaire de création
  const [createOpen, setCreateOpen] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDefaultValue, setNewDefaultValue] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  // État pour l'édition inline de description
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    loadFeatures();
  }, []);

  async function loadFeatures() {
    try {
      const data = await apiClient.getAdminFeatures();
      setFeatures(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate() {
    if (!newKey.trim()) return;
    setCreateLoading(true);
    setError(null);
    try {
      const created = await apiClient.createAdminFeature({
        key: newKey.trim(),
        description: newDescription.trim() || undefined,
        defaultValue: newDefaultValue,
      });
      setFeatures((prev) => [...prev, created]);
      setCreateOpen(false);
      setNewKey('');
      setNewDescription('');
      setNewDefaultValue(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création');
    } finally {
      setCreateLoading(false);
    }
  }

  function startEdit(feature: FeatureItem) {
    setEditingId(feature.id);
    setEditDescription(feature.description ?? '');
  }

  async function handleEditSave(id: string) {
    setEditLoading(true);
    setError(null);
    try {
      const updated = await apiClient.updateAdminFeature(id, {
        description: editDescription,
      });
      setFeatures((prev) => prev.map((f) => (f.id === id ? updated : f)));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
    } finally {
      setEditLoading(false);
    }
  }

  const columns: ColumnDef<FeatureItem>[] = [
    {
      accessorKey: 'key',
      header: 'Clé',
      cell: ({ row }) => (
        <code className="text-xs font-mono">{row.original.key}</code>
      ),
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => {
        const feature = row.original;
        if (editingId === feature.id) {
          return (
            <div className="flex items-center gap-2">
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="h-7 text-xs"
                autoFocus
              />
              <Button
                size="sm"
                variant="default"
                onClick={() => handleEditSave(feature.id)}
                disabled={editLoading}
              >
                OK
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingId(null)}
                disabled={editLoading}
              >
                ✕
              </Button>
            </div>
          );
        }
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {feature.description || <em className="text-xs">—</em>}
            </span>
            <button
              onClick={() => startEdit(feature)}
              className="text-xs text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
              title="Modifier la description"
            >
              ✏️
            </button>
          </div>
        );
      },
    },
    {
      accessorKey: 'defaultValue',
      header: 'Défaut',
      cell: ({ row }) => (
        <Badge variant={row.original.defaultValue ? 'default' : 'secondary'}>
          {row.original.defaultValue ? 'true' : 'false'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Feature Flags"
          description="Catalogue des fonctionnalités contrôlées par feature flags"
        />
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>+ Nouvelle feature</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer une feature</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label htmlFor="new-key">Clé (snake_case)</Label>
                <Input
                  id="new-key"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="ex: my_feature"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-desc">Description</Label>
                <Input
                  id="new-desc"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Description optionnelle"
                />
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="new-default">Valeur par défaut</Label>
                <Switch
                  id="new-default"
                  checked={newDefaultValue}
                  onCheckedChange={setNewDefaultValue}
                />
                <span className="text-sm">{newDefaultValue ? 'true' : 'false'}</span>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleCreate} disabled={createLoading || !newKey.trim()}>
                  Créer
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {error && !createOpen && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Chargement...</p>
      ) : (
        <DataTable columns={columns} data={features} />
      )}
    </div>
  );
}
