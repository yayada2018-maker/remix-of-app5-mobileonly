import { useState, useEffect, useCallback, type RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Heart, Wallet, ChevronRight, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useWallet } from '@/hooks/useWallet';
import { AuthDialog } from '@/components/AuthDialog';
import { KHQRPaymentDialog } from '@/components/payment/KHQRPaymentDialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SupportUsColors {
  buttonBg: string;
  buttonText: string;
  selectedBg: string;
  selectedText: string;
}

interface SupportUsOverlayProps {
  isVisible: boolean;
  onClose: () => void;
  onSkip: () => void;
  contentId?: string;
  contentTitle?: string;
  countdownSeconds?: number;
  supportAmounts?: number[];
  episodeId?: string;
  colors?: SupportUsColors;
  containerRef?: RefObject<HTMLElement | null>;
  startAtWallet?: boolean; // Skip initial step and go directly to wallet
}

const defaultColors: SupportUsColors = {
  buttonBg: '#FFFFFF',
  buttonText: '#0F172A',
  selectedBg: '#00BCD4',
  selectedText: '#FFFFFF',
};

export const SupportUsOverlay = ({
  isVisible,
  onClose,
  onSkip,
  contentId,
  contentTitle,
  countdownSeconds = 10,
  supportAmounts = [0.5, 1, 2, 5],
  episodeId,
  colors = defaultColors,
  containerRef,
  startAtWallet = false
}: SupportUsOverlayProps) => {
  const { user } = useAuth();
  const { balance, loading: walletLoading, refetch: refetchWallet } = useWallet();
  const { toast } = useToast();
  
  const [countdown, setCountdown] = useState(10);
  const [step, setStep] = useState<'initial' | 'wallet'>('initial');
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [showKHQRDialog, setShowKHQRDialog] = useState(false);
  const [supportAmount, setSupportAmount] = useState<number>(1);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isSupporting, setIsSupporting] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showAuthDialogPending, setShowAuthDialogPending] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);

  const portalContainer =
    containerRef?.current ||
    (typeof document !== 'undefined' ? (document.fullscreenElement as HTMLElement | null) : null);

  // Reset countdown when overlay becomes visible
  useEffect(() => {
    if (isVisible) {
      setCountdown(countdownSeconds);
      // If startAtWallet and user is logged in, skip to wallet step
      if (startAtWallet && user) {
        setStep('wallet');
        setIsProcessingPayment(true);
      } else {
        setStep('initial');
        setIsProcessingPayment(false);
      }
      setShowAuthDialogPending(false);
      setCustomAmount('');
    }
  }, [isVisible, countdownSeconds, startAtWallet, user]);

  // Auto-dismiss countdown - pause when auth dialog is shown or processing payment
  useEffect(() => {
    if (!isVisible) return;

    // Don't countdown if auth dialog is open or processing payment
    if (showAuthDialog || isProcessingPayment || step === 'wallet') {
      return;
    }

    // Start countdown timer
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Only auto-skip if not processing payment and not waiting for auth
          if (!isProcessingPayment && step === 'initial' && !showAuthDialog) {
            onSkip();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isVisible, onSkip, isProcessingPayment, step, showAuthDialog]);

  const handleSupportClick = useCallback(() => {
    if (!user) {
      setShowAuthDialog(true);
      setShowAuthDialogPending(true);
      return;
    }
    setStep('wallet');
    setIsProcessingPayment(true);
  }, [user]);

  const handleAuthSuccess = useCallback(() => {
    setShowAuthDialog(false);
    setShowAuthDialogPending(false);
    // After login, go to wallet step
    setTimeout(() => {
      setStep('wallet');
      setIsProcessingPayment(true);
    }, 100);
  }, []);

  const handleAuthDialogClose = useCallback((open: boolean) => {
    setShowAuthDialog(open);
    if (!open) {
      setShowAuthDialogPending(false);
    }
  }, []);

  const handleTopupClick = useCallback(() => {
    setShowKHQRDialog(true);
  }, []);

  const handleTopupSuccess = useCallback((newBalance: number) => {
    setShowKHQRDialog(false);
    refetchWallet();
  }, [refetchWallet]);

  const handleAmountSelect = (amount: number) => {
    setSupportAmount(amount);
    setCustomAmount('');
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
      setSupportAmount(numValue);
    }
  };

  const handleConfirmSupport = useCallback(async () => {
    if (!user || !contentId) return;
    
    const finalAmount = customAmount ? parseFloat(customAmount) : supportAmount;
    
    if (isNaN(finalAmount) || finalAmount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount",
        variant: "destructive"
      });
      return;
    }
    
    if (balance < finalAmount) {
      toast({
        title: "Insufficient Balance",
        description: "Please top up your wallet first",
        variant: "destructive"
      });
      return;
    }

    setIsSupporting(true);
    try {
      const { data, error } = await supabase.rpc('support_content_with_wallet', {
        p_user_id: user.id,
        p_content_id: contentId,
        p_amount: finalAmount,
        p_episode_id: episodeId || null
      });

      if (error) throw error;

      toast({
        title: "Thank you! ❤️",
        description: `You supported this content with $${finalAmount.toFixed(2)}`,
      });
      
      refetchWallet();
      // Show a short celebration animation, then close
      setShowThankYou(true);
      setTimeout(() => {
        setShowThankYou(false);
        onClose();
      }, 1200);
    } catch (error: any) {
      toast({
        title: "Support Failed",
        description: error.message || "Could not process your support",
        variant: "destructive"
      });
    } finally {
      setIsSupporting(false);
    }
  }, [user, contentId, supportAmount, customAmount, balance, toast, refetchWallet, onClose, episodeId]);

  if (!isVisible) return null;

  const finalAmount = customAmount ? parseFloat(customAmount) : supportAmount;
  const isValidAmount = !isNaN(finalAmount) && finalAmount > 0;

  return (
    <>
      {/* Keep overlay below dialog z-index so dialogs never appear behind it */}
      <div className="absolute inset-0 z-[9998] flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <AnimatePresence>
          {showThankYou && (
            <motion.div
              className="absolute inset-0 z-[10003] flex items-center justify-center pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="relative flex flex-col items-center gap-2"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              >
                <div className="text-white text-lg sm:text-2xl font-bold">Thank you!</div>
                <div className="text-white/70 text-xs sm:text-sm">Your support helps us keep going.</div>

                {/* Heart burst */}
                <div className="absolute inset-0">
                  {Array.from({ length: 10 }).map((_, i) => {
                    const angle = (i / 10) * Math.PI * 2;
                    const distance = 60;
                    const x = Math.cos(angle) * distance;
                    const y = Math.sin(angle) * distance;
                    return (
                      <motion.div
                        key={i}
                        className="absolute left-1/2 top-1/2"
                        initial={{ x: 0, y: 0, opacity: 0, scale: 0.6 }}
                        animate={{ x, y, opacity: [0, 1, 0], scale: [0.6, 1, 0.8] }}
                        transition={{ duration: 1.0, delay: i * 0.03 }}
                      >
                        <Heart className="w-4 h-4 text-primary" fill="currentColor" />
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Countdown circle - positioned for both portrait and landscape */}
        <div className="absolute top-1/2 right-3 sm:right-6 -translate-y-1/2 flex flex-col sm:flex-row items-center gap-1.5">
          <div className="relative w-8 h-8 sm:w-10 sm:h-10">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="2"
              />
              <circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="2"
                strokeDasharray={100}
                strokeDashoffset={100 - (countdown / countdownSeconds) * 100}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-white text-xs sm:text-sm font-bold">
              {countdown}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onSkip}
            className="text-white/70 hover:text-white hover:bg-white/10 text-[10px] sm:text-xs px-1.5 sm:px-2 h-6 sm:h-7 gap-0.5"
          >
            Skip <ChevronRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
          </Button>
        </div>

        {/* Main Content - Responsive for landscape, scaled 30% smaller on mobile/native */}
        <div className="text-center w-full max-w-[180px] sm:max-w-[320px] landscape:max-w-[360px] sm:landscape:max-w-[400px] mx-auto px-4 space-y-1.5 sm:space-y-3 scale-[0.70] sm:scale-100 origin-center">
          {/* Initial Step - Support Us prompt */}
          {step === 'initial' && (
            <>
              <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto rounded-full bg-gradient-to-br from-pink-500 to-red-500 flex items-center justify-center animate-pulse">
                <Heart className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="white" />
              </div>
              
              <div className="space-y-1">
                <h3 className="text-white text-base sm:text-lg font-bold">Support Us</h3>
                <p className="text-white/70 text-xs sm:text-sm leading-tight">
                  Love this content? Support us!
                </p>
              </div>

              <Button
                onClick={handleSupportClick}
                size="sm"
                className="w-full max-w-[240px] sm:max-w-[280px] mx-auto h-9 sm:h-10 gap-1.5 text-sm sm:text-base bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 text-white font-semibold rounded-lg"
              >
                <Heart className="w-4 h-4 sm:w-5 sm:h-5" />
                Support
              </Button>
            </>
          )}

          {/* Wallet Step - Show balance */}
          {step === 'wallet' && (
            <>
              <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
                <Wallet className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
              </div>
              
              <div className="space-y-1">
                <h3 className="text-white text-base sm:text-lg font-bold">Your Wallet</h3>
                <div className="flex items-center justify-center gap-1.5">
                  <Wallet className="w-4 h-4 text-primary" />
                  <span className="text-primary text-xl sm:text-2xl font-bold">
                    {walletLoading ? '...' : `$${balance.toFixed(2)}`}
                  </span>
                </div>
              </div>

              {balance <= 0 ? (
                <>
                  <p className="text-white/70 text-xs sm:text-sm">
                    Wallet empty. Top up first!
                  </p>
                  <Button
                    onClick={handleTopupClick}
                    size="sm"
                    className="w-full max-w-[240px] mx-auto h-9 sm:h-10 gap-1.5 text-sm bg-primary hover:bg-primary/90 font-semibold rounded-lg"
                  >
                    <Wallet className="w-4 h-4" />
                    Top Up
                  </Button>
                </>
              ) : (
                <>
                  {/* Amount Selection - Responsive for landscape */}
                  <div className="space-y-2 sm:space-y-3">
                    <p className="text-white/70 text-xs sm:text-sm">Choose amount:</p>
                    <div className="grid grid-cols-4 gap-1.5 sm:gap-2 max-w-[280px] sm:max-w-[320px] mx-auto">
                      {supportAmounts.map((amount) => {
                        const isSelected = supportAmount === amount && !customAmount;
                        return (
                          <button
                            key={amount}
                            onClick={() => handleAmountSelect(amount)}
                            disabled={balance < amount}
                            className="h-8 sm:h-9 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{
                              backgroundColor: isSelected ? colors.selectedBg : colors.buttonBg,
                              color: isSelected ? colors.selectedText : colors.buttonText,
                            }}
                          >
                            ${amount}
                          </button>
                        );
                      })}
                    </div>
                    
                    {/* Custom Amount Input - Responsive */}
                    <div className="flex items-center gap-2 max-w-[280px] sm:max-w-[320px] mx-auto">
                      <Input
                        type="number"
                        placeholder="Custom"
                        value={customAmount}
                        onChange={(e) => handleCustomAmountChange(e.target.value)}
                        className="h-8 sm:h-9 text-xs sm:text-sm rounded-full text-center px-3"
                        style={{
                          backgroundColor: colors.buttonBg,
                          color: colors.buttonText,
                          borderColor: customAmount ? colors.selectedBg : 'transparent',
                        }}
                        min="0.01"
                        step="0.01"
                      />
                      <button
                        onClick={handleConfirmSupport}
                        disabled={isSupporting || !isValidAmount || balance < finalAmount}
                        className="h-8 sm:h-9 px-4 rounded-full text-xs sm:text-sm font-medium flex items-center gap-1.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 text-white whitespace-nowrap"
                      >
                        {isSupporting ? (
                          <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                        ) : (
                          <Heart className="w-3 h-3 sm:w-4 sm:h-4" fill="white" />
                        )}
                        ${isValidAmount ? finalAmount.toFixed(2) : '0.00'}
                      </button>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleTopupClick}
                    className="w-full max-w-[200px] mx-auto h-7 sm:h-8 gap-1.5 text-xs sm:text-sm text-white/50 hover:text-white hover:bg-white/10"
                  >
                    <Wallet className="w-3 h-3 sm:w-4 sm:h-4" />
                    Top Up Wallet
                  </Button>
                </>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep('initial')}
                className="text-white/50 hover:text-white text-xs sm:text-sm h-6 sm:h-7"
              >
                ← Back
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Auth Dialog */}
      <AuthDialog
        open={showAuthDialog}
        onOpenChange={handleAuthDialogClose}
        onSuccess={handleAuthSuccess}
        container={portalContainer}
      />

      {/* KHQR Payment Dialog for Top Up */}
      <KHQRPaymentDialog
        isOpen={showKHQRDialog}
        onClose={() => setShowKHQRDialog(false)}
        onSuccess={handleTopupSuccess}
        container={portalContainer}
      />
    </>
  );
};