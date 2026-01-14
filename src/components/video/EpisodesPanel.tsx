import { useState, useMemo } from 'react';
import { X, Play, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  contentBackdrop
}: EpisodesPanelProps) => {
  const [selectedVersion, setSelectedVersion] = useState<string>('all');

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

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-[65] bg-black/95 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <h3 className="text-white font-semibold text-lg">Episodes</h3>
          
          {/* Season Selector */}
          {seasons.length > 1 && onSeasonSelect && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-white/80 hover:text-white gap-1">
                  {currentSeason?.title || 'Season 1'}
                  <ChevronDown className="h-4 w-4" />
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
                <Button variant="ghost" size="sm" className="text-white/80 hover:text-white gap-1 bg-white/10">
                  {selectedVersion === 'all' ? 'All Versions' : selectedVersion}
                  <ChevronDown className="h-4 w-4" />
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
          
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Episodes Grid */}
      <ScrollArea className="h-[calc(100%-60px)]">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-4">
          {filteredEpisodes.map((episode) => {
            const isCurrentEpisode = episode.id === currentEpisodeId;
            // Use episode still_path if available, otherwise use series backdrop
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
                  "relative group rounded-lg overflow-hidden transition-all duration-200",
                  isCurrentEpisode 
                    ? "ring-2 ring-primary" 
                    : "hover:ring-2 hover:ring-white/30"
                )}
              >
                {/* Thumbnail */}
                <div className="aspect-video bg-white/10 relative">
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt={`EP ${episode.episode_number}`}
                      className={cn(
                        "w-full h-full object-cover",
                        // Apply 50% opacity if using backdrop as fallback
                        !hasEpisodeThumbnail && "opacity-50"
                      )}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/10 to-white/5">
                      {/* Fallback: show large episode number */}
                    </div>
                  )}
                  
                  {/* Large Episode Number Overlay - Always visible */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-white/80 text-3xl sm:text-4xl font-bold drop-shadow-lg">
                      EP {episode.episode_number}
                    </span>
                  </div>
                  
                  {/* Play overlay on hover */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play className="h-8 w-8 text-white" fill="white" />
                  </div>

                  {/* Currently playing indicator */}
                  {isCurrentEpisode && (
                    <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Playing
                    </div>
                  )}

                  {/* Version badge */}
                  {episode.version && (
                    <div className="absolute bottom-2 right-2 bg-primary/80 text-primary-foreground text-xs px-2 py-0.5 rounded">
                      {episode.version}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {filteredEpisodes.length === 0 && (
          <div className="flex items-center justify-center h-40 text-white/50">
            No episodes found
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
