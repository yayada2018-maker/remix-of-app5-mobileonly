import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Wallet, Loader2, QrCode, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import QRCode from 'react-qr-code';

interface TopupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (newBalance: number) => void;
  requiredAmount?: number;
}

export const TopupDialog = ({ open, onOpenChange, onSuccess, requiredAmount }: TopupDialogProps) => {
  const { user } = useAuth();
  const [amount, setAmount] = useState('10');
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'completed'>('idle');

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

  const quickAmounts = [5, 10, 20, 50, 100];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-sm landscape:max-w-[55vw] landscape:max-h-[85vh] max-h-[90vh] overflow-y-auto p-4 landscape:p-3">
        <DialogHeader className="landscape:pb-1">
          <DialogTitle className="flex items-center gap-2 text-base landscape:text-sm">
            <Wallet className="h-4 w-4 landscape:h-3.5 landscape:w-3.5 text-primary" />
            Top Up Wallet
          </DialogTitle>
          {requiredAmount && paymentStatus === 'idle' && (
            <DialogDescription className="landscape:text-xs">
              Amount needed: <span className="text-primary font-semibold">${requiredAmount.toFixed(2)}</span>
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-3 landscape:space-y-2 mt-3 landscape:mt-2">
          {paymentStatus === 'idle' && (
            <>
              {/* Amount Selection */}
              <div className="grid grid-cols-5 gap-1.5 landscape:gap-1">
                {quickAmounts.map((quickAmount) => (
                  <Button
                    key={quickAmount}
                    variant={amount === quickAmount.toString() ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAmount(quickAmount.toString())}
                    className="font-semibold h-8 landscape:h-7 text-xs landscape:text-[10px]"
                  >
                    ${quickAmount}
                  </Button>
                ))}
              </div>

              {/* Custom Amount Input */}
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm landscape:text-xs">$</span>
                <Input
                  type="number"
                  placeholder="Custom amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="1"
                  step="0.01"
                  className="text-center h-9 landscape:h-8 text-sm landscape:text-xs"
                />
              </div>

              {/* Generate QR Button - directly generates KHQR */}
              <Button
                onClick={generateQRCode}
                disabled={loading || !amount || parseFloat(amount) <= 0}
                className="w-full h-10 landscape:h-9 gap-2 text-sm landscape:text-xs"
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
                className="-ml-2 h-7 landscape:h-6 text-xs"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Back
              </Button>

              <div className="bg-white rounded-lg p-3 landscape:p-2 flex justify-center">
                <QRCode id="topup-qr-code" value={qrCode} size={180} className="landscape:!w-[120px] landscape:!h-[120px]" />
              </div>

              <div className="text-center space-y-0.5">
                <p className="text-base landscape:text-sm font-semibold">Scan to Pay ${parseFloat(amount).toFixed(2)}</p>
                <p className="text-xs landscape:text-[10px] text-muted-foreground">Use any Cambodian banking app</p>
              </div>

              <div className="flex items-center justify-center gap-2 text-muted-foreground text-xs landscape:text-[10px]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Waiting for payment...
              </div>

              <Button
                variant="outline"
                onClick={manualCheckPayment}
                disabled={checking}
                className="w-full h-9 landscape:h-8 text-sm landscape:text-xs"
              >
                {checking ? 'Checking...' : 'I have paid'}
              </Button>
            </div>
          )}

          {paymentStatus === 'completed' && (
            <div className="flex flex-col items-center gap-2 landscape:gap-1.5 py-4 landscape:py-2">
              <CheckCircle2 className="w-12 h-12 landscape:w-10 landscape:h-10 text-green-500" />
              <p className="text-base landscape:text-sm font-semibold">Payment Successful!</p>
              <p className="text-xs landscape:text-[10px] text-muted-foreground">Your wallet has been topped up</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
