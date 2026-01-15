import { Capacitor } from '@capacitor/core';
import WatchPage from './WatchPage';
import NativeWatchPage from './NativeWatchPage';
import { useIsMobile } from '@/hooks/use-mobile';
import { useIsIPad } from '@/hooks/use-ipad';

/**
 * Smart Watch Page Router
 * Routes to NativeWatchPage on native apps and mobile devices
 * Routes to WatchPage (with full Shaka player) on desktop and iPad landscape
 * iPad portrait uses mobile layout (NativeWatchPage)
 * iPad landscape uses desktop layout (WatchPage)
 */
const WatchPageRouter = () => {
  const isNative = Capacitor.isNativePlatform();
  const isMobile = useIsMobile();
  const { isIPadPortrait, isIPadLandscape } = useIsIPad();
  
  // Use simplified native player on Android/iOS native apps
  if (isNative) {
    return <NativeWatchPage />;
  }
  
  // iPad landscape uses desktop layout with full Shaka player
  if (isIPadLandscape) {
    return <WatchPage />;
  }
  
  // Mobile devices and iPad portrait use mobile layout
  if (isMobile || isIPadPortrait) {
    return <NativeWatchPage />;
  }
  
  // Desktop uses full-featured watch page with Shaka
  return <WatchPage />;
};

export default WatchPageRouter;
