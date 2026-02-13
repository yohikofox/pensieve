'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/admin/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient, ContentStats } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';
import { FileText, Lightbulb, CheckSquare } from 'lucide-react';

export default function ContentPage() {
  const [stats, setStats] = useState<ContentStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      setIsLoading(true);
      const token = await getAccessToken();
      if (token) {
        apiClient.setAccessToken(token);
      }

      const data = await apiClient.getContentStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
      setError(error instanceof Error ? error.message : 'Failed to load stats');
    } finally {
      setIsLoading(false);
    }
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Modération de contenu</h1>
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">Erreur: {error}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Modération de contenu"
          description="Vue d'ensemble du contenu créé par les utilisateurs"
        />
        <div className="flex items-center justify-center h-32">
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Modération de contenu"
        description="Vue d'ensemble du contenu créé par les utilisateurs"
      />

      <div className="grid gap-4 md:grid-cols-3">
        {/* Thoughts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Thoughts</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.thoughts.total || 0}</div>
            <div className="text-xs text-muted-foreground">
              <Badge variant="secondary" className="mr-1">
                {stats?.thoughts.recent || 0}
              </Badge>
              créés ces 30 derniers jours
            </div>
          </CardContent>
        </Card>

        {/* Ideas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ideas</CardTitle>
            <Lightbulb className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.ideas.total || 0}</div>
            <div className="text-xs text-muted-foreground">
              <Badge variant="secondary" className="mr-1">
                {stats?.ideas.recent || 0}
              </Badge>
              créées ces 30 derniers jours
            </div>
          </CardContent>
        </Card>

        {/* Todos */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Todos</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.todos.total || 0}</div>
            <div className="text-xs text-muted-foreground">
              <Badge variant="secondary" className="mr-1">
                {stats?.todos.recent || 0}
              </Badge>
              créés ces 30 derniers jours
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Informations supplémentaires */}
      <Card>
        <CardHeader>
          <CardTitle>Actions de modération</CardTitle>
          <CardDescription>
            Fonctionnalités de modération à venir
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="rounded-lg border border-muted bg-muted/20 p-4">
              <h4 className="text-sm font-semibold mb-2">Prochaines fonctionnalités</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Liste complète des thoughts avec pagination</li>
                <li>• Recherche et filtres avancés</li>
                <li>• Suppression de contenu inapproprié</li>
                <li>• Signalement de contenu par les utilisateurs</li>
                <li>• Modération en masse</li>
              </ul>
            </div>
            <p className="text-sm text-muted-foreground">
              Pour le moment, seules les statistiques sont disponibles. Les fonctionnalités de
              modération seront ajoutées dans une prochaine version.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
