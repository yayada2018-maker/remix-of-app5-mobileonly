import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Search, Loader2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  uploadTmdbImagesToIdrive, 
  uploadCastProfileToIdrive 
} from "@/lib/tmdbImageUpload";

interface TMDBSearchResult {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  release_date: string;
  genre_ids: number[];
  vote_average: number;
}

const TMDB_API_KEY = "5cfa727c2f549c594772a50e10e3f272";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

const AdminMoviesAdd = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TMDBSearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<TMDBSearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [uploadToIdrive, setUploadToIdrive] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, currentFile: '' });
  const [formData, setFormData] = useState({
    title: "",
    poster_path: "",
    backdrop_path: "",
    genre: "",
    overview: "",
    release_date: "",
    tmdb_id: null as number | null,
    duration: null as number | null,
    vote_average: null as number | null,
    access_type: "free" as "free" | "membership" | "purchase",
    price: 0,
    currency: "USD",
    purchase_period: 1,
    max_devices: 3,
    exclude_from_plan: false,
  });

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced real-time search
  useEffect(() => {
    const searchTMDB = async () => {
      if (!searchQuery.trim() || searchQuery.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setIsSearching(true);
      try {
        const response = await fetch(
          `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(searchQuery)}&language=en-US&page=1`
        );
        const data = await response.json();
        setSuggestions(data.results?.slice(0, 8) || []);
        setShowSuggestions(true);
      } catch (error) {
        console.error("TMDB search error:", error);
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(searchTMDB, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(searchQuery)}&language=en-US&page=1`
      );
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (error) {
      console.error("TMDB search error:", error);
      toast.error("Failed to search TMDB");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectMovie = async (result: TMDBSearchResult) => {
    // Check for duplicates first
    const { data: existingContent } = await supabase
      .from("content")
      .select("id, title")
      .eq("tmdb_id", result.id)
      .eq("content_type", "movie")
      .maybeSingle();

    if (existingContent) {
      toast.error(`"${result.title}" (TMDB ID: ${result.id}) already exists in your database!`, {
        duration: 5000,
      });
      return;
    }

    // Fetch detailed info
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/movie/${result.id}?api_key=${TMDB_API_KEY}&language=en-US`
      );
      const details = await response.json();
      
      let finalPosterPath = result.poster_path ? `${TMDB_IMAGE_BASE}${result.poster_path}` : "";
      let finalBackdropPath = result.backdrop_path ? `https://image.tmdb.org/t/p/original${result.backdrop_path}` : "";
      
      // Upload images to iDrive E2 if enabled
      if (uploadToIdrive) {
        setIsUploading(true);
        setUploadProgress({ current: 0, total: 2, currentFile: 'Starting upload...' });
        try {
          const { posterUrl, backdropUrl } = await uploadTmdbImagesToIdrive(
            result.id,
            result.poster_path,
            result.backdrop_path,
            'movie',
            (progress) => setUploadProgress(progress)
          );
          
          // Use iDrive URLs if upload succeeded
          if (posterUrl) {
            finalPosterPath = posterUrl;
            console.log("Poster uploaded to iDrive:", posterUrl);
          } else if (result.poster_path) {
            console.warn("Poster upload failed, using TMDB URL as fallback");
          }
          if (backdropUrl) {
            finalBackdropPath = backdropUrl;
            console.log("Backdrop uploaded to iDrive:", backdropUrl);
          } else if (result.backdrop_path) {
            console.warn("Backdrop upload failed, using TMDB URL as fallback");
          }
          
          // Show warning if any upload failed
          if ((!posterUrl && result.poster_path) || (!backdropUrl && result.backdrop_path)) {
            toast.warning("Some images couldn't be uploaded to iDrive E2. Using TMDB URLs as fallback.");
          }
        } catch (uploadError) {
          console.error("iDrive upload error:", uploadError);
          toast.warning("Failed to upload images to iDrive E2. Using TMDB URLs as fallback.");
        } finally {
          setIsUploading(false);
        }
      }
      
      setFormData({
        ...formData,
        title: result.title,
        poster_path: finalPosterPath,
        backdrop_path: finalBackdropPath,
        overview: result.overview,
        release_date: result.release_date,
        tmdb_id: result.id,
        duration: details.runtime || null,
        vote_average: result.vote_average || null,
        genre: details.genres?.map((g: any) => g.name).join(", ") || "",
      });
      
      const successMsg = uploadToIdrive 
        ? "Movie info loaded with images saved to iDrive E2" 
        : "Movie info loaded from TMDB";
      toast.success(successMsg);
      setSearchResults([]);
      setSuggestions([]);
      setShowSuggestions(false);
      setSearchQuery("");
    } catch (error) {
      console.error("Failed to fetch TMDB details:", error);
      toast.error("Failed to load movie details");
    }
  };

  const createMovieMutation = useMutation({
    mutationFn: async () => {
      const { data: content, error } = await supabase
        .from("content")
        .insert({
          title: formData.title,
          poster_path: formData.poster_path,
          backdrop_path: formData.backdrop_path,
          genre: formData.genre,
          overview: formData.overview,
          release_date: formData.release_date,
          tmdb_id: formData.tmdb_id,
          content_type: "movie",
          access_type: formData.access_type,
          price: formData.price,
          currency: formData.currency,
          purchase_period: formData.purchase_period,
          max_devices: formData.max_devices,
          exclude_from_plan: formData.exclude_from_plan,
        })
        .select()
        .single();

      if (error) throw error;

      // Now fetch and import cast & trailers
      if (formData.tmdb_id && content) {
        try {
          // Fetch cast data
          const creditsResponse = await fetch(
            `https://api.themoviedb.org/3/movie/${formData.tmdb_id}/credits?api_key=${TMDB_API_KEY}`
          );
          const creditsData = await creditsResponse.json();

          // Fetch trailer data
          const videosResponse = await fetch(
            `https://api.themoviedb.org/3/movie/${formData.tmdb_id}/videos?api_key=${TMDB_API_KEY}`
          );
          const videosData = await videosResponse.json();

          // Import cast members (top 15)
          if (creditsData.cast && creditsData.cast.length > 0) {
            for (const castMember of creditsData.cast.slice(0, 15)) {
              try {
                const { data: existingCast } = await supabase
                  .from('cast_members')
                  .select('id')
                  .eq('tmdb_id', castMember.id)
                  .maybeSingle();

                let castMemberId = existingCast?.id;

                if (!existingCast) {
                  // Upload cast profile image to iDrive if enabled
                  let finalProfilePath = castMember.profile_path
                    ? `https://image.tmdb.org/t/p/original${castMember.profile_path}`
                    : null;
                    
                  if (uploadToIdrive && castMember.profile_path) {
                    const castProfileUrl = await uploadCastProfileToIdrive(
                      castMember.id,
                      castMember.profile_path
                    );
                    if (castProfileUrl) {
                      finalProfilePath = castProfileUrl;
                    }
                  }
                    
                  const { data: newCast } = await supabase
                    .from('cast_members')
                    .insert({
                      tmdb_id: castMember.id,
                      name: castMember.name,
                      profile_path: finalProfilePath,
                      known_for_department: castMember.known_for_department,
                      popularity: castMember.popularity,
                      gender: castMember.gender,
                    })
                    .select()
                    .single();

                  castMemberId = newCast?.id;
                }

                if (castMemberId) {
                  await supabase.from('cast_credits').insert({
                    cast_member_id: castMemberId,
                    tmdb_content_id: formData.tmdb_id,
                    title: formData.title,
                    character_name: castMember.character,
                    media_type: 'movie',
                    release_date: formData.release_date,
                    poster_path: formData.poster_path,
                  });
                }
              } catch (castError) {
                console.error('Error processing cast member:', castError);
              }
            }
          }

          // Import trailer
          if (videosData.results && videosData.results.length > 0) {
            const trailer = videosData.results.find((v: any) =>
              v.type === 'Trailer' && v.site === 'YouTube'
            ) || videosData.results[0];

            if (trailer && trailer.site === 'YouTube') {
              await supabase.from('trailers').delete().eq('content_id', content.id);
              await supabase.from('trailers').insert({
                content_id: content.id,
                youtube_id: trailer.key,
              });
            }
          }
        } catch (importError) {
          console.error('Error importing additional data:', importError);
          toast.error('Movie created but some data could not be imported');
        }
      }

      return content;
    },
    onSuccess: (data) => {
      toast.success("Movie created with images saved to iDrive E2!");
      queryClient.invalidateQueries({ queryKey: ["movies"] });
      queryClient.invalidateQueries({ queryKey: ["admin-casters"] });
      navigate(`/admin/movies/${data.id}/edit`);
    },
    onError: (error: Error) => {
      toast.error("Failed to create movie: " + error.message);
    },
  });

  const handleSubmit = () => {
    if (!formData.title) {
      toast.error("Please enter a movie title");
      return;
    }
    createMovieMutation.mutate();
  };

  return (
    <AdminLayout>
      <div className="space-y-6" onContextMenu={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin/movies")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Add New Movie</h1>
            <p className="text-muted-foreground">Search TMDB and create a new movie</p>
          </div>
        </div>

        {/* TMDB Search */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Search TMDB</CardTitle>
            <div className="flex items-center gap-2">
              <Checkbox 
                id="uploadToIdrive" 
                checked={uploadToIdrive}
                onCheckedChange={(checked) => setUploadToIdrive(checked === true)}
              />
              <Label htmlFor="uploadToIdrive" className="text-sm font-normal cursor-pointer">
                Save images to iDrive E2
              </Label>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Upload Progress Indicator */}
            {isUploading && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm font-medium">Uploading to iDrive E2...</span>
                </div>
                <Progress 
                  value={uploadProgress.total > 0 ? (uploadProgress.current / uploadProgress.total) * 100 : 0} 
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground">
                  {uploadProgress.currentFile} ({uploadProgress.current}/{uploadProgress.total})
                </p>
              </div>
            )}
            <div className="flex gap-2 relative" ref={searchRef}>
              <div className="flex-1 relative">
                <Input
                  placeholder="Search movies by title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSearch();
                      setShowSuggestions(false);
                    }
                  }}
                  className="pr-4"
                />
                {/* Suggestions dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border rounded-md shadow-lg max-h-80 overflow-y-auto">
                    {suggestions.map((result) => (
                      <div
                        key={result.id}
                        className="flex items-center gap-3 p-3 hover:bg-accent cursor-pointer border-b last:border-b-0"
                        onClick={() => handleSelectMovie(result)}
                      >
                        {result.poster_path ? (
                          <img
                            src={`${TMDB_IMAGE_BASE}${result.poster_path}`}
                            alt={result.title}
                            className="w-10 h-14 object-cover rounded"
                          />
                        ) : (
                          <div className="w-10 h-14 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
                            No img
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{result.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {result.release_date ? new Date(result.release_date).getFullYear() : "N/A"} • Rating: {result.vote_average?.toFixed(1) || "N/A"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Button onClick={handleSearch} disabled={isSearching} className="bg-[hsl(187,85%,43%)] hover:bg-[hsl(187,85%,38%)]">
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-4">
                {searchResults.map((result) => (
                  <div
                    key={result.id}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => handleSelectMovie(result)}
                  >
                    {result.poster_path ? (
                      <img
                        src={`${TMDB_IMAGE_BASE}${result.poster_path}`}
                        alt={result.title}
                        className="w-full aspect-[2/3] object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-full aspect-[2/3] bg-muted rounded-lg flex items-center justify-center">
                        No Image
                      </div>
                    )}
                    <p className="text-sm mt-1 font-medium truncate">{result.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {result.release_date ? new Date(result.release_date).getFullYear() : "N/A"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Movie Information Form */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Movie Information</CardTitle>
            <Button 
              onClick={handleSubmit} 
              disabled={createMovieMutation.isPending}
              className="bg-[hsl(187,85%,43%)] hover:bg-[hsl(187,85%,38%)]"
            >
              <Save className="h-4 w-4 mr-2" />
              Create Movie
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="Movie title..."
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="poster_path">Poster URL</Label>
                <Input
                  id="poster_path"
                  placeholder="https://image.tmdb.org/t/p/w500/..."
                  value={formData.poster_path}
                  onChange={(e) => setFormData({ ...formData, poster_path: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="backdrop_path">Backdrop URL</Label>
                <Input
                  id="backdrop_path"
                  placeholder="https://image.tmdb.org/t/p/original/..."
                  value={formData.backdrop_path}
                  onChange={(e) => setFormData({ ...formData, backdrop_path: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="genre">Genre</Label>
                <Input
                  id="genre"
                  placeholder="Action, Drama, etc."
                  value={formData.genre}
                  onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="release_date">Release Date</Label>
                <Input
                  id="release_date"
                  type="date"
                  value={formData.release_date}
                  onChange={(e) => setFormData({ ...formData, release_date: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  placeholder="120"
                  value={formData.duration || ""}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value ? parseInt(e.target.value) : null })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vote_average">Rating</Label>
                <Input
                  id="vote_average"
                  type="number"
                  step="0.1"
                  placeholder="7.5"
                  value={formData.vote_average || ""}
                  onChange={(e) => setFormData({ ...formData, vote_average: e.target.value ? parseFloat(e.target.value) : null })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="overview">Overview</Label>
              <Textarea
                id="overview"
                placeholder="Movie description..."
                value={formData.overview}
                onChange={(e) => setFormData({ ...formData, overview: e.target.value })}
                className="min-h-[100px]"
              />
            </div>

            {/* Access Type Section */}
            <div className="border-t pt-4 mt-4">
              <h3 className="font-semibold mb-4">Access Settings</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Access Type</Label>
                  <Select
                    value={formData.access_type}
                    onValueChange={(value: "free" | "membership" | "purchase") => 
                      setFormData({ ...formData, access_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="membership">Membership</SelectItem>
                      <SelectItem value="purchase">Purchase</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.access_type === "purchase" && (
                  <>
                    <div className="space-y-2">
                      <Label>Price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Currency</Label>
                      <Select
                        value={formData.currency}
                        onValueChange={(value) => setFormData({ ...formData, currency: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="KHR">KHR</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Purchase Period (days)</Label>
                      <Input
                        type="number"
                        value={formData.purchase_period}
                        onChange={(e) => setFormData({ ...formData, purchase_period: parseInt(e.target.value) || 1 })}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 mt-4">
                <Checkbox
                  id="exclude_from_plan"
                  checked={formData.exclude_from_plan}
                  onCheckedChange={(checked) => setFormData({ ...formData, exclude_from_plan: checked === true })}
                />
                <Label htmlFor="exclude_from_plan" className="text-sm font-normal cursor-pointer">
                  Exclude from subscription plans
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminMoviesAdd;
