import { Capacitor } from '@capacitor/core';
import WatchPage from './WatchPage';
import NativeWatchPage from './NativeWatchPage';

/**
 * Smart Watch Page Router
 * Routes to NativeWatchPage (without Shaka player) on native apps
 * Routes to WatchPage (with full Shaka player) on web
 */
const WatchPageRouter = () => {
  const isNative = Capacitor.isNativePlatform();
  
  // Use simplified native player on Android/iOS to avoid Shaka errors
  if (isNative) {
    return <NativeWatchPage />;
  }
  
  // Use full-featured watch page with Shaka on web
  return <WatchPage />;
};

export default WatchPageRouter;
