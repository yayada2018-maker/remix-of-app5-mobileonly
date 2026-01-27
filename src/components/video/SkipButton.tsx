import { Button } from '@/components/ui/button';
import { FastForward } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SkipButtonProps {
  label: string;
  onSkip: () => void;
  isVisible: boolean;
  className?: string;
}

/**
 * Reusable Skip Button component for intro/outro skipping
 * Glass-morphism design with slide-in animation
 */
export const SkipButton = ({
  label,
  onSkip,
  isVisible,
  className = ''
}: SkipButtonProps) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSkip();
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className={`absolute bottom-24 right-4 md:bottom-20 md:right-6 z-40 ${className}`}
        >
          <Button
            onClick={handleClick}
            variant="outline"
            className="
              bg-white/95 hover:bg-white text-black 
              dark:bg-zinc-900/95 dark:hover:bg-zinc-900 dark:text-white
              border-2 border-white/80 dark:border-zinc-700
              font-semibold text-sm md:text-base
              px-4 py-2 md:px-6 md:py-3
              h-auto
              rounded-md
              shadow-lg shadow-black/30
              backdrop-blur-sm
              flex items-center gap-2
              transition-all duration-200
              hover:scale-105 active:scale-95
            "
          >
            <FastForward className="w-4 h-4 md:w-5 md:h-5" />
            <span>{label}</span>
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
