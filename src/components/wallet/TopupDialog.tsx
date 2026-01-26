import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Wallet, Loader2, QrCode, ArrowLeft, CheckCircle2, Download, ExternalLink } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import QRCode from 'react-qr-code';
import { useSiteSettings } from '@/contexts/SiteSettingsContext';
import { useTheme } from '@/contexts/ThemeContext';
import defaultLogo from '@/assets/khmerzoon.png';

interface TopupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (newBalance: number) => void;
  requiredAmount?: number;
}

export const TopupDialog = ({ open, onOpenChange, onSuccess, requiredAmount }: TopupDialogProps) => {
  const { user } = useAuth();
  const { settings, logos } = useSiteSettings();
  const { effectiveTheme } = useTheme();
  const [amount, setAmount] = useState('10');
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'completed'>('idle');

  // Get logo and site name from settings
  const currentLogo = effectiveTheme === 'dark' 
    ? (logos?.dark_logo || logos?.light_logo || defaultLogo)
    : (logos?.light_logo || logos?.dark_logo || defaultLogo);
  const siteName = settings?.site_title || 'KHMERZOON';

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setAmount(requiredAmount ? Math.ceil(requiredAmount).toString() : '10');
      setQrCode(null);
      setTransactionId(null);
      setPaymentStatus('idle');
    }
  }, [open, requiredAmount]);

  // Check payment status periodically
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (paymentStatus === 'pending' && transactionId) {
      interval = setInterval(() => {
        checkPaymentStatus();
      }, 3000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [paymentStatus, transactionId]);

  const generateQRCode = async () => {
    if (!user) {
      toast.error('Please login to continue');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('Session expired. Please login again');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('khqr-payment', {
        body: {
          action: 'generate',
          amount: parseFloat(amount),
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data.success) {
        setQrCode(data.qrCode);
        setTransactionId(data.transactionId);
        setPaymentStatus('pending');
        toast.success('QR Code generated! Scan to pay');
      } else {
        throw new Error('Failed to generate QR code');
      }
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast.error('Failed to generate QR code');
    } finally {
      setLoading(false);
    }
  };

  const checkPaymentStatus = async () => {
    if (!transactionId || checking || !user) return;

    setChecking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setChecking(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('khqr-payment', {
        body: {
          action: 'check',
          transactionId,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        setChecking(false);
        return;
      }

      if (data.status === 'completed') {
        setPaymentStatus('completed');
        toast.success(`Payment successful! Balance: $${data.newBalance.toFixed(2)}`);
        onSuccess?.(data.newBalance);
        
        setTimeout(() => {
          onOpenChange(false);
        }, 1500);
      }
    } catch (error) {
      console.error('Error checking payment:', error);
    } finally {
      setChecking(false);
    }
  };

  const manualCheckPayment = async () => {
    if (!transactionId || !user) return;

    setChecking(true);
    toast.info('Checking payment status...');
    
    try {
      const { data: transaction } = await supabase
        .from('payment_transactions')
        .select('status, amount')
        .eq('id', transactionId)
        .eq('user_id', user.id)
        .single();

      if (transaction?.status === 'completed') {
        // Get updated balance
        const { data: profile } = await supabase
          .from('profiles')
          .select('wallet_balance')
          .eq('id', user.id)
          .single();

        const newBalance = profile?.wallet_balance || 0;
        
        setPaymentStatus('completed');
        toast.success(`Payment confirmed! Balance: $${newBalance.toFixed(2)}`);
        onSuccess?.(newBalance);
        
        setTimeout(() => {
          onOpenChange(false);
        }, 1500);
      } else {
        toast.info('Payment not confirmed yet. Please wait or contact support.');
      }
    } catch (error) {
      toast.error('Failed to verify payment');
    } finally {
      setChecking(false);
    }
  };

  // Generate watermarked KHQR image matching reference design
  const generateWatermarkedQRImage = async (): Promise<Blob | null> => {
    const qrSvg = document.getElementById('topup-qr-code');
    if (!qrSvg) return null;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Canvas size for the watermarked image
    const width = 400;
    const height = 520;
    canvas.width = width;
    canvas.height = height;

    // Fill white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Load and draw logo
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    logoImg.src = currentLogo;
    
    await new Promise((resolve) => {
      logoImg.onload = resolve;
      logoImg.onerror = resolve;
    });

    // Draw logo (centered at top) - small size
    const logoSize = 50;
    ctx.drawImage(logoImg, (width - logoSize) / 2, 20, logoSize, logoSize);

    // Draw site name below logo (cyan/teal color like reference)
    ctx.fillStyle = '#00bcd4';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(siteName.toUpperCase(), width / 2, 90);

    // Convert QR SVG to image
    const svgData = new XMLSerializer().serializeToString(qrSvg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    const qrImg = new Image();
    qrImg.crossOrigin = 'anonymous';
    
    await new Promise((resolve, reject) => {
      qrImg.onload = resolve;
      qrImg.onerror = reject;
      qrImg.src = url;
    });

    // Draw QR code (centered)
    const qrSize = 260;
    const qrX = (width - qrSize) / 2;
    const qrY = 110;
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
    URL.revokeObjectURL(url);

    // Draw logo centered inside QR code with white background circle
    const centerLogoSize = 50;
    const centerX = qrX + (qrSize - centerLogoSize) / 2;
    const centerY = qrY + (qrSize - centerLogoSize) / 2;
    
    // Draw white circle background for logo
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(qrX + qrSize / 2, qrY + qrSize / 2, centerLogoSize / 2 + 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw the logo in the center
    ctx.drawImage(logoImg, centerX, centerY, centerLogoSize, centerLogoSize);

    // Draw "Scan to Pay $XX.XX" text
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Scan to Pay $${parseFloat(amount).toFixed(2)}`, width / 2, qrY + qrSize + 40);

    // Draw "Open in Banking App" text
    ctx.fillStyle = '#666666';
    ctx.font = '14px Arial';
    ctx.fillText('Open in Banking App', width / 2, qrY + qrSize + 65);

    // Draw "Powered by KHQR" watermark at bottom
    ctx.fillStyle = '#999999';
    ctx.font = '12px Arial';
    ctx.fillText('Powered by KHQR', width / 2, height - 15);

    // Convert to blob
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png', 1.0);
    });
  };

  const downloadQRCode = async () => {
    if (!qrCode) return;

    try {
      const blob = await generateWatermarkedQRImage();
      
      if (!blob) {
        toast.error('Failed to generate QR image');
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${siteName.toUpperCase()}-KHQR-${Date.now()}.png`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('QR Code downloaded');
    } catch (error) {
      console.error('Error downloading QR code:', error);
      toast.error('Failed to download QR code');
    }
  };

  const openWithBankApp = async () => {
    if (!qrCode) return;

    try {
      const blob = await generateWatermarkedQRImage();

      if (!blob) {
        toast.error('Failed to create QR image');
        return;
      }

      // Try Web Share API for native sharing
      const navAny = navigator as any;
      if (navAny?.share) {
        try {
          const file = new File([blob], `${siteName.toUpperCase()}-KHQR-Payment.png`, { type: 'image/png' });
          
          // Check if we can share files
          if (navAny.canShare && !navAny.canShare({ files: [file] })) {
            throw new Error('File sharing not supported');
          }

          await navAny.share({
            files: [file],
            title: `${siteName} KHQR Payment`,
            text: `Scan to pay $${parseFloat(amount).toFixed(2)} - Open in your banking app`,
          });
          
          return;
        } catch (shareError: any) {
          console.log('Share API error:', shareError);
          
          // If user cancelled, don't show error
          if (shareError.name === 'AbortError') {
            return;
          }
          
          // Fallback: download instead
          await downloadQRCode();
          return;
        }
      }

      // If share API not available, download automatically
      await downloadQRCode();
      
    } catch (error) {
      console.error('Error sharing:', error);
      toast.error('Please use Download button instead');
    }
  };

  const quickAmounts = [5, 10, 20, 50, 100];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md landscape:max-w-[50vw] landscape:md:max-w-[40vw] landscape:max-h-[90vh] max-h-[85vh] overflow-y-auto p-0 bg-transparent border-0 shadow-none">
        {/* Transparent glass container */}
        <div className="bg-background/80 backdrop-blur-xl border border-border/50 rounded-xl p-4 sm:p-5 landscape:p-3 space-y-4 landscape:space-y-3">
          <DialogHeader className="landscape:pb-1 pb-2">
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl landscape:text-base font-bold">
              <Wallet className="h-5 w-5 landscape:h-4 landscape:w-4 text-primary" />
              Top Up Wallet
            </DialogTitle>
            {requiredAmount && paymentStatus === 'idle' && (
              <DialogDescription className="text-sm landscape:text-xs mt-1">
                Required: <span className="text-yellow-500 font-semibold">${requiredAmount.toFixed(2)}</span>
              </DialogDescription>
            )}
          </DialogHeader>

          {paymentStatus === 'idle' && (
            <>
              {/* Amount Selection */}
              <div className="grid grid-cols-5 gap-2 landscape:gap-1.5">
                {quickAmounts.map((quickAmount) => (
                  <Button
                    key={quickAmount}
                    variant={amount === quickAmount.toString() ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAmount(quickAmount.toString())}
                    className="font-semibold h-9 sm:h-10 landscape:h-7 text-sm landscape:text-xs bg-background/50 backdrop-blur-sm border-border/50"
                  >
                    ${quickAmount}
                  </Button>
                ))}
              </div>

              {/* Custom Amount Input */}
              <div className="flex items-center gap-3 landscape:gap-2">
                <span className="text-muted-foreground text-base landscape:text-sm font-medium">$</span>
                <Input
                  type="number"
                  placeholder="Custom amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="1"
                  step="0.01"
                  className="text-center h-10 sm:h-11 landscape:h-8 text-base landscape:text-sm font-medium bg-background/50 backdrop-blur-sm border-border/50"
                />
              </div>

              {/* Generate QR Button */}
              <Button
                onClick={generateQRCode}
                disabled={loading || !amount || parseFloat(amount) <= 0}
                className="w-full h-11 sm:h-12 landscape:h-9 gap-2 text-base landscape:text-sm font-semibold"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 landscape:w-3.5 landscape:h-3.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <QrCode className="w-4 h-4 landscape:w-3.5 landscape:h-3.5" />
                    Add ${parseFloat(amount || '0').toFixed(2)} to Wallet
                  </>
                )}
              </Button>
            </>
          )}

          {paymentStatus === 'pending' && qrCode && (
            <div className="space-y-3 landscape:space-y-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPaymentStatus('idle');
                  setQrCode(null);
                  setTransactionId(null);
                }}
                className="-ml-2 h-7 landscape:h-6 text-sm landscape:text-xs"
              >
                <ArrowLeft className="h-3.5 w-3.5 landscape:h-3 landscape:w-3 mr-1" />
                Back
              </Button>

              {/* QR Code Display with branding */}
              <div className="bg-white rounded-xl p-4 landscape:p-3 flex flex-col items-center shadow-lg">
                {/* Site logo and name above QR */}
                <div className="flex flex-col items-center mb-3 landscape:mb-2">
                  <img 
                    src={currentLogo} 
                    alt={siteName} 
                    className="w-10 h-10 landscape:w-8 landscape:h-8 object-contain mb-1"
                  />
                  <span className="text-[#00bcd4] font-bold text-base landscape:text-sm">{siteName.toUpperCase()}</span>
                </div>
                
                {/* QR Code with centered logo */}
                <div className="relative">
                  <QRCode 
                    id="topup-qr-code" 
                    value={qrCode} 
                    size={180} 
                    className="w-[160px] h-[160px] sm:w-[180px] sm:h-[180px] landscape:!w-[120px] landscape:!h-[120px]" 
                  />
                  {/* Centered logo overlay */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-white p-1.5 rounded-full">
                      <img 
                        src={currentLogo} 
                        alt="" 
                        className="w-8 h-8 landscape:w-6 landscape:h-6 object-contain"
                      />
                    </div>
                  </div>
                </div>

                {/* Payment amount */}
                <p className="text-black font-bold text-lg landscape:text-base mt-3 landscape:mt-2">
                  Scan to Pay ${parseFloat(amount).toFixed(2)}
                </p>
                <p className="text-gray-500 text-sm landscape:text-xs">Open in Banking App</p>
                
                {/* Powered by KHQR */}
                <p className="text-gray-400 text-xs landscape:text-[10px] mt-3 landscape:mt-2">Powered by KHQR</p>
              </div>

              {/* Waiting indicator */}
              <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm landscape:text-xs py-1">
                <div className="h-2 w-2 bg-orange-500 rounded-full animate-pulse" />
                Waiting for payment...
              </div>

              {/* Action buttons row - Open With & Download */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openWithBankApp}
                  className="flex-1 h-9 landscape:h-7 text-sm landscape:text-xs gap-1.5 bg-background/50 backdrop-blur-sm border-border/50"
                >
                  <ExternalLink className="w-3.5 h-3.5 landscape:w-3 landscape:h-3" />
                  Open With
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadQRCode}
                  className="flex-1 h-9 landscape:h-7 text-sm landscape:text-xs gap-1.5 bg-background/50 backdrop-blur-sm border-border/50"
                >
                  <Download className="w-3.5 h-3.5 landscape:w-3 landscape:h-3" />
                  Download
                </Button>
              </div>

              {/* I have paid button */}
              <Button
                variant="default"
                onClick={manualCheckPayment}
                disabled={checking}
                className="w-full h-10 landscape:h-8 text-base landscape:text-sm font-medium"
              >
                {checking ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  'I have paid'
                )}
              </Button>
            </div>
          )}

          {paymentStatus === 'completed' && (
            <div className="flex flex-col items-center gap-3 landscape:gap-2 py-6 landscape:py-3">
              <div className="p-3 rounded-full bg-green-500/10">
                <CheckCircle2 className="w-14 h-14 landscape:w-10 landscape:h-10 text-green-500" />
              </div>
              <p className="text-xl landscape:text-base font-bold text-green-500">Payment Successful!</p>
              <p className="text-sm landscape:text-xs text-muted-foreground">Your wallet has been topped up</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
