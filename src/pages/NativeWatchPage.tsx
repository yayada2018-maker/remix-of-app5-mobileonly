import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Home, Film, Tv, LayoutDashboard, ChevronDown, Crown, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import NativeVideoPlayer from "@/components/NativeVideoPlayer";
import { CommentsSection } from "@/components/CommentsSection";
import { useSwipeScroll } from "@/hooks/useSwipeScroll";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { CastSkeleton, EpisodesSkeleton, RecommendedSkeleton } from "@/components/watch/ContentSkeleton";
import { ActionButtons } from "@/components/watch/ActionButtons";
import { SocialShareMeta } from "@/components/SocialShareMeta";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { WalletSection } from "@/components/wallet/WalletSection";
import { SubscriptionDialog } from "@/components/subscription/SubscriptionDialog";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import CastMemberDialog from "@/components/movie/CastMemberDialog";
import { useProfileImage } from "@/hooks/useProfileImage";
import { useContentData, Content } from "@/hooks/useContentData";
import { NativeBannerAdSlot } from "@/components/ads/NativeBannerAdSlot";

interface Episode {
  id: string;
  episode_number: number;
  title: string;
  still_path?: string;
  season_id?: string;
  show_id?: string;
  access_type?: 'free' | 'membership' | 'purchase';
  price?: number;
}

// Collapsible Tabs Section Component
interface CollapsibleTabsSectionProps {
  isSeriesContent: boolean;
  seasons: any[];
  selectedSeasonId: string | null;
  setSelectedSeasonId: (id: string) => void;
  episodes: Episode[];
  episodesLoading: boolean;
  content: Content | null;
  currentEpisode: Episode | null;
  fetchVideoSource: (episodeId: string) => void;
  getProgressPercentage: (episodeId: string) => number;
  forYouContent: any[];
  navigate: (path: string) => void;
}

const CollapsibleTabsSection = ({
  isSeriesContent,
  seasons,
  selectedSeasonId,
  setSelectedSeasonId,
  episodes,
  episodesLoading,
  content,
  currentEpisode,
  fetchVideoSource,
  getProgressPercentage,
  forYouContent,
  navigate,
}: CollapsibleTabsSectionProps) => {
  const [episodesExpanded, setEpisodesExpanded] = useState(false);
  
  const filteredEpisodes = useMemo(() => {
    if (!selectedSeasonId) return episodes;
    return episodes.filter(ep => ep.season_id === selectedSeasonId);
  }, [episodes, selectedSeasonId]);

  return (
    <Tabs defaultValue="episodes" className="w-full">
      <TabsList className="w-full justify-center bg-transparent border-b rounded-none h-auto p-0">
        {isSeriesContent && (
          <TabsTrigger 
            value="episodes"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-2 py-1.5 text-xs sm:text-sm"
          >
            Episodes
          </TabsTrigger>
        )}
        <TabsTrigger 
          value="foryou"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-2 py-1.5 text-xs sm:text-sm"
        >
          For You
        </TabsTrigger>
        <TabsTrigger 
          value="comments"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-2 py-1.5 text-xs sm:text-sm"
        >
          Comments
        </TabsTrigger>
        <TabsTrigger 
          value="detail"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-2 py-1.5 text-xs sm:text-sm"
        >
          Detail
        </TabsTrigger>
        <TabsTrigger 
          value="home"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-2 py-1.5 text-xs sm:text-sm"
        >
          Home
        </TabsTrigger>
      </TabsList>

      {/* Episodes Tab */}
      <TabsContent value="episodes" className="mt-0">
        {isSeriesContent && content && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative rounded-lg overflow-hidden cursor-pointer"
            onClick={() => setEpisodesExpanded(!episodesExpanded)}
          >
            <img 
              src={content.backdrop_path || content.poster_path || "/placeholder.svg"} 
              alt={content.title}
              className="w-full aspect-[16/6.75] object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 flex items-end gap-3">
              <div className="w-14 h-20 rounded-lg overflow-hidden flex-shrink-0 shadow-lg border border-white/20">
                <img 
                  src={content.poster_path || "/placeholder.svg"} 
                  alt={content.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-white truncate">{content.title}</p>
                <p className="text-sm text-primary font-medium">
                  {currentEpisode ? `Watching S${seasons.find(s => s.id === selectedSeasonId)?.season_number || 1} EP${currentEpisode.episode_number}` : 'Watching'}
                </p>
                <p className="text-xs text-white/70">
                  {filteredEpisodes.length} Episodes
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-white/80 font-medium">More Episodes</span>
                <motion.div
                  animate={{ rotate: episodesExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="bg-white/20 rounded-full p-1.5 backdrop-blur-sm"
                >
                  <ChevronDown className="h-4 w-4 text-white" />
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
        
        <AnimatePresence mode="wait">
          {isSeriesContent && episodesExpanded && (
            <motion.div
              key="expanded"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden mt-3"
            >
              {seasons.length > 1 && (
                <div className="flex gap-2 mb-3 flex-wrap">
                  {seasons.map((season) => (
                    <Button
                      key={season.id}
                      variant={selectedSeasonId === season.id ? "default" : "outline"}
                      size="sm"
                      className={`h-8 px-4 text-sm ${selectedSeasonId === season.id ? "bg-primary hover:bg-primary/90" : ""}`}
                      onClick={() => setSelectedSeasonId(season.id)}
                    >
                      Season {season.season_number}
                    </Button>
                  ))}
                </div>
              )}

              {episodesLoading ? (
                <EpisodesSkeleton />
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {filteredEpisodes.map((ep) => {
                    const progressPercent = getProgressPercentage(ep.id);
                    const isActive = currentEpisode?.id === ep.id;
                    const isFreeEpisode = ep.access_type === 'free';
                    const isRentEpisode = ep.access_type === 'purchase';
                    const isMembershipEpisode = ep.access_type === 'membership';
                    return (
                      <motion.div
                        key={ep.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2 }}
                        className={`relative aspect-video rounded-lg overflow-hidden bg-muted cursor-pointer hover:opacity-80 transition-all hover:scale-[1.02] ${isActive ? 'ring-2 ring-primary' : ''}`}
                        onClick={async () => {
                          // Clear video sources first
                          fetchVideoSource(ep.id);
                          // Update URL without causing a full reload
                          const seasonNum = seasons.find(s => s.id === ep.season_id)?.season_number || 1;
                          const contentIdentifier = content?.tmdb_id || content?.id;
                          // Use replace to avoid adding to history and prevent useEffect reset
                          window.history.replaceState({}, '', `/watch/series/${contentIdentifier}/${seasonNum}/${ep.episode_number}`);
                        }}
                      >
                        <img
                          src={ep.still_path || content?.backdrop_path || "/placeholder.svg"}
                          alt={`Episode ${ep.episode_number}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-1.5 right-1.5">
                          {isFreeEpisode ? (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-green-500 text-white rounded shadow-md uppercase">Free</span>
                          ) : isRentEpisode ? (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-yellow-500 text-black rounded shadow-md uppercase">Rent</span>
                          ) : isMembershipEpisode ? (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-red-600 text-white rounded shadow-md uppercase flex items-center gap-0.5">
                              <Crown className="h-2.5 w-2.5" />VIP+
                            </span>
                          ) : null}
                        </div>
                        {progressPercent > 0 && (
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                            <div className="h-full bg-red-600 transition-all" style={{ width: `${Math.min(progressPercent, 100)}%` }} />
                          </div>
                        )}
                        <div className="absolute bottom-1 left-2">
                          <span className="text-3xl font-black text-white leading-none" style={{
                            textShadow: '2px 2px 0px rgba(0,0,0,0.9), 4px 4px 8px rgba(0,0,0,0.5)',
                            WebkitTextStroke: '1px rgba(255,255,255,0.3)',
                          }}>
                            {ep.episode_number}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </TabsContent>

      {/* For You Tab */}
      <TabsContent value="foryou" className="mt-3">
        <div className="grid grid-cols-4 gap-2">
          {forYouContent && forYouContent.length > 0 ? (
            forYouContent.slice(0, 8).map((item) => (
              <div
                key={item.id}
                className="cursor-pointer transition-transform hover:scale-105"
                onClick={() => {
                  const contentIdentifier = item.tmdb_id || item.id;
                  if (item.content_type === 'anime') {
                    navigate(`/watch/anime/${contentIdentifier}/1/1`);
                  } else if (item.content_type === 'series') {
                    navigate(`/watch/series/${contentIdentifier}/1/1`);
                  } else {
                    navigate(`/watch/movie/${contentIdentifier}`);
                  }
                }}
              >
                <div className="aspect-[2/3] rounded-lg overflow-hidden">
                  <img
                    src={item.poster_path || "/placeholder.svg"}
                    alt={item.title}
                    className="w-full h-full object-cover hover:opacity-80 transition-opacity"
                  />
                </div>
              </div>
            ))
          ) : (
            <RecommendedSkeleton columns={4} />
          )}
        </div>
      </TabsContent>

      {/* Comments Tab */}
      <TabsContent value="comments" className="mt-3">
        <CommentsSection 
          episodeId={currentEpisode?.id}
          movieId={content?.content_type === 'movie' ? content.id : undefined}
        />
      </TabsContent>

      {/* Detail Tab */}
      <TabsContent value="detail" className="mt-3">
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold text-sm mb-1">Description</h4>
            <p className="text-muted-foreground text-sm">
              {content?.overview || 'No description available.'}
            </p>
          </div>
        </div>
      </TabsContent>

      {/* Home Tab */}
      <TabsContent value="home" className="mt-3">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-2"
        >
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
            onClick={() => navigate('/')}
          >
            <Home className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">Go to Home</span>
            <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
            onClick={() => navigate('/series')}
          >
            <Tv className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">Go to Series</span>
            <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
            onClick={() => navigate('/movies')}
          >
            <Film className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">Go to Movies</span>
            <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
            onClick={() => navigate('/dashboard')}
          >
            <LayoutDashboard className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">Go to Dashboard</span>
            <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
          </motion.div>
        </motion.div>
      </TabsContent>
    </Tabs>
  );
};

const NativeWatchPage = () => {
  const { type, id, season, episode } = useParams<{ type: string; id: string; season?: string; episode?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { hasActiveSubscription, remainingDays } = useSubscription();
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false);

  const contentType = type === 'movie' ? 'movie' : 'series';
  const { content, seasons, episodes: rawEpisodes, videoSources: allVideoSources, loading, error } = useContentData(id, contentType as 'movie' | 'series');

  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [videoSources, setVideoSources] = useState<any[]>([]);
  const [manualEpisodeSelection, setManualEpisodeSelection] = useState<string | null>(null);
  
const [castMembers, setCastMembers] = useState<any[]>([]);
  const [forYouContent, setForYouContent] = useState<any[]>([]);
  const [relatedContent, setRelatedContent] = useState<any[]>([]);
  const [shorts, setShorts] = useState<any[]>([]);
  const [watchHistory, setWatchHistory] = useState<Record<string, { progress: number; duration: number }>>({});
  const [castLoading, setCastLoading] = useState(true);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<{ username: string | null; profile_image: string | null } | null>(null);
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);
  const [selectedCastMember, setSelectedCastMember] = useState<any>(null);

  // Convert episodes
  const episodes: Episode[] = useMemo(() => rawEpisodes.map(ep => ({
    id: ep.id,
    episode_number: ep.episode_number || 1,
    title: ep.title,
    still_path: ep.still_path,
    season_id: ep.season_id,
    show_id: ep.show_id,
    access_type: ep.access_type,
    price: ep.price
  })), [rawEpisodes]);

  const displayEpisodes = useMemo(() => {
    if (!selectedSeasonId) return episodes;
    const seasonExists = seasons.some(s => s.id === selectedSeasonId);
    if (!seasonExists) return episodes;
    return episodes.filter(ep => ep.season_id === selectedSeasonId);
  }, [episodes, selectedSeasonId, seasons]);

  const { signedUrl: profileImageUrl } = useProfileImage({ 
    imagePath: userProfile?.profile_image,
    userId: user?.id 
  });

  // Reset state when content changes
  useEffect(() => {
    setCurrentEpisode(null);
    setSelectedSeasonId(null);
    setVideoSources([]);
    setManualEpisodeSelection(null);
  }, [id, type]);

  // Fetch user profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('username, profile_image')
        .eq('id', user.id)
        .maybeSingle();
      if (data) setUserProfile(data);
    };
    fetchProfile();
  }, [user?.id]);

  // Initialize video sources - skip if user manually selected an episode
  useEffect(() => {
    // Skip initialization if user manually selected an episode
    if (manualEpisodeSelection) return;
    
    if (contentType === 'movie' && allVideoSources.length > 0) {
      setVideoSources(allVideoSources);
    } else if (contentType === 'series' && content?.id) {
      const seasonsMatchContent = seasons.length > 0 && seasons[0]?.show_id === content.id;
      if (!seasonsMatchContent) return;
      
      const episodesMatchContent = episodes.length > 0 && episodes[0]?.show_id === content.id;
      if (!episodesMatchContent) return;
      
      if (seasons.length > 0) {
        let targetSeasonId = selectedSeasonId;
        const selectedSeasonBelongsToContent = selectedSeasonId && seasons.some(s => s.id === selectedSeasonId);
        
        if (season && (!selectedSeasonId || !selectedSeasonBelongsToContent)) {
          const seasonNum = parseInt(season);
          const targetSeason = seasons.find(s => s.season_number === seasonNum);
          if (targetSeason) {
            targetSeasonId = targetSeason.id;
            setSelectedSeasonId(targetSeason.id);
          } else {
            targetSeasonId = seasons[0].id;
            setSelectedSeasonId(seasons[0].id);
          }
        } else if (!selectedSeasonId || !selectedSeasonBelongsToContent) {
          targetSeasonId = seasons[0].id;
          setSelectedSeasonId(seasons[0].id);
        }
      }
      
      if (episodes.length > 0 && allVideoSources.length > 0) {
        let targetEp: Episode | undefined;
        
        if (episode) {
          const episodeNum = parseInt(episode);
          if (season && seasons.length > 0) {
            const seasonNum = parseInt(season);
            const targetSeason = seasons.find(s => s.season_number === seasonNum);
            if (targetSeason) {
              const seasonEpisodes = episodes.filter(ep => ep.season_id === targetSeason.id);
              targetEp = seasonEpisodes.find(ep => ep.episode_number === episodeNum) || seasonEpisodes[0];
            }
          }
          
          if (!targetEp) {
            targetEp = episodes.find(ep => ep.episode_number === episodeNum);
          }
        }
        
        if (!targetEp) {
          targetEp = episodes[0];
        }
        
        if (targetEp) {
          setCurrentEpisode(targetEp);
          const sources = allVideoSources.filter(s => s.episode_id === targetEp!.id);
          setVideoSources(sources);
        }
      }
    }
  }, [content?.id, allVideoSources.length, episodes, seasons, season, episode, contentType, selectedSeasonId, manualEpisodeSelection]);

  // Fetch "For You" content with randomization
  useEffect(() => {
    const fetchForYou = async () => {
      if (!content?.id) return;
      
      // Use content_type for matching similar content
      const currentContentType = content.content_type;
      
      // Fetch different content for "For You" - mix of types
      const { data } = await supabase
        .from('content')
        .select('id, title, poster_path, tmdb_id, content_type')
        .neq('id', content.id)
        .order('view_count', { ascending: false })
        .limit(40);
      
      if (data && data.length > 0) {
        // Prioritize content with matching type, then shuffle
        const sameType = data.filter(item => item.content_type === currentContentType);
        const differentType = data.filter(item => item.content_type !== currentContentType);
        
        // Shuffle both arrays using Fisher-Yates
        const shuffledSame = [...sameType].sort(() => Math.random() - 0.5);
        const shuffledDifferent = [...differentType].sort(() => Math.random() - 0.5);
        
        // Combine: first some same type, then different types for variety
        const combined = [...shuffledSame.slice(0, 6), ...shuffledDifferent.slice(0, 6)];
        
        // Final shuffle to mix them
        const finalShuffled = combined.sort(() => Math.random() - 0.5);
        setForYouContent(finalShuffled.slice(0, 12));
      }
    };
    fetchForYou();
  }, [content?.id, content?.content_type]);

  // Fetch Recommended content (same type as current)
  useEffect(() => {
    const fetchRelated = async () => {
      if (!content?.id) return;
      
      const recommendationType = type === 'anime' ? 'anime' : contentType;
      
      const { data } = await supabase
        .from('content')
        .select('id, title, poster_path, tmdb_id, content_type')
        .eq('content_type', recommendationType)
        .neq('id', content.id)
        .order('popularity', { ascending: false })
        .limit(20);
      
      if (data && data.length > 0) {
        const shuffled = [...data].sort(() => Math.random() - 0.5);
        setRelatedContent(shuffled.slice(0, 12));
      }
    };
    fetchRelated();
  }, [content?.id, contentType, type]);

  // Fetch Shorts
  useEffect(() => {
    const fetchShorts = async () => {
      const { data } = await supabase
        .from('shorts')
        .select('*')
        .eq('status', 'active')
        .order('views', { ascending: false })
        .limit(8);
      if (data) setShorts(data);
    };
    fetchShorts();
  }, []);

  // Fetch cast
  useEffect(() => {
    const fetchCast = async () => {
      if (!content?.tmdb_id) {
        if (content && (content as any).cast_members) {
          const castString = (content as any).cast_members as string;
          const parsed = castString.split(',').map((item, index) => {
            const trimmed = item.trim();
            const match = trimmed.match(/^(.+?)\s*\((.+?)\)$/);
            if (match) {
              return { id: `cast-${index}`, actor_name: match[1].trim(), character_name: match[2].trim(), profile_url: null };
            }
            return { id: `cast-${index}`, actor_name: trimmed, character_name: null, profile_url: null };
          }).filter(c => c.actor_name);
          setCastMembers(parsed);
        }
        setCastLoading(false);
        return;
      }

      const tmdbId = content.tmdb_id;
      const mediaType = contentType === 'movie' ? 'movie' : 'tv';
      
      try {
        const { data: castCredits } = await supabase
          .from('cast_credits')
          .select(`
            id,
            character_name,
            cast_member_id,
            cast_members!cast_credits_cast_member_id_fkey (
              id,
              name,
              profile_path
            )
          `)
          .eq('tmdb_content_id', tmdbId)
          .limit(15);

        if (castCredits && castCredits.length > 0) {
          const formattedCast = castCredits.map((credit: any) => ({
            id: credit.id,
            actor_name: credit.cast_members?.name || 'Unknown',
            character_name: credit.character_name,
            profile_url: credit.cast_members?.profile_path?.startsWith('http') 
              ? credit.cast_members.profile_path 
              : credit.cast_members?.profile_path 
                ? `https://image.tmdb.org/t/p/w185${credit.cast_members.profile_path}`
                : null
          })).filter((c: any) => c.actor_name !== 'Unknown');
          
          if (formattedCast.length > 0) {
            setCastMembers(formattedCast);
            setCastLoading(false);
            return;
          }
        }

        const tmdbResponse = await fetch(
          `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/credits?api_key=5cfa727c2f549c594772a50e10e3f272`
        );
        
        if (tmdbResponse.ok) {
          const tmdbData = await tmdbResponse.json();
          if (tmdbData.cast && tmdbData.cast.length > 0) {
            const formattedCast = tmdbData.cast.slice(0, 15).map((member: any) => ({
              id: member.id.toString(),
              actor_name: member.name || member.original_name,
              character_name: member.character,
              profile_url: member.profile_path 
                ? `https://image.tmdb.org/t/p/w185${member.profile_path}`
                : null
            }));
            setCastMembers(formattedCast);
          }
        }
      } catch (err) {
        console.error('Error fetching cast:', err);
      }
      setCastLoading(false);
    };

    fetchCast();
  }, [content, contentType]);

  const fetchVideoSource = async (episodeId: string) => {
    // Mark this as a manual selection to prevent useEffect from overriding
    setManualEpisodeSelection(episodeId);
    
    // Clear current sources first for smooth transition
    setVideoSources([]);
    
    // Small delay for clean state reset
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const sources = allVideoSources.filter(s => s.episode_id === episodeId);
    const ep = episodes.find(e => e.id === episodeId);
    
    if (ep) {
      setCurrentEpisode(ep);
      // Set video sources but don't trigger autoplay - player handles this
      setVideoSources(sources);
    }
  };

  const desktopCastScrollRef = useSwipeScroll({ enabled: true });

  const getProgressPercentage = (episodeId: string) => {
    const history = watchHistory[episodeId];
    if (!history || !history.duration || history.duration === 0) return 0;
    return (history.progress / history.duration) * 100;
  };

  const isSeriesContent = type === 'series' || Boolean(season && episode);

  const videoPlayerAccessType = useMemo(() => {
    const effectiveAccessType = isSeriesContent 
      ? (currentEpisode?.access_type || episodes[0]?.access_type || content?.access_type)
      : content?.access_type;
    return effectiveAccessType === 'purchase' ? 'rent' : effectiveAccessType === 'membership' ? 'vip' : 'free';
  }, [isSeriesContent, currentEpisode?.access_type, episodes, content?.access_type]);

  const videoPlayerElement = useMemo(() => {
    const videoBackdrop = isSeriesContent && currentEpisode?.still_path 
      ? currentEpisode.still_path 
      : content?.backdrop_path;
    
    // Get skip timestamps - from episode for series, from content for movies
    const introStart = isSeriesContent 
      ? (currentEpisode as any)?.intro_start ?? 0 
      : (content as any)?.intro_start ?? 0;
    const introEnd = isSeriesContent 
      ? (currentEpisode as any)?.intro_end ?? undefined 
      : (content as any)?.intro_end ?? undefined;
    const outroStart = isSeriesContent 
      ? (currentEpisode as any)?.outro_start ?? undefined 
      : (content as any)?.outro_start ?? undefined;
    
    return (
      <NativeVideoPlayer 
        videoSources={videoSources}
        contentBackdrop={videoBackdrop}
        contentId={content?.id}
        accessType={videoPlayerAccessType as 'free' | 'rent' | 'vip'}
        excludeFromPlan={content?.exclude_from_plan}
        rentalPrice={isSeriesContent && currentEpisode?.price ? currentEpisode.price : content?.price}
        rentalPeriodDays={content?.purchase_period || 7}
        mediaId={content?.id}
        mediaType={contentType}
        title={content?.title}
        movieId={id}
        currentEpisodeId={currentEpisode?.id}
        episodes={isSeriesContent ? displayEpisodes : []}
        onEpisodeSelect={isSeriesContent ? fetchVideoSource : undefined}
        onFullscreenChange={setIsVideoFullscreen}
        introStartTime={introStart}
        introEndTime={introEnd}
        outroStartTime={outroStart}
      />
    );
  }, [videoSources, content, videoPlayerAccessType, isSeriesContent, currentEpisode, contentType, id, displayEpisodes]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-background text-foreground gap-4">
        <h2 className="text-2xl font-bold">Content Not Found</h2>
        <p className="text-muted-foreground">{error || 'The requested content could not be loaded.'}</p>
        <Button onClick={() => navigate('/')}>Go Home</Button>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen text-foreground pt-[env(safe-area-inset-top)] relative">
        {/* Background with poster/backdrop and theme-aware gradient - no solid background color */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <img 
            src={content?.poster_path || content?.backdrop_path || "/placeholder.svg"}
            alt=""
            className="w-full h-full object-cover"
          />
          {/* Theme-aware gradient overlay - from bottom to top */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent dark:from-background dark:via-background/85 dark:to-transparent" />
        </div>
        
        <SocialShareMeta title={content.title} description={content.overview || ''} image={content.backdrop_path || content.poster_path} type={contentType === 'movie' ? 'video.movie' : 'video.tv_show'} />
        <div className="flex flex-col relative z-10">
          {/* Ad Slot: Above Player - uses TOP_CENTER position */}
          {!isVideoFullscreen && (
            <NativeBannerAdSlot 
              placement="watch_top_banner" 
              position="top"
              pageLocation="watch"
            />
          )}
          
          {/* Video Player */}
          <div className={`bg-black sticky top-[env(safe-area-inset-top)] z-50 ${isVideoFullscreen ? 'fixed inset-0 z-[9999] !top-0 !pt-0' : ''}`}>
            {videoPlayerElement}
          </div>
              
          {/* Content Below Player */}
          {!isVideoFullscreen && (
            <div className="flex-1">
              <NativeBannerAdSlot placement="watch_banner" />
              
              {/* User Profile Section */}
              <div className="px-4 py-2">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10 border-2 border-primary flex-shrink-0 cursor-pointer" onClick={() => navigate('/dashboard')}>
                    <AvatarImage src={profileImageUrl || undefined} alt={userProfile?.username || user?.email || 'User'} />
                    <AvatarFallback className="bg-primary/10 text-primary text-base font-semibold">
                      {(userProfile?.username || user?.email || 'U').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <h1 className="text-sm font-bold truncate">{userProfile?.username || user?.email?.split('@')[0] || 'Guest'}</h1>
                    <WalletSection iconClassName="h-3 w-3" textClassName="text-xs" />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1 mt-2">
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1 border-primary/50 text-primary hover:bg-primary/10" onClick={() => setShowSubscriptionDialog(true)}>
                    <Crown className="h-3 w-3" />
                    {hasActiveSubscription ? (<span className="flex items-center gap-1">VIP<Badge variant="secondary" className="h-3.5 px-0.5 text-[9px] bg-yellow-500/20 text-yellow-600">{remainingDays}d</Badge></span>) : 'VIP'}
                  </Button>
                  <ActionButtons contentId={content?.id} contentType={contentType as 'movie' | 'series'} episodeId={currentEpisode?.id} userId={user?.id} contentTitle={content?.title} tmdbId={id} seasonNumber={season ? parseInt(season) : undefined} episodeNumber={episode ? parseInt(episode) : undefined} />
                </div>
              </div>

              {/* Cast Section */}
              <div className="px-4 py-2">
                {castLoading ? (
                  <CastSkeleton />
                ) : castMembers.length > 0 ? (
                  <div ref={desktopCastScrollRef} className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide scroll-smooth px-1">
                    {castMembers.slice(0, 10).map((member, idx) => (
                      <div key={idx} className="flex-shrink-0 cursor-pointer" onClick={() => setSelectedCastMember(member)}>
                        <div className="w-16 h-20 rounded-md overflow-hidden bg-muted ring-1 ring-border/30">
                          <img src={member.profile_url || "/placeholder.svg"} alt={member.actor_name} className="w-full h-full object-cover" />
                        </div>
                        <p className="text-[10px] w-16 text-center mt-1.5 truncate font-medium">{member.actor_name}</p>
                        {member.character_name && (
                          <p className="text-[9px] w-16 text-center text-muted-foreground truncate">{member.character_name}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Ad Slot: Between Cast & Tabs - uses BOTTOM_CENTER since AdMob can't render inline */}
              <div className="px-4 py-2">
                <NativeBannerAdSlot 
                  placement="watch_cast_tabs_banner" 
                  position="bottom"
                  pageLocation="watch"
                  className="rounded-lg"
                />
              </div>

              {/* Main Content with Tabs */}
              <div className="px-4 py-3 space-y-4">
                <CollapsibleTabsSection
                  key={`native-${content?.id || id}`}
                  isSeriesContent={isSeriesContent}
                  seasons={seasons}
                  selectedSeasonId={selectedSeasonId}
                  setSelectedSeasonId={setSelectedSeasonId}
                  episodes={episodes}
                  episodesLoading={episodesLoading}
                  content={content}
                  currentEpisode={currentEpisode}
                  fetchVideoSource={fetchVideoSource}
                  getProgressPercentage={getProgressPercentage}
                  forYouContent={forYouContent}
                  navigate={navigate}
                />

                {/* Recommended Section */}
                {relatedContent.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Recommended</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {relatedContent.slice(0, 6).map((item) => (
                        <div 
                          key={item.id} 
                          className="cursor-pointer transition-transform hover:scale-105" 
                          onClick={() => {
                            const contentIdentifier = item.tmdb_id || item.id;
                            if (item.content_type === 'anime') {
                              navigate(`/watch/anime/${contentIdentifier}/1/1`);
                            } else if (item.content_type === 'series') {
                              navigate(`/watch/series/${contentIdentifier}/1/1`);
                            } else {
                              navigate(`/watch/movie/${contentIdentifier}`);
                            }
                          }}
                        >
                          <div className="aspect-[2/3] rounded-md overflow-hidden">
                            <img 
                              src={item.poster_path || "/placeholder.svg"} 
                              alt={item.title} 
                              className="w-full h-full object-cover hover:opacity-80 transition-opacity" 
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Shorts Section */}
                {shorts.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Shorts</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {shorts.slice(0, 6).map((short) => (
                        <div 
                          key={short.id} 
                          className="aspect-[9/16] rounded-md overflow-hidden bg-muted cursor-pointer hover:opacity-80 transition-all hover:scale-105"
                          onClick={() => navigate(`/short?id=${short.id}`)}
                        >
                          <img 
                            src={short.thumbnail_url || "/placeholder.svg"} 
                            alt={short.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Subscription Banner */}
                <div className="bg-primary/10 border border-primary/20 rounded-md p-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-xs font-semibold">Premium Access</p>
                        <p className="text-[10px] text-muted-foreground">Unlimited content</p>
                      </div>
                    </div>
                    <Button size="sm" className="h-7 text-xs" onClick={() => setShowSubscriptionDialog(true)}>
                      {hasActiveSubscription ? 'Manage' : 'Subscribe'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <SubscriptionDialog open={showSubscriptionDialog} onOpenChange={setShowSubscriptionDialog} />
      
      {selectedCastMember && (
        <CastMemberDialog
          isOpen={!!selectedCastMember}
          onClose={() => setSelectedCastMember(null)}
          castMember={{
            actor_name: selectedCastMember.actor_name,
            character_name: selectedCastMember.character_name,
            profile_url: selectedCastMember.profile_url
          }}
        />
      )}
    </>
  );
};

export default NativeWatchPage;
