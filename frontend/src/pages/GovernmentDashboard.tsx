import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import { Download, Filter, ShieldCheck, BarChart3, PieChart as PieChartIcon, TrendingUp, Clock, CheckCircle, XCircle, AlertTriangle, MessageSquare, Star } from "lucide-react";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Pie, PieChart, XAxis, YAxis, Cell } from "recharts";
import { reportStorage, CivicReport } from "@/lib/reportStorage";
import { feedbackService, Feedback } from "@/lib/feedbackService";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import GovernmentTopBar from "@/components/GovernmentTopBar";

const AREAS = ["Alkapuri", "Akota", "Gotri", "Manjalpur", "Vasna Bhayli Main Road", "Old Padra Road"];
const ISSUE_TYPES = ["Potholes", "Garbage", "Street Light", "Waterlogging"];

const GovernmentDashboard = () => {
  const { toast } = useToast();
  const [map, setMap] = useState<L.Map | null>(null);
  const [filters, setFilters] = useState({ area: "All", issue: "All", status: "All", severity: "All" });
  const [reports, setReports] = useState<CivicReport[]>([]);
  const [showHeat, setShowHeat] = useState(false);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean, id: string | null }>({ open: false, id: null });
  const [reviewDialog, setReviewDialog] = useState<{ open: boolean, report: CivicReport | null }>({ open: false, report: null });
  const [rejectNotes, setRejectNotes] = useState("");
  const [autoAssignRules, setAutoAssignRules] = useState<any[]>([]);

  // Feedback state
  const [currentView, setCurrentView] = useState<'reports' | 'feedback'>('reports');
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [feedbackStats, setFeedbackStats] = useState<any>(null);

  useEffect(() => {
    loadReports();
    const unsubscribe = reportStorage.subscribe(() => {
      loadReports();
    });

    // Polling fallback: Auto-refresh every 5 seconds
    // This ensures data is valid even if Supabase Realtime isn't enabled on the table
    const interval = setInterval(() => {
      loadReports();
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // Load feedback when view changes to feedback
  useEffect(() => {
    if (currentView === 'feedback') {
      loadFeedback();
    }
  }, [currentView]);

  const loadFeedback = async () => {
    const allFeedback = await feedbackService.getAllFeedback();
    const stats = await feedbackService.getFeedbackStats();
    setFeedbackList(allFeedback);
    setFeedbackStats(stats);
  };

  const loadReports = async () => {
    const data = await reportStorage.getAllReports();
    const processed = applyAutoAssignRules(data);
    setReports(processed);
  };

  const applyAutoAssignRules = (currentReports: CivicReport[]) => {
    let updated = false;
    const processed = currentReports.map(r => {
      if (r.status !== 'reported') return r;

      const rule = autoAssignRules.find(rule =>
        (rule.filters.area === 'All' || r.location.address.includes(rule.filters.area)) &&
        (rule.filters.issue === 'All' || r.issueType === rule.filters.issue)
      );

      if (rule) {
        updated = true;
        reportStorage.assignIncident(r.id, rule.assignTo, rule.assignToName);
        return { ...r, status: 'assigned' as const, assignedTo: rule.assignToName, assignedDeptId: rule.assignTo };
      }
      return r;
    });
    return processed;
  };

  const filtered = useMemo(() => {
    return reports.filter(r =>
      (filters.area === 'All' || r.location.address.includes(filters.area)) &&
      (filters.issue === 'All' || r.issueType === filters.issue) &&
      (filters.status === 'All' || r.status === filters.status) &&
      (filters.severity === 'All' || r.severity === filters.severity)
    );
  }, [reports, filters]);

  useEffect(() => {
    const m = L.map('gov-map', { zoomControl: true, scrollWheelZoom: true }).setView([22.3072, 73.1812], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(m);
    setMap(m);
    
    // Handle window resize
    const handleResize = () => m.invalidateSize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      m.remove();
    };
  }, []);

  useEffect(() => {
    if (!map) return;
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Circle || layer instanceof L.LayerGroup || (layer as any)._leaflet_id && !(layer as any)._url) {
        map.removeLayer(layer);
      }
    });

    // Use marker cluster for better performance
    const markerCluster = L.markerClusterGroup({
      chunkedLoading: true,
      showCoverageOnHover: false,
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 16,
    });
    
    const heatLayer = L.layerGroup();
    const bounds = L.latLngBounds([]);
    
    filtered.forEach(r => {
      const color = r.issueType === 'Potholes' ? '#ef4444' : r.issueType === 'Garbage' ? '#f59e0b' : r.issueType === 'Street Light' ? '#3b82f6' : '#14b8a6';
      const statusLabel = r.status === 'resolved' ? 'Resolved' : r.status === 'in-progress' ? 'In Progress' : r.status === 'pending-review' ? 'Pending Review' : r.status === 'assigned' ? 'Assigned' : 'New';
      const statusColor = r.status === 'resolved' ? '#059669' : r.status === 'in-progress' || r.status === 'pending-review' ? '#D97706' : '#DC2626';
      const severity = r.severity || 'medium';
      const department = r.assignedTo || 'Not Assigned';
      
      const icon = L.divIcon({ 
        html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};box-shadow:0 0 0 4px ${color}33;border:2px solid white;transition:transform 0.15s ease;" class="auth-marker"></div>`, 
        className: 'pulse-marker',
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });
      
      const lat = r.location.latitude;
      const lng = r.location.longitude;
      bounds.extend([lat, lng]);
      
      const marker = L.marker([lat, lng], { icon })
        // Hover tooltip - lightweight info preview
        .bindTooltip(`
          <div style="font-size:11px;min-width:140px;">
            <div style="font-weight:600;margin-bottom:4px;">${r.issueType}</div>
            <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:4px;">
              <span style="padding:2px 6px;border-radius:4px;font-size:9px;background:${statusColor}20;color:${statusColor};">${statusLabel}</span>
              <span style="padding:2px 6px;border-radius:4px;font-size:9px;background:#64748b20;color:#64748b;text-transform:capitalize;">${severity}</span>
            </div>
            <div style="font-size:9px;color:#64748b;">Dept: ${department}</div>
          </div>
        `, {
          direction: 'top',
          offset: [0, -10],
          opacity: 0.95,
          className: 'gov-map-tooltip'
        })
        // Click popup - detailed view
        .bindPopup(`
          <div style="min-width:180px;">
            <b>${r.issueType}</b><br/>
            <span style="color:#64748b;font-size:11px;">Status: ${statusLabel}</span><br/>
            <span style="color:#64748b;font-size:11px;">Severity: ${severity}</span><br/>
            <span style="color:#64748b;font-size:11px;">Dept: ${department}</span>
          </div>
        `);
      
      markerCluster.addLayer(marker);
      
      // Heatmap circles
      if (showHeat) {
        const intensity = severity === 'high' ? 0.6 : severity === 'medium' ? 0.4 : 0.2;
        const radius = severity === 'high' ? 400 : severity === 'medium' ? 300 : 200;
        const circle = L.circle([lat, lng], { color, fillColor: color, fillOpacity: intensity, radius, weight: 1 });
        heatLayer.addLayer(circle);
      }
    });

    markerCluster.addTo(map);
    if (showHeat) heatLayer.addTo(map);
    
    // Auto-fit bounds if we have markers
    if (bounds.isValid() && filtered.length > 0) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
    }
  }, [map, filtered, showHeat]);

  const assignOne = async (id: string) => {
    const dept = window.prompt('Assign to department (e.g., road_dept, sanitation_dept):');
    if (!dept) return;
    const deptNameMap: Record<string, string> = {
      'road_dept': 'Road Department',
      'sanitation_dept': 'Sanitation Department',
      'electric_dept': 'Electrical Department',
      'drainage_dept': 'Drainage Department',
      'green_dept': 'Green Department'
    };
    await reportStorage.assignIncident(id, dept, deptNameMap[dept] || dept);
    toast({ title: "Assigned", description: `Incident assigned to ${deptNameMap[dept] || dept}` });
  };

  const bulkAssign = async () => {
    const dept = window.prompt('Assign ALL filtered "Reported" incidents to (e.g., road_dept):');
    if (!dept) return;

    const deptNameMap: Record<string, string> = {
      'road_dept': 'Road Department',
      'sanitation_dept': 'Sanitation Department',
      'electric_dept': 'Electrical Department',
      'drainage_dept': 'Drainage Department',
      'green_dept': 'Green Department'
    };

    const toAssign = filtered.filter(r => r.status === 'reported');
    let count = 0;
    for (const r of toAssign) {
      await reportStorage.assignIncident(r.id, dept, deptNameMap[dept] || dept);
      count++;
    }
    toast({ title: "Bulk Assignment", description: `Assigned ${count} incidents to ${deptNameMap[dept] || dept}` });
  };

  const autoAssign = () => {
    if (filters.area === 'All' && filters.issue === 'All') {
      alert('Please select at least one filter (Area or Issue) to create a rule.');
      return;
    }
    const dept = window.prompt('Auto-assign future matches to (e.g., road_dept):');
    if (!dept) return;

    const deptNameMap: Record<string, string> = {
      'road_dept': 'Road Department',
      'sanitation_dept': 'Sanitation Department',
      'electric_dept': 'Electrical Department',
      'drainage_dept': 'Drainage Department',
      'green_dept': 'Green Department'
    };

    const newRule = {
      id: Date.now(),
      filters: { ...filters },
      assignTo: dept,
      assignToName: deptNameMap[dept] || dept
    };

    setAutoAssignRules(prev => [...prev, newRule]);
    toast({ title: "Rule Created", description: `Auto-assigning ${filters.issue} in ${filters.area} to ${newRule.assignToName}` });
    loadReports();
  };

  const verifyResolution = async (id: string) => {
    await reportStorage.verifyResolution(id);
    toast({ title: "Verified", description: "Incident marked as Resolved." });
  };

  const rejectResolution = async () => {
    if (rejectDialog.id) {
      await reportStorage.rejectResolution(rejectDialog.id, rejectNotes);
      toast({ title: "Rejected", description: "Incident sent back to department." });
      setRejectDialog({ open: false, id: null });
      setRejectNotes("");
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background/90 border border-border p-2 rounded shadow-lg text-xs">
          <p className="font-bold">{`${label}`}</p>
          <p>{`Reports: ${payload[0].value}`}</p>
        </div>
      );
    }
    return null;
  };

  const pendingCount = reports.filter(r => r.status === 'pending-review').length;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <GovernmentTopBar />

      {/* Dashboard Navigation Bar */}
      <div className="border-b border-border/40 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 sticky top-0 z-40">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2 mr-4">
              <div className="w-8 h-8 rounded-lg bg-civic-blue/10 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-civic-blue" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">City Admin</h1>
                <p className="text-xs text-muted-foreground">Central Command</p>
              </div>
            </div>

            <nav className="flex items-center space-x-2">
              <Button
                variant={currentView === 'reports' && filters.status === 'All' ? "secondary" : "ghost"}
                size="sm"
                onClick={() => {
                  setCurrentView('reports');
                  setFilters({ ...filters, status: 'All' });
                }}
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Overview
              </Button>
              <Button
                variant={currentView === 'reports' && filters.status === 'pending-review' ? "secondary" : "ghost"}
                size="sm"
                onClick={() => {
                  setCurrentView('reports');
                  setFilters({ ...filters, status: 'pending-review' });
                }}
                className={currentView === 'reports' && filters.status === 'pending-review' ? "bg-purple-100 text-purple-900 hover:bg-purple-200" : "text-muted-foreground hover:text-purple-900"}
              >
                <div className="relative flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Pending Reviews
                  {pendingCount > 0 && (
                    <Badge className="ml-2 h-5 min-w-[1.25rem] px-1 bg-purple-600 hover:bg-purple-700 text-white border-none">
                      {pendingCount}
                    </Badge>
                  )}
                </div>
              </Button>
              <Button
                variant={currentView === 'feedback' ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setCurrentView('feedback')}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Feedback
                {feedbackStats && feedbackStats.total > 0 && (
                  <Badge className="ml-2 h-5 min-w-[1.25rem] px-1">
                    {feedbackStats.total}
                  </Badge>
                )}
              </Button>
            </nav>
          </div>

          <div className="flex items-center space-x-2">
            <div className="text-sm text-muted-foreground mr-2">
              <Clock className="w-3 h-3 inline mr-1" />
              Live Updates
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 container mx-auto p-4 grid grid-cols-12 gap-4">
        <aside className="col-span-12 md:col-span-3 space-y-4">
          <Card className="p-4 bg-card/50 backdrop-blur-sm border-border/50">
            <div className="flex items-center mb-3"><Filter className="w-4 h-4 mr-2" /><h2 className="font-semibold">Filters</h2></div>
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Area</div>
                <select className="w-full border rounded-md p-2 bg-background" value={filters.area} onChange={(e) => setFilters({ ...filters, area: e.target.value })}>
                  <option>All</option>
                  {AREAS.map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Issue Type</div>
                <select className="w-full border rounded-md p-2 bg-background" value={filters.issue} onChange={(e) => setFilters({ ...filters, issue: e.target.value })}>
                  <option>All</option>
                  {ISSUE_TYPES.map(i => <option key={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Status</div>
                <select className="w-full border rounded-md p-2 bg-background" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                  {['All', 'reported', 'assigned', 'in-progress', 'pending-review', 'resolved'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Severity</div>
                <select className="w-full border rounded-md p-2 bg-background" value={filters.severity} onChange={(e) => setFilters({ ...filters, severity: e.target.value })}>
                  {['All', 'low', 'medium', 'high'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
            </div>
          </Card>

          <Card className="p-4 space-y-2 bg-card/50 backdrop-blur-sm border-border/50">
            <div className="flex items-center mb-1"><ShieldCheck className="w-4 h-4 mr-2" /><h2 className="font-semibold">Controls</h2></div>
            <Button variant="outline" className="w-full justify-start" onClick={bulkAssign}>
              <CheckCircle className="w-4 h-4 mr-2" /> Bulk Assign
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={autoAssign}>
              <Clock className="w-4 h-4 mr-2" /> Create Auto-Rule
            </Button>
            {autoAssignRules.length > 0 && (
              <div className="text-xs text-muted-foreground mt-2">
                {autoAssignRules.length} active rule(s)
              </div>
            )}
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50 mt-2">
              <span>Heatmap</span>
              <input type="checkbox" checked={showHeat} onChange={(e) => setShowHeat(e.target.checked)} />
            </div>
          </Card>
        </aside>

        <main className="col-span-12 md:col-span-6 space-y-4">
          <Card className="p-2 bg-card/50 backdrop-blur-sm border-border/50">
            <div id="gov-map" className="w-full h-[320px] rounded-md" />
          </Card>
          <Card className="p-0 overflow-hidden bg-card/50 backdrop-blur-sm border-border/50">
            <div className="overflow-auto max-h-[340px]">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-background/90 backdrop-blur border-b z-10">
                  <tr>
                    {['ID', 'Photo', 'Issue', 'Area', 'Status', 'Assigned To', 'Actions'].map(h => (
                      <th key={h} className="text-left p-2 whitespace-nowrap font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                      <td className="p-2 font-mono text-xs">{r.id}</td>
                      <td className="p-2">
                        {r.photoUrls && r.photoUrls.length > 0 ? (
                          <div className="w-10 h-10 rounded overflow-hidden bg-muted">
                            <img src={r.photoUrls[0]} alt="Thumb" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">No Img</div>
                        )}
                      </td>
                      <td className="p-2">{r.issueType}</td>
                      <td className="p-2 truncate max-w-[100px]" title={r.location.address}>{r.location.address}</td>
                      <td className="p-2">
                        <Badge variant={r.status === 'pending-review' ? 'destructive' : 'outline'} className="whitespace-nowrap">
                          {r.status}
                        </Badge>
                      </td>
                      <td className="p-2 text-xs">{r.assignedTo || '-'}</td>
                      <td className="p-2 space-x-1 flex items-center">
                        {r.status === 'reported' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => assignOne(r.id)}>Assign</Button>
                        )}
                        {r.status === 'pending-review' && (
                          <>
                            <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => verifyResolution(r.id)}>
                              <CheckCircle className="w-3 h-3 mr-1" /> Verify
                            </Button>
                            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => setRejectDialog({ open: true, id: r.id })}>
                              <XCircle className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                        {r.status === 'resolved' && (
                          <span className="text-green-500 text-xs flex items-center"><CheckCircle className="w-3 h-3 mr-1" /> Done</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </main>

        <aside className="col-span-12 md:col-span-3 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card/50 border border-border/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-foreground mb-1">{reports.length}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="bg-card/50 border border-border/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-green-500 mb-1">{reports.filter(r => r.status === 'resolved').length}</div>
              <div className="text-xs text-muted-foreground">Resolved</div>
            </div>
          </div>

          <div className="bg-card/50 border border-border/50 rounded-xl p-4">
            <h3 className="font-semibold text-sm mb-4 flex items-center"><PieChartIcon className="w-4 h-4 mr-2" /> Issue Types</h3>
            <div className="h-40">
              <ChartContainer config={{}}>
                <PieChart>
                  <Pie
                    dataKey="value"
                    data={ISSUE_TYPES.map((type, index) => ({
                      name: type,
                      value: filtered.filter(r => r.issueType === type).length,
                      fill: ['#ef4444', '#10b981', '#3b82f6', '#14b8a6'][index % 4]
                    }))}
                    cx="50%" cy="50%" innerRadius={25} outerRadius={60} paddingAngle={2}
                  >
                    {ISSUE_TYPES.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={['#ef4444', '#10b981', '#3b82f6', '#14b8a6'][index % 4]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={CustomTooltip} />
                </PieChart>
              </ChartContainer>
            </div>
          </div>
        </aside>

        <Dialog open={rejectDialog.open} onOpenChange={(open) => setRejectDialog({ open, id: open ? rejectDialog.id : null })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Resolution</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Textarea
                placeholder="Reason for rejection..."
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialog({ open: false, id: null })}>Cancel</Button>
              <Button variant="destructive" onClick={rejectResolution}>Reject & Reassign</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Review Dialog */}
        <Dialog open={reviewDialog.open} onOpenChange={(open) => setReviewDialog({ ...reviewDialog, open })}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Review Resolution</DialogTitle>
            </DialogHeader>
            {reviewDialog.report && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Issue</h4>
                    <p className="text-sm font-semibold">{reviewDialog.report.issueType}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Department</h4>
                    <p className="text-sm">{reviewDialog.report.assignedTo}</p>
                  </div>
                </div>

                <div className="bg-muted p-3 rounded-md">
                  <h4 className="text-sm font-medium text-foreground mb-2">Resolution Notes</h4>
                  <p className="text-sm text-muted-foreground">
                    {reviewDialog.report.resolutionPayload?.notes || "No notes provided."}
                  </p>
                </div>

                {reviewDialog.report.resolutionPayload?.resources && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Resources Used</h4>
                    <p className="text-sm">{reviewDialog.report.resolutionPayload.resources}</p>
                  </div>
                )}

                <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-4">
                  <Clock className="w-3 h-3" />
                  <span>Submitted on {reviewDialog.report.resolutionPayload?.timestamp ? new Date(reviewDialog.report.resolutionPayload.timestamp).toLocaleString() : 'N/A'}</span>
                </div>
              </div>
            )}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setReviewDialog({ open: false, report: null })}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setReviewDialog({ open: false, report: null });
                  setRejectDialog({ open: true, id: reviewDialog.report?.id || null });
                }}
              >
                Reject
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => {
                  if (reviewDialog.report) verifyResolution(reviewDialog.report.id);
                  setReviewDialog({ open: false, report: null });
                }}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Approve & Resolve
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default GovernmentDashboard;
