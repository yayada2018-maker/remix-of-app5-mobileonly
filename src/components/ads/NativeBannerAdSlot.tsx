import { useEffect, useState, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import AdSlot from './AdSlot';
import { useFullscreenState } from '@/hooks/useFullscreenState';

interface AppAd {
  id: string;
  name: string;
  ad_type: string;
  ad_unit_id: string;
  platform: string;
  placement: string;
  is_active: boolean;
  is_test_mode: boolean;
  priority: number;
  frequency_cap?: number | null;
  show_after_seconds?: number | null;
  reward_amount?: number | null;
  reward_type?: string | null;
}

interface AdMobSettings {
  enabled: boolean;
  test_mode: boolean;
}

interface NativeBannerAdSlotProps {
  placement: string;
  className?: string;
  position?: 'top' | 'bottom' | 'inline';
  pageLocation?: string;
  /** Hide ad during video fullscreen mode */
  hideInFullscreen?: boolean;
  /** Callback when rewarded ad is completed */
  onRewardEarned?: (amount: number, type: string) => void;
}

// AdMob Plugin interface
interface AdMobPlugin {
  showBanner: (options: {
    adId: string;
    adSize?: string;
    position?: 'TOP_CENTER' | 'BOTTOM_CENTER';
    margin?: number;
    isTesting?: boolean;
  }) => Promise<void>;
  hideBanner: () => Promise<void>;
  prepareInterstitial?: (options: { adId: string; isTesting?: boolean }) => Promise<void>;
  showInterstitial?: () => Promise<void>;
  prepareRewardVideoAd?: (options: { adId: string; isTesting?: boolean }) => Promise<void>;
  showRewardVideoAd?: () => Promise<{ type: string; amount: number }>;
}

// Get AdMob plugin
const getAdMobPlugin = (): AdMobPlugin | null => {
  try {
    const AdMob = (window as any).Capacitor?.Plugins?.AdMob || (window as any).AdMob;
    return AdMob || null;
  } catch {
    return null;
  }
};

/**
 * Universal Native Ad Slot for Capacitor apps
 * Supports all ad types: banner, interstitial, rewarded, native, app_open
 * Falls back to web ads for non-native platforms
 * 
 * Respects edge-to-edge immersive mode:
 * - Hides during fullscreen video playback
 * - Adds safe area margins for notched devices
 */
export function NativeBannerAdSlot({ 
  placement, 
  className = '', 
  position = 'inline', 
  pageLocation = 'watch',
  hideInFullscreen = true,
  onRewardEarned
}: NativeBannerAdSlotProps) {
  const [isNative, setIsNative] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [bannerShown, setBannerShown] = useState(false);
  const [webAdCode, setWebAdCode] = useState<string | null>(null);
  const [adConfig, setAdConfig] = useState<{ ad: AppAd; settings: AdMobSettings } | null>(null);
  const [adError, setAdError] = useState<string | null>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [isInView, setIsInView] = useState(false);
  
  // Track fullscreen state to hide ads during immersive video
  const isFullscreen = useFullscreenState();

  // Check if native platform
  useEffect(() => {
    const native = Capacitor.isNativePlatform();
    setIsNative(native);
    
    if (native) {
      fetchAdConfig();
    } else {
      fetchWebAd();
    }
  }, [placement]);

  // Intersection observer to track visibility
  useEffect(() => {
    if (!slotRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const isVisible = entries[0]?.isIntersecting ?? false;
        setIsInView(isVisible);
      },
      { threshold: 0.1 }
    );

    observerRef.current.observe(slotRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  // Fetch native AdMob config from Supabase - supports ALL ad types
  const fetchAdConfig = async () => {
    try {
      const platform = Capacitor.getPlatform();
      
      // Fetch ad for this placement - any ad type
      const { data: adsData, error: adsError } = await supabase
        .from('app_ads')
        .select('*')
        .eq('is_active', true)
        .eq('placement', placement)
        .or(`platform.eq.${platform},platform.eq.both`)
        .order('priority', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (adsError) {
        console.error('[NativeAdSlot] Error fetching ad:', adsError);
      }

      // Fetch global settings
      const { data: settingsData } = await supabase
        .from('app_ad_settings')
        .select('*')
        .eq('setting_key', 'global_settings')
        .maybeSingle();

      const rawSettings = settingsData?.setting_value as Record<string, unknown> | null;
      const settings: AdMobSettings = {
        enabled: (rawSettings?.enabled as boolean) ?? true,
        test_mode: (rawSettings?.test_mode as boolean) ?? true,
      };
      
      if (adsData && settings.enabled) {
        setAdConfig({ ad: adsData, settings });
        console.log('[NativeAdSlot] Loaded config for placement:', placement, {
          name: adsData.name,
          type: adsData.ad_type,
          unitId: adsData.ad_unit_id?.substring(0, 20) + '...',
          testMode: settings.test_mode || adsData.is_test_mode
        });
      } else {
        console.log('[NativeAdSlot] No active ad found for placement:', placement, 'Trying web fallback...');
        // Try fetching web ad as fallback
        await fetchWebAd();
      }
    } catch (error) {
      console.error('[NativeAdSlot] Error fetching config:', error);
      setAdError('Failed to load ad configuration');
      await fetchWebAd();
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch web ad as fallback
  const fetchWebAd = async () => {
    try {
      const { data } = await supabase
        .from('ads')
        .select('ad_code, image_url, link_url')
        .eq('placement', placement)
        .eq('is_active', true)
        .order('priority', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.ad_code) {
        setWebAdCode(data.ad_code);
        console.log('[NativeAdSlot] Web ad loaded for placement:', placement);
      }
    } catch (error) {
      console.log('[NativeAdSlot] Could not fetch web ad for placement:', placement);
    } finally {
      setIsLoading(false);
    }
  };

  // Show native AdMob ad based on type
  const showAd = useCallback(async () => {
    if (!adConfig || !isInView) return;
    
    // Don't show if in fullscreen mode
    if (hideInFullscreen && isFullscreen) {
      console.log('[NativeAdSlot] Skipping - fullscreen active');
      return;
    }

    const AdMob = getAdMobPlugin();
    if (!AdMob) {
      console.log('[NativeAdSlot] AdMob plugin not available - native ads require @capacitor-community/admob');
      return;
    }

    const { ad, settings } = adConfig;
    const useTestMode = settings.test_mode || ad.is_test_mode;

    try {
      switch (ad.ad_type) {
        case 'banner':
        case 'native':
          if (bannerShown) return;
          
          const adPosition = position === 'top' ? 'TOP_CENTER' : 
                            position === 'bottom' ? 'BOTTOM_CENTER' : 'BOTTOM_CENTER';
          
          // Add margin for safe area (status bar at top, navigation at bottom)
          const safeAreaMargin = position === 'top' ? 24 : 0;

          await AdMob.showBanner({
            adId: ad.ad_unit_id,
            adSize: 'ADAPTIVE_BANNER',
            position: adPosition,
            margin: safeAreaMargin,
            isTesting: useTestMode,
          });

          setBannerShown(true);
          console.log('[NativeAdSlot] Banner shown for placement:', placement);
          break;

        case 'interstitial':
          if (AdMob.prepareInterstitial && AdMob.showInterstitial) {
            await AdMob.prepareInterstitial({
              adId: ad.ad_unit_id,
              isTesting: useTestMode,
            });
            await AdMob.showInterstitial();
            console.log('[NativeAdSlot] Interstitial shown for placement:', placement);
          }
          break;

        case 'rewarded':
          if (AdMob.prepareRewardVideoAd && AdMob.showRewardVideoAd) {
            await AdMob.prepareRewardVideoAd({
              adId: ad.ad_unit_id,
              isTesting: useTestMode,
            });
            const result = await AdMob.showRewardVideoAd();
            console.log('[NativeAdSlot] Rewarded ad completed:', result);
            
            if (onRewardEarned) {
              onRewardEarned(
                result.amount || ad.reward_amount || 1,
                result.type || ad.reward_type || 'coins'
              );
            }
          }
          break;

        case 'app_open':
          // App open ads typically shown via different mechanism
          console.log('[NativeAdSlot] App open ad - should be triggered on app resume');
          break;

        default:
          console.log('[NativeAdSlot] Unknown ad type:', ad.ad_type);
      }
    } catch (error) {
      console.error('[NativeAdSlot] Failed to show ad:', error);
      setAdError('Failed to display ad');
    }
  }, [adConfig, bannerShown, isInView, placement, position, isFullscreen, hideInFullscreen, onRewardEarned]);

  // Hide native AdMob banner
  const hideBanner = useCallback(async () => {
    if (!bannerShown) return;

    const AdMob = getAdMobPlugin();
    if (!AdMob) return;

    try {
      await AdMob.hideBanner();
      setBannerShown(false);
      console.log('[NativeAdSlot] Banner hidden');
    } catch (error) {
      console.error('[NativeAdSlot] Failed to hide banner:', error);
    }
  }, [bannerShown]);

  // Hide banner when entering fullscreen
  useEffect(() => {
    if (hideInFullscreen && isFullscreen && bannerShown) {
      hideBanner();
    }
  }, [isFullscreen, hideInFullscreen, bannerShown, hideBanner]);

  // Show/hide banner based on visibility (only when not in fullscreen)
  useEffect(() => {
    if (!isNative || !adConfig) return;
    
    // Only handle banner/native type ads for visibility-based showing
    if (adConfig.ad.ad_type !== 'banner' && adConfig.ad.ad_type !== 'native') return;
    
    // Skip if in fullscreen
    if (hideInFullscreen && isFullscreen) return;

    if (isInView) {
      showAd();
    } else if (bannerShown) {
      hideBanner();
    }
  }, [isNative, adConfig, isInView, showAd, hideBanner, bannerShown, isFullscreen, hideInFullscreen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isNative && bannerShown) {
        const AdMob = getAdMobPlugin();
        AdMob?.hideBanner?.().catch(() => {});
      }
    };
  }, [isNative, bannerShown]);

  // Don't render anything during fullscreen
  if (hideInFullscreen && isFullscreen) {
    return null;
  }

  // Native platform - render placeholder div for positioning
  if (isNative) {
    if (isLoading) {
      return (
        <div 
          ref={slotRef} 
          className={`w-full h-14 bg-muted/20 animate-pulse flex items-center justify-center rounded-md ${className}`}
          style={{ 
            paddingBottom: position === 'bottom' ? 'env(safe-area-inset-bottom, 0px)' : undefined,
            paddingTop: position === 'top' ? 'env(safe-area-inset-top, 0px)' : undefined
          }}
        >
          <span className="text-xs text-muted-foreground">Loading Ad...</span>
        </div>
      );
    }

    if (!adConfig) {
      // No ad configured - return empty spacer in development, nothing in production
      if (process.env.NODE_ENV === 'development') {
        return (
          <div 
            ref={slotRef}
            className={`w-full h-14 border border-dashed border-muted-foreground/30 rounded-md flex items-center justify-center ${className}`}
          >
            <span className="text-xs text-muted-foreground">Ad: {placement}</span>
          </div>
        );
      }
      return null;
    }

    // For inline position (like between cast and tabs), render a spacer
    if (position === 'inline') {
      return (
        <div 
          ref={slotRef} 
          className={`w-full rounded-md overflow-hidden ${className}`}
          style={{ minHeight: '60px' }}
          data-placement={placement}
          data-ad-type={adConfig.ad.ad_type}
          data-banner-active={bannerShown}
        >
          {/* Native banner will overlay, this is positioning spacer */}
          {adConfig.ad.ad_type === 'banner' || adConfig.ad.ad_type === 'native' ? (
            <div className="w-full h-14 bg-muted/10 flex items-center justify-center">
              {!bannerShown && (
                <span className="text-xs text-muted-foreground animate-pulse">
                  {adConfig.ad.name || 'Loading Ad...'}
                </span>
              )}
            </div>
          ) : null}
        </div>
      );
    }

    // Top/bottom positioned native banner will overlay on top, this is just a spacer with safe area
    return (
      <div 
        ref={slotRef} 
        className={`w-full ${className}`}
        style={{
          height: '60px',
          paddingBottom: position === 'bottom' ? 'env(safe-area-inset-bottom, 0px)' : undefined,
        }}
        data-placement={placement}
        data-ad-type={adConfig.ad.ad_type}
        data-banner-active={bannerShown}
      />
    );
  }

  // Web platform - show web ads
  if (webAdCode) {
    return (
      <div 
        ref={slotRef}
        className={`w-full rounded-md overflow-hidden ${className}`}
        dangerouslySetInnerHTML={{ __html: webAdCode }}
      />
    );
  }

  // Fallback to regular AdSlot component
  if (!isLoading) {
    return <AdSlot placement={placement} pageLocation={pageLocation} className={className} />;
  }

  return null;
}

export default NativeBannerAdSlot;
