import { useState, useMemo, useRef } from 'react';
import { X, Play, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

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

interface EpisodesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  episodes: Episode[];
  seasons?: Season[];
  currentEpisodeId?: string;
  currentSeasonId?: string;
  onEpisodeSelect: (episodeId: string) => void;
  onSeasonSelect?: (seasonId: string) => void;
  showVersionFilter?: boolean;
  availableVersions?: string[];
  contentBackdrop?: string;
  isLandscape?: boolean;
}

export const EpisodesPanel = ({
  isOpen,
  onClose,
  episodes,
  seasons = [],
  currentEpisodeId,
  currentSeasonId,
  onEpisodeSelect,
  onSeasonSelect,
  showVersionFilter = true,
  availableVersions = [],
  contentBackdrop,
  isLandscape = false
}: EpisodesPanelProps) => {
  const [selectedVersion, setSelectedVersion] = useState<string>('all');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Get unique versions from episodes
  const versions = useMemo(() => {
    if (availableVersions.length > 0) return availableVersions;
    const uniqueVersions = [...new Set(episodes.map(ep => ep.version).filter(Boolean))];
    return uniqueVersions as string[];
  }, [episodes, availableVersions]);

  // Filter episodes by version
  const filteredEpisodes = useMemo(() => {
    if (selectedVersion === 'all') return episodes;
    return episodes.filter(ep => ep.version === selectedVersion);
  }, [episodes, selectedVersion]);

  // Get current season
  const currentSeason = seasons.find(s => s.id === currentSeasonId);

  // Scroll handlers for horizontal scroll
  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  };

  if (!isOpen) return null;

  // Detect if we're in landscape mode (fullscreen video)
  const isFullscreenLandscape = typeof window !== 'undefined' && window.innerWidth > window.innerHeight;

  return (
    <div 
      className={cn(
        "absolute z-[65] animate-fade-in",
        // Always use bottom-anchored horizontal layout for both orientations
        "bottom-0 left-0 right-0 h-auto"
      )}
      style={{
        // Frosted glass effect
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
      }}
    >
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between border-b border-white/10",
        "px-4 py-2"
      )}>
        <div className="flex items-center gap-3">
          <h3 className="text-white font-semibold text-sm">Episodes</h3>
          
          {/* Season Selector */}
          {seasons.length > 1 && onSeasonSelect && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-white/80 hover:text-white gap-1 text-xs">
                  {currentSeason?.title || 'Season 1'}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-background border-border max-h-[300px] overflow-auto">
                {seasons.map((season) => (
                  <DropdownMenuItem
                    key={season.id}
                    onClick={() => onSeasonSelect(season.id)}
                    className={cn(
                      currentSeasonId === season.id && "bg-primary text-primary-foreground"
                    )}
                  >
                    {season.title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Version Filter */}
          {showVersionFilter && versions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-white/80 hover:text-white gap-1 bg-white/10 text-xs">
                  {selectedVersion === 'all' ? 'All' : selectedVersion}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-background border-border">
                <DropdownMenuItem
                  onClick={() => setSelectedVersion('all')}
                  className={selectedVersion === 'all' ? "bg-primary text-primary-foreground" : ""}
                >
                  All Versions
                </DropdownMenuItem>
                {versions.map((version) => (
                  <DropdownMenuItem
                    key={version}
                    onClick={() => setSelectedVersion(version)}
                    className={selectedVersion === version ? "bg-primary text-primary-foreground" : ""}
                  >
                    {version}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10 h-7 w-7">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Episodes - Always horizontal scroll for both portrait and landscape */}
      <div className="relative px-4 py-3">
        {/* Left Arrow - Rounded with frosted glass */}
        <button 
          onClick={scrollLeft}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all border border-white/10 shadow-lg"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {/* Horizontal scroll container */}
        <div 
          ref={scrollContainerRef}
          className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide scroll-smooth px-10"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {filteredEpisodes.map((episode) => {
            const isCurrentEpisode = episode.id === currentEpisodeId;
            const hasEpisodeThumbnail = !!episode.still_path;
            const thumbnailUrl = episode.still_path?.startsWith('http')
              ? episode.still_path
              : episode.still_path
                ? `https://image.tmdb.org/t/p/w300${episode.still_path}`
                : contentBackdrop || null;

            return (
              <button
                key={episode.id}
                onClick={() => {
                  onEpisodeSelect(episode.id);
                  onClose();
                }}
                className={cn(
                  "relative group flex-shrink-0 rounded-xl overflow-hidden transition-all duration-200",
                  // Slightly larger cards
                  isFullscreenLandscape ? "w-44 aspect-video" : "w-32 sm:w-36 aspect-video",
                  isCurrentEpisode 
                    ? "ring-2 ring-cyan-400 shadow-lg shadow-cyan-400/30" 
                    : "hover:ring-2 hover:ring-white/40"
                )}
              >
                {/* Thumbnail */}
                <div className="w-full h-full bg-white/10 relative">
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt={`EP ${episode.episode_number}`}
                      className={cn(
                        "w-full h-full object-cover",
                        !hasEpisodeThumbnail && "opacity-50"
                      )}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-white/10 to-white/5" />
                  )}
                  
                  {/* Word-Art Style Episode Number - Larger */}
                  <div className="absolute bottom-1.5 left-2.5 pointer-events-none">
                    <span 
                      className={cn(
                        "text-white font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]",
                        isFullscreenLandscape ? "text-5xl" : "text-3xl sm:text-4xl"
                      )}
                      style={{
                        WebkitTextStroke: '1.5px rgba(255,255,255,0.3)',
                        textShadow: '3px 3px 0 rgba(0,0,0,0.6), -1px -1px 0 rgba(255,255,255,0.15)',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        fontStyle: 'italic',
                      }}
                    >
                      {episode.episode_number}
                    </span>
                  </div>
                  
                  {/* Play overlay on hover */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play className={cn("text-white", isFullscreenLandscape ? "h-9 w-9" : "h-7 w-7")} fill="white" />
                  </div>

                  {/* "Now" badge on current episode - Enhanced styling */}
                  {isCurrentEpisode && (
                    <div className="absolute top-1.5 left-1.5 bg-cyan-500 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-lg animate-pulse">
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                      Now
                    </div>
                  )}

                  {/* Version badge */}
                  {episode.version && (
                    <div className="absolute bottom-1.5 right-1.5 bg-primary/80 text-primary-foreground text-[10px] px-1.5 py-0.5 rounded">
                      {episode.version}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Arrow - Rounded with frosted glass */}
        <button 
          onClick={scrollRight}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all border border-white/10 shadow-lg"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Empty state message if no episodes */}
      {filteredEpisodes.length === 0 && (
        <div className="flex items-center justify-center h-20 text-white/50 text-sm">
          No episodes found
        </div>
      )}
    </div>
  );
};