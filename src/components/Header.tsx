import { useState, useEffect } from 'react';
import { Search, Crown, Wallet, Globe, Bell, Sun, Moon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { useSiteSettingsOptional } from '@/contexts/SiteSettingsContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { NotificationsDropdown } from '@/components/NotificationsDropdown';
import { MembershipDialog } from '@/components/MembershipDialog';
import { KHQRPaymentDialog } from '@/components/payment/KHQRPaymentDialog';
import VoiceSearchButton from '@/components/VoiceSearchButton';
import { useAuth } from '@/hooks/useAuth';
import { useWallet } from '@/hooks/useWallet';
import logoDefault from '@/assets/logo-red-lion.png';
import logoLightDefault from '@/assets/logo-light-new.png';

interface HeaderProps {
  onMenuClick: () => void;
  hideJoinMember?: boolean;
}

const Header = ({ onMenuClick, hideJoinMember = false }: HeaderProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [membershipDialogOpen, setMembershipDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const navigate = useNavigate();
  const { effectiveTheme } = useTheme();
  const siteSettings = useSiteSettingsOptional();
  const { user } = useAuth();
  const { balance, refetch: refetchBalance } = useWallet();

  // Track scroll position for header background effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Get logo from settings or use defaults
  const lightLogo = siteSettings?.logos?.light_logo || logoLightDefault;
  const darkLogo = siteSettings?.logos?.dark_logo || logoDefault;
  const currentLogo = effectiveTheme === 'dark' ? darkLogo : lightLogo;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const handleVoiceSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query)}`);
    }
  };

  return (
    <header 
      className={`fixed top-0 z-50 w-full transition-all duration-300 ${
        isScrolled 
          ? 'bg-black/40 backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.05)]' 
          : 'bg-transparent'
      }`}
    >
      <div className="flex h-14 items-center px-4 lg:px-6 gap-3">
        {/* Left: Menu and Logo */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="hover:bg-white/20 text-white h-9 w-9"
          >
            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor">
              <path d="M0 96C0 78.3 14.3 64 32 64H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H32C14.3 128 0 113.7 0 96zM0 256c0-17.7 14.3-32 32-32H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H32c-17.7 0-32-14.3-32-32zM448 416c0 17.7-14.3 32-32 32H32c-17.7 0-32-14.3-32-32s14.3-32 32-32H416c17.7 0 32 14.3 32 32z"/>
            </svg>
          </Button>

          {/* Logo with App Name */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <img 
              src={currentLogo} 
              alt="Site Logo" 
              className="h-8 w-auto object-contain"
            />
            <span className="font-bold text-lg text-white hidden sm:inline">
              {siteSettings?.settings?.site_title || 'KHMERZOON'}
            </span>
          </button>
        </div>

        {/* Center: Search with Voice */}
        <form onSubmit={handleSearch} className="flex-1 max-w-xl mx-auto">
          <div className="flex items-center gap-1">
            <div className="relative flex-1">
              <Input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-4 pr-10 bg-white/20 backdrop-blur-sm text-white placeholder:text-white/70 border-white/30 focus-visible:ring-white/50 focus-visible:ring-offset-0 rounded-full"
              />
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full hover:bg-transparent text-white"
              >
                <Search className="h-5 w-5" />
              </Button>
            </div>
            {/* Voice Search with Language Indicator */}
            <div className="flex items-center">
              <VoiceSearchButton onSearchResult={handleVoiceSearch} />
            </div>
          </div>
        </form>

        {/* Right: Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Language Toggle */}
          <LanguageToggle variant="icon" />
          
          {/* Theme Toggle */}
          <ThemeToggle />
          
          {/* Notifications */}
          <NotificationsDropdown />
          
          {/* Wallet Button */}
          <button
            onClick={() => {
              if (!user) {
                navigate('/auth');
              } else {
                setIsPaymentDialogOpen(true);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
          >
            <Wallet className="w-4 h-4 text-white" />
            <span className="text-sm font-semibold text-white">
              {user ? `$${balance.toFixed(2)}` : 'Sign In'}
            </span>
          </button>
          
          {/* Join Member Button */}
          {!hideJoinMember && (
            <Button 
              className="gap-2 bg-white hover:bg-white/90 text-primary font-semibold ml-1"
              onClick={() => setMembershipDialogOpen(true)}
            >
              <Crown className="h-4 w-4" />
              <span className="hidden sm:inline">Join Member</span>
            </Button>
          )}
        </div>
      </div>

      <MembershipDialog 
        open={membershipDialogOpen} 
        onOpenChange={setMembershipDialogOpen}
      />

      <KHQRPaymentDialog
        isOpen={isPaymentDialogOpen}
        onClose={() => setIsPaymentDialogOpen(false)}
        onSuccess={() => refetchBalance()}
      />
    </header>
  );
};

export default Header;
