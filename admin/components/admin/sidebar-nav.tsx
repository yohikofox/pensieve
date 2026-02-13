'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Users, Shield, Key, CreditCard, FileText, BarChart } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: BarChart },
  { href: '/users', label: 'Utilisateurs', icon: Users },
  { href: '/roles', label: 'Rôles', icon: Shield },
  { href: '/permissions', label: 'Permissions', icon: Key },
  { href: '/subscriptions', label: 'Abonnements', icon: CreditCard },
  { href: '/content', label: 'Contenu', icon: FileText },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col space-y-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:bg-accent',
              isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
