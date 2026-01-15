import HeroBanner from '@/components/HeroBanner';
import ContentRow from '@/components/ContentRow';
import TopSection from '@/components/TopSection';
import TopMoviesSection from '@/components/TopMoviesSection';
import TopAnimesSection from '@/components/TopAnimesSection';
import MobileHeroBanner from '@/components/MobileHeroBanner';
import MobileCircleSlider from '@/components/MobileCircleSlider';
import MobileTopSection from '@/components/MobileTopSection';
import MobileContentSection from '@/components/MobileContentSection';
import CollectionsScroll from '@/components/CollectionsScroll';
import HomeWatchHistory from '@/components/HomeWatchHistory';
import HomeContinuousWatch from '@/components/HomeContinuousWatch';
import { UpcomingSection } from '@/components/UpcomingSection';
import AdSlot from '@/components/ads/AdSlot';
import SeriesUpdateTodaySection from '@/components/SeriesUpdateTodaySection';
import { useIsMobile } from '@/hooks/use-mobile';
import { useIsIPad } from '@/hooks/use-ipad';

const Home = () => {
  const isMobile = useIsMobile();
  const { isIPadPortrait, isIPadLandscape } = useIsIPad();

  // Mobile layout: mobile devices OR iPad in portrait mode
  const useMobileLayout = isMobile || isIPadPortrait;

  if (useMobileLayout) {
    return (
      <div className="min-h-screen scrollbar-hide">
        <MobileHeroBanner page="home" />
        <MobileCircleSlider />
        <HomeContinuousWatch />
        <MobileTopSection />
        <SeriesUpdateTodaySection />
        <AdSlot placement="banner" pageLocation="home_top_series" className="px-4 py-2" />
        <MobileContentSection title="Trending Now" type="trending" link="/movies" />
        <MobileContentSection title="New Releases" type="new_releases" link="/movies" />
        <UpcomingSection />
        <CollectionsScroll />
        <AdSlot placement="banner" pageLocation="home_collections" className="px-4 py-2" />
      </div>
    );
  }

  // Desktop Layout (also used for iPad landscape)
  return (
    <div className="pb-8">
      <HeroBanner page="home" />
      <div className="space-y-6">
        <TopSection className="px-0 mx-[15px]" />
        <SeriesUpdateTodaySection className="px-[15px]" />
        <AdSlot placement="banner" pageLocation="home_top_series" className="px-4" />
        <TopAnimesSection className="mx-[15px] px-[15px]" />
        <HomeWatchHistory />
        <HomeContinuousWatch />
        <TopMoviesSection className="px-[15px] mx-[15px]" />
        <UpcomingSection className="mx-[15px] px-0" />
        <CollectionsScroll />
        <AdSlot placement="banner" pageLocation="home_collections" className="px-4" />
        <ContentRow title="Trending Now" className="px-[15px] mx-[15px]" />
        <ContentRow title="New Releases" className="px-[15px] mx-[15px]" />
        <AdSlot placement="banner" pageLocation="home_new_releases" className="px-4" />
      </div>
    </div>
  );
};

export default Home;
