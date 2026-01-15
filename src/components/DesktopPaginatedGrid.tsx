import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';
import GridMovieCard from '@/components/GridMovieCard';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

interface Content {
  id: string;
  title: string;
  poster_path?: string;
  backdrop_path?: string;
  tmdb_id?: number;
  content_type?: string;
  recent_episode?: string;
  overview?: string;
  genre?: string;
  access_type?: 'free' | 'purchase' | 'membership';
  cast?: { id: string; profile_path: string; name?: string }[];
}

interface DesktopPaginatedGridProps {
  contentType: 'movie' | 'series';
  title: string;
}

const DesktopPaginatedGrid = ({ contentType, title }: DesktopPaginatedGridProps) => {
  const [content, setContent] = useState<Content[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const itemsPerPage = 24; // More items for desktop

  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true);
      const start = (currentPage - 1) * itemsPerPage;
      const end = start + itemsPerPage - 1;

      const { data, error, count } = await supabase
        .from('content')
        .select('id, title, poster_path, backdrop_path, tmdb_id, content_type, recent_episode, overview, genre, access_type', { count: 'exact' })
        .eq('content_type', contentType)
        .in('status', ['active', 'Ended'])
        .order('created_at', { ascending: false })
        .range(start, end);

      if (!error && data) {
        setContent(data);
        if (count) {
          setTotalPages(Math.ceil(count / itemsPerPage));
        }
      }
      setLoading(false);
    };

    fetchContent();
  }, [contentType, currentPage]);

  const handleClick = (item: Content) => {
    const id = item.tmdb_id || item.id;
    if (contentType === 'series') {
      navigate(`/watch/series/${id}/1/1`);
    } else {
      navigate(`/watch/movie/${id}`);
    }
  };

  const setCurrentPage = (page: number) => {
    setSearchParams({ page: page.toString() });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderPaginationItems = () => {
    const items = [];
    const maxVisible = 7;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
      items.push(
        <PaginationItem key="1">
          <PaginationLink onClick={() => setCurrentPage(1)}>1</PaginationLink>
        </PaginationItem>
      );
      if (startPage > 2) {
        items.push(<PaginationEllipsis key="ellipsis-start" />);
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink 
            isActive={currentPage === i}
            onClick={() => setCurrentPage(i)}
          >
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        items.push(<PaginationEllipsis key="ellipsis-end" />);
      }
      items.push(
        <PaginationItem key={totalPages}>
          <PaginationLink onClick={() => setCurrentPage(totalPages)}>
            {totalPages}
          </PaginationLink>
        </PaginationItem>
      );
    }

    return items;
  };

  return (
    <div className="container mx-auto px-4 pb-12">
      <h2 className="text-3xl font-bold mb-8 text-foreground">{title}</h2>
      
      {loading ? (
        <div className="grid grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 24 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[2/3] rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 mb-8">
            {content.map((item) => (
              <GridMovieCard
                key={item.id}
                item={item}
                onClick={handleClick}
              />
            ))}
          </div>
          
          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
                    className={currentPage <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
                {renderPaginationItems()}
                <PaginationItem>
                  <PaginationNext 
                    onClick={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
                    className={currentPage >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}
    </div>
  );
};

export default DesktopPaginatedGrid;
