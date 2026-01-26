import { useRef, useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
// @ts-ignore
import shaka from 'shaka-player';

interface NativeShakaConfig {
  videoRef: React.RefObject<HTMLVideoElement>;
  autoQualityEnabled?: boolean;
  estimatedBandwidth?: number;
  onQualitiesLoaded?: (qualities: string[]) => void;
  onAudioTracksLoaded?: (tracks: any[]) => void;
  onTextTracksLoaded?: (tracks: any[]) => void;
  onBandwidthUpdate?: (bandwidth: number) => void;
  onError?: (error: Error) => void;
  onLoaded?: () => void;
}

// Debug logging helper
const logDebug = (context: string, ...args: any[]) => {
  if (Capacitor.isNativePlatform()) {
    console.log(`[NativeShakaPlayer] ${context}:`, ...args);
  }
};

/**
 * Detect video source type from URL
 */
export function detectSourceType(url: string): 'mp4' | 'hls' | 'dash' | 'unknown' {
  const lowerUrl = url.toLowerCase();
  
  // HLS detection
  if (lowerUrl.includes('.m3u8') || lowerUrl.includes('m3u8')) {
    logDebug('detectSourceType', 'Detected HLS stream', url.substring(0, 100));
    return 'hls';
  }
  
  // DASH detection
  if (lowerUrl.includes('.mpd') || lowerUrl.includes('mpd')) {
    logDebug('detectSourceType', 'Detected DASH stream', url.substring(0, 100));
    return 'dash';
  }
  
  // MP4 detection
  if (lowerUrl.includes('.mp4') || lowerUrl.includes('mp4')) {
    logDebug('detectSourceType', 'Detected MP4 file', url.substring(0, 100));
    return 'mp4';
  }
  
  logDebug('detectSourceType', 'Unknown source type', url.substring(0, 100));
  return 'unknown';
}

/**
 * Get network quality estimate
 */
function getNetworkQuality(): { type: string; downlink: number; effectiveType: string } {
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  
  if (connection) {
    return {
      type: connection.type || 'unknown',
      downlink: connection.downlink || 10, // Mbps
      effectiveType: connection.effectiveType || '4g',
    };
  }
  
  return { type: 'unknown', downlink: 10, effectiveType: '4g' };
}

/**
 * Optimized Shaka Player hook for native Capacitor apps
 * Provides better buffering, reduced battery drain, and smoother playback
 */
export function useNativeShakaPlayer({
  videoRef,
  autoQualityEnabled = true,
  estimatedBandwidth = 5000000,
  onQualitiesLoaded,
  onAudioTracksLoaded,
  onTextTracksLoaded,
  onBandwidthUpdate,
  onError,
  onLoaded,
}: NativeShakaConfig) {
  const shakaPlayerRef = useRef<shaka.Player | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();
  
  // Native-optimized Shaka configuration
  const getNativeConfig = useCallback(() => {
    const networkQuality = getNetworkQuality();
    logDebug('getNativeConfig', 'Network quality:', networkQuality);
    
    // Adjust buffer based on network quality - more aggressive for Android
    const getBufferGoal = () => {
      if (!isNative) return 30;
      // Android needs larger buffers for smooth HLS playback
      if (platform === 'android') {
        switch (networkQuality.effectiveType) {
          case '4g': return 30;
          case '3g': return 45;
          case '2g': return 60;
          default: return 30;
        }
      }
      switch (networkQuality.effectiveType) {
        case '4g': return 20;
        case '3g': return 30;
        case '2g': return 45;
        default: return 20;
      }
    };
    
    const bufferGoal = getBufferGoal();
    
    // Base configuration optimized for mobile
    const baseConfig = {
      streaming: {
        // Adaptive buffer based on network - larger buffer on slow networks
        bufferingGoal: bufferGoal,
        // Quick recovery from rebuffering - smaller on fast networks
        rebufferingGoal: isNative ? Math.max(2, bufferGoal / 8) : 2,
        // Reduce memory usage on mobile
        bufferBehind: isNative ? Math.min(bufferGoal, 20) : 30,
        // Faster segment fetch for responsive seeking
        retryParameters: {
          maxAttempts: 8,
          baseDelay: 200,
          backoffFactor: 1.3,
          timeout: isNative ? 15000 : 30000,
          fuzzFactor: 0.3,
        },
        // Enable low latency for live streams
        lowLatencyMode: false,
        // Prefer native HLS on iOS for better performance
        preferNativeHls: platform === 'ios',
        // Use MediaSource more efficiently
        useNativeHlsOnSafari: platform === 'ios',
        // Segment prefetch for smoother playback - more for Android
        segmentPrefetchLimit: platform === 'android' ? 5 : (isNative ? 3 : 4),
        // Reduce start latency
        smallGapLimit: 0.5,
        jumpLargeGaps: true,
        // Stall detection - more tolerant on Android
        stallEnabled: true,
        stallThreshold: platform === 'android' ? 1.0 : (isNative ? 0.5 : 1),
        stallSkip: platform === 'android' ? 0.3 : (isNative ? 0.15 : 0.1),
        // Safe seek adjustment
        safeSeekOffset: 0,
        // Gap detection - more tolerant on Android
        gapDetectionThreshold: platform === 'android' ? 0.8 : (isNative ? 0.3 : 0.5),
        // Auto recovery from errors
        failureCallback: () => {
          logDebug('streaming', 'Failure callback triggered, attempting recovery');
        },
        // Start at lower quality for faster start
        startAtSegmentBoundary: isNative,
        // Ignore text track failures
        ignoreTextStreamFailures: true,
        // Don't fail on audio/video track failures
        alwaysStreamText: false,
        // More forgiving for segment availability
        inaccurateManifestTolerance: platform === 'android' ? 5 : 2,
        // Don't dispatch all events - reduce overhead
        dispatchAllEmsgBoxes: false,
      },
      abr: {
        enabled: autoQualityEnabled,
        // Dynamic bandwidth estimate based on network - start lower on Android
        defaultBandwidthEstimate: platform === 'android'
          ? (networkQuality.effectiveType === '4g' ? 5000000 : networkQuality.effectiveType === '3g' ? 1500000 : 500000)
          : (networkQuality.effectiveType === '4g' 
            ? Math.max(estimatedBandwidth, 8000000) 
            : networkQuality.effectiveType === '3g' 
              ? 2000000 
              : 500000),
        // More conservative switching on mobile to reduce buffering
        switchInterval: platform === 'android' ? 8 : (isNative ? 6 : 4),
        // Higher upgrade threshold for stability - don't upgrade too quickly
        bandwidthUpgradeTarget: platform === 'android' ? 0.60 : (isNative ? 0.70 : 0.85),
        // Lower downgrade threshold to prevent stuttering - downgrade faster
        bandwidthDowngradeTarget: platform === 'android' ? 0.90 : (isNative ? 0.85 : 0.95),
        // Limit resolution on mobile for battery/data
        restrictions: isNative ? {
          maxHeight: 1080,
          maxWidth: 1920,
          // Be more conservative on Android
          maxBandwidth: platform === 'android'
            ? (networkQuality.effectiveType === '4g' ? 8000000 : networkQuality.effectiveType === '3g' ? 3000000 : 1000000)
            : (networkQuality.effectiveType === '4g' 
              ? 12000000 
              : networkQuality.effectiveType === '3g' 
                ? 4000000 
                : 1500000),
        } : {},
        // Ignore device pixel ratio for consistent behavior
        ignoreDevicePixelRatio: true,
        // Don't clear buffer on switch - smoother transitions
        clearBufferSwitch: false,
        // Safer switching margin - larger on Android
        safeMarginSwitch: platform === 'android' ? 5 : (isNative ? 3 : 1),
        // Cache bandwidth estimate
        cacheLoadThreshold: 20,
      },
      manifest: {
        // Faster manifest parsing with more retries on Android
        retryParameters: {
          maxAttempts: platform === 'android' ? 8 : 5,
          baseDelay: 200,
          backoffFactor: 1.3,
          timeout: platform === 'android' ? 12000 : (isNative ? 8000 : 20000),
          fuzzFactor: 0.3,
        },
        // Parse HLS faster
        hls: {
          ignoreManifestProgramDateTime: true,
          ignoreManifestProgramDateTimeForTypes: [],
          // Sequence mode for better compatibility
          useFullSegmentsForStartTime: isNative,
          // Don't ignore text stream failures
          ignoreTextStreamFailures: true,
          // More tolerant parsing on Android
          mediaPlaylistFullMimeType: 'application/x-mpegURL',
        },
        // DASH optimizations
        dash: {
          ignoreMinBufferTime: isNative,
          xlinkFailGracefully: true,
          ignoreMaxSegmentDuration: true,
          ignoreEmptyAdaptationSet: true,
        },
        // Default presentation delay
        defaultPresentationDelay: 0,
        // Disable clock sync for VOD
        disableAudio: false,
        disableVideo: false,
        disableText: false,
        // Availability window override for Android - helps with segment availability
        availabilityWindowOverride: platform === 'android' ? 120 : undefined,
      },
      drm: {
        // DRM timeout adjustments for mobile
        retryParameters: {
          maxAttempts: 4,
          baseDelay: 500,
          backoffFactor: 2,
          timeout: 15000,
          fuzzFactor: 0.5,
        },
      },
      // Prefer native tracks on mobile
      preferredAudioLanguage: 'km',
      preferredTextLanguage: 'km',
      preferredVariantRole: '',
      preferredTextRole: '',
    };

    // iOS-specific optimizations
    if (platform === 'ios') {
      logDebug('getNativeConfig', 'Applying iOS-specific optimizations');
      return {
        ...baseConfig,
        streaming: {
          ...baseConfig.streaming,
          // iOS handles HLS natively better
          preferNativeHls: true,
          useNativeHlsOnSafari: true,
          // Smaller buffer for iOS memory constraints
          bufferingGoal: Math.min(bufferGoal, 15),
          bufferBehind: 12,
          // iOS is more sensitive to gaps
          gapDetectionThreshold: 0.2,
          smallGapLimit: 0.2,
        },
      };
    }

    // Android-specific optimizations - critical for HLS playback
    if (platform === 'android') {
      logDebug('getNativeConfig', 'Applying Android-specific HLS optimizations');
      return {
        ...baseConfig,
        streaming: {
          ...baseConfig.streaming,
          // Android WebView needs more buffer for HLS
          bufferingGoal: Math.max(bufferGoal, 35),
          rebufferingGoal: 4,
          bufferBehind: 30,
          // Force gap jumping on Android for better recovery
          jumpLargeGaps: true,
          stallSkip: 0.5,
          // More tolerant stall recovery on Android
          stallThreshold: 1.5,
          // Larger prefetch for smoother playback
          segmentPrefetchLimit: 6,
          // More forgiving gap detection
          gapDetectionThreshold: 1.0,
          smallGapLimit: 1.0,
          // Disable native HLS on Android (use Shaka's MSE)
          preferNativeHls: false,
          useNativeHlsOnSafari: false,
          // Higher tolerance for segment timing
          inaccurateManifestTolerance: 8,
          // Force lower latency start
          startAtSegmentBoundary: false,
          // Auto low latency mode off for VOD stability
          autoLowLatencyMode: false,
        },
        abr: {
          ...baseConfig.abr,
          // Start with lower bandwidth estimate on Android
          defaultBandwidthEstimate: 3000000,
          // Longer switch interval for stability
          switchInterval: 10,
          // Very conservative upgrade threshold
          bandwidthUpgradeTarget: 0.55,
          // Quick downgrade to prevent buffering
          bandwidthDowngradeTarget: 0.92,
          // Larger safe margin
          safeMarginSwitch: 6,
          restrictions: {
            maxHeight: 720, // Start with 720p max on Android for stability
            maxWidth: 1280,
            maxBandwidth: networkQuality.effectiveType === '4g' ? 6000000 : 2500000,
          },
        },
        manifest: {
          ...baseConfig.manifest,
          retryParameters: {
            maxAttempts: 10,
            baseDelay: 150,
            backoffFactor: 1.2,
            timeout: 15000,
            fuzzFactor: 0.2,
          },
          // Larger availability window for Android
          availabilityWindowOverride: 180,
        },
      };
    }

    return baseConfig;
  }, [isNative, platform, autoQualityEnabled, estimatedBandwidth]);

  // Initialize Shaka Player with native optimizations
  const initPlayer = useCallback(async () => {
    if (!videoRef.current) {
      logDebug('initPlayer', 'No video ref available');
      return null;
    }

    try {
      logDebug('initPlayer', 'Starting initialization...', { platform, isNative });
      
      // Install polyfills
      shaka.polyfill.installAll();

      if (!shaka.Player.isBrowserSupported()) {
        console.warn('Shaka Player not supported on this browser');
        logDebug('initPlayer', 'Browser not supported');
        return null;
      }

      // Cleanup existing player
      if (shakaPlayerRef.current) {
        try {
          logDebug('initPlayer', 'Cleaning up existing player');
          await shakaPlayerRef.current.unload();
          await shakaPlayerRef.current.detach();
          await shakaPlayerRef.current.destroy();
        } catch (e) {
          console.warn('Error cleaning up previous player:', e);
        }
        shakaPlayerRef.current = null;
      }

      // Create new player
      const player = new shaka.Player();
      await player.attach(videoRef.current);
      
      // Apply native-optimized configuration
      const config = getNativeConfig();
      logDebug('initPlayer', 'Applying config:', {
        bufferingGoal: config.streaming?.bufferingGoal,
        rebufferingGoal: config.streaming?.rebufferingGoal,
        defaultBandwidthEstimate: config.abr?.defaultBandwidthEstimate,
        maxBandwidth: config.abr?.restrictions?.maxBandwidth,
      });
      player.configure(config);

      // Set up event listeners
      player.addEventListener('error', (event: any) => {
        const error = event.detail;
        console.error('Shaka error:', error.code, error.message, error);
        logDebug('error', `Code: ${error.code}, Message: ${error.message}`, error.data);
        onError?.(new Error(`Shaka error ${error.code}: ${error.message}`));
      });

      player.addEventListener('adaptation', () => {
        const stats = player.getStats();
        logDebug('adaptation', 'Quality changed:', {
          width: stats.width,
          height: stats.height,
          bandwidth: Math.round(stats.estimatedBandwidth / 1000) + ' kbps',
          bufferingTime: stats.bufferingTime,
        });
        if (stats.estimatedBandwidth) {
          onBandwidthUpdate?.(stats.estimatedBandwidth);
        }
      });

      player.addEventListener('buffering', (event: any) => {
        logDebug('buffering', event.buffering ? 'Started buffering' : 'Finished buffering');
        // On Android, if buffering takes too long, try to nudge playback
        if (event.buffering && platform === 'android' && videoRef.current) {
          setTimeout(() => {
            if (videoRef.current && videoRef.current.paused && videoRef.current.readyState >= 2) {
              logDebug('buffering', 'Auto-resuming after buffer on Android');
              videoRef.current.play().catch(() => {});
            }
          }, 2000);
        }
      });

      player.addEventListener('stalldetected', () => {
        console.warn('Stall detected, attempting recovery');
        logDebug('stalldetected', 'Attempting recovery...');
        // On native, try to recover from stalls - more aggressive on Android
        if (isNative && videoRef.current) {
          const currentTime = videoRef.current.currentTime;
          // Skip forward slightly to recover - larger skip on Android
          const skipAmount = platform === 'android' ? 0.5 : 0.2;
          videoRef.current.currentTime = currentTime + skipAmount;
          // Also try to resume playback with retry
          setTimeout(() => {
            if (videoRef.current) {
              videoRef.current.play().catch(() => {
                // Retry after another delay on Android
                if (platform === 'android') {
                  setTimeout(() => {
                    videoRef.current?.play().catch(() => {});
                  }, 500);
                }
              });
            }
          }, 150);
        }
      });

      player.addEventListener('loading', () => {
        logDebug('loading', 'Loading started');
      });

      player.addEventListener('loaded', () => {
        const stats = player.getStats();
        logDebug('loaded', 'Content loaded:', {
          width: stats.width,
          height: stats.height,
          streamBandwidth: stats.streamBandwidth,
        });
      });

      shakaPlayerRef.current = player;
      setIsInitialized(true);
      logDebug('initPlayer', 'Initialization complete');
      
      return player;
    } catch (error) {
      console.error('Failed to initialize Shaka Player:', error);
      logDebug('initPlayer', 'Initialization failed:', error);
      onError?.(error as Error);
      return null;
    }
  }, [videoRef, getNativeConfig, onBandwidthUpdate, onError, isNative, platform]);

  // Load a video source
  const loadSource = useCallback(async (url: string, mimeType?: string) => {
    setIsLoading(true);
    logDebug('loadSource', 'Loading source:', { url: url.substring(0, 100), mimeType, platform });
    
    let player = shakaPlayerRef.current;
    
    if (!player) {
      logDebug('loadSource', 'No player, initializing...');
      player = await initPlayer();
      if (!player) {
        setIsLoading(false);
        logDebug('loadSource', 'Failed to initialize player');
        return false;
      }
    }

    try {
      // Unload previous content
      logDebug('loadSource', 'Unloading previous content');
      await player.unload();
      
      // Wait a bit for cleanup on native - longer delay on Android for stability
      if (isNative) {
        const cleanupDelay = platform === 'android' ? 200 : 100;
        await new Promise(resolve => setTimeout(resolve, cleanupDelay));
      }

      // Auto-detect mime type if not provided
      const detectedType = detectSourceType(url);
      let finalMimeType = mimeType;
      if (!finalMimeType) {
        if (detectedType === 'hls') {
          finalMimeType = 'application/x-mpegURL';
        } else if (detectedType === 'dash') {
          finalMimeType = 'application/dash+xml';
        }
      }
      
      logDebug('loadSource', 'Loading with mime type:', finalMimeType || 'auto-detect');

      // On Android, ensure video element is ready before loading
      if (platform === 'android' && videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
        // Reset any error state
        videoRef.current.load();
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Load new source with retry logic for Android
      const loadStartTime = Date.now();
      let loadAttempt = 0;
      const maxAttempts = platform === 'android' ? 3 : 1;
      let lastError: any = null;
      
      while (loadAttempt < maxAttempts) {
        try {
          logDebug('loadSource', `Load attempt ${loadAttempt + 1}/${maxAttempts}`);
          await player.load(url, undefined, finalMimeType);
          logDebug('loadSource', `Loaded in ${Date.now() - loadStartTime}ms`);
          break;
        } catch (err: any) {
          lastError = err;
          loadAttempt++;
          if (loadAttempt < maxAttempts) {
            logDebug('loadSource', `Load failed, retrying in 500ms...`, err.message);
            await new Promise(resolve => setTimeout(resolve, 500));
            // Re-apply config before retry
            player.configure(getNativeConfig());
          }
        }
      }
      
      if (loadAttempt >= maxAttempts && lastError) {
        throw lastError;
      }

      // Get available tracks
      const variantTracks = player.getVariantTracks();
      logDebug('loadSource', 'Available variant tracks:', variantTracks.length);
      
      // On Android, prefer lower qualities initially for smoother playback
      if (platform === 'android' && variantTracks.length > 0) {
        // Find a 480p or 360p track to start with
        const lowerQualityTrack = variantTracks.find((t: any) => t.height === 480 || t.height === 360);
        if (lowerQualityTrack) {
          logDebug('loadSource', 'Selecting lower quality track for Android:', lowerQualityTrack.height);
          player.selectVariantTrack(lowerQualityTrack, false);
        }
      }
      
      const qualities = [...new Set(variantTracks.map((t: any) => `${t.height}p`))]
        .filter((q: string) => q !== 'undefinedp' && q !== 'nullp')
        .sort((a: string, b: string) => parseInt(b) - parseInt(a)) as string[];
      
      logDebug('loadSource', 'Available qualities:', qualities);
      onQualitiesLoaded?.(qualities);

      // Audio tracks
      const audioTracks = player.getAudioLanguagesAndRoles();
      logDebug('loadSource', 'Audio tracks:', audioTracks);
      onAudioTracksLoaded?.(audioTracks);

      // Text tracks
      const textTracks = player.getTextLanguagesAndRoles();
      logDebug('loadSource', 'Text tracks:', textTracks);
      onTextTracksLoaded?.(textTracks);
      player.setTextTrackVisibility(false);

      setIsLoading(false);
      onLoaded?.();
      
      // On Android, try to start playback after a short delay if video is ready
      if (platform === 'android' && videoRef.current) {
        setTimeout(() => {
          if (videoRef.current && videoRef.current.readyState >= 2) {
            logDebug('loadSource', 'Android: Video ready, can play');
          }
        }, 300);
      }
      
      return true;
    } catch (error: any) {
      console.error('Failed to load video source:', error);
      logDebug('loadSource', 'Load failed:', {
        code: error.code,
        message: error.message,
        data: error.data,
        category: error.category,
      });
      setIsLoading(false);
      onError?.(error as Error);
      return false;
    }
  }, [initPlayer, isNative, platform, getNativeConfig, onQualitiesLoaded, onAudioTracksLoaded, onTextTracksLoaded, onLoaded, onError]);

  // Set video quality
  const setQuality = useCallback((quality: string) => {
    if (!shakaPlayerRef.current) return;

    const player = shakaPlayerRef.current;
    const tracks = player.getVariantTracks();
    const targetHeight = parseInt(quality.replace('p', ''));

    // Find tracks with matching height
    const matchingTracks = tracks.filter((t: any) => t.height === targetHeight);
    
    if (matchingTracks.length > 0) {
      // Select the best matching track (highest bandwidth)
      const bestTrack = matchingTracks.reduce((a: any, b: any) => 
        (a.bandwidth || 0) > (b.bandwidth || 0) ? a : b
      );
      
      // Clear ABR and select specific track
      player.configure('abr.enabled', false);
      player.selectVariantTrack(bestTrack, true);
    }
  }, []);

  // Enable/disable auto quality
  const setAutoQuality = useCallback((enabled: boolean) => {
    if (!shakaPlayerRef.current) return;
    shakaPlayerRef.current.configure('abr.enabled', enabled);
  }, []);

  // Set audio track
  const setAudioTrack = useCallback((language: string, role?: string) => {
    if (!shakaPlayerRef.current) return;
    shakaPlayerRef.current.selectAudioLanguage(language, role);
  }, []);

  // Set text track (subtitles)
  const setTextTrack = useCallback((language: string | null, role?: string) => {
    if (!shakaPlayerRef.current) return;
    
    if (language === null || language === 'off') {
      shakaPlayerRef.current.setTextTrackVisibility(false);
    } else {
      shakaPlayerRef.current.selectTextLanguage(language, role);
      shakaPlayerRef.current.setTextTrackVisibility(true);
    }
  }, []);

  // Get current stats
  const getStats = useCallback(() => {
    if (!shakaPlayerRef.current) return null;
    return shakaPlayerRef.current.getStats();
  }, []);

  // Cleanup on unmount
  const cleanup = useCallback(async () => {
    if (shakaPlayerRef.current) {
      try {
        await shakaPlayerRef.current.unload();
        await shakaPlayerRef.current.detach();
        await shakaPlayerRef.current.destroy();
      } catch (e) {
        console.warn('Error during cleanup:', e);
      } finally {
        shakaPlayerRef.current = null;
        setIsInitialized(false);
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    player: shakaPlayerRef.current,
    isInitialized,
    isLoading,
    isNative,
    platform,
    initPlayer,
    loadSource,
    setQuality,
    setAutoQuality,
    setAudioTrack,
    setTextTrack,
    getStats,
    cleanup,
    getNativeConfig,
  };
}

/**
 * Get optimized video element attributes for native apps
 */
export function getNativeVideoAttributes() {
  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();

  return {
    // Inline playback for iOS (prevents fullscreen on play)
    playsInline: true,
    // Webkit-specific inline playback
    'webkit-playsinline': 'true',
    // Allow AirPlay on iOS
    'x-webkit-airplay': 'allow',
    // Preload metadata for faster start
    preload: isNative ? 'metadata' : 'auto',
    // Cross-origin for CORS
    crossOrigin: 'anonymous' as const,
    // Disable picture-in-picture if needed
    // disablePictureInPicture: false,
    // iOS-specific: allow background audio
    ...(platform === 'ios' ? {
      'x-webkit-wirelessvideoplaybackdisabled': 'false',
    } : {}),
    // Android-specific optimizations
    ...(platform === 'android' ? {
      // Hardware acceleration hints
      style: {
        transform: 'translateZ(0)',
        willChange: 'transform',
      },
    } : {}),
  };
}

/**
 * Check if device can handle high quality video
 */
export function getRecommendedMaxQuality(): number {
  const isNative = Capacitor.isNativePlatform();
  
  if (!isNative) return 1080;
  
  // Check device memory if available
  const memory = (navigator as any).deviceMemory;
  if (memory) {
    if (memory >= 8) return 1080;
    if (memory >= 4) return 720;
    return 480;
  }
  
  // Check connection type
  const connection = (navigator as any).connection;
  if (connection?.effectiveType) {
    switch (connection.effectiveType) {
      case '4g': return 1080;
      case '3g': return 480;
      case '2g': return 360;
      default: return 720;
    }
  }
  
  return 720; // Safe default
}
