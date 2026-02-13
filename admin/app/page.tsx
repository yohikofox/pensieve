'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('admin_token');

    if (token) {
      // Redirect to dashboard if authenticated
      router.replace('/users');
    } else {
      // Redirect to login if not authenticated
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <p className="text-muted-foreground">Redirection...</p>
      </div>
    </div>
  );
}
