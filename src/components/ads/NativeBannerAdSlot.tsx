import { useEffect, useState, useRef, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import AdSlot from "./AdSlot";
import { useFullscreenState } from "@/hooks/useFullscreenState";

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
  position?: "top" | "bottom" | "inline";
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
    position?: "TOP_CENTER" | "BOTTOM_CENTER";
    margin?: number;
    isTesting?: boolean;
  }) => Promise<void>;
  hideBanner: () => Promise<void>;
  prepareInterstitial?: (options: { adId: string; isTesting?: boolean }) => Promise<void>;
  showInterstitial?: () => Promise<void>;
  prepareRewardVideoAd?: (options: { adId: string; isTesting?: boolean }) => Promise<void>;
  showRewardVideoAd?: () => Promise<{ type: string; amount: number }>;
}

// Debug logger for AdMob
const logAdMob = (level: "info" | "warn" | "error", message: string, data?: any) => {
  const prefix = "[AdMob-Debug]";
  const timestamp = new Date().toISOString().split("T")[1].split(".")[0];
  const fullMessage = `${prefix} [${timestamp}] ${message}`;

  if (data !== undefined) {
    console[level](fullMessage, JSON.stringify(data, null, 2));
  } else {
    console[level](fullMessage);
  }
};

// Get AdMob plugin with detailed logging
const getAdMobPlugin = (): AdMobPlugin | null => {
  try {
    const capacitorPlugins = (window as any).Capacitor?.Plugins;
    const directAdMob = (window as any).AdMob;

    logAdMob("info", "Checking AdMob plugin availability...", {
      hasCapacitor: !!(window as any).Capacitor,
      hasCapacitorPlugins: !!capacitorPlugins,
      hasAdMobInPlugins: !!capacitorPlugins?.AdMob,
      hasDirectAdMob: !!directAdMob,
      platform: (window as any).Capacitor?.getPlatform?.() || "unknown",
    });

    const AdMob = capacitorPlugins?.AdMob || directAdMob;

    if (AdMob) {
      logAdMob("info", "AdMob plugin FOUND", {
        methods: Object.keys(AdMob).filter((k) => typeof AdMob[k] === "function"),
      });
    } else {
      logAdMob("warn", "AdMob plugin NOT FOUND - ensure @capacitor-community/admob is installed and synced");
    }

    return AdMob || null;
  } catch (error) {
    logAdMob("error", "Error getting AdMob plugin", { error: String(error) });
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
  className = "",
  position = "top",
  pageLocation = "watch",
  hideInFullscreen = true,
  onRewardEarned,
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
    const platform = Capacitor.getPlatform();

    logAdMob("info", `Platform check for placement: ${placement}`, {
      isNative: native,
      platform: platform,
      userAgent: navigator.userAgent.substring(0, 100),
    });

    setIsNative(native);

    if (native) {
      logAdMob("info", `Fetching native ad config for: ${placement}`);
      fetchAdConfig();
    } else {
      logAdMob("info", `Non-native platform, fetching web ad for: ${placement}`);
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
      { threshold: 0.1 },
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

      logAdMob("info", `Querying app_ads table`, {
        placement,
        platform,
        query: `is_active=true AND placement=${placement} AND (platform=${platform} OR platform=both)`,
      });

      // Fetch ad for this placement - any ad type
      const { data: adsData, error: adsError } = await supabase
        .from("app_ads")
        .select("*")
        .eq("is_active", true)
        .eq("placement", placement)
        .or(`platform.eq.${platform},platform.eq.both`)
        .order("priority", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (adsError) {
        logAdMob("error", "Database query error for app_ads", {
          error: adsError.message,
          code: adsError.code,
          details: adsError.details,
        });
      }

      // Fetch global settings
      const { data: settingsData, error: settingsError } = await supabase
        .from("app_ad_settings")
        .select("*")
        .eq("setting_key", "global_settings")
        .maybeSingle();

      if (settingsError) {
        logAdMob("warn", "Could not fetch global settings", { error: settingsError.message });
      }

      const rawSettings = settingsData?.setting_value as Record<string, unknown> | null;
      const settings: AdMobSettings = {
        enabled: (rawSettings?.enabled as boolean) ?? true,
        test_mode: (rawSettings?.test_mode as boolean) ?? true,
      };

      logAdMob("info", "Ad config fetch results", {
        placement,
        foundAd: !!adsData,
        adName: adsData?.name || "N/A",
        adType: adsData?.ad_type || "N/A",
        adUnitId: adsData?.ad_unit_id ? `${adsData.ad_unit_id.substring(0, 25)}...` : "N/A",
        adPlatform: adsData?.platform || "N/A",
        isActive: adsData?.is_active,
        isTestMode: adsData?.is_test_mode,
        globalEnabled: settings.enabled,
        globalTestMode: settings.test_mode,
      });

      if (adsData && settings.enabled) {
        setAdConfig({ ad: adsData, settings });
        logAdMob("info", `✅ Ad config loaded successfully for: ${placement}`, {
          name: adsData.name,
          type: adsData.ad_type,
          unitId: adsData.ad_unit_id,
          testMode: settings.test_mode || adsData.is_test_mode,
        });
      } else {
        logAdMob("warn", `❌ No active ad found for placement: ${placement}`, {
          reason: !adsData ? "No matching ad in database" : "Global ads disabled",
          settingsEnabled: settings.enabled,
        });
        // Try fetching web ad as fallback
        await fetchWebAd();
      }
    } catch (error) {
      logAdMob("error", "Exception fetching ad config", {
        error: String(error),
        placement,
      });
      setAdError("Failed to load ad configuration");
      await fetchWebAd();
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch web ad as fallback
  const fetchWebAd = async () => {
    try {
      const { data } = await supabase
        .from("ads")
        .select("ad_code, image_url, link_url")
        .eq("placement", placement)
        .eq("is_active", true)
        .order("priority", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.ad_code) {
        setWebAdCode(data.ad_code);
        console.log("[NativeAdSlot] Web ad loaded for placement:", placement);
      }
    } catch (error) {
      console.log("[NativeAdSlot] Could not fetch web ad for placement:", placement);
    } finally {
      setIsLoading(false);
    }
  };

  // Show native AdMob ad based on type
  const showAd = useCallback(async () => {
    logAdMob("info", `showAd called for: ${placement}`, {
      hasConfig: !!adConfig,
      isInView,
      isFullscreen,
      hideInFullscreen,
      bannerAlreadyShown: bannerShown,
    });

    if (!adConfig) {
      logAdMob("warn", `Cannot show ad - no config loaded for: ${placement}`);
      return;
    }

    if (!isInView) {
      logAdMob("info", `Skipping ad - not in view: ${placement}`);
      return;
    }

    // Don't show if in fullscreen mode
    if (hideInFullscreen && isFullscreen) {
      logAdMob("info", `Skipping ad - fullscreen active: ${placement}`);
      return;
    }

    const AdMob = getAdMobPlugin();
    if (!AdMob) {
      logAdMob("error", `❌ AdMob plugin NOT available - cannot show ads`, {
        placement,
        tip: "Ensure @capacitor-community/admob is installed, run npx cap sync, and test on real device",
      });
      return;
    }

    const { ad, settings } = adConfig;
    const useTestMode = settings.test_mode || ad.is_test_mode;

    logAdMob("info", `Attempting to show ${ad.ad_type} ad`, {
      placement,
      adName: ad.name,
      adUnitId: ad.ad_unit_id,
      testMode: useTestMode,
      position,
    });

    try {
      switch (ad.ad_type) {
        case "banner":
        case "native":
          if (bannerShown) {
            logAdMob("info", `Banner already shown for: ${placement}`);
            return;
          }

          const adPosition: "TOP_CENTER" | "BOTTOM_CENTER" = position === "bottom" ? "BOTTOM_CENTER" : "TOP_CENTER";

          const safeAreaMargin = position === "bottom" ? 0 : 24;

          // Use actual ad unit ID from database, with test mode from settings
          const bannerOptions = {
            adId: ad.ad_unit_id,
            adSize: "ADAPTIVE_BANNER",
            position: adPosition,
            margin: safeAreaMargin,
            isTesting: useTestMode,
          };

          logAdMob("info", `Calling AdMob.showBanner()`, bannerOptions);

          await AdMob.showBanner(bannerOptions);

          setBannerShown(true);
          logAdMob("info", `✅ Banner SHOWN successfully for: ${placement}`, {
            adId: ad.ad_unit_id,
            position: adPosition,
            margin: safeAreaMargin,
            testMode: useTestMode,
          });
          break;

        case "interstitial":
          if (AdMob.prepareInterstitial && AdMob.showInterstitial) {
            logAdMob("info", `Preparing interstitial for: ${placement}`);
            await AdMob.prepareInterstitial({
              adId: ad.ad_unit_id,
              isTesting: useTestMode,
            });
            logAdMob("info", `Showing interstitial for: ${placement}`);
            await AdMob.showInterstitial();
            logAdMob("info", `✅ Interstitial SHOWN for: ${placement}`);
          } else {
            logAdMob("error", `Interstitial methods not available on AdMob plugin`);
          }
          break;

        case "rewarded":
          if (AdMob.prepareRewardVideoAd && AdMob.showRewardVideoAd) {
            logAdMob("info", `Preparing rewarded ad for: ${placement}`);
            await AdMob.prepareRewardVideoAd({
              adId: ad.ad_unit_id,
              isTesting: useTestMode,
            });
            logAdMob("info", `Showing rewarded ad for: ${placement}`);
            const result = await AdMob.showRewardVideoAd();
            logAdMob("info", `✅ Rewarded ad completed for: ${placement}`, result);

            if (onRewardEarned) {
              onRewardEarned(result.amount || ad.reward_amount || 1, result.type || ad.reward_type || "coins");
            }
          } else {
            logAdMob("error", `Rewarded ad methods not available on AdMob plugin`);
          }
          break;

        case "app_open":
          logAdMob("info", `App open ad - should be triggered on app resume: ${placement}`);
          break;

        default:
          logAdMob("warn", `Unknown ad type: ${ad.ad_type} for placement: ${placement}`);
      }
    } catch (error: any) {
      logAdMob("error", `❌ Failed to show ${ad.ad_type} ad`, {
        placement,
        error: error?.message || String(error),
        errorCode: error?.code,
        stack: error?.stack?.substring(0, 200),
      });
      setAdError("Failed to display ad");
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
      console.log("[NativeAdSlot] Banner hidden");
    } catch (error) {
      console.error("[NativeAdSlot] Failed to hide banner:", error);
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
    if (adConfig.ad.ad_type !== "banner" && adConfig.ad.ad_type !== "native") return;

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
            paddingBottom: position === "bottom" ? "env(safe-area-inset-bottom, 0px)" : undefined,
            paddingTop: position === "top" ? "env(safe-area-inset-top, 0px)" : undefined,
          }}
        >
          <span className="text-xs text-muted-foreground">Loading Ad...</span>
        </div>
      );
    }

    if (!adConfig) {
      // No ad configured - return empty spacer in development, nothing in production
      if (process.env.NODE_ENV === "development") {
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
    if (position === "inline") {
      return (
        <div
          ref={slotRef}
          className={`w-full rounded-md overflow-hidden ${className}`}
          style={{ minHeight: "60px" }}
          data-placement={placement}
          data-ad-type={adConfig.ad.ad_type}
          data-banner-active={bannerShown}
        >
          {/* Native banner will overlay, this is positioning spacer */}
          {adConfig.ad.ad_type === "banner" || adConfig.ad.ad_type === "native" ? (
            <div className="w-full h-14 bg-muted/10 flex items-center justify-center">
              {!bannerShown && (
                <span className="text-xs text-muted-foreground animate-pulse">
                  {adConfig.ad.name || "Loading Ad..."}
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
          height: "60px",
          paddingBottom: position === "bottom" ? "env(safe-area-inset-bottom, 0px)" : undefined,
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
