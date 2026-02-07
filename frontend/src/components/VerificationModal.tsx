
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Check, X, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface VerificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageFile: File | null;
    onVerified: (token: string) => void;
    category?: string;
}

type VerificationState = 'scanning' | 'success' | 'failed' | 'error';

export default function VerificationModal({
    isOpen,
    onClose,
    imageFile,
    onVerified,
    category = "General"
}: VerificationModalProps) {
    const [state, setState] = useState<VerificationState>('scanning');
    const [message, setMessage] = useState('Nagar Seva AI is verifying evidence...');
    const [failureReason, setFailureReason] = useState<string>('');

    useEffect(() => {
        if (isOpen && imageFile) {
            startVerification();
        } else if (!isOpen) {
            // Reset state on close
            setTimeout(() => setState('scanning'), 300);
        }
    }, [isOpen, imageFile]);

    const startVerification = async () => {
        setState('scanning');
        setMessage('Nagar Seva AI is verifying evidence...');
        setFailureReason('');

        try {
            const formData = new FormData();
            formData.append('image', imageFile!);
            formData.append('category', category);

            // Add a timeout to the fetch
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for AI processing

            // Use environment variable for API URL
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/verify`, {
                method: 'POST',
                body: formData,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Service Error: ${response.status}`);
            }

            const data = await response.json();

            if (data.status === 'approved') {
                // Success Phase
                setState('success');
                setMessage('Evidence Verified & Secured');

                // Haptic feedback if available
                if (navigator.vibrate) {
                    navigator.vibrate([100, 50, 100]);
                }

                // Delay before proceeding to give user time to see success
                setTimeout(() => {
                    onVerified(data.verification_token);
                }, 1500);
            } else {
                // Rejected Phase
                setState('failed');
                setFailureReason(data.reason || 'Image Quality Issues');
            }

        } catch (error: any) {
            setState('error');
            if (error.name === 'AbortError') {
                setFailureReason('Network timeout. Please try again.');
            } else {
                setFailureReason('Failed to connect to AI Service.');
            }
        }
    };

    const renderContent = () => {
        switch (state) {
            case 'scanning':
                return (
                    <div className="flex flex-col items-center justify-center py-8">
                        <div className="relative mb-6">
                            <motion.div
                                animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-20"
                            />
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                            >
                                <Shield className="w-20 h-20 text-blue-500" />
                            </motion.div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Loader2 className="w-8 h-8 text-white animate-spin" />
                            </div>
                        </div>
                        <h3 className="text-xl font-semibold text-foreground mb-2">Verifying Evidence</h3>
                        <p className="text-muted-foreground text-center max-w-[250px]">{message}</p>
                    </div>
                );

            case 'success':
                return (
                    <div className="flex flex-col items-center justify-center py-8">
                        <div className="relative mb-6">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center"
                            >
                                <Shield className="w-12 h-12 text-green-600 dark:text-green-400" />
                            </motion.div>
                            <motion.div
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center border-4 border-white dark:border-slate-950"
                            >
                                <Check className="w-4 h-4 text-white" strokeWidth={4} />
                            </motion.div>
                        </div>
                        <motion.h3
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-xl font-bold text-green-600 dark:text-green-400 mb-2"
                        >
                            Verified
                        </motion.h3>
                        <p className="text-muted-foreground text-center">{message}</p>
                    </div>
                );

            case 'failed':
                return (
                    <div className="flex flex-col items-center justify-center py-8">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="mb-6 relative"
                        >
                            <Shield className="w-20 h-20 text-red-500 opacity-20" />
                            <AlertTriangle className="absolute inset-0 m-auto w-10 h-10 text-red-500" />
                        </motion.div>
                        <h3 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-2">Verification Failed</h3>
                        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/10 rounded-lg mb-6 max-w-[90%]">
                            <p className="text-sm font-medium text-red-800 dark:text-red-200 text-center">
                                {failureReason}
                            </p>
                        </div>
                        <div className="flex space-x-3 w-full">
                            <Button variant="outline" className="flex-1" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button className="flex-1" onClick={startVerification}>
                                <RefreshCw className="w-4 h-4 mr-2" /> Retry
                            </Button>
                        </div>
                    </div>
                );

            case 'error':
                return (
                    <div className="flex flex-col items-center justify-center py-8">
                        <AlertTriangle className="w-16 h-16 text-amber-500 mb-4" />
                        <h3 className="text-lg font-semibold text-foreground mb-2">Service Error</h3>
                        <p className="text-muted-foreground text-center mb-6 max-w-[280px]">
                            {failureReason}
                        </p>
                        <div className="flex space-x-3 w-full">
                            <Button variant="outline" className="flex-1" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button className="flex-1" onClick={startVerification}>
                                <RefreshCw className="w-4 h-4 mr-2" /> Retry
                            </Button>
                        </div>
                    </div>
                );
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(val) => { if (!val && state !== 'scanning') onClose(); }}>
            <DialogContent className="sm:max-w-sm rounded-2xl border-none shadow-2xl bg-background/95 backdrop-blur-md">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={state}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                    >
                        {renderContent()}
                    </motion.div>
                </AnimatePresence>
            </DialogContent>
        </Dialog>
    );
}
