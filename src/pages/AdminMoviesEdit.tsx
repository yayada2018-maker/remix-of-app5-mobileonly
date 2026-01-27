import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, X, Plus, Trash2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContentInfoBoxes } from "@/components/admin/ContentInfoBoxes";
import { SkipTimestampFields } from "@/components/admin/SkipTimestampFields";

interface VideoSource {
  id?: string;
  media_id?: string;
  source_type: 'mp4' | 'hls' | 'iframe';
  url: string;
  quality?: string | null;
  language?: string | null;
  version?: string | null;
  permission?: 'web_and_mobile' | 'web_only' | 'mobile_only';
  quality_urls?: {
    "480p"?: string;
    "720p"?: string;
    "1080p"?: string;
  };
  default_quality?: '480p' | '720p' | '1080p';
  is_default?: boolean | null;
  server_name?: string | null;
}

const AdminMoviesEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNewMovie = id === 'new';
  
  const [editedMovie, setEditedMovie] = useState<any>({
    title: '',
    overview: '',
    poster_path: '',
    backdrop_path: '',
    genre: '',
    cast_members: '',
    release_year: '',
    access_type: 'free',
    price: 0,
    currency: 'USD',
    purchase_period: 1,
    max_devices: 3,
    exclude_from_plan: false,
    collection_id: null,
    last_content_update: null,
    intro_start: 0,
    intro_end: null,
    outro_start: null,
  });
  
  const [videoSources, setVideoSources] = useState<VideoSource[]>([]);
  const [trailerUrl, setTrailerUrl] = useState("");

  const { data: movie, isLoading } = useQuery({
    queryKey: ["movie", id],
    queryFn: async () => {
      if (isNewMovie) return null;
      
      const { data, error } = await supabase
        .from("content")
        .select("*")
        .eq("id", id)
        .eq('content_type', 'movie')
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !isNewMovie,
  });

  const { data: sources = [] } = useQuery({
    queryKey: ["movie-sources", id],
    queryFn: async () => {
      if (isNewMovie) return [];
      
      const { data, error } = await supabase
        .from("video_sources")
        .select("*")
        .eq("media_id", id);

      if (error) throw error;
      return data || [];
    },
    enabled: !isNewMovie,
  });

  const { data: trailer } = useQuery({
    queryKey: ["movie-trailer", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trailers")
        .select("*")
        .eq("content_id", id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !isNewMovie,
  });

  useEffect(() => {
    if (movie) {
      setEditedMovie({
        title: movie.title || '',
        overview: movie.overview || '',
        poster_path: movie.poster_path || '',
        backdrop_path: movie.backdrop_path || '',
        genre: movie.genre || '',
        cast_members: movie.cast_members || '',
        release_year: movie.release_year || '',
        access_type: movie.access_type || 'free',
        price: movie.price || 0,
        currency: movie.currency || 'USD',
        purchase_period: movie.purchase_period || 1,
        max_devices: movie.max_devices || 3,
        exclude_from_plan: movie.exclude_from_plan || false,
        collection_id: movie.collection_id || null,
        last_content_update: (movie as any).last_content_update ? new Date((movie as any).last_content_update) : null,
        intro_start: (movie as any).intro_start ?? 0,
        intro_end: (movie as any).intro_end ?? null,
        outro_start: (movie as any).outro_start ?? null,
      });
    }
  }, [movie]);

  useEffect(() => {
    if (sources.length > 0) {
      const mappedSources: VideoSource[] = sources.map((source) => ({
        id: source.id,
        media_id: source.media_id,
        source_type: source.source_type,
        url: source.url || '',
        quality: source.quality,
        language: source.language,
        version: source.version,
        permission: (source.permission || 'web_and_mobile') as 'web_and_mobile' | 'web_only' | 'mobile_only',
        quality_urls: (source.quality_urls || {}) as { "480p"?: string; "720p"?: string; "1080p"?: string },
        default_quality: source.quality as '480p' | '720p' | '1080p' | undefined,
        is_default: source.is_default,
        server_name: source.server_name,
      }));
      setVideoSources(mappedSources);
    }
  }, [sources]);

  useEffect(() => {
    if (trailer) {
      if (trailer.youtube_id) {
        setTrailerUrl(`https://www.youtube.com/watch?v=${trailer.youtube_id}`);
      } else if (trailer.self_hosted_url) {
        setTrailerUrl(trailer.self_hosted_url);
      }
    }
  }, [trailer]);

  const saveMovieMutation = useMutation({
    mutationFn: async () => {
      let movieId = id;
      let movieData;
      
      // Prepare data with proper date formatting
      const dataToSave = {
        ...editedMovie,
        last_content_update: editedMovie.last_content_update 
          ? editedMovie.last_content_update.toISOString() 
          : null,
      };
      
      if (isNewMovie) {
        const { data, error } = await supabase
          .from("content")
          .insert({
            ...dataToSave,
            content_type: 'movie',
          })
          .select()
          .single();

        if (error) throw error;
        movieId = data.id;
        movieData = data;
      } else {
        const { error } = await supabase
          .from("content")
          .update(dataToSave)
          .eq("id", id);

        if (error) throw error;
        movieData = movie;
      }

      // Handle trailer update if trailerUrl is provided
      if (trailerUrl && movieId) {
        const youtubeMatch = trailerUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
        const youtubeId = youtubeMatch ? youtubeMatch[1] : null;

        if (trailer) {
          // Update existing trailer
          await supabase
            .from("trailers")
            .update({
              youtube_id: youtubeId,
              self_hosted_url: youtubeId ? null : trailerUrl,
            })
            .eq("id", trailer.id);
        } else {
          // Create new trailer
          await supabase
            .from("trailers")
            .insert({
              content_id: movieId,
              youtube_id: youtubeId,
              self_hosted_url: youtubeId ? null : trailerUrl,
            });
        }
      }

      return movieData;
    },
    onSuccess: (data) => {
      toast.success(isNewMovie ? "Movie created successfully!" : "Movie updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["movie", id] });
      queryClient.invalidateQueries({ queryKey: ["movie-trailer", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-movies"] });
      setTrailerUrl("");
      if (isNewMovie && data) {
        navigate(`/admin/movies/${data.id}/edit`);
      }
    },
    onError: (error: Error) => {
      toast.error("Failed to save movie: " + error.message);
    },
  });

  const saveVideoSourcesMutation = useMutation({
    mutationFn: async (sources: VideoSource[]) => {
      const movieId = isNewMovie ? null : id;
      if (!movieId) {
        throw new Error("Please save the movie first before adding video sources");
      }

      // Delete existing sources
      await supabase.from("video_sources").delete().eq("media_id", movieId);

      // Insert new sources
      if (sources.length > 0) {
        const { error } = await supabase
          .from("video_sources")
          .insert(sources.map(s => {
            // For MP4 sources with quality_urls, use the first available quality URL as main URL if url is empty
            let mainUrl = s.url;
            if (!mainUrl && s.source_type === "mp4" && s.quality_urls) {
              const qualityUrls = s.quality_urls as Record<string, string>;
              const firstQualityUrl = Object.values(qualityUrls).find(url => url && url.trim() !== '');
              mainUrl = firstQualityUrl || '';
            }
            
            return {
              media_id: movieId,
              source_type: s.source_type,
              url: mainUrl || '',
              quality: s.source_type === "mp4" ? s.default_quality : s.quality,
              language: s.language,
              version: s.version,
              permission: s.permission,
              quality_urls: s.source_type === "mp4" ? s.quality_urls : {},
              is_default: s.is_default,
              server_name: s.server_name,
            };
          }));

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Video sources saved successfully!");
      queryClient.invalidateQueries({ queryKey: ["movie-sources", id] });
    },
    onError: (error: Error) => {
      toast.error("Failed to save video sources: " + error.message);
    },
  });

  const handleAddVideoSource = () => {
    setVideoSources([
      ...videoSources,
      {
        server_name: `Server ${videoSources.length + 1}`,
        version: "free",
        permission: "web_and_mobile",
        source_type: "iframe",
        url: "",
        is_default: videoSources.length === 0,
      },
    ]);
  };

  const handleRemoveVideoSource = (index: number) => {
    setVideoSources(videoSources.filter((_, i) => i !== index));
  };

  const handleVideoSourceChange = (index: number, field: keyof VideoSource, value: any) => {
    const updated = [...videoSources];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === "source_type" && value === "mp4" && !updated[index].quality_urls) {
      updated[index].quality_urls = { "480p": "", "720p": "", "1080p": "" };
      updated[index].default_quality = "720p";
    }
    
    setVideoSources(updated);
  };

  const handleMp4QualityChange = (index: number, quality: "480p" | "720p" | "1080p", url: string) => {
    const updated = [...videoSources];
    if (!updated[index].quality_urls) {
      updated[index].quality_urls = {};
    }
    updated[index].quality_urls![quality] = url;
    setVideoSources(updated);
  };

  const handleDefaultChange = (index: number) => {
    const updated = videoSources.map((source, i) => ({
      ...source,
      is_default: i === index,
    }));
    setVideoSources(updated);
  };

  const handleSave = () => {
    saveMovieMutation.mutate();
  };

  const handleSaveVideoSources = () => {
    if (isNewMovie) {
      toast.error("Please save the movie first before adding video sources");
      return;
    }
    saveVideoSourcesMutation.mutate(videoSources);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin/movies")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {isNewMovie ? 'Add New Movie' : editedMovie.title || 'Edit Movie'}
              </h1>
              <p className="text-muted-foreground">
                {isNewMovie ? 'Create a new movie' : 'Edit movie information'}
              </p>
            </div>
          </div>
          <Button 
            onClick={handleSave}
            disabled={saveMovieMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {saveMovieMutation.isPending ? "Saving..." : "Save Movie"}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Movie Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={editedMovie.title}
                  onChange={(e) => setEditedMovie({ ...editedMovie, title: e.target.value })}
                  placeholder="Movie title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="release_year">Release Year</Label>
                <Input
                  id="release_year"
                  value={editedMovie.release_year}
                  onChange={(e) => setEditedMovie({ ...editedMovie, release_year: e.target.value })}
                  placeholder="2024"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="overview">Overview</Label>
              <Textarea
                id="overview"
                value={editedMovie.overview}
                onChange={(e) => setEditedMovie({ ...editedMovie, overview: e.target.value })}
                placeholder="Movie description..."
                rows={4}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="poster_path">Poster URL</Label>
                <Input
                  id="poster_path"
                  value={editedMovie.poster_path}
                  onChange={(e) => setEditedMovie({ ...editedMovie, poster_path: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="backdrop_path">Backdrop URL</Label>
                <Input
                  id="backdrop_path"
                  value={editedMovie.backdrop_path}
                  onChange={(e) => setEditedMovie({ ...editedMovie, backdrop_path: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="genre">Genre</Label>
                <Input
                  id="genre"
                  value={editedMovie.genre}
                  onChange={(e) => setEditedMovie({ ...editedMovie, genre: e.target.value })}
                  placeholder="Action, Drama, Comedy"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cast_members">Cast Members</Label>
                <Textarea
                  id="cast_members"
                  value={editedMovie.cast_members || ''}
                  onChange={(e) => setEditedMovie({ ...editedMovie, cast_members: e.target.value })}
                  placeholder="Cast member names, comma separated"
                  rows={2}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="access_type">Access Type</Label>
              <Select
                value={editedMovie.access_type}
                onValueChange={(value) => setEditedMovie({ ...editedMovie, access_type: value })}
              >
                <SelectTrigger id="access_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="membership">Membership</SelectItem>
                  <SelectItem value="purchase">Purchase</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editedMovie.access_type === "purchase" && (
              <div className="grid gap-4 md:grid-cols-4 p-4 border rounded-lg bg-muted/50">
                <div className="space-y-2">
                  <Label htmlFor="price">Price</Label>
                  <Input
                    id="price"
                    type="number"
                    value={editedMovie.price}
                    onChange={(e) => setEditedMovie({ ...editedMovie, price: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Input
                    id="currency"
                    value={editedMovie.currency}
                    onChange={(e) => setEditedMovie({ ...editedMovie, currency: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="purchase_period">Period (days)</Label>
                  <Input
                    id="purchase_period"
                    type="number"
                    value={editedMovie.purchase_period}
                    onChange={(e) => setEditedMovie({ ...editedMovie, purchase_period: parseInt(e.target.value) || 1 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_devices">Max Devices</Label>
                  <Input
                    id="max_devices"
                    type="number"
                    value={editedMovie.max_devices}
                    onChange={(e) => setEditedMovie({ ...editedMovie, max_devices: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="trailer_url">Trailer URL</Label>
              <Input
                id="trailer_url"
                placeholder="https://www.youtube.com/watch?v=... or self-hosted URL"
                value={trailerUrl}
                onChange={(e) => setTrailerUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter a YouTube URL or self-hosted video URL
              </p>
            </div>

            {/* Skip Intro/Outro Timestamps */}
            <SkipTimestampFields
              introStart={editedMovie.intro_start}
              introEnd={editedMovie.intro_end}
              outroStart={editedMovie.outro_start}
              onIntroStartChange={(value) => setEditedMovie({ ...editedMovie, intro_start: value })}
              onIntroEndChange={(value) => setEditedMovie({ ...editedMovie, intro_end: value })}
              onOutroStartChange={(value) => setEditedMovie({ ...editedMovie, outro_start: value })}
            />

            {/* Content Info Boxes */}
            <ContentInfoBoxes
              contentType="movie"
              collectionId={editedMovie.collection_id}
              onCollectionChange={(value) => setEditedMovie({ ...editedMovie, collection_id: value })}
              lastContentUpdate={editedMovie.last_content_update}
              onLastContentUpdateChange={(value) => setEditedMovie({ ...editedMovie, last_content_update: value })}
            />
          </CardContent>
        </Card>

        {!isNewMovie && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Video Sources</CardTitle>
              <div className="flex gap-2">
                <Button 
                  onClick={handleAddVideoSource} 
                  size="sm"
                  className="bg-black text-white hover:bg-gray-800"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Source
                </Button>
                <Button 
                  onClick={handleSaveVideoSources}
                  size="sm"
                  disabled={saveVideoSourcesMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saveVideoSourcesMutation.isPending ? "Saving..." : "Save Sources"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {/* Table Header */}
                <div className="grid grid-cols-[1.2fr,1fr,1.2fr,1fr,2fr,1fr,0.8fr,0.5fr] gap-2 p-3 bg-[hsl(142,76%,36%)] text-white rounded-lg font-medium text-sm">
                  <div>Server Name</div>
                  <div>Version</div>
                  <div>Permission</div>
                  <div>URL Type</div>
                  <div>URL</div>
                  <div>Quality</div>
                  <div>Default</div>
                  <div>Action</div>
                </div>

                {/* Table Rows or Empty State */}
                {videoSources.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground border rounded-lg">
                    No video sources added yet. Click "Add Source" to add one.
                  </div>
                ) : (
                  videoSources.map((source, index) => (
                    <div key={index} className="space-y-2">
                      <div className="grid grid-cols-[1.2fr,1fr,1.2fr,1fr,2fr,1fr,0.8fr,0.5fr] gap-2 p-3 border rounded-lg items-center">
                        {/* Server Name */}
                        <Input
                          value={source.server_name || ''}
                          onChange={(e) => handleVideoSourceChange(index, "server_name", e.target.value)}
                          placeholder="Server 1"
                          className="h-9"
                        />

                        {/* Version */}
                        <Select
                          value={source.version || 'free'}
                          onValueChange={(value) => handleVideoSourceChange(index, "version", value)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free">Free</SelectItem>
                            <SelectItem value="membership">Membership</SelectItem>
                            <SelectItem value="purchase">Purchase</SelectItem>
                          </SelectContent>
                        </Select>

                        {/* Permission */}
                        <Select
                          value={source.permission || 'web_and_mobile'}
                          onValueChange={(value) => handleVideoSourceChange(index, "permission", value)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="web_and_mobile">Web & Mobile</SelectItem>
                            <SelectItem value="web_only">Web only</SelectItem>
                            <SelectItem value="mobile_only">Mobile only</SelectItem>
                          </SelectContent>
                        </Select>

                        {/* URL Type */}
                        <Select
                          value={source.source_type}
                          onValueChange={(value) => handleVideoSourceChange(index, "source_type", value)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="iframe">Embed</SelectItem>
                            <SelectItem value="mp4">MP4</SelectItem>
                            <SelectItem value="hls">HLS</SelectItem>
                          </SelectContent>
                        </Select>

                        {/* Main URL */}
                        {source.source_type !== "mp4" ? (
                          <Input
                            value={source.url}
                            onChange={(e) => handleVideoSourceChange(index, "url", e.target.value)}
                            placeholder="https://player.example.com"
                            className="h-9"
                          />
                        ) : (
                          <div className="text-sm text-muted-foreground">See below</div>
                        )}

                        {/* Quality Selector */}
                        <Select
                          value={source.source_type === "mp4" ? (source.default_quality || "720p") : (source.quality || "auto")}
                          onValueChange={(value) => {
                            if (source.source_type === "mp4") {
                              handleVideoSourceChange(index, "default_quality", value);
                            } else {
                              handleVideoSourceChange(index, "quality", value);
                            }
                          }}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">Auto</SelectItem>
                            <SelectItem value="480p">480p</SelectItem>
                            <SelectItem value="720p">720p</SelectItem>
                            <SelectItem value="1080p">1080p</SelectItem>
                            <SelectItem value="4k">4K</SelectItem>
                          </SelectContent>
                        </Select>

                        {/* Default Checkbox */}
                        <div className="flex justify-center">
                          <input
                            type="checkbox"
                            checked={source.is_default || false}
                            onChange={() => handleDefaultChange(index)}
                            className="w-5 h-5 accent-blue-500 cursor-pointer"
                          />
                        </div>

                        {/* Delete Button */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveVideoSource(index)}
                          className="h-9 w-9"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>

                      {/* Additional Quality URLs for MP4 */}
                      {source.source_type === "mp4" && (
                        <div className="ml-4 p-4 border-l-4 border-blue-200 bg-muted/30 rounded space-y-3">
                          <div className="text-sm font-medium text-muted-foreground mb-2">
                            Additional Quality URLs:
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <Label className="w-16 text-sm">480p:</Label>
                              <Input
                                value={source.quality_urls?.["480p"] || ""}
                                onChange={(e) => handleMp4QualityChange(index, "480p", e.target.value)}
                                placeholder="https://example.com/video/480p.mp4"
                                className="flex-1"
                              />
                            </div>
                            <div className="flex items-center gap-3">
                              <Label className="w-16 text-sm">720p:</Label>
                              <Input
                                value={source.quality_urls?.["720p"] || ""}
                                onChange={(e) => handleMp4QualityChange(index, "720p", e.target.value)}
                                placeholder="https://example.com/video/720p.mp4"
                                className="flex-1"
                              />
                            </div>
                            <div className="flex items-center gap-3">
                              <Label className="w-16 text-sm">1080p:</Label>
                              <Input
                                value={source.quality_urls?.["1080p"] || ""}
                                onChange={(e) => handleMp4QualityChange(index, "1080p", e.target.value)}
                                placeholder="https://example.com/video/1080p.mp4"
                                className="flex-1"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminMoviesEdit;
