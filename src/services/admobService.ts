/**
 * AdMob Service for Native Mobile Apps
 * Uses @capacitor-community/admob plugin for native Android/iOS
 * Returns stub functions for PWA/web
 */

import { Capacitor } from '@capacitor/core';

// AdMob Plugin interface (from @capacitor-community/admob)
interface AdMobPlugin {
  initialize: (options: {
    testingDevices?: string[];
    initializeForTesting?: boolean;
    tagForChildDirectedTreatment?: boolean;
    tagForUnderAgeOfConsent?: boolean;
    maxAdContentRating?: 'General' | 'ParentalGuidance' | 'Teen' | 'MatureAudience';
  }) => Promise<void>;
  showBanner: (options: {
    adId: string;
    adSize?: string;
    position?: 'TOP_CENTER' | 'BOTTOM_CENTER';
    margin?: number;
    isTesting?: boolean;
  }) => Promise<void>;
  hideBanner: () => Promise<void>;
  removeBanner: () => Promise<void>;
  prepareInterstitial: (options: { adId: string; isTesting?: boolean }) => Promise<void>;
  showInterstitial: () => Promise<void>;
  prepareRewardVideoAd: (options: { adId: string; isTesting?: boolean }) => Promise<void>;
  showRewardVideoAd: () => Promise<{ type: string; amount: number }>;
}

// Track initialization state
let adMobInitialized = false;
let bannerShowing = false;

/**
 * Get the AdMob plugin from Capacitor
 */
export function getAdMobPlugin(): AdMobPlugin | null {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }
  
  try {
    // Try to get the plugin from Capacitor plugins
    const AdMob = (window as any).Capacitor?.Plugins?.AdMob || (window as any).AdMob;
    return AdMob || null;
  } catch {
    return null;
  }
}

/**
 * Check if AdMob is available (native platform with plugin)
 */
export function isAdMobAvailable(): boolean {
  return Capacitor.isNativePlatform() && getAdMobPlugin() !== null;
}

/**
 * Check if AdMob is initialized
 */
export function isAdMobInitialized(): boolean {
  return adMobInitialized;
}

/**
 * Initialize AdMob - required before showing any ads
 */
export async function initializeAdMob(options?: {
  testMode?: boolean;
  childDirected?: boolean;
  maxRating?: 'General' | 'ParentalGuidance' | 'Teen' | 'MatureAudience';
}): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    console.log('[AdMob] Web platform - use AdSense instead');
    return false;
  }

  if (adMobInitialized) {
    console.log('[AdMob] Already initialized');
    return true;
  }

  const AdMob = getAdMobPlugin();
  if (!AdMob) {
    console.warn('[AdMob] Plugin not available. Make sure @capacitor-community/admob is installed and synced.');
    return false;
  }

  try {
    await AdMob.initialize({
      testingDevices: options?.testMode ? [] : undefined,
      initializeForTesting: options?.testMode ?? false,
      tagForChildDirectedTreatment: options?.childDirected ?? false,
      tagForUnderAgeOfConsent: options?.childDirected ?? false,
      maxAdContentRating: options?.maxRating ?? 'General',
    });

    adMobInitialized = true;
    console.log('[AdMob] Initialized successfully');
    return true;
  } catch (error) {
    console.error('[AdMob] Initialization failed:', error);
    return false;
  }
}

/**
 * Load a rewarded ad (prepare for display)
 */
export async function loadRewardedAd(adUnitId: string, isTesting = false): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    console.log('[AdMob] Rewarded ads not available on web');
    return false;
  }

  const AdMob = getAdMobPlugin();
  if (!AdMob) {
    console.warn('[AdMob] Plugin not available');
    return false;
  }

  if (!adMobInitialized) {
    console.log('[AdMob] Initializing before loading rewarded ad...');
    const initialized = await initializeAdMob({ testMode: isTesting });
    if (!initialized) return false;
  }

  try {
    console.log('[AdMob] Loading rewarded ad:', adUnitId);
    await AdMob.prepareRewardVideoAd({
      adId: adUnitId,
      isTesting: isTesting,
    });
    console.log('[AdMob] Rewarded ad loaded successfully');
    return true;
  } catch (error) {
    console.error('[AdMob] Failed to load rewarded ad:', error);
    return false;
  }
}

/**
 * Show a rewarded ad (must be loaded first)
 */
export async function showRewardedAd(): Promise<{ shown: boolean; rewarded: boolean; amount?: number; type?: string }> {
  if (!Capacitor.isNativePlatform()) {
    console.log('[AdMob] Rewarded ads not available on web');
    return { shown: false, rewarded: false };
  }

  const AdMob = getAdMobPlugin();
  if (!AdMob) {
    console.warn('[AdMob] Plugin not available');
    return { shown: false, rewarded: false };
  }

  try {
    console.log('[AdMob] Showing rewarded ad...');
    const result = await AdMob.showRewardVideoAd();
    console.log('[AdMob] Rewarded ad completed:', result);
    return {
      shown: true,
      rewarded: true,
      amount: result?.amount || 1,
      type: result?.type || 'reward',
    };
  } catch (error) {
    console.error('[AdMob] Failed to show rewarded ad:', error);
    return { shown: false, rewarded: false };
  }
}

/**
 * Load an interstitial ad (prepare for display)
 */
export async function loadInterstitialAd(adUnitId: string, isTesting = false): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    console.log('[AdMob] Interstitial ads not available on web');
    return false;
  }

  const AdMob = getAdMobPlugin();
  if (!AdMob) {
    console.warn('[AdMob] Plugin not available');
    return false;
  }

  if (!adMobInitialized) {
    const initialized = await initializeAdMob({ testMode: isTesting });
    if (!initialized) return false;
  }

  try {
    console.log('[AdMob] Loading interstitial ad:', adUnitId);
    await AdMob.prepareInterstitial({
      adId: adUnitId,
      isTesting: isTesting,
    });
    console.log('[AdMob] Interstitial ad loaded successfully');
    return true;
  } catch (error) {
    console.error('[AdMob] Failed to load interstitial ad:', error);
    return false;
  }
}

/**
 * Show an interstitial ad (must be loaded first)
 */
export async function showInterstitialAd(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    console.log('[AdMob] Interstitial ads not available on web');
    return false;
  }

  const AdMob = getAdMobPlugin();
  if (!AdMob) {
    console.warn('[AdMob] Plugin not available');
    return false;
  }

  try {
    console.log('[AdMob] Showing interstitial ad...');
    await AdMob.showInterstitial();
    console.log('[AdMob] Interstitial ad shown');
    return true;
  } catch (error) {
    console.error('[AdMob] Failed to show interstitial ad:', error);
    return false;
  }
}

/**
 * Show a banner ad
 */
export async function showBannerAd(
  adUnitId: string,
  isTesting = false,
  position: 'top' | 'bottom' = 'bottom'
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    console.log('[AdMob] Banner ads not available on web - use web ad slots instead');
    return false;
  }

  const AdMob = getAdMobPlugin();
  if (!AdMob) {
    console.warn('[AdMob] Plugin not available');
    return false;
  }

  if (!adMobInitialized) {
    const initialized = await initializeAdMob({ testMode: isTesting });
    if (!initialized) return false;
  }

  try {
    console.log('[AdMob] Showing banner ad:', adUnitId);
    await AdMob.showBanner({
      adId: adUnitId,
      adSize: 'ADAPTIVE_BANNER',
      position: position === 'top' ? 'TOP_CENTER' : 'BOTTOM_CENTER',
      isTesting: isTesting,
    });
    bannerShowing = true;
    console.log('[AdMob] Banner ad shown');
    return true;
  } catch (error) {
    console.error('[AdMob] Failed to show banner ad:', error);
    return false;
  }
}

/**
 * Hide the current banner ad
 */
export async function hideBannerAd(): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || !bannerShowing) {
    return false;
  }

  const AdMob = getAdMobPlugin();
  if (!AdMob) return false;

  try {
    await AdMob.hideBanner();
    bannerShowing = false;
    console.log('[AdMob] Banner ad hidden');
    return true;
  } catch (error) {
    console.error('[AdMob] Failed to hide banner ad:', error);
    return false;
  }
}

/**
 * Remove the banner ad completely
 */
export async function removeBannerAd(): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || !bannerShowing) {
    return false;
  }

  const AdMob = getAdMobPlugin();
  if (!AdMob) return false;

  try {
    await AdMob.removeBanner();
    bannerShowing = false;
    console.log('[AdMob] Banner ad removed');
    return true;
  } catch (error) {
    console.error('[AdMob] Failed to remove banner ad:', error);
    return false;
  }
}

/**
 * Check if banner is currently showing
 */
export function isBannerShowing(): boolean {
  return bannerShowing;
}
