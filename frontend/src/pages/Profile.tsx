
import { useEffect, useState } from "react";
import { QRCodeSVG } from 'qrcode.react';
import { Button } from "@/components/ui/button";
import { authService, User } from "@/lib/authService";
import { useAuth } from "@/contexts/AuthProvider";
import { reportStorage } from "@/lib/reportStorage";
import { certificateService, CivicCertificate } from "@/lib/certificateService";
import { emailService } from "@/lib/emailService";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield, Download, FileText, CheckCircle2, User as UserIcon, Mail, Phone, Edit, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
// Removed duplicate Dialog imports here, using the comprehensive one below
import { calculateUserPoints, getLevel, PointBreakdown } from "@/lib/pointCalculator";
// Import Feedback Service
import { feedbackService, Feedback } from "@/lib/feedbackService";
import { Separator } from "@/components/ui/separator";

// Tax Service Imports
import { taxService, TaxBill } from "@/lib/taxService";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Loader2, IndianRupee } from "lucide-react";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Profile = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);
    const [stats, setStats] = useState({
        totalReports: 0,
        resolvedReports: 0,
        verifiedReports: 0,
    });
    const [certificates, setCertificates] = useState<CivicCertificate[]>([]);
    const [loading, setLoading] = useState(true);
    const [claiming, setClaiming] = useState<string | null>(null);

    // New Gamification State
    const [pointsBreakdown, setPointsBreakdown] = useState<PointBreakdown | null>(null);
    const [calculatedPoints, setCalculatedPoints] = useState(0);
    const [currentLevel, setCurrentLevel] = useState<{ name: string, min: number, max: number }>({ name: 'Novice', min: 0, max: 100 });

    // Tax Module State
    const [taxIdInput, setTaxIdInput] = useState("");
    const [taxBill, setTaxBill] = useState<TaxBill | null>(null);
    const [pendingBill, setPendingBill] = useState<TaxBill | null>(null); // For intermediate OTP step
    const [loadingTax, setLoadingTax] = useState(false);
    const [redeemPoints, setRedeemPoints] = useState(0);
    const [showOtpDialog, setShowOtpDialog] = useState(false);
    const [otpMode, setOtpMode] = useState<'FETCH' | 'PAY'>('FETCH');
    const [otpInput, setOtpInput] = useState("");

    const handleFetchTax = async () => {
        if (!taxIdInput) return;
        setLoadingTax(true);
        try {
            const bill = await taxService.fetchTaxDetails(taxIdInput);
            if (bill) {
                setPendingBill(bill);
                setOtpMode('FETCH');
                setShowOtpDialog(true);
            } else {
                toast({ title: "Not Found", description: "No tax bill found for this ID.", variant: "destructive" });
            }
        } finally {
            setLoadingTax(false);
        }
    };

    const handleVerifyOtp = async () => {
        setLoadingTax(true);
        const verified = await taxService.verifyOTP(otpInput);

        if (verified) {
            if (otpMode === 'FETCH') {
                // Access Granted
                setTaxBill(pendingBill);
                setPendingBill(null); // Clear pending
                setRedeemPoints(0);
                setShowOtpDialog(false);
                setOtpInput("");
                toast({ title: "Verified", description: "Access granted to tax record." });
            } else {
                // Payment Processing
                if (!taxBill) return;
                const txn = await taxService.payTax(taxBill.id, redeemPoints, 10); // 1 Pt = 10 Rs
                if (txn) {
                    taxService.generateReceipt(txn, taxBill);

                    // DEDUCT POINTS (Mock Logic)
                    const newPoints = calculatedPoints - redeemPoints;
                    setCalculatedPoints(newPoints); // UI Update

                    // Update Local Storage Persistence
                    if (user) {
                        const storedUsers = localStorage.getItem('nagarSevaMockDB_Users');
                        if (storedUsers) {
                            const users = JSON.parse(storedUsers);
                            const uIndex = users.findIndex((u: any) => u.id === user.id);
                            if (uIndex !== -1) {
                                users[uIndex].points = newPoints;
                                localStorage.setItem('nagarSevaMockDB_Users', JSON.stringify(users));
                            }
                        }
                        // Also update session user potentially if needed for reload
                        // But 'loadData' usually refetches from reportStorage sum, currently we are overriding 
                        // Wait, 'calculatedPoints' comes from 'calculateUserPoints(reports)'. 
                        // To permanently reduce points in this system (which is report-based), we usually need to add a "Debit Transaction" record.
                        // BUT, our current Point System is purely sum() of Reports.
                        // To support "Redemption", we need to hack it:
                        // We can add a "Negative Point Report" or simpler: just store 'spentPoints' in user metadata.
                        // Let's store 'spentPoints' in the mock user profile.

                        const storedUsersPersistence = localStorage.getItem('nagarSevaMockDB_Users');
                        if (storedUsersPersistence) {
                            const users = JSON.parse(storedUsersPersistence);
                            const uIndex = users.findIndex((u: any) => u.id === user.id);
                            if (uIndex !== -1) {
                                // Add to spent points
                                const currentSpent = users[uIndex].spentPoints || 0;
                                users[uIndex].spentPoints = currentSpent + redeemPoints;
                                localStorage.setItem('nagarSevaMockDB_Users', JSON.stringify(users));
                            }
                        }
                    }

                    toast({ title: "Payment Successful", description: `Receipt downloaded. ${redeemPoints} points redeemed.` });
                    setShowOtpDialog(false);
                    setOtpInput("");
                    setTaxBill(null);
                    loadData(); // Reload to reflect point changes
                }
            }
        } else {
            toast({ title: "Invalid OTP", description: "Please try again.", variant: "destructive" });
        }
        setLoadingTax(false);
    };

    const { user: authUser, loading: authLoading } = useAuth(); // Hooks must be at top level

    useEffect(() => {
        if (!authLoading) {
            loadData();

            // Real-time subscription to reports
            const unsubscribe = reportStorage.subscribe(() => {
                loadData();
            });
            return () => unsubscribe();
        }
    }, [navigate, authUser, authLoading]);

    const loadData = async () => {
        if (!authUser) {
            navigate('/signin');
            return;
        }

        setLoading(true);
        const currentUser = authUser;
        // Proceed to load data for existing user...


        try {
            // Fetch strict profile from DB to get latest points/role not just session metadata
            const freshProfile = await authService.fetchFreshProfile(currentUser.id);

            // Merge session data (email/id) with DB profile data (points/role/phone)
            const baseName = freshProfile?.name ||
                ((currentUser as any).user_metadata?.full_name) ||
                ((currentUser as any).name) ||
                'Citizen';

            const baseEmail = currentUser.email;

            const userWithPoints: User = {
                id: currentUser.id,
                username: baseEmail || '',
                email: baseEmail,
                name: baseName,
                role: (freshProfile?.role as any) || 'citizen',
                phone: freshProfile?.phone || (currentUser as any).phone || (currentUser as any).user_metadata?.phone,
                points: freshProfile?.points || 0
            };

            setUser(userWithPoints);

            // Fetch reports to calculate points, BUT respect the DB points if they are higher (source of truth for redeemed/bonus points)
            const reports = await reportStorage.getUserReports(currentUser.id);
            const total = reports.length;
            const resolved = reports.filter(r => r.status === 'resolved').length;

            setStats({
                totalReports: total,
                resolvedReports: resolved,
                verifiedReports: resolved
            });

            // Fetch User Feedback for Points
            const feedbacks = await feedbackService.getFeedbackByUser(currentUser.id);

            // 1. Calculate LIFETIME Points from reports (Total Earnings)
            // This is used for LEVEL progression (never goes down)
            const breakdown = calculateUserPoints(reports as any, feedbacks);
            setPointsBreakdown(breakdown);
            const lifetimeEarnings = breakdown.total;

            // 2. Calculate SPENT Points from Mock DB / Metadata
            // We need to know how many points were redeemed to subtract them from the Balance
            // but NOT from the Level calculation.
            let spentPoints = 0;
            if (currentUser && (currentUser as any).user_metadata?.spentPoints) {
                spentPoints = (currentUser as any).user_metadata.spentPoints;
            } else {
                // Try local storage for mock (as we updated it there in handleVerifyOtp)
                const storedUsersPersistence = localStorage.getItem('nagarSevaMockDB_Users');
                if (storedUsersPersistence) {
                    const users = JSON.parse(storedUsersPersistence);
                    const found = users.find((u: any) => u.id === currentUser.id);
                    if (found && found.spentPoints) {
                        spentPoints = found.spentPoints;
                    }
                }
            }

            // 3. Determine Current Balance (Spendable)
            // Balance = Lifetime - Spent
            const currentBalance = Math.max(0, lifetimeEarnings - spentPoints);

            setCalculatedPoints(currentBalance); // Update Balance Display
            setCurrentLevel(getLevel(lifetimeEarnings)); // Update Level based on LIFETIME earnings (won't drop)

            const userCerts = await certificateService.getMyCertificates();
            setCertificates(userCerts);

        } catch (error) {
            console.error("Error loading profile data", error);
        } finally {
            setLoading(false);
        }
    };

    const handleClaimCertificate = async (level: 'Bronze' | 'Silver' | 'Gold') => {
        if (!user) return;
        setClaiming(level);
        try {
            const cert = await certificateService.claimCertificate(level, stats.totalReports);
            if (cert && cert.code) {
                toast({
                    title: "Certificate Issued",
                    description: `${cert.title} has been generated.`,
                });
                await emailService.sendCertificateEmail(user.email, user.name, cert);
                loadData();
            }
        } catch (error: any) {
            console.error("Claim Error:", error);
            toast({
                title: "Error",
                description: error.message || "Failed to generate certificate.",
                variant: "destructive"
            });
        } finally {
            setClaiming(null);
        }
    };

    const handleDemoGeneration = () => {
        if (!user) return;
        const demoCert: CivicCertificate = {
            id: 'demo-' + Date.now(),
            certificate_type: 'Honorary Civic Mentor',
            issue_date: new Date().toISOString(),
            verification_code: 'DEMO-TEACHER-VIEW',
            user_id: user.id,
            report_count_at_issue: 0,
            points_at_issue: 0
        };
        setCertificates(prev => [demoCert, ...prev]);
        toast({
            title: "Demo Certificate Generated",
            description: "A demo certificate has been added for presentation purposes.",
        });
    };

    if (loading || !user) {
        return <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>;
    }

    const progressPercent = Math.min(100, Math.max(0, ((calculatedPoints - currentLevel.min) / (currentLevel.max - currentLevel.min)) * 100));

    return (
        <div className="min-h-screen bg-background font-sans text-foreground pb-12">
            {/* Header */}
            <header className="bg-card border-b border-border sticky top-0 z-10">
                <div className="container mx-auto max-w-7xl px-4 md:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm" onClick={() => navigate('/app')} className="text-muted-foreground hover:text-foreground px-0 hover:bg-transparent">
                            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
                        </Button>
                        <div className="h-6 w-px bg-border"></div>
                        <h1 className="text-lg font-medium text-card-foreground">Citizen Profile</h1>
                    </div>
                </div>
            </header>

            <main className="container mx-auto max-w-7xl p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* LEFT SIDEBAR: PROFILE DETAILS */}
                <div className="lg:col-span-4 space-y-6">
                    <Card className="border-border shadow-sm">
                        <CardHeader className="pb-4">
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-lg font-semibold text-card-foreground flex items-center gap-2">
                                    <UserIcon className="w-5 h-5 text-muted-foreground" />
                                    Profile Details
                                </CardTitle>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                    <Edit className="w-4 h-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Avatar / Name */}
                            <div className="flex flex-col items-center text-center pb-6 border-b border-border">
                                <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-4 border-2 border-card shadow-sm">
                                    <UserIcon className="w-10 h-10" />
                                </div>
                                <h2 className="text-xl font-bold text-foreground">{user.name}</h2>
                                <p className="text-sm text-muted-foreground uppercase tracking-wide mt-1">{user.role}</p>
                                {user.role === 'citizen' && (
                                    <Badge variant="secondary" className="mt-3 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 border-emerald-200 dark:border-emerald-800">
                                        <CheckCircle2 className="w-3 h-3 mr-1" /> Verified Citizen
                                    </Badge>
                                )}
                            </div>

                            {/* Contact Info */}
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Full Name</label>
                                    <div className="text-sm font-medium text-foreground bg-muted/50 p-2.5 rounded border border-border">
                                        {user.name}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Email Address</label>
                                    <div className="flex items-center text-sm font-medium text-foreground bg-muted/50 p-2.5 rounded border border-border">
                                        <Mail className="w-4 h-4 mr-2 text-muted-foreground" />
                                        {user.email || "No email linked"}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Phone Number</label>
                                    <div className="flex items-center text-sm font-medium text-foreground bg-muted/50 p-2.5 rounded border border-border">
                                        <Phone className="w-4 h-4 mr-2 text-muted-foreground" />
                                        {user.phone || "+91 --"}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2">
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    <Info className="w-3 h-3 inline mr-1" />
                                    These details reflect your identity as verified at the time of sign-up. To update sensitive information, please visit the municipal office.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Stats Summary (Compact for Sidebar) */}
                    <Card className="border-border shadow-sm bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 text-white">
                        <CardContent className="p-6">
                            <h3 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-4">Lifetime Impact</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-3xl font-bold">{stats.totalReports}</div>
                                    <div className="text-xs text-slate-300 mt-1">Total Reports</div>
                                </div>
                                <div>
                                    <div className="text-3xl font-bold text-emerald-400">{stats.resolvedReports}</div>
                                    <div className="text-xs text-slate-300 mt-1">Issues Resolved</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* RIGHT MAIN AREA: POINTS & GAMIFICATION */}
                <div className="lg:col-span-8 space-y-6">

                    {/* 1. Point Dashboard */}
                    <Card className="border-border shadow-sm overflow-hidden relative">
                        {/* Decorative Background for Level */}
                        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                            <Shield className="w-64 h-64 rotate-12" />
                        </div>

                        <CardHeader className="pb-2">
                            <CardTitle className="text-xl text-card-foreground">Civic Point Dashboard</CardTitle>
                        </CardHeader>

                        <CardContent className="space-y-8">
                            {/* Main Score & Level */}
                            <div className="flex flex-col md:flex-row items-center md:items-end justify-between gap-6 pb-6 border-b border-border">
                                <div>
                                    <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Current Balance</div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-5xl font-bold text-blue-600 dark:text-blue-400">{calculatedPoints}</span>
                                        <span className="text-lg text-muted-foreground font-medium">pts</span>
                                    </div>
                                </div>

                                <div className="flex-1 w-full md:w-auto md:max-w-xs">
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="font-semibold text-foreground">{currentLevel.name}</span>
                                        <span className="text-muted-foreground">{currentLevel.max} pts to next level</span>
                                    </div>
                                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-600 dark:bg-blue-500 rounded-full transition-all duration-1000 ease-out"
                                            style={{ width: `${progressPercent}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>

                            {/* Point Breakdown Grid */}
                            <div>
                                <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-muted-foreground" />
                                    Live Point Breakdown
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    <PointCard
                                        icon="📸"
                                        label="Photo Reports"
                                        points={pointsBreakdown?.photoPoints || 0}
                                        color="bg-purple-50 text-purple-700 border-purple-100"
                                    />
                                    <PointCard
                                        icon="✅"
                                        label="Resolutions"
                                        points={pointsBreakdown?.resolutionPoints || 0}
                                        color="bg-emerald-50 text-emerald-700 border-emerald-100"
                                    />
                                    <PointCard
                                        icon="👥"
                                        label="Validations"
                                        points={pointsBreakdown?.validationPoints || 0}
                                        color="bg-blue-50 text-blue-700 border-blue-100"
                                    />
                                    <PointCard
                                        icon="💬"
                                        label="Feedback"
                                        points={pointsBreakdown?.feedbackPoints || 0}
                                        color="bg-pink-50 text-pink-700 border-pink-100"
                                    />
                                    <PointCard
                                        icon="📝"
                                        label="Documentation"
                                        points={pointsBreakdown?.documentationPoints || 0}
                                        color="bg-slate-50 text-slate-700 border-slate-100"
                                    />
                                    <PointCard
                                        icon="🎯"
                                        label="Consistency"
                                        points={pointsBreakdown?.monthlyBonus || 0}
                                        color="bg-amber-50 text-amber-700 border-amber-100"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 2. Tax Benefits Section */}
                    <Card className="border-gray-200 shadow-sm bg-indigo-50/50 mb-6">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-lg text-indigo-900 flex items-center gap-2">
                                <IndianRupee className="w-5 h-5" />
                                Tax Benefit Program
                            </CardTitle>
                            <Badge className="bg-indigo-600">Beta</Badge>
                        </CardHeader>
                        <CardContent>
                            {!taxBill ? (
                                <div className="space-y-4">
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <Label htmlFor="taxId" className="text-xs uppercase text-indigo-700 font-bold tracking-wider">Property Tax ID</Label>
                                            <div className="flex mt-1.5 gap-2">
                                                <Input
                                                    id="taxId"
                                                    placeholder="VMS-2025-001"
                                                    value={taxIdInput}
                                                    onChange={(e) => setTaxIdInput(e.target.value)}
                                                    className="border-indigo-200 focus:ring-indigo-500 bg-white text-slate-900 placeholder:text-slate-400"
                                                />
                                                <Button onClick={handleFetchTax} disabled={loadingTax} className="bg-indigo-700 hover:bg-indigo-800">
                                                    {loadingTax ? <Loader2 className="w-4 h-4 animate-spin" /> : "Fetch Bill"}
                                                </Button>
                                            </div>
                                            <p className="text-[10px] text-indigo-500 mt-1">Try: VMS-2025-001</p>
                                        </div>
                                    </div>

                                    {/* Transaction History Mini-View */}
                                    <div className="pt-4 border-t border-indigo-200/50">
                                        <p className="text-xs font-semibold text-indigo-800 mb-2">Recent Savings</p>
                                        <div className="space-y-2">
                                            {taxService.getTransactionHistory().length === 0 ? (
                                                <p className="text-xs text-indigo-400 italic">No savings yet. Pay your first bill!</p>
                                            ) : (
                                                taxService.getTransactionHistory().slice(0, 3).map(txn => (
                                                    <div key={txn.id} className="flex justify-between items-center text-xs bg-white p-2 rounded border border-indigo-100">
                                                        <span className="font-mono text-indigo-900">{txn.taxId}</span>
                                                        <span className="text-green-600 font-bold">- ₹{txn.discountAmount}</span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="animate-in slide-in-from-right-4 duration-300 space-y-4">
                                    <div className="bg-white p-4 rounded-lg border border-indigo-100 grid grid-cols-2 gap-y-2 text-sm shadow-sm">
                                        <div className="col-span-2 flex justify-between border-b border-indigo-50 pb-2 mb-2">
                                            <span className="font-bold text-indigo-900">{taxBill.propertyName}</span>
                                            <Badge variant="outline" className="text-[10px] border-indigo-200 text-indigo-700">{taxBill.billingPeriod}</Badge>
                                        </div>
                                        <span className="text-slate-500">Bill Amount:</span>
                                        <span className="text-right font-medium">₹ {taxBill.amount}</span>
                                        <span className="text-slate-500">Your Points:</span>
                                        <span className="text-right font-medium text-amber-600">{calculatedPoints} pts</span>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex justify-between text-xs font-semibold text-indigo-800">
                                            <span>Redeem Points</span>
                                            <span>{redeemPoints} pts = ₹ {redeemPoints * 10} Off</span>
                                        </div>
                                        <Slider
                                            value={[redeemPoints]}
                                            onValueChange={(val) => setRedeemPoints(val[0])}
                                            max={Math.min(calculatedPoints, Math.floor(taxBill.amount / 10))}
                                            step={1}
                                            className="py-2"
                                        />
                                        <div className="flex justify-between items-center bg-indigo-900 text-white p-3 rounded-lg shadow-md">
                                            <div className="text-xs opacity-80">Final Payable</div>
                                            <div className="text-xl font-bold">₹ {Math.max(0, taxBill.amount - (redeemPoints * 10))}</div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button variant="outline" className="flex-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50" onClick={() => setTaxBill(null)}>Cancel</Button>
                                        <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white shadow-green-200" onClick={() => {
                                            setOtpMode('PAY');
                                            setShowOtpDialog(true);
                                        }}>Pay & Save</Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* OTP Dialog */}
                    <Dialog open={showOtpDialog} onOpenChange={setShowOtpDialog}>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>{otpMode === 'FETCH' ? 'Verify Identity' : 'Secure Payment Verification'}</DialogTitle>
                                <DialogDescription>
                                    {otpMode === 'FETCH'
                                        ? "Enter OTP to access your private tax records."
                                        : "Enter OTP to confirm payment and point redemption."}
                                    <br />
                                    <span className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">Demo: 1234</span>
                                </DialogDescription>
                            </DialogHeader>
                            <div className="flex justify-center py-4">
                                <Input
                                    className="text-center text-2xl tracking-[0.5em] h-12 w-48 font-mono border-slate-300 focus:ring-slate-800"
                                    placeholder="••••"
                                    maxLength={4}
                                    value={otpInput}
                                    onChange={(e) => setOtpInput(e.target.value)}
                                />
                            </div>
                            <DialogFooter>
                                <Button onClick={handleVerifyOtp} disabled={loadingTax || otpInput.length !== 4} className="w-full bg-slate-900">
                                    {loadingTax ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : (otpMode === 'FETCH' ? "Verify" : "Pay & Download")}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* 2. My Certificates (Retained) */}
                    <Card className="border-border shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-lg text-card-foreground">My Certificates</CardTitle>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleDemoGeneration}
                                className="text-xs text-muted-foreground border-dashed border-border hover:text-foreground"
                            >
                                + Demo Cert
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border border-border overflow-hidden">
                                {certificates.length === 0 ? (
                                    <div className="p-8 text-center text-muted-foreground text-sm bg-muted/50">
                                        <p>No certificates issued yet.</p>
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50 hover:bg-muted/50 text-xs uppercase tracking-wider">
                                                <TableHead>Certificate ID</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead className="text-right">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {certificates.map((cert) => (
                                                <TableRow key={cert.id}>
                                                    <TableCell className="font-mono text-xs text-muted-foreground">{cert.verification_code}</TableCell>
                                                    <TableCell className="font-medium text-foreground">{cert.certificate_type}</TableCell>
                                                    <TableCell className="text-right">
                                                        <CertificateDialog cert={cert} userName={user.name} />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* 3. Available Incentives (Retained but simplified) */}
                    <div>
                        <h4 className="text-sm font-semibold text-foreground mb-4">Milestone Rewards</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <SimpleIncentiveItem
                                title="Bronze Contributor"
                                pointsRequired={60}
                                userPoints={calculatedPoints}
                                isClaimed={certificates.some(c => c.certificate_type.includes('Bronze'))}
                                onClaim={() => handleClaimCertificate('Bronze')}
                                loading={claiming === 'Bronze'}
                            />
                            <SimpleIncentiveItem
                                title="Silver Contributor"
                                pointsRequired={120}
                                userPoints={calculatedPoints}
                                isClaimed={certificates.some(c => c.certificate_type.includes('Silver'))}
                                onClaim={() => handleClaimCertificate('Silver')}
                                loading={claiming === 'Silver'}
                            />
                            <SimpleIncentiveItem
                                title="Gold Contributor"
                                pointsRequired={300}
                                userPoints={calculatedPoints}
                                isClaimed={certificates.some(c => c.certificate_type.includes('Gold'))}
                                onClaim={() => handleClaimCertificate('Gold')}
                                loading={claiming === 'Gold'}
                            />
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
};

// Sub-components

const PointCard = ({ icon, label, points, color }: { icon: string, label: string, points: number, color: string }) => (
    <div className={`p-4 rounded-lg flex items-center justify-between border ${color}`}>
        <div className="flex items-center gap-3">
            <span className="text-xl">{icon}</span>
            <span className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</span>
        </div>
        <div className="text-lg font-bold">
            {points > 0 ? "+" : ""}{points}
        </div>
    </div>
);

const SimpleIncentiveItem = ({ title, pointsRequired, userPoints, isClaimed, onClaim, loading }: any) => {
    const isEligible = userPoints >= pointsRequired;

    return (
        <div className={`bg-card border rounded-lg p-4 flex flex-col justify-between h-full transition-shadow ${isEligible && !isClaimed ? 'border-border shadow-sm hover:shadow-md' : 'border-border opacity-80'}`}>
            <div>
                <div className="flex justify-between items-start mb-2">
                    <span className="text-sm font-bold text-card-foreground">{title}</span>
                    {isClaimed && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                </div>
                <div className="text-xs text-muted-foreground mb-4 font-mono">REQ: {pointsRequired} PTS</div>
            </div>

            {isClaimed ? (
                <div className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 border border-emerald-100 dark:border-emerald-800 rounded py-2 text-center font-medium">
                    Issued
                </div>
            ) : isEligible ? (
                <Button
                    onClick={onClaim}
                    disabled={loading}
                    variant="default"
                    className="w-full h-8 text-xs bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900"
                >
                    {loading ? '...' : 'Claim Reward'}
                </Button>
            ) : (
                <div className="text-xs text-muted-foreground bg-muted/50 border border-border rounded py-2 text-center flex items-center justify-center gap-1.5">
                    Locked
                </div>
            )}
        </div>
    );
};

const CertificateDialog = ({ cert, userName }: { cert: CivicCertificate, userName: string }) => {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-blue-600">
                    <FileText className="w-4 h-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl p-0 overflow-hidden bg-card">
                <div className="p-12 border-2 border-foreground m-4 bg-card text-card-foreground">

                    <div className="text-center mb-8 pb-4 border-b border-border">
                        <h2 className="text-2xl font-bold uppercase tracking-wide text-foreground mb-1">Civic Incentive Certificate</h2>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Issued under the Civic Issue Reporting System</p>
                    </div>

                    <div className="text-center space-y-6 my-10 relative">
                        {/* QR Code positioned absolutely or in layout */}

                        <p className="text-foreground text-lg">This is to certify that</p>

                        <h3 className="text-3xl font-bold text-foreground">{userName}</h3>

                        <div className="max-w-xl mx-auto text-foreground leading-relaxed text-base space-y-4">
                            <p>
                                has verified civic contributions by reporting public issues
                                effectively. This document serves as an official acknowledgment
                                of civic participation.
                            </p>
                        </div>

                        <div className="mt-8 inline-block px-6 py-2 border border-border rounded-sm bg-muted">
                            <span className="text-muted-foreground text-xs uppercase mr-2 tracking-widest">Level</span>
                            <span className="font-bold text-foreground text-lg">{cert.certificate_type}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-12 mt-12 pt-8 border-t border-border text-sm">
                        <div className="text-left space-y-2">
                            <div className="mb-4">
                                <QRCodeSVG
                                    value={`${window.location.origin}/verify-certificate/${cert.verification_code}`}
                                    size={80}
                                    level="M"
                                    includeMargin={false}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground uppercase tracking-widest">Verification ID</p>
                            <p className="font-mono text-foreground">{cert.verification_code}</p>
                        </div>

                        <div className="text-right space-y-1 flex flex-col justify-end">
                            <div className="h-12 w-32 ml-auto mb-2 border-b border-border"></div>
                            <p className="font-bold text-foreground uppercase text-xs tracking-wider">Authorized Signatory</p>
                            <p className="text-muted-foreground text-xs">Civic Administration</p>
                        </div>
                    </div>

                    <div className="mt-8 pt-6 flex justify-center print:hidden border-t border-border bg-muted -mx-12 -mb-12 p-6">
                        <Button className="gap-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200" onClick={() => window.print()}>
                            <Download className="w-4 h-4" /> Download Official Record
                        </Button>
                    </div>

                </div>
            </DialogContent>
        </Dialog>
    );
};

export default Profile;
