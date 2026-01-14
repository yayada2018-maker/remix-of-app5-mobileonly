import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'en' | 'km';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations = {
  en: {
    // Navigation
    home: 'Home',
    myFeed: 'My Feed',
    movies: 'Movies',
    series: 'Series',
    tvSeries: 'TV Series',
    shorts: 'Shorts',
    shortVideos: 'Short Videos',
    search: 'Search',
    liked: 'Liked',
    likedVideos: 'Liked Videos',
    history: 'History',
    subscriptions: 'Subscriptions',
    shop: 'Shop',
    dashboard: 'Dashboard',
    premium: 'Premium',
    gaming: 'Gaming',
    finance: 'Finance & Crypto',
    live: 'LIVE',
    sports: 'Sports',
    viral: 'Viral',
    trending: 'Trending',
    explore: 'Explore',
    library: 'Library',
    downloads: 'Downloads',
    sls: 'SLS',
    podcasts: 'Podcasts',
    leaderboard: 'Leaderboard',
    vlogs: 'Vlogs',
    news: 'News',
    health: 'Health & Science',
    music: 'Music',
    entertainment: 'Entertainment',
    
    // Actions
    searchVideos: 'Search videos...',
    signOut: 'Sign Out',
    signIn: 'Sign In',
    joinMember: 'Join Member',
    play: 'Play',
    addToMyList: 'Add To MyList',
    removeFromList: 'Remove from List',
    seeAll: 'See all',
    moreEpisodes: 'More Episodes',
    watchNow: 'Watch Now',
    
    // Content sections
    topTvSeriesToday: 'TOP TV SERIES TODAY',
    topMoviesToday: 'TOP MOVIES TODAY',
    continueWatching: 'Continue Watching',
    watchHistory: 'Watch History',
    newReleases: 'New Releases',
    popular: 'Popular',
    recommended: 'Recommended',
    forYou: 'For You',
    upcoming: 'Upcoming',
    collections: 'Collections',
    
    // Watch page
    episodes: 'Episodes',
    comments: 'Comments',
    detail: 'Detail',
    cast: 'Cast',
    related: 'Related',
    watching: 'Watching',
    season: 'Season',
    episode: 'Episode',
    free: 'FREE',
    vip: 'VIP',
    views: 'views',
    
    // Common
    welcome: 'Welcome',
    loading: 'Loading...',
    walletBalance: 'Wallet Balance',
    language: 'Language',
    settings: 'Settings',
    profile: 'Profile',
    notifications: 'Notifications',
    darkMode: 'Dark Mode',
    lightMode: 'Light Mode',
    all: 'All',
    allVersions: 'All Versions',
    noEpisodesFound: 'No episodes found',
    noDescriptionAvailable: 'No description available.',
    loadingVideo: 'Loading video...',
    report: 'Report',
    share: 'Share',
    support: 'Support',
    like: 'Like',
    dislike: 'Dislike',
    goToHome: 'Go to Home',
    goToSeries: 'Go to Series',
    goToMovies: 'Go to Movies',
    goToDashboard: 'Go to Dashboard',
    description: 'Description',
  },
  km: {
    // Navigation
    home: 'ទំព័រដើម',
    myFeed: 'មតិព័ត៌មានរបស់ខ្ញុំ',
    movies: 'ភាពយន្ត',
    series: 'រឿងភាគ',
    tvSeries: 'រឿងភាគទូរទស្សន៍',
    shorts: 'វីដេអូខ្លី',
    shortVideos: 'វីដេអូខ្លី',
    search: 'ស្វែងរក',
    liked: 'ចូលចិត្ត',
    likedVideos: 'វីដេអូដែលចូលចិត្ត',
    history: 'ប្រវត្តិ',
    subscriptions: 'ការជាវ',
    shop: 'ហាង',
    dashboard: 'ផ្ទាំងគ្រប់គ្រង',
    premium: 'ពិសេស',
    gaming: 'ហ្គេម',
    finance: 'ហិរញ្ញវត្ថុ និងគ្រីបតូ',
    live: 'ផ្ទាល់',
    sports: 'កីឡា',
    viral: 'មាតិកាពេញនិយម',
    trending: 'និន្នាការ',
    explore: 'ស្វែងយល់',
    library: 'បណ្ណាល័យ',
    downloads: 'ទាញយក',
    sls: 'SLS',
    podcasts: 'ផតខាស',
    leaderboard: 'តារាងលេខកំពូល',
    vlogs: 'វីឡក',
    news: 'ព័ត៌មាន',
    health: 'សុខភាព និងវិទ្យាសាស្ត្រ',
    music: 'តន្ត្រី',
    entertainment: 'ការកម្សាន្ត',
    
    // Actions
    searchVideos: 'ស្វែងរកវីដេអូ...',
    signOut: 'ចាកចេញ',
    signIn: 'ចូល',
    joinMember: 'ចូលជាសមាជិក',
    play: 'ចាក់',
    addToMyList: 'បន្ថែមទៅបញ្ជី',
    removeFromList: 'ដកចេញពីបញ្ជី',
    seeAll: 'មើលទាំងអស់',
    moreEpisodes: 'វគ្គច្រើនទៀត',
    watchNow: 'មើលឥឡូវ',
    
    // Content sections
    topTvSeriesToday: 'រឿងភាគកំពូលថ្ងៃនេះ',
    topMoviesToday: 'ភាពយន្តកំពូលថ្ងៃនេះ',
    continueWatching: 'បន្តមើល',
    watchHistory: 'ប្រវត្តិមើល',
    newReleases: 'ចេញថ្មី',
    popular: 'ពេញនិយម',
    recommended: 'ណែនាំ',
    forYou: 'សម្រាប់អ្នក',
    upcoming: 'នឹងមកដល់',
    collections: 'បណ្តុំ',
    
    // Watch page
    episodes: 'វគ្គ',
    comments: 'មតិយោបល់',
    detail: 'ព័ត៌មានលម្អិត',
    cast: 'តួសម្តែង',
    related: 'ពាក់ព័ន្ធ',
    watching: 'កំពុងមើល',
    season: 'រដូវកាល',
    episode: 'វគ្គ',
    free: 'ឥតគិតថ្លៃ',
    vip: 'VIP',
    views: 'ការមើល',
    
    // Common
    welcome: 'សូមស្វាគមន៍',
    loading: 'កំពុងផ្ទុក...',
    walletBalance: 'សមតុល្យកាបូប',
    language: 'ភាសា',
    settings: 'ការកំណត់',
    profile: 'ប្រវត្តិរូប',
    notifications: 'ការជូនដំណឹង',
    darkMode: 'ទម្រង់ងងឹត',
    lightMode: 'ទម្រង់ភ្លឺ',
    all: 'ទាំងអស់',
    allVersions: 'កំណែទាំងអស់',
    noEpisodesFound: 'រកមិនឃើញវគ្គ',
    noDescriptionAvailable: 'មិនមានការពិពណ៌នា។',
    loadingVideo: 'កំពុងផ្ទុកវីដេអូ...',
    report: 'រាយការណ៍',
    share: 'ចែករំលែក',
    support: 'គាំទ្រ',
    like: 'ចូលចិត្ត',
    dislike: 'មិនចូលចិត្ត',
    goToHome: 'ទៅទំព័រដើម',
    goToSeries: 'ទៅរឿងភាគ',
    goToMovies: 'ទៅភាពយន្ត',
    goToDashboard: 'ទៅផ្ទាំងគ្រប់គ្រង',
    description: 'ការពិពណ៌នា',
  },
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    return (saved === 'km' ? 'km' : 'en') as Language;
  });

  useEffect(() => {
    localStorage.setItem('language', language);
    // Apply Khmer font to document body when Khmer is selected
    if (language === 'km') {
      document.body.classList.add('font-khmer');
    } else {
      document.body.classList.remove('font-khmer');
    }
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations.en] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
