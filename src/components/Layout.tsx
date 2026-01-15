import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import MobileHeader from './MobileHeader';
import MobileSidebar from './MobileSidebar';
import BottomNav from './BottomNav';
import Header from './Header';
import Sidebar from './Sidebar';
import { PullToRefresh } from './PullToRefresh';
import { Capacitor } from '@capacitor/core';
import { useIsMobile } from '@/hooks/use-mobile';
import { useIsIPad } from '@/hooks/use-ipad';
import { Sheet, SheetContent } from '@/components/ui/sheet';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isNative = Capacitor.isNativePlatform();
  const isMobile = useIsMobile();
  const { isIPad, isIPadPortrait, isIPadLandscape } = useIsIPad();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false);

  const handleRefresh = async () => {
    window.location.reload();
  };

  useEffect(() => {
    const isGuestMode = localStorage.getItem('guestMode') === 'true';
    if (!loading && !user && !isGuestMode) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  const isGuestMode = localStorage.getItem('guestMode') === 'true';
  if (!user && !isGuestMode) {
    return null;
  }

  const isHome = location.pathname === '/';

  // Native app: allow content to render behind the transparent status bar on Home.
  // Other routes keep safe-area padding to avoid unexpected overlaps.
  const topInsetClass = isNative
    ? (isHome ? '' : 'native-safe-area-top')
    : 'pt-[env(safe-area-inset-top)]';

  // Determine if we should use mobile layout:
  // - Native apps always use mobile layout
  // - Mobile devices (< 768px) use mobile layout
  // - iPad in portrait mode uses mobile layout
  // - iPad in landscape mode uses desktop layout
  const useMobileLayout = isNative || isMobile || isIPadPortrait;

  // Mobile / Native / iPad Portrait layout
  if (useMobileLayout) {
    return (
      <div className={`min-h-screen bg-background dark:bg-black ${topInsetClass}`.trim()}>
        <MobileHeader onMenuClick={() => setMobileSidebarOpen(true)} />
        <MobileSidebar isOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />

        <PullToRefresh onRefresh={handleRefresh}>
          <main className="min-h-screen pb-16 px-[1px]">{children}</main>
        </PullToRefresh>

        <BottomNav />
      </div>
    );
  }

  // Desktop layout (restore full desktop header)
  return (
    <div className={`min-h-screen bg-background dark:bg-black ${topInsetClass}`.trim()}>
      <Header onMenuClick={() => setDesktopMenuOpen(true)} />

      <Sheet open={desktopMenuOpen} onOpenChange={setDesktopMenuOpen}>
        <SheetContent side="left" className="p-0">
          <Sidebar onToggle={() => setDesktopMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      <PullToRefresh onRefresh={handleRefresh}>
        <main className="min-h-screen">{children}</main>
      </PullToRefresh>
    </div>
  );
};

export default Layout;

