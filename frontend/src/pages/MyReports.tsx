import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  Camera,
  TrendingUp,
  Filter,
  RefreshCw,
  AlertTriangle,
  Zap
} from "lucide-react";
import { reportStorage, CivicReport, addDemoData } from "@/lib/reportStorage";
import GovernmentTopBar from "@/components/GovernmentTopBar";
import { useAuth } from "@/contexts/AuthProvider";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { feedbackService, Feedback } from "@/lib/feedbackService";
import { Star } from "lucide-react";

const MyReports = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [reports, setReports] = useState<CivicReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'reported' | 'in-progress' | 'resolved'>('all');

  // Feedback State
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackReportId, setFeedbackReportId] = useState<string | null>(null);
  const [feedbackIssueType, setFeedbackIssueType] = useState<string>('');
  const previouslyResolvedRef = useRef<Set<string>>(new Set());
  const [reportRatings, setReportRatings] = useState<Record<string, number>>({});

  useEffect(() => {
    // Initialize demo data if no reports exist (only in local mode)
    if (reportStorage.getCount() === 0) {
      addDemoData();
    }
    loadReports();

    // Subscribe to Realtime Updates
    const unsubscribe = reportStorage.subscribe(() => {
      loadReports(false);
    });

    // Real-time updates every 5 seconds for better sync
    const interval = setInterval(() => loadReports(false), 5000);
    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [user]);

  // Watch for newly resolved reports and show feedback dialog
  useEffect(() => {
    const resolvedReports = reports.filter(r => r.status === 'resolved');

    for (const report of resolvedReports) {
      // Check if this is a newly resolved report (not seen before)
      if (!previouslyResolvedRef.current.has(report.id)) {
        // Mark as seen
        previouslyResolvedRef.current.add(report.id);

        // Show feedback dialog for this report
        setFeedbackReportId(report.id);
        setFeedbackIssueType(report.issueType);
        setIsFeedbackOpen(true);

        // Only show one dialog at a time
        break;
      }
    }
  }, [reports]);

  const loadReports = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);

      // Update alert eligibility first
      await reportStorage.updateAlertEligibility();

      // If user is logged in, fetch THEIR reports. Otherwise fetch all (or empty)
      let allReports: CivicReport[] = [];
      if (user) {
        allReports = await reportStorage.getUserReports(user.id);
      } else {
        // Fallback for demo/local if no user, or maybe fetch all?
        // For now fetch all as fallback or empty
        allReports = await reportStorage.getAllReports();
      }

      setReports(allReports);

      // Fetch Feedback to get ratings
      if (user) {
        const feedbacks = await feedbackService.getFeedbackByUser(user.id);
        const ratingMap: Record<string, number> = {};
        feedbacks.forEach(f => {
          if (f.report_id) {
            ratingMap[f.report_id] = f.rating;
          }
        });
        setReportRatings(ratingMap);
      }

      // Simulate real-time status updates for demo purposes
      simulateStatusUpdates(allReports);
    } catch (error) {
      console.error('Failed to load reports:', error);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadReports(true);
  };

  const handleEscalate = async (reportId: string) => {
    try {
      const success = await reportStorage.escalateReport(reportId);
      if (success) {
        // Refresh reports to show updated status
        await loadReports(true);

        // Show success message (you can add a toast here)
        console.log('Report escalated successfully');
      }
    } catch (error) {
      console.error('Failed to escalate report:', error);
    }
  };

  const simulateStatusUpdates = async (reports: CivicReport[]) => {
    // Simulate status progression for demo reports
    for (const report of reports) {
      if (report.status === 'reported' && Math.random() < 0.1) {
        // 10% chance to move from reported to in-progress
        await reportStorage.updateReportStatus(report.id, 'in-progress');
      } else if (report.status === 'in-progress' && Math.random() < 0.05) {
        // 5% chance to move from in-progress to resolved
        await reportStorage.updateReportStatus(report.id, 'resolved');
      }
    }
  };

  const getStatusIcon = (status: CivicReport['status']) => {
    switch (status) {
      case 'reported':
        return <FileText className="w-4 h-4" />;
      case 'in-progress':
        return <Clock className="w-4 h-4" />;
      case 'resolved':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: CivicReport['status']) => {
    switch (status) {
      case 'reported':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'in-progress':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'resolved':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getProgressValue = (status: CivicReport['status']) => {
    switch (status) {
      case 'reported':
        return 25;
      case 'in-progress':
        return 75;
      case 'resolved':
        return 100;
      default:
        return 0;
    }
  };

  const getSeverityColor = (severity: CivicReport['severity']) => {
    switch (severity) {
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const canEscalate = (report: CivicReport) => {
    return report.alertEnabled &&
      report.status !== 'resolved' &&
      !report.alertTriggered;
  };

  const getDaysOld = (report: CivicReport) => {
    const now = new Date();
    const diffTime = now.getTime() - report.submittedAt.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const filteredReports = reports.filter(report =>
    filter === 'all' || report.status === filter
  );

  const getStatistics = () => {
    const total = reports.length;
    const byStatus = reports.reduce((acc, report) => {
      acc[report.status] = (acc[report.status] || 0) + 1;
      return acc;
    }, {} as Record<CivicReport['status'], number>);

    // Average resolution time for resolved reports (in days)
    const resolved = reports.filter(r => r.status === 'resolved');
    let avgResolutionDays = 0;
    if (resolved.length > 0) {
      const totalMs = resolved.reduce((sum, r) => sum + (r.updatedAt.getTime() - r.submittedAt.getTime()), 0);
      avgResolutionDays = totalMs / resolved.length / (1000 * 60 * 60 * 24);
    }

    return { total, byStatus, avgResolutionDays };
  };

  const stats = getStatistics();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-civic-blue/5 via-background to-civic-green/5 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <GovernmentTopBar />
      <div className="flex-1 bg-gradient-to-br from-civic-blue/5 via-background to-civic-green/5">
        <div className="container mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(-1)}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-foreground">My Reports</h1>
                <p className="text-muted-foreground">Track the progress of your civic issue reports</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="bg-gradient-card border-border/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Reports</p>
                    <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                  </div>
                  <div className="w-12 h-12 bg-gradient-civic rounded-xl flex items-center justify-center">
                    <FileText className="w-6 h-6 text-primary-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card border-border/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Reported</p>
                    <p className="text-2xl font-bold text-blue-600">{stats.byStatus.reported || 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card border-border/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">In Progress</p>
                    <p className="text-2xl font-bold text-yellow-600">{stats.byStatus['in-progress'] || 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                    <Clock className="w-6 h-6 text-yellow-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card border-border/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Resolved</p>
                    <p className="text-2xl font-bold text-green-600">{stats.byStatus.resolved || 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                </div>
                <div className="mt-4 text-sm text-muted-foreground">
                  Avg. resolution time: <span className="font-medium text-foreground">{stats.avgResolutionDays ? stats.avgResolutionDays.toFixed(1) : '—'} days</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filter Buttons */}
          <div className="flex flex-wrap gap-2 mb-6">
            {[
              { key: 'all', label: 'All Reports', count: reports.length },
              { key: 'reported', label: 'Reported', count: stats.byStatus.reported || 0 },
              { key: 'in-progress', label: 'In Progress', count: stats.byStatus['in-progress'] || 0 },
              { key: 'resolved', label: 'Resolved', count: stats.byStatus.resolved || 0 }
            ].map(({ key, label, count }) => (
              <Button
                key={key}
                variant={filter === key ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(key as any)}
                className={filter === key ? "bg-gradient-civic" : ""}
              >
                <Filter className="w-4 h-4 mr-2" />
                {label} ({count})
              </Button>
            ))}
          </div>

          {/* Reports List */}
          {filteredReports.length === 0 ? (
            <Card className="bg-gradient-card border-border/50">
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 bg-muted rounded-xl flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">No Reports Found</h3>
                <p className="text-muted-foreground mb-6">
                  {filter === 'all'
                    ? "You haven't submitted any reports yet. Start by reporting a civic issue!"
                    : `No reports with status "${filter}" found.`
                  }
                </p>
                {filter === 'all' && (
                  <Button
                    onClick={() => navigate('/')}
                    className="bg-gradient-civic hover:opacity-90"
                  >
                    Report an Issue
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {filteredReports.map((report) => (
                <Card key={report.id} className="bg-gradient-card border-border/50 hover:shadow-card transition-all duration-300">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <CardTitle className="text-lg font-semibold text-foreground">
                            {report.issueType}
                          </CardTitle>
                          <Badge className={`${getStatusColor(report.status)} border`}>
                            {getStatusIcon(report.status)}
                            <span className="ml-1 capitalize">{report.status.replace('-', ' ')}</span>
                          </Badge>
                          <Badge className={`${getSeverityColor(report.severity)} border`}>
                            {report.severity} Priority
                          </Badge>
                          {report.priority === 'high' && (
                            <Badge className="bg-red-100 text-red-800 border-red-200 border">
                              <Zap className="w-3 h-3 mr-1" />
                              ESCALATED
                            </Badge>
                          )}
                          {/* Star Rating Badge */}
                          {reportRatings[report.id] && (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200 border">
                              <Star className="w-3 h-3 mr-1 fill-amber-500 text-amber-500" />
                              {reportRatings[report.id]} Stars
                            </Badge>
                          )}

                          {getDaysOld(report) >= 5 && report.status !== 'resolved' && (
                            <Badge className="bg-orange-100 text-orange-800 border-orange-200 border">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              {getDaysOld(report)}+ days old
                            </Badge>
                          )}
                        </div>
                        {report.subcategory && (
                          <div className="mb-2">
                            <Badge variant="outline" className="mr-2">
                              {report.subcategory}
                            </Badge>
                            {report.subcategoryOtherText && (
                              <span className="text-xs text-muted-foreground">{report.subcategoryOtherText}</span>
                            )}
                          </div>
                        )}
                        <p className="text-muted-foreground text-sm mb-3">{report.description}</p>

                        {/* Progress Bar */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium text-foreground">{getProgressValue(report.status)}%</span>
                          </div>
                          <Progress
                            value={getProgressValue(report.status)}
                            className={`h-2 ${report.status === 'resolved' ? '[&>div]:bg-green-500' :
                              report.status === 'in-progress' ? '[&>div]:bg-yellow-500' :
                                '[&>div]:bg-blue-500'
                              }`}
                          />
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className={report.status === 'reported' ? 'text-blue-600 font-medium' : ''}>Reported</span>
                            <span className={report.status === 'in-progress' ? 'text-yellow-600 font-medium' : ''}>In Progress</span>
                            <span className={report.status === 'resolved' ? 'text-green-600 font-medium' : ''}>Resolved</span>
                          </div>
                        </div>
                      </div>

                      <div className="w-16 h-16 bg-muted rounded-xl flex items-center justify-center ml-4">
                        <Camera className="w-8 h-8 text-muted-foreground" />
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <Separator className="mb-4" />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-civic-blue" />
                        <span className="text-muted-foreground">{report.location.address}</span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-civic-green" />
                        <span className="text-muted-foreground">
                          Submitted: {report.submittedAt.toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-civic-orange" />
                        <span className="text-muted-foreground">
                          Last Updated: {report.updatedAt.toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <TrendingUp className="w-4 h-4 text-civic-purple" />
                        <span className="text-muted-foreground">
                          Report ID: {report.id}
                        </span>
                      </div>
                    </div>

                    {/* Resolution Details */}
                    {report.status === 'resolved' && report.resolutionPayload && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <h4 className="text-sm font-semibold text-green-800 mb-2 flex items-center">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Resolution Details
                        </h4>
                        <p className="text-sm text-green-900 mb-3">{report.resolutionPayload.notes}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                          {report.resolutionPayload.resources && (
                            <div className="text-xs text-green-800 bg-green-100/50 p-2 rounded">
                              <span className="font-semibold">Resources:</span> {report.resolutionPayload.resources}
                            </div>
                          )}
                          {report.resolutionPayload.duration && (
                            <div className="text-xs text-green-800 bg-green-100/50 p-2 rounded">
                              <span className="font-semibold">Duration:</span> {report.resolutionPayload.duration}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-green-700 mt-2 flex items-center border-t border-green-200 pt-2 font-medium">
                          <Clock className="w-3 h-3 mr-1" />
                          Resolved on: {new Date(report.resolutionPayload.timestamp).toLocaleDateString()}
                          <span className="ml-1 opacity-75">
                            ({new Date(report.resolutionPayload.timestamp).toLocaleDateString('en-US', { weekday: 'long' })})
                          </span>
                        </div>
                      </div>
                    )}

                    {/* ALERT Button Section */}
                    {canEscalate(report) && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mt-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <AlertTriangle className="w-4 h-4 text-orange-600" />
                            <div>
                              <p className="text-sm font-medium text-orange-800">
                                This issue has been unresolved for {getDaysOld(report)} days
                              </p>
                              <p className="text-xs text-orange-600">
                                You can escalate this to get faster attention from authorities
                              </p>
                            </div>
                          </div>
                          <Button
                            onClick={() => handleEscalate(report.id)}
                            size="sm"
                            className="bg-orange-500 hover:bg-orange-600 text-white"
                          >
                            <Zap className="w-4 h-4 mr-2" />
                            ALERT
                          </Button>
                        </div>
                      </div>
                    )}

                    {report.alertTriggered && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-4">
                        <div className="flex items-center space-x-2">
                          <Zap className="w-4 h-4 text-red-600" />
                          <p className="text-sm font-medium text-red-800">
                            Alert sent to authorities - Priority escalated
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Real-time Update Indicator */}
          <div className="mt-8 text-center">
            <div className="inline-flex items-center space-x-2 bg-background/80 backdrop-blur-sm border border-border/50 rounded-full px-4 py-2">
              <div className="w-2 h-2 bg-civic-green rounded-full animate-pulse"></div>
              <span className="text-sm text-muted-foreground">Real-time updates enabled</span>
            </div>
          </div>
        </div>
      </div>

      <FeedbackDialog
        open={isFeedbackOpen}
        onOpenChange={setIsFeedbackOpen}
        type="resolution_satisfaction"
        reportId={feedbackReportId}
        reportIssueType={feedbackIssueType}
      />
    </div>
  );
};

export default MyReports;
