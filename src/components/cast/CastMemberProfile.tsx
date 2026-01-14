import React from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { User, Heart, Share2, Loader2 } from "lucide-react";
import { getImageUrl } from "./utils";
import { useSiteSettingsOptional } from "@/contexts/SiteSettingsContext";
import { useTheme } from "@/contexts/ThemeContext";

interface CastMember {
  id: string;
  actor_name: string;
  character_name?: string;
  profile_url?: string;
}

interface CastMemberProfileProps {
  castMember: CastMember;
  isFollowing: boolean;
  isMobile: boolean;
  onFollow: () => void;
  onShare: () => void;
  isFollowLoading?: boolean;
}

const CastMemberProfile = ({
  castMember,
  isFollowing,
  isMobile,
  onFollow,
  onShare,
  isFollowLoading = false
}: CastMemberProfileProps) => {
  const siteSettings = useSiteSettingsOptional();
  const { effectiveTheme } = useTheme();
  
  // Get theme colors from site settings
  const themeColors = effectiveTheme === 'dark' 
    ? siteSettings?.settings?.dark_mode 
    : siteSettings?.settings?.light_mode;
  
  const buttonColor = themeColors?.button_color || (effectiveTheme === 'dark' ? '#D50055' : '#D50055');
  const buttonTextColor = themeColors?.button_text_color || '#FFFFFF';
  const textColor = themeColors?.text_color || (effectiveTheme === 'dark' ? '#FFFFFF' : '#0F172A');
  const linkColor = themeColors?.link_color || (effectiveTheme === 'dark' ? '#00ABD6' : '#0078D4');

  return (
    <div className="bg-transparent">
      <div className={`flex ${isMobile ? 'flex-col items-center gap-4' : 'items-start gap-6'}`}>
        {/* Profile Image */}
        <div className={`
          ${isMobile ? 'w-28 h-36' : 'w-36 h-44'} 
          rounded-xl overflow-hidden bg-gradient-to-br from-muted to-muted/80 
          shadow-xl flex-shrink-0 border-2 border-border/50 relative group
        `}>
          {getImageUrl(castMember.profile_url) ? (
            <img 
              src={getImageUrl(castMember.profile_url)!} 
              alt={castMember.actor_name} 
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" 
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/80">
              <Avatar className={`${isMobile ? 'h-14 w-14' : 'h-18 w-18'}`}>
                <AvatarFallback className="bg-muted-foreground/20 text-foreground">
                  <User size={isMobile ? 18 : 22} />
                </AvatarFallback>
              </Avatar>
            </div>
          )}
        </div>
        
        {/* Info Section */}
        <div className={`flex-1 ${isMobile ? 'text-center w-full' : ''}`}>
          <div className="bg-transparent">
            <h1 
              className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold mb-2`}
              style={{ color: textColor }}
            >
              {castMember.actor_name}
            </h1>
            {castMember.character_name && (
              <p 
                className={`${isMobile ? 'text-lg' : 'text-xl'} mb-3 font-medium`}
                style={{ color: linkColor }}
              >
                as {castMember.character_name}
              </p>
            )}
            
            {/* Action Buttons */}
            <div className={`flex gap-3 mt-4 ${isMobile ? 'justify-center' : ''}`}>
              <Button
                variant={isFollowing ? "secondary" : "default"}
                size="sm"
                onClick={onFollow}
                disabled={isFollowLoading}
                className="gap-2"
                style={!isFollowing ? { backgroundColor: buttonColor, color: buttonTextColor } : {}}
              >
                {isFollowLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Heart size={16} className={isFollowing ? "fill-current" : ""} />
                )}
                {isFollowing ? "Following" : "Follow"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onShare}
                className="gap-2 border-border"
              >
                <Share2 size={16} />
                Share
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CastMemberProfile;