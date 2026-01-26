import { ReactNode } from 'react';
import { BottomNav } from './BottomNav';

interface MobileLayoutProps {
  children: ReactNode;
  showNav?: boolean;
}

export function MobileLayout({ children, showNav = true }: MobileLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className={`flex-1 ${showNav ? 'pb-20' : ''} safe-top`}>
        {children}
      </main>
      {showNav && <BottomNav />}
    </div>
  );
}
