import { Capacitor } from '@capacitor/core';
import WatchPage from './WatchPage';
import NativeWatchPage from './NativeWatchPage';
import { useIsMobile } from '@/hooks/use-mobile';
import { useIsIPad } from '@/hooks/use-ipad';

/**
 * Smart Watch Page Router
 * Routes to NativeWatchPage on native apps and mobile devices
 * Routes to WatchPage (with full Shaka player) on desktop and iPad (all orientations)
 * iPad always uses desktop Shaka player for fullscreen compatibility
 */
const WatchPageRouter = () => {
  const isNative = Capacitor.isNativePlatform();
  const isMobile = useIsMobile();
  const { isIPad } = useIsIPad();
  
  // Use simplified native player on Android/iOS native apps
  if (isNative) {
    return <NativeWatchPage />;
  }
  
  // iPad always uses desktop layout with full Shaka player (both portrait and landscape)
  if (isIPad) {
    return <WatchPage />;
  }
  
  // Mobile devices use mobile layout
  if (isMobile) {
    return <NativeWatchPage />;
  }
  
  // Desktop uses full-featured watch page with Shaka
  return <WatchPage />;
};

export default WatchPageRouter;
