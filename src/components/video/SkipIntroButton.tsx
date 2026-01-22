import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { FastForward } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SkipIntroButtonProps {
  currentTime: number;
  introStartTime?: number;  // When intro starts (usually 0)
  introEndTime?: number;    // When intro ends (skip target)
  onSkipIntro: () => void;
  isVisible?: boolean;      // External visibility control
  className?: string;
}

export const SkipIntroButton = ({
  currentTime,
  introStartTime = 0,
  introEndTime,
  onSkipIntro,
  isVisible = true,
  className = ''
}: SkipIntroButtonProps) => {
  const [shouldShow, setShouldShow] = useState(false);

  // Determine if button should be visible based on current playback time
  useEffect(() => {
    if (!introEndTime || introEndTime <= 0) {
      setShouldShow(false);
      return;
    }

    // Show button when currentTime is within intro range
    // Buffer: show a bit before intro ends (introEndTime - 2 seconds)
    const isWithinIntroRange = 
      currentTime >= introStartTime && 
      currentTime < introEndTime - 0.5; // Hide just before it would skip anyway

    setShouldShow(isWithinIntroRange && isVisible);
  }, [currentTime, introStartTime, introEndTime, isVisible]);

  const handleSkip = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSkipIntro();
  };

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className={`absolute bottom-24 right-4 md:bottom-20 md:right-6 z-40 ${className}`}
        >
          <Button
            onClick={handleSkip}
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
            <span>Skip Intro</span>
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
