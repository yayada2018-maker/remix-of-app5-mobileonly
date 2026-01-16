import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, 
  Loader2, SkipBack, SkipForward, Crown,
  Server as ServerIcon, CreditCard, ArrowLeft, Lock, ListVideo
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { VideoSource } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { AuthDialog } from "@/components/AuthDialog";
import { InlineRentSubscribe } from "@/components/video/InlineRentSubscribe";
import { Capacitor } from '@capacitor/core';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { useVideoResume } from '@/hooks/useVideoResume';
import { useAuth } from '@/hooks/useAuth';
import AppLockOverlay from '@/components/AppLockOverlay';
import { ScreenLockOverlay } from '@/components/video/ScreenLockOverlay';
import { EpisodesPanel } from '@/components/video/EpisodesPanel';
import { SupportUsOverlay } from '@/components/video/SupportUsOverlay';
import { useNativePlayerSettings } from '@/hooks/useNativePlayerSettings';
import { useSupportUsSettings } from '@/hooks/useSupportUsSettings';
import { useSubscription } from '@/hooks/useSubscription';
import { NativeScreenProtection } from '@/utils/nativeScreenProtection';
import { usePinchToZoom } from '@/hooks/usePinchToZoom';
import { VideoSettingsMenu } from '@/components/VideoSettingsMenu';
import { useNativeShakaPlayer } from '@/hooks/useNativeShakaPlayer';

interface Episode {
  id: string;
  title: string;
  episode_number: number;
  still_path?: string;
  duration?: number;
  version?: string;
  season_id?: string;
}

interface Season {
  id: string;
  title: string;
  season_number: number;
}

interface NativeVideoPlayerProps {
  videoSources: VideoSource[];
  onEpisodeSelect?: (episodeId: string) => void;
  onSeasonSelect?: (seasonId: string) => void;
  episodes?: Episode[];
  seasons?: Season[];
  currentEpisodeId?: string;
  currentSeasonId?: string;
  contentBackdrop?: string;
  contentId?: string;
  accessType?: 'free' | 'rent' | 'vip';
  excludeFromPlan?: boolean;
  rentalPrice?: number;
  rentalPeriodDays?: number;
  mediaId?: string;
  mediaType?: 'movie' | 'series' | 'anime';
  title?: string;
  movieId?: string;
  onEnded?: () => void;
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

// Helpers
const normalizeType = (rawType?: string, url?: string): "mp4" | "hls" | "iframe" => {
  const t = (rawType || "").toString().toLowerCase().trim();
  
  // Explicit type checks first
  if (t === "iframe" || t === "embed") return "iframe";
  if (t === "mp4") return "mp4";
  if (t === "hls" || t === "m3u8") return "hls";
  
  // URL-based detection
  const u = (url || "").toLowerCase();
  
  // Check for MP4 files
  if (u.endsWith(".mp4") || u.includes(".mp4?") || u.includes("mp4")) return "mp4";
  
  // Check for HLS streams
  if (u.endsWith(".m3u8") || u.includes(".m3u8?") || u.includes("m3u8")) return "hls";
  
  // Check for embed/iframe sources
  if (u.includes("youtube.com") || u.includes("youtu.be") || u.includes("player.") || u.includes("embed")) return "iframe";
  if (u.includes("vk.com/video") || u.includes("vk.ru/video") || u.includes("video_ext.php")) return "iframe";
  
  // Default to mp4 for direct video URLs (not iframe)
  if (u.startsWith("http") && !u.includes("embed") && !u.includes("player")) {
    return "mp4";
  }
  
  return "iframe";
};

// Convert VK Video URL to embed format
const convertVkVideoUrl = (url: string): string => {
  if (!url) return url;
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.includes('video_ext.php')) {
    let embedUrl = url.replace(/^http:/, 'https:');
    if (!embedUrl.includes('hd=')) embedUrl += (embedUrl.includes('?') ? '&' : '?') + 'hd=2';
    if (!embedUrl.includes('autoplay=')) embedUrl += '&autoplay=0';
    return embedUrl;
  }
  
  const vkVideoMatch = url.match(/(?:vk\.com|vk\.ru|vkvideo\.ru)\/video(-?\d+)_(\d+)/i);
  if (vkVideoMatch) {
    const oid = vkVideoMatch[1];
    const id = vkVideoMatch[2];
    const hashMatch = url.match(/[?&]hash=([a-f0-9]+)/i);
    const hash = hashMatch ? `&hash=${hashMatch[1]}` : '';
    return `https://vk.com/video_ext.php?oid=${oid}&id=${id}${hash}&hd=2&autoplay=0`;
  }
  
  return url;
};

const NativeVideoPlayer = ({ 
  videoSources, 
  onEpisodeSelect,
  onSeasonSelect,
  episodes = [],
  seasons = [],
  currentEpisodeId,
  currentSeasonId,
  contentBackdrop,
  contentId,
  accessType = 'free',
  excludeFromPlan = false,
  rentalPrice,
  rentalPeriodDays = 7,
  mediaId,
  mediaType,
  title,
  movieId,
  onEnded,
  onFullscreenChange
}: NativeVideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffered, setBuffered] = useState(0);
  const [currentServer, setCurrentServer] = useState<VideoSource | null>(null);
  
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [accessLoading, setAccessLoading] = useState(true);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  
  // New state for enhanced features
  const [isScreenLocked, setIsScreenLocked] = useState(false);
  const [showEpisodesPanel, setShowEpisodesPanel] = useState(false);
  const [showSupportUsOverlay, setShowSupportUsOverlay] = useState(false);
  const [supportUsShownAtStart, setSupportUsShownAtStart] = useState(false);
  const [supportUsShownAt50, setSupportUsShownAt50] = useState(false);
  const [supportUsShownAt85, setSupportUsShownAt85] = useState(false);
  // State to control if video has been played for the first time
  const [hasAttemptedFirstPlay, setHasAttemptedFirstPlay] = useState(false);
  const [pendingPlayAfterOverlay, setPendingPlayAfterOverlay] = useState(false);
  
  // Video settings state
  const [stableVolume, setStableVolume] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [sleepTimer, setSleepTimer] = useState(0);
  const [currentTextTrack, setCurrentTextTrack] = useState('off');
  const [currentQuality, setCurrentQuality] = useState('auto');
  const [autoQualityEnabled, setAutoQualityEnabled] = useState(true);
  const [availableQualities, setAvailableQualities] = useState<string[]>([]);
  
  const { user } = useAuth();
  const { settings: playerSettings } = useNativePlayerSettings();
  const { settings: supportUsSettings } = useSupportUsSettings();
  const { hasActiveSubscription } = useSubscription();
  
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { saveProgress, restoreProgress } = useVideoResume({
    contentId: contentId || mediaId,
    episodeId: currentEpisodeId,
    videoRef,
  });

  const isNativePlatform = Capacitor.isNativePlatform();

  // Pinch to zoom for fullscreen
  const { scale, isZoomed, showIndicator, zoomPercentage, resetZoom } = usePinchToZoom({
    containerRef,
    videoRef,
    isFullscreen,
    enabled: true
  });

  // Enable screen protection on mount if enabled in settings
  useEffect(() => {
    if (playerSettings.enableScreenProtection && isNativePlatform) {
      NativeScreenProtection.enable();
      return () => {
        NativeScreenProtection.disable();
      };
    }
  }, [playerSettings.enableScreenProtection, isNativePlatform]);

  // Get unique versions from episodes
  const availableVersions = useMemo(() => {
    return [...new Set(episodes.map(ep => ep.version).filter(Boolean))] as string[];
  }, [episodes]);

  // Filter sources for native platform
  const allAvailableSources = useMemo(() => {
    return videoSources.filter(source => {
      if (source.permission === 'web_only') return false;
      return true;
    });
  }, [videoSources]);

  const allSourcesWebOnly = useMemo(() => {
    return videoSources.length > 0 && videoSources.every(s => s.permission === 'web_only');
  }, [videoSources]);

  // Track the current episode to detect episode changes
  const prevEpisodeIdRef = useRef<string | undefined>(currentEpisodeId);

  // Set initial server when sources change or episode changes
  useEffect(() => {
    // Detect if episode changed
    const episodeChanged = prevEpisodeIdRef.current !== currentEpisodeId;
    
    if (allAvailableSources.length > 0 && (!currentServer || episodeChanged)) {
      const defaultSource = allAvailableSources.find(s => s.is_default) || allAvailableSources[0];
      setCurrentServer(defaultSource);
      
      // Reset player state when episode changes
      if (episodeChanged) {
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        setHasAttemptedFirstPlay(false);
        setSupportUsShownAtStart(false);
        setSupportUsShownAt50(false);
        setSupportUsShownAt85(false);
        setPendingPlayAfterOverlay(false);
        
        // Clear video element
        if (videoRef.current) {
          videoRef.current.pause();
        }
      }
    }
    
    prevEpisodeIdRef.current = currentEpisodeId;
  }, [allAvailableSources, currentServer, currentEpisodeId]);

  // Extract available qualities from current server's quality_urls
  useEffect(() => {
    if (currentServer?.quality_urls && typeof currentServer.quality_urls === 'object') {
      const qualities = Object.keys(currentServer.quality_urls as Record<string, string>);
      // Sort qualities by resolution (480p, 720p, 1080p, etc.)
      const sortedQualities = qualities.sort((a, b) => {
        const getResolution = (q: string) => parseInt(q.replace(/\D/g, '')) || 0;
        return getResolution(a) - getResolution(b);
      });
      setAvailableQualities(sortedQualities);
      // Set default quality if not set
      if (!currentQuality || currentQuality === 'auto') {
        setCurrentQuality(sortedQualities[sortedQualities.length - 1] || 'auto');
      }
    } else if (currentServer?.quality) {
      // Fallback to single quality from source
      setAvailableQualities([currentServer.quality]);
      setCurrentQuality(currentServer.quality);
    } else {
      setAvailableQualities([]);
    }
  }, [currentServer]);

  // Check user access
  useEffect(() => {
    const checkAccess = async () => {
      setAccessLoading(true);
      
      if (accessType === 'free') {
        setHasAccess(true);
        setAccessLoading(false);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setHasAccess(false);
          setAccessLoading(false);
          return;
        }

        const { data: membership } = await supabase
          .from('user_memberships')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();

        if (membership && !excludeFromPlan) {
          setHasAccess(true);
          setAccessLoading(false);
          return;
        }

        if (accessType === 'rent' || contentId) {
          const { data: purchase } = await supabase
            .from('user_content_purchases')
            .select('*')
            .eq('user_id', user.id)
            .eq('content_id', contentId || mediaId)
            .eq('status', 'active')
            .gt('expires_at', new Date().toISOString())
            .maybeSingle();

          if (purchase) {
            setHasAccess(true);
            setAccessLoading(false);
            return;
          }
        }

        setHasAccess(false);
      } catch (error) {
        console.error('Access check error:', error);
        setHasAccess(false);
      }
      setAccessLoading(false);
    };

    checkAccess();
  }, [accessType, contentId, mediaId, excludeFromPlan, currentEpisodeId]);

  const isLocked = !accessLoading && hasAccess === false && accessType !== 'free';

  const sourceType = currentServer ? normalizeType(currentServer.source_type, currentServer.url) : "iframe";

  // Support Us overlay logic based on checkpoints (show during playback)
  useEffect(() => {
    if (!supportUsSettings.enabled || !playerSettings.showSupportUsOverlay || hasActiveSubscription || !duration) return;
    
    const progress = (currentTime / duration) * 100;
    
    // Show at 50%
    if (supportUsSettings.checkpoint50 && !supportUsShownAt50 && progress >= 50 && progress < 55) {
      setSupportUsShownAt50(true);
      setShowSupportUsOverlay(true);
      // Pause video when showing overlay
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    }
    
    // Show at 85%
    if (supportUsSettings.checkpoint85 && !supportUsShownAt85 && progress >= 85 && progress < 90) {
      setSupportUsShownAt85(true);
      setShowSupportUsOverlay(true);
      // Pause video when showing overlay
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    }
  }, [currentTime, duration, supportUsSettings, playerSettings.showSupportUsOverlay, hasActiveSubscription, supportUsShownAt50, supportUsShownAt85]);

  // Check if source is playable via Shaka (mp4 or hls)
  const isPlayableSource = sourceType === 'mp4' || sourceType === 'hls';

  // Initialize Shaka Player for HLS/MP4 sources
  const {
    loadSource: loadShakaSource,
    cleanup: cleanupShaka,
    isLoading: shakaLoading,
    setQuality: setShakaQuality,
    setAutoQuality: setShakaAutoQuality,
  } = useNativeShakaPlayer({
    videoRef,
    autoQualityEnabled,
    onQualitiesLoaded: (qualities) => {
      if (sourceType === 'hls') {
        setAvailableQualities(qualities);
      }
    },
    onError: (error) => {
      console.error('Shaka Player error:', error);
      setIsLoading(false);
    },
    onLoaded: () => {
      setIsLoading(false);
      restoreProgress();
    },
  });

  // Video event handlers (for MP4 and HLS sources)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isPlayableSource) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration || 0);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    const handleProgress = () => {
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };
    const handleEnded = () => {
      saveProgress();
      onEnded?.();
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('progress', handleProgress);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('progress', handleProgress);
      video.removeEventListener('ended', handleEnded);
    };
  }, [isPlayableSource, saveProgress, onEnded]);

  // Load video source (MP4 or HLS)
  useEffect(() => {
    if (!currentServer || !isPlayableSource || !videoRef.current || isLocked) return;
    
    const loadVideo = async () => {
      setIsLoading(true);
      
      // Get the actual URL to use (considering quality_urls for MP4)
      let videoUrl = currentServer.url;
      
      // Check if we have quality URLs for MP4
      if (sourceType === 'mp4' && currentServer.quality_urls && typeof currentServer.quality_urls === 'object') {
        const qualityUrls = currentServer.quality_urls as Record<string, string>;
        // Use selected quality or default
        const selectedQualityUrl = qualityUrls[currentQuality] || 
                                   qualityUrls[currentServer.default_quality || ''] ||
                                   Object.values(qualityUrls)[Object.values(qualityUrls).length - 1] ||
                                   currentServer.url;
        videoUrl = selectedQualityUrl || currentServer.url;
      }
      
      console.log(`Loading ${sourceType} source:`, videoUrl);
      
      if (sourceType === 'hls') {
        // Use Shaka Player for HLS
        const success = await loadShakaSource(videoUrl, 'application/x-mpegURL');
        if (!success) {
          console.error('Failed to load HLS source with Shaka');
        }
      } else {
        // For MP4, use direct src loading for better native compatibility
        try {
          await cleanupShaka();
          videoRef.current.src = videoUrl;
          videoRef.current.load();
          restoreProgress();
        } catch (error) {
          console.error('Error loading MP4:', error);
        }
        setIsLoading(false);
      }
    };
    
    loadVideo();
  }, [currentServer, isPlayableSource, isLocked, restoreProgress, currentQuality, sourceType, loadShakaSource, cleanupShaka]);

  const togglePlayPause = useCallback(() => {
    if (!videoRef.current || !isPlayableSource) return;
    
    // Check if support us overlay should show on first play attempt
    if (!hasAttemptedFirstPlay && !isPlaying && supportUsSettings.enabled && 
        supportUsSettings.checkpointStart && playerSettings.showSupportUsOverlay && !hasActiveSubscription) {
      setHasAttemptedFirstPlay(true);
      setSupportUsShownAtStart(true);
      setShowSupportUsOverlay(true);
      setPendingPlayAfterOverlay(true);
      // Do NOT start playing - wait for overlay countdown
      return;
    }
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(console.error);
    }
  }, [isPlaying, isPlayableSource, hasAttemptedFirstPlay, supportUsSettings, playerSettings.showSupportUsOverlay, hasActiveSubscription]);

  const handleSeek = useCallback((value: number[]) => {
    if (!videoRef.current || !isPlayableSource) return;
    videoRef.current.currentTime = value[0];
    setCurrentTime(value[0]);
  }, [isPlayableSource]);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      if (!isFullscreen) {
        // Enter fullscreen - always lock to landscape (for both mp4 and iframe)
        if (isNativePlatform) {
          await ScreenOrientation.lock({ orientation: 'landscape' });
        }
        
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if ((container as any).webkitRequestFullscreen) {
          await (container as any).webkitRequestFullscreen();
        }
        setIsFullscreen(true);
        onFullscreenChange?.(true);
      } else {
        // Exit fullscreen
        if (isNativePlatform) {
          await ScreenOrientation.lock({ orientation: 'portrait' });
        }
        
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
        setIsFullscreen(false);
        onFullscreenChange?.(false);
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  }, [isFullscreen, isNativePlatform, onFullscreenChange]);

  // Listen for fullscreen changes and update body class
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsFullscreen(isFs);
      onFullscreenChange?.(isFs);
      
      // Add/remove body class to hide notifications and other UI
      if (isFs) {
        document.body.classList.add('native-video-fullscreen');
      } else {
        document.body.classList.remove('native-video-fullscreen');
      }
      
      if (!isFs && isNativePlatform) {
        ScreenOrientation.lock({ orientation: 'portrait' }).catch(console.error);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      // Clean up body class on unmount
      document.body.classList.remove('native-video-fullscreen');
    };
  }, [isNativePlatform, onFullscreenChange]);

  const skipBackward = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
  };

  const skipForward = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleMouseMove = () => {
    if (isScreenLocked) return;
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, playerSettings.autoHideControlsMs || 3000);
  };

  const handleServerChange = useCallback(async (source: VideoSource) => {
    if (currentServer?.id === source.id) return;
    
    // Set loading state before changing source
    setIsLoading(true);
    setIsPlaying(false);
    
    // Clean up Shaka player if we were using HLS
    if (sourceType === 'hls') {
      await cleanupShaka();
    }
    
    // If we have a video element, reset it
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
    }
    
    // Use timeout to ensure smooth state transition
    setTimeout(() => {
      setCurrentServer(source);
      setCurrentTime(0);
      setDuration(0);
      setAvailableQualities([]);
      setCurrentQuality('auto');
    }, 50);
  }, [currentServer, sourceType, cleanupShaka]);

  const handleEpisodeSelect = useCallback(async (episodeId: string) => {
    // Set loading state immediately for smooth transition
    setIsLoading(true);
    setIsPlaying(false);
    
    // Clean up Shaka player if we were using HLS
    if (sourceType === 'hls') {
      await cleanupShaka();
    }
    
    // Clear video element completely for clean transition
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
    }
    
    // Clear current server to force reload
    setCurrentServer(null);
    
    // Use a slight delay to ensure state updates before new sources load
    setTimeout(() => {
      setCurrentTime(0);
      setDuration(0);
      setAvailableQualities([]);
      setCurrentQuality('auto');
      onEpisodeSelect?.(episodeId);
      
      // Reset support us shown states for new episode
      setSupportUsShownAtStart(false);
      setSupportUsShownAt50(false);
      setSupportUsShownAt85(false);
      setHasAttemptedFirstPlay(false);
      setPendingPlayAfterOverlay(false);
    }, 100);
  }, [onEpisodeSelect, sourceType, cleanupShaka]);

  // Handle support us overlay skip/close - play video if pending
  const handleSupportUsClose = useCallback(() => {
    setShowSupportUsOverlay(false);
    if (pendingPlayAfterOverlay && videoRef.current) {
      setPendingPlayAfterOverlay(false);
      videoRef.current.play().catch(console.error);
    }
  }, [pendingPlayAfterOverlay]);

  // Video settings handlers
  const handleQualityChange = useCallback((quality: string) => {
    setCurrentQuality(quality);
    setAutoQualityEnabled(false);
    
    // For HLS, use Shaka Player's quality switching
    if (sourceType === 'hls') {
      setShakaQuality(quality);
      setShakaAutoQuality(false);
      return;
    }
    
    // For MP4, switch to the quality URL if quality_urls is available
    if (currentServer?.quality_urls && typeof currentServer.quality_urls === 'object') {
      const qualityUrls = currentServer.quality_urls as Record<string, string>;
      const newUrl = qualityUrls[quality];
      if (newUrl && videoRef.current) {
        const currentTime = videoRef.current.currentTime;
        const wasPlaying = !videoRef.current.paused;
        videoRef.current.src = newUrl;
        videoRef.current.load();
        videoRef.current.currentTime = currentTime;
        if (wasPlaying) {
          videoRef.current.play().catch(console.error);
        }
      }
    }
  }, [currentServer, sourceType, setShakaQuality, setShakaAutoQuality]);

  const handleAutoQualityToggle = useCallback(() => {
    const newValue = !autoQualityEnabled;
    setAutoQualityEnabled(newValue);
    
    // For HLS, update Shaka ABR setting
    if (sourceType === 'hls') {
      setShakaAutoQuality(newValue);
    }
  }, [autoQualityEnabled, sourceType, setShakaAutoQuality]);

  const handlePlaybackSpeedChange = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  }, []);

  const handleTextTrackChange = useCallback((language: string) => {
    setCurrentTextTrack(language);
  }, []);

  const videoPoster = contentBackdrop || '';

  // Auth dialog
  const paymentDialogs = (
    <AuthDialog 
      open={showAuthDialog} 
      onOpenChange={setShowAuthDialog}
    />
  );

  // Loading state
  if (!currentServer) {
    if (allSourcesWebOnly) {
      return (
        <div ref={containerRef} className="relative bg-black w-full aspect-video">
          <AppLockOverlay type="web_only" contentBackdrop={contentBackdrop} />
          {paymentDialogs}
        </div>
      );
    }

    if (isLocked || (accessLoading && accessType !== 'free')) {
      return (
        <div 
          ref={containerRef}
          className="relative bg-black w-full aspect-video flex items-center justify-center"
          style={{
            backgroundImage: contentBackdrop ? `url(${contentBackdrop})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/90 to-black/70" />
          
          {accessLoading ? (
            <div className="relative z-10 flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-white/70 text-sm">Checking access...</p>
            </div>
          ) : (
            <div className="relative z-10 flex flex-col items-center gap-4 p-4 text-center max-w-md mx-4">
              <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center ring-2 ring-primary/30">
                {accessType === 'rent' ? (
                  <CreditCard className="w-7 h-7 text-yellow-500" />
                ) : (
                  <Crown className="w-7 h-7 text-primary" />
                )}
              </div>
              <div className="space-y-2">
                <h3 className="text-white text-xl font-bold">
                  {accessType === 'rent' ? 'Content For Rent' : 'Premium Content'}
                </h3>
                <p className="text-white/70 text-sm">
                  {accessType === 'rent' 
                    ? excludeFromPlan 
                      ? `Purchase to watch for ${rentalPeriodDays} days` 
                      : 'Subscribe or rent to unlock this content'
                    : 'Subscribe to unlock this premium content'}
                </p>
              </div>
              
              <InlineRentSubscribe
                accessType={accessType}
                excludeFromPlan={excludeFromPlan}
                rentalPrice={rentalPrice}
                rentalPeriodDays={rentalPeriodDays}
                contentId={contentId || mediaId}
                mediaType={mediaType}
                title={title}
                onAuthRequired={() => setShowAuthDialog(true)}
                onSuccess={() => window.location.reload()}
              />
            </div>
          )}
          {paymentDialogs}
        </div>
      );
    }

    return (
      <div 
        ref={containerRef}
        className="relative bg-black w-full aspect-video flex items-center justify-center"
        style={{
          backgroundImage: contentBackdrop ? `url(${contentBackdrop})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-white/70 text-sm">Loading player...</p>
        </div>
        {paymentDialogs}
      </div>
    );
  }

  // Main player render
  return (
    <>
      <div 
        ref={containerRef}
        className={`relative bg-black group w-full aspect-video ${isFullscreen ? 'fixed inset-0 z-[9999] !aspect-auto' : ''}`}
        onMouseMove={handleMouseMove}
        onTouchStart={handleMouseMove}
        style={{
          // Hide system UI elements when in fullscreen
          ...(isFullscreen && {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999
          })
        }}
      >
        {/* Zoom Indicator */}
        {isFullscreen && showIndicator && isZoomed && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[100] pointer-events-none">
            <div className="bg-black/70 text-white px-4 py-2 rounded-lg backdrop-blur-sm">
              <span className="text-lg font-medium">{zoomPercentage}%</span>
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {isLoading && !isLocked && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-white text-sm">Loading video...</p>
            </div>
          </div>
        )}

        {/* Locked Content Overlay */}
        {isLocked && (
          <div 
            className="absolute inset-0 bg-gradient-to-t from-black via-black/95 to-black/80 flex items-center justify-center z-[55]"
            style={{
              backgroundImage: contentBackdrop ? `url(${contentBackdrop})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/90 to-black/70" />
            <div className="relative z-10 flex flex-col items-center gap-4 p-4 text-center max-w-md mx-4">
              <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center ring-2 ring-primary/30">
                {accessType === 'rent' ? (
                  <CreditCard className="w-7 h-7 text-yellow-500" />
                ) : (
                  <Crown className="w-7 h-7 text-primary" />
                )}
              </div>
              <div className="space-y-2">
                <h3 className="text-white text-xl font-bold">
                  {accessType === 'rent' ? 'Content For Rent' : 'Premium Content'}
                </h3>
                <p className="text-white/70 text-sm">
                  {accessType === 'rent' 
                    ? excludeFromPlan 
                      ? `Purchase to watch for ${rentalPeriodDays} days` 
                      : 'Subscribe or rent to unlock this content'
                    : 'Subscribe to unlock this premium content'}
                </p>
              </div>
              
              <InlineRentSubscribe
                accessType={accessType}
                excludeFromPlan={excludeFromPlan}
                rentalPrice={rentalPrice}
                rentalPeriodDays={rentalPeriodDays}
                contentId={contentId || mediaId}
                mediaType={mediaType}
                title={title}
                onAuthRequired={() => setShowAuthDialog(true)}
                onSuccess={() => window.location.reload()}
              />
            </div>
          </div>
        )}

        {/* Web Only Lock */}
        {allSourcesWebOnly && !isLocked && !accessLoading && (
          <AppLockOverlay type="web_only" contentBackdrop={contentBackdrop} />
        )}

        {/* Video Element for MP4 and HLS sources */}
        {isPlayableSource && !isLocked && !accessLoading && !allSourcesWebOnly && (
          <video
            ref={videoRef}
            className="w-full h-full"
            poster={videoPoster}
            style={{ objectFit: 'contain' }}
            playsInline
            preload="metadata"
            crossOrigin="anonymous"
            controls={false}
          />
        )}

        {/* Iframe Element for embed sources */}
        {sourceType === 'iframe' && !isLocked && !accessLoading && !allSourcesWebOnly && (
          <iframe
            ref={iframeRef}
            src={convertVkVideoUrl(currentServer.url)}
            className="w-full h-full"
            allowFullScreen
            allow="autoplay; encrypted-media; fullscreen"
            style={{ border: 'none' }}
          />
        )}

        {/* Screen Lock Overlay - For MP4/HLS sources, NOT for embed/iframe */}
        {playerSettings.showScreenLock && isPlayableSource && (
          <ScreenLockOverlay
            isLocked={isScreenLocked}
            onToggleLock={() => setIsScreenLocked(!isScreenLocked)}
            showControls={showControls}
          />
        )}

        {/* Episodes Panel */}
        {playerSettings.showEpisodesPanel && episodes.length > 0 && (
          <EpisodesPanel
            isOpen={showEpisodesPanel}
            onClose={() => setShowEpisodesPanel(false)}
            episodes={episodes}
            seasons={seasons}
            currentEpisodeId={currentEpisodeId}
            currentSeasonId={currentSeasonId}
            onEpisodeSelect={handleEpisodeSelect}
            onSeasonSelect={onSeasonSelect}
            showVersionFilter={playerSettings.showVersionFilter}
            availableVersions={availableVersions}
            contentBackdrop={contentBackdrop}
          />
        )}

        {/* Support Us Overlay */}
        {playerSettings.showSupportUsOverlay && (
          <SupportUsOverlay
            isVisible={showSupportUsOverlay}
            onClose={handleSupportUsClose}
            onSkip={handleSupportUsClose}
            contentId={contentId || mediaId}
            contentTitle={title}
            countdownSeconds={supportUsSettings.countdownSeconds}
            supportAmounts={supportUsSettings.amounts}
            episodeId={currentEpisodeId}
            colors={supportUsSettings.colors}
          />
        )}

        {/* Top Right Controls: Server Selector Only - Show only if 2+ servers */}
        {!isScreenLocked && !accessLoading && !isLocked && showControls && (
          <div className="absolute top-2 right-2 z-[60] flex items-center gap-2 transition-opacity duration-300">
            {/* Server Selector - Only show if there are 2 or more servers */}
            {playerSettings.showServerSelector && allAvailableSources.length >= 2 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white bg-black/40 hover:bg-black/60">
                    <ServerIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  className="bg-black/95 text-white border border-white/10 shadow-xl z-[10000] min-w-[180px]"
                  align="end"
                  sideOffset={8}
                >
                  <DropdownMenuLabel className="text-white/70 text-xs">Select Server</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/10" />
                  {allAvailableSources.map((source, index) => {
                    const isActive = currentServer?.id === source.id;
                    const serverDisplayName = source.server_name || `Server ${index + 1}`;
                    return (
                      <DropdownMenuItem
                        key={source.id}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleServerChange(source);
                        }}
                        className={`cursor-pointer ${isActive ? "bg-primary text-primary-foreground" : "hover:bg-white/10 text-white"}`}
                      >
                        <ServerIcon className="h-4 w-4 mr-2" />
                        <span className="flex-1">{serverDisplayName}</span>
                        {source.quality && (
                          <span className="ml-2 text-xs bg-white/20 px-1.5 py-0.5 rounded">{source.quality}</span>
                        )}
                        {source.version && (
                          <span className="ml-1 text-xs bg-primary/30 px-1.5 py-0.5 rounded">{source.version}</span>
                        )}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
        
        {/* Embed/Iframe Fullscreen Button - Bottom Right for smooth toggle - 100% transparent background */}
        {sourceType === 'iframe' && !accessLoading && !isLocked && showControls && (
          <div className="absolute bottom-4 right-4 z-[60] transition-opacity duration-300">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleFullscreen}
              className="h-10 w-10 text-white hover:text-white/80 bg-transparent hover:bg-transparent rounded-full"
            >
              {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </Button>
          </div>
        )}

        {/* Video Controls - For MP4/HLS sources */}
        {isPlayableSource && !isLocked && !accessLoading && !allSourcesWebOnly && !isScreenLocked && (
          <>
            {/* Exit Fullscreen Button */}
            {isFullscreen && showControls && (
              <div className="absolute top-4 left-4 z-[60]">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleFullscreen}
                  className="h-10 w-10 text-white bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </div>
            )}

            {/* Center Controls */}
            <div 
              className="absolute inset-0 z-10 flex items-center justify-center"
              onClick={togglePlayPause}
            >
              {showControls && (
                <div className="flex items-center gap-12">
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); skipBackward(); }} className="h-12 w-12 text-white/90">
                    <SkipBack className="h-6 w-6" fill="currentColor" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-16 w-16 rounded-full text-white">
                    {isPlaying ? <Pause className="h-7 w-7" fill="currentColor" /> : <Play className="h-7 w-7 ml-0.5" fill="currentColor" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); skipForward(); }} className="h-12 w-12 text-white/90">
                    <SkipForward className="h-6 w-6" fill="currentColor" />
                  </Button>
                </div>
              )}
            </div>

            {/* Bottom Controls */}
            <div className={`absolute bottom-0 left-0 right-0 z-40 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
              {/* Progress Bar */}
              <div className="px-4 pb-2">
                <div className="relative h-1.5 bg-white/20 rounded-full">
                  <div className="absolute h-full bg-white/30 rounded-full" style={{ width: `${(buffered / duration) * 100}%` }} />
                  <Slider
                    value={[currentTime]}
                    max={duration || 100}
                    step={0.1}
                    onValueChange={handleSeek}
                    className="absolute inset-0"
                  />
                </div>
              </div>

              {/* Control Bar */}
              <div className="bg-gradient-to-t from-black/90 to-transparent px-4 pb-4 pt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={toggleMute} className="h-8 w-8 text-white">
                    {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </Button>
                  <span className="text-white text-xs">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>
                
                <div className="flex items-center gap-1">
                  {/* Screen Lock Button - Before Episodes (for MP4/HLS sources) */}
                  {playerSettings.showScreenLock && isPlayableSource && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setIsScreenLocked(true)}
                      className="h-8 w-8 text-white hover:bg-white/10"
                    >
                      <Lock className="h-4 w-4" />
                    </Button>
                  )}
                  
                  {/* Episodes Button (text version for bottom bar) */}
                  {playerSettings.showEpisodesPanel && episodes.length > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setShowEpisodesPanel(true)} 
                      className="h-8 text-white gap-1.5 px-2"
                    >
                      <ListVideo className="h-4 w-4" />
                      <span className="text-xs hidden sm:inline">Episodes</span>
                    </Button>
                  )}
                  
                  {/* Settings/Gear Icon */}
                  <VideoSettingsMenu
                    stableVolume={stableVolume}
                    onStableVolumeChange={setStableVolume}
                    availableTextTracks={[]}
                    currentTextTrack={currentTextTrack}
                    onTextTrackChange={handleTextTrackChange}
                    sleepTimer={sleepTimer}
                    onSleepTimerChange={setSleepTimer}
                    playbackSpeed={playbackSpeed}
                    onPlaybackSpeedChange={handlePlaybackSpeedChange}
                    availableQualities={availableQualities}
                    currentQuality={currentQuality}
                    autoQualityEnabled={autoQualityEnabled}
                    onQualityChange={handleQualityChange}
                    onAutoQualityToggle={handleAutoQualityToggle}
                    sourceType={sourceType}
                  />
                  
                  <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="h-8 w-8 text-white">
                    {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

      </div>

      {paymentDialogs}
    </>
  );
};

export default NativeVideoPlayer;
