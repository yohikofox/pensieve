'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient, UserStats, SubscriptionStats, ContentStats, SystemStats } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';
import { Users, CreditCard, FileText, Activity } from 'lucide-react';

export default function DashboardPage() {
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [subscriptionStats, setSubscriptionStats] = useState<SubscriptionStats | null>(null);
  const [contentStats, setContentStats] = useState<ContentStats | null>(null);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
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

      const [users, subscriptions, content, system] = await Promise.all([
        apiClient.getUserStats(),
        apiClient.getSubscriptionStats(),
        apiClient.getContentStats(),
        apiClient.getSystemStats(),
      ]);

      setUserStats(users);
      setSubscriptionStats(subscriptions);
      setContentStats(content);
      setSystemStats(system);
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
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Erreur: {error}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Vérifiez que le backend est lancé et que vous avez la permission admin.access
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Vue d'ensemble de l'application</p>
        </div>
        <div className="flex items-center justify-center h-32">
          <p className="text-muted-foreground">Chargement des statistiques...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Vue d'ensemble de l'application</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Utilisateurs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userStats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              <Badge variant="secondary" className="mr-1">
                {userStats?.active || 0}
              </Badge>
              actifs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Revenue MRR</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              €{subscriptionStats?.totalRevenue.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              {subscriptionStats?.tierStats.reduce((sum, t) => sum + t.subscribers, 0) || 0} abonnés payants
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Thoughts</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contentStats?.thoughts.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              +{contentStats?.thoughts.recent || 0} ce mois
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Système</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Badge variant={systemStats?.database === 'healthy' ? 'default' : 'destructive'}>
                {systemStats?.database || 'unknown'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Database status</p>
          </CardContent>
        </Card>
      </div>

      {/* Growth Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Croissance utilisateurs</CardTitle>
            <CardDescription>Derniers 30 jours</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Nouveaux utilisateurs</span>
                <span className="text-sm font-medium">{userStats?.recentUsers || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Taux de croissance</span>
                <span className="text-sm font-medium">
                  {userStats?.growthRate.toFixed(1)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Abonnements par tier</CardTitle>
            <CardDescription>Répartition des abonnés</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {subscriptionStats?.tierStats.map((tier) => (
                <div key={tier.tierName} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground capitalize">
                    {tier.tierName}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{tier.subscribers}</Badge>
                    <span className="text-sm font-medium">€{tier.revenue.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Activité récente</CardTitle>
          <CardDescription>Contenu créé ces 30 derniers jours</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <p className="text-sm font-medium">Thoughts</p>
              <p className="text-2xl font-bold">{contentStats?.thoughts.recent || 0}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Ideas</p>
              <p className="text-2xl font-bold">{contentStats?.ideas.recent || 0}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Todos</p>
              <p className="text-2xl font-bold">{contentStats?.todos.recent || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
