import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, 
  Loader2, SkipBack, SkipForward, Crown,
  Server as ServerIcon, CreditCard, ArrowLeft
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

interface NativeVideoPlayerProps {
  videoSources: VideoSource[];
  onEpisodeSelect?: (episodeId: string) => void;
  episodes?: any[];
  currentEpisodeId?: string;
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
  if (t === "iframe" || t === "embed") return "iframe";
  if (t === "mp4") return "mp4";
  const u = (url || "").toLowerCase();
  if (u.endsWith(".mp4")) return "mp4";
  if (u.includes("youtube.com") || u.includes("youtu.be") || u.includes("player.") || u.includes("embed")) return "iframe";
  if (u.includes("vk.com/video") || u.includes("vk.ru/video")) return "iframe";
  // For native apps, prefer iframe for HLS/DASH sources to avoid Shaka issues
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
  episodes = [],
  currentEpisodeId, 
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
  
  const { user } = useAuth();
  
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { saveProgress, restoreProgress } = useVideoResume({
    contentId: contentId || mediaId,
    episodeId: currentEpisodeId,
    videoRef,
  });

  const isNativePlatform = Capacitor.isNativePlatform();

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

  // Set initial server
  useEffect(() => {
    if (allAvailableSources.length > 0 && !currentServer) {
      const defaultSource = allAvailableSources.find(s => s.is_default) || allAvailableSources[0];
      setCurrentServer(defaultSource);
    }
  }, [allAvailableSources, currentServer]);

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

  // Video event handlers (only for MP4 sources)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || sourceType !== 'mp4') return;

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
  }, [sourceType, saveProgress, onEnded]);

  // Load MP4 source
  useEffect(() => {
    if (!currentServer || sourceType !== 'mp4' || !videoRef.current || isLocked) return;
    
    setIsLoading(true);
    videoRef.current.src = currentServer.url;
    videoRef.current.load();
    restoreProgress();
    setIsLoading(false);
  }, [currentServer, sourceType, isLocked, restoreProgress]);

  const togglePlayPause = useCallback(() => {
    if (!videoRef.current || sourceType !== 'mp4') return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(console.error);
    }
  }, [isPlaying, sourceType]);

  const handleSeek = useCallback((value: number[]) => {
    if (!videoRef.current || sourceType !== 'mp4') return;
    videoRef.current.currentTime = value[0];
    setCurrentTime(value[0]);
  }, [sourceType]);

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
        // Enter fullscreen
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

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsFullscreen(isFs);
      onFullscreenChange?.(isFs);
      
      if (!isFs && isNativePlatform) {
        ScreenOrientation.lock({ orientation: 'portrait' }).catch(console.error);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
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
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  const handleServerChange = (source: VideoSource) => {
    setCurrentServer(source);
    setIsPlaying(false);
  };

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
      >
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

        {/* MP4 Video Element */}
        {sourceType === 'mp4' && !isLocked && !accessLoading && !allSourcesWebOnly && (
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

        {/* Iframe Element (default for native) */}
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

        {/* Server Selector */}
        {allAvailableSources.length > 1 && !accessLoading && (
          <div className={`absolute top-2 right-2 z-[60] transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white bg-black/40 hover:bg-black/60">
                  <ServerIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-background text-foreground border border-border shadow-xl z-[10000]">
                <DropdownMenuLabel className="text-muted-foreground">Select Server</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border" />
                {allAvailableSources.map((source) => {
                  const isActive = currentServer?.id === source.id;
                  return (
                    <DropdownMenuItem
                      key={source.id}
                      onClick={() => handleServerChange(source)}
                      className={`${isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                    >
                      <ServerIcon className="h-4 w-4 mr-2" />
                      <span>{source.server_name || 'Server'}</span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* MP4 Controls */}
        {sourceType === 'mp4' && !isLocked && !accessLoading && !allSourcesWebOnly && (
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
                
                <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="h-8 w-8 text-white">
                  {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </Button>
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
