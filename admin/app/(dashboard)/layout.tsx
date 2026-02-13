'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SidebarNav } from '@/components/admin/sidebar-nav';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('admin_token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-background p-6">
        <div className="mb-8">
          <h2 className="text-2xl font-bold">Admin</h2>
          <p className="text-sm text-muted-foreground">Pensieve Backoffice</p>
        </div>
        <SidebarNav />
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
