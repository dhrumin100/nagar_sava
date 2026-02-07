import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { authService, User } from "@/lib/authService";
import { reportStorage, CivicReport } from "@/lib/reportStorage";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Building2, LogOut, RefreshCw, MapPin, Calendar, CheckCircle, Clock, ArrowRightLeft } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DeptDashboard = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [user, setUser] = useState<User | null>(null);
    const [reports, setReports] = useState<CivicReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState<CivicReport | null>(null);
    const [resolutionForm, setResolutionForm] = useState({ resources: "", notes: "", duration: "" });
    const [submitting, setSubmitting] = useState(false);
    const [redirectDialog, setRedirectDialog] = useState<{ open: boolean, report: CivicReport | null }>({ open: false, report: null });
    const [selectedDept, setSelectedDept] = useState("");

    const DEPARTMENTS = [
        { id: 'road_dept', name: 'Road Department' },
        { id: 'sanitation_dept', name: 'Sanitation Department' },
        { id: 'electric_dept', name: 'Electrical Department' },
        { id: 'drainage_dept', name: 'Drainage Department' },
        { id: 'green_dept', name: 'Green Department' },
    ];

    useEffect(() => {
        const currentUser = authService.getCurrentUser();
        if (!currentUser || currentUser.role !== 'department') {
            navigate('/dept-signin');
            return;
        }
        setUser(currentUser);
        loadReports(currentUser.deptId!);
    }, [navigate]);

    const loadReports = async (deptId: string) => {
        setLoading(true);
        try {
            const data = await reportStorage.getReportsByDept(deptId);
            setReports(data);
        } catch (error) {
            console.error("Failed to load reports", error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        authService.logout();
        navigate('/dept-signin');
    };

    const handleResolveClick = (report: CivicReport) => {
        setSelectedReport(report);
        setResolutionForm({ resources: "", notes: "", duration: "" });
    };

    const handleSubmitResolution = async () => {
        if (!selectedReport || !resolutionForm.notes || !resolutionForm.resources || !resolutionForm.duration) return;

        setSubmitting(true);
        try {
            await reportStorage.submitResolution(selectedReport.id, resolutionForm);
            toast({ title: "Report Resolved", description: "Incident marked as Resolved. Emails sent." });
            setSelectedReport(null);
            if (user?.deptId) loadReports(user.deptId);
        } catch (error) {
            toast({ title: "Error", description: "Failed to submit resolution.", variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    };

    const handleRedirectSubmit = async () => {
        if (!redirectDialog.report || !selectedDept) return;

        const deptName = DEPARTMENTS.find(d => d.id === selectedDept)?.name || selectedDept;
        setSubmitting(true);
        try {
            await reportStorage.assignIncident(redirectDialog.report.id, selectedDept, deptName);
            toast({ title: "Report Redirected", description: `Incident moved to ${deptName}.` });
            setRedirectDialog({ open: false, report: null });
            setSelectedDept("");
            if (user?.deptId) loadReports(user.deptId);
        } catch (error) {
            toast({ title: "Error", description: "Failed to redirect report.", variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'assigned': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'in-progress': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'pending-review': return 'bg-purple-100 text-purple-800 border-purple-200';
            case 'resolved': return 'bg-green-100 text-green-800 border-green-200';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
                <div className="container flex h-16 items-center justify-between py-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-civic-orange/10 flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-civic-orange" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">{user.name}</h1>
                            <p className="text-xs text-muted-foreground">Service Dashboard</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <Button variant="ghost" size="sm" onClick={() => loadReports(user.deptId!)}>
                            <RefreshCw className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleLogout}>
                            <LogOut className="w-4 h-4 mr-2" /> Logout
                        </Button>
                    </div>
                </div>
            </header>

            <main className="flex-1 container py-6 space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold tracking-tight">Assigned Incidents</h2>
                    <Badge variant="outline" className="text-sm">
                        {reports.filter(r => r.status !== 'resolved').length} Active
                    </Badge>
                </div>

                {loading ? (
                    <div className="text-center py-12 text-muted-foreground">Loading tasks...</div>
                ) : reports.length === 0 ? (
                    <Card className="bg-muted/50 border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                            <CheckCircle className="w-12 h-12 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-semibold">All Caught Up!</h3>
                            <p className="text-muted-foreground">No pending incidents assigned to your department.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {reports.map((report) => (
                            <Card key={report.id} className="group hover:shadow-lg transition-all duration-300 border-border/50 bg-gradient-card">
                                <CardHeader className="pb-3">
                                    <div className="flex justify-between items-start">
                                        <Badge className={getStatusColor(report.status)} variant="outline">
                                            {report.status.replace('-', ' ').toUpperCase()}
                                        </Badge>
                                        {report.priority === 'high' && (
                                            <Badge variant="destructive" className="animate-pulse">HIGH PRIORITY</Badge>
                                        )}
                                    </div>
                                    {report.photoUrls && report.photoUrls.length > 0 && (
                                        <div className="mt-2 rounded-md overflow-hidden h-32 w-full bg-muted">
                                            <img
                                                src={report.photoUrls[0]}
                                                alt="Incident"
                                                className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                                            />
                                        </div>
                                    )}
                                    <CardTitle className="text-base font-semibold mt-2 line-clamp-1">
                                        {report.issueType}: {report.location.address}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                                        {report.description}
                                    </p>

                                    <div className="text-xs space-y-1 text-muted-foreground">
                                        <div className="flex items-center">
                                            <MapPin className="w-3 h-3 mr-1" /> {report.location.address}
                                        </div>
                                        <div className="flex items-center">
                                            <Calendar className="w-3 h-3 mr-1" /> {new Date(report.submittedAt).toLocaleDateString()}
                                        </div>
                                    </div>

                                    <div className="pt-2">
                                        {report.status === 'assigned' || report.status === 'in-progress' ? (
                                            <Button
                                                className="w-full bg-civic-green hover:bg-civic-green/90 text-white"
                                                onClick={() => handleResolveClick(report)}
                                            >
                                                <CheckCircle className="w-4 h-4 mr-2" /> Mark Complete
                                            </Button>
                                        ) : report.status === 'pending-review' ? (
                                            <Button disabled variant="outline" className="w-full">
                                                <Clock className="w-4 h-4 mr-2" /> Awaiting Verification
                                            </Button>
                                        ) : (
                                            <Button disabled variant="ghost" className="w-full text-green-600">
                                                <CheckCircle className="w-4 h-4 mr-2" /> Resolved
                                            </Button>
                                        )}
                                        {report.status !== 'resolved' && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full mt-2 text-xs"
                                                onClick={() => setRedirectDialog({ open: true, report })}
                                            >
                                                <ArrowRightLeft className="w-3 h-3 mr-1" /> Not our Dept? Redirect
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </main>

            <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Submit Resolution Report</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Resolution Duration</Label>
                            <Input
                                placeholder="e.g. 2 hours, 3 days"
                                value={resolutionForm.duration}
                                onChange={(e) => setResolutionForm({ ...resolutionForm, duration: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Resources Used</Label>
                            <Textarea
                                placeholder="e.g. 2 workers, 5kg cement, 1 truck"
                                value={resolutionForm.resources}
                                onChange={(e) => setResolutionForm({ ...resolutionForm, resources: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Completion Notes</Label>
                            <Textarea
                                placeholder="Describe the work done..."
                                value={resolutionForm.notes}
                                onChange={(e) => setResolutionForm({ ...resolutionForm, notes: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedReport(null)}>Cancel</Button>
                        <Button
                            onClick={handleSubmitResolution}
                            disabled={submitting || !resolutionForm.resources || !resolutionForm.notes || !resolutionForm.duration}
                            className="bg-civic-green text-white"
                        >
                            {submitting ? "Resolving..." : "Mark as Resolved"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={redirectDialog.open} onOpenChange={(open) => setRedirectDialog({ ...redirectDialog, open })}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Redirect Incident</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <Label>Select Responsible Department</Label>
                        <Select onValueChange={setSelectedDept} value={selectedDept}>
                            <SelectTrigger>
                                <SelectValue placeholder="Choose Department" />
                            </SelectTrigger>
                            <SelectContent>
                                {DEPARTMENTS.filter(d => d.id !== user.deptId).map(dept => (
                                    <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRedirectDialog({ open: false, report: null })}>Cancel</Button>
                        <Button
                            onClick={handleRedirectSubmit}
                            disabled={!selectedDept || submitting}
                        >
                            Redirect
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default DeptDashboard;
