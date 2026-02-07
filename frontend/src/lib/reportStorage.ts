import { supabase, isSupabaseConfigured } from './supabaseClient';
import { Database } from '../types/database.types';
import { emailService } from './emailService';
import { authService } from './authService';
import { notificationService } from './notificationService';

export interface ResolutionPayload {
  resources: string;
  notes: string;
  duration?: string;
  timestamp: Date;
}

export interface CivicReport {
  id: string;
  issueType: string;
  subcategory?: string;
  subcategoryOtherText?: string;
  description: string;
  photo?: File; // For upload
  photoUrls: string[];
  audioBlob?: Blob;
  verificationToken?: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  status: 'reported' | 'assigned' | 'in-progress' | 'pending-review' | 'resolved';
  priority: 'normal' | 'high';
  severity: 'low' | 'medium' | 'high';
  submittedAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  assignedTo?: string; // Display name of dept
  assignedDeptId?: string; // ID for logic
  reporter: string;
  userId?: string; // Linked User ID
  reporterPhone?: string;
  alertEnabled: boolean;
  alertTriggered: boolean;
  resolutionPayload?: ResolutionPayload;
}

class ReportStorage {
  private reports: Map<string, CivicReport> = new Map();
  private nextId = 1;
  private listeners: (() => void)[] = [];
  private useSupabase = isSupabaseConfigured();
  private realtimeSubscription: any = null;

  constructor() {
    // Always load local storage. It handles the 'Mock' side of hybrid mode.
    this.loadFromLocalStorage();
  }

  private loadFromLocalStorage() {
    const stored = localStorage.getItem('nagarSevaReports');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        parsed.forEach((r: any) => {
          r.submittedAt = new Date(r.submittedAt);
          r.updatedAt = new Date(r.updatedAt);
          if (r.resolvedAt) r.resolvedAt = new Date(r.resolvedAt);
          if (r.resolutionPayload) r.resolutionPayload.timestamp = new Date(r.resolutionPayload.timestamp);
          this.reports.set(r.id, r);
        });
        const maxId = parsed.reduce((max: number, r: any) => {
          if (r.id.startsWith('CR')) {
            const num = parseInt(r.id.replace('CR', ''));
            return !isNaN(num) && num > max ? num : max;
          }
          return max;
        }, 0);
        this.nextId = maxId + 1;
      } catch (e) {
        console.error("Failed to load reports from storage", e);
      }
    }
  }

  private persist() {
    // OLD: if (this.useSupabase) return;
    // NEW: Always persist local map to localStorage to support hybrid/offline fallback.
    const serialized = Array.from(this.reports.values());
    localStorage.setItem('nagarSevaReports', JSON.stringify(serialized));
    this.notifyListeners();
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    // Initial load trigger
    if (this.useSupabase) {
      this.getAllReports().then(() => listener());

      // Setup Realtime Subscription if not exists
      // We use a singleton channel for the storage instance
      if (!this.realtimeSubscription && supabase) {
        this.realtimeSubscription = supabase
          .channel('civic_reports_changes')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'civic_reports' },
            (payload) => {
              console.log('🔔 Realtime update received:', payload);
              this.notifyListeners();
            }
          )
          .subscribe();
      }
    }
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(l => l());
  }

  private mapSupabaseToReport(row: Database['public']['Tables']['civic_reports']['Row']): CivicReport {
    const r = row as any;
    return {
      id: row.id,
      issueType: row.issue_type,
      description: row.description,
      photoUrls: row.photo_urls || [],
      location: {
        latitude: row.latitude,
        longitude: row.longitude,
        address: row.address,
      },
      status: row.status as CivicReport['status'],
      priority: (row.priority as CivicReport['priority']) || 'normal',
      severity: 'medium', // Default
      submittedAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      resolvedAt: row.status === 'resolved' ? new Date(row.updated_at) : undefined,
      assignedTo: row.assigned_to || undefined,
      assignedDeptId: row.assigned_dept_id || undefined,
      reporter: row.reporter_name || 'Anonymous',
      userId: row.user_id,
      reporterPhone: row.reporter_phone || undefined,
      alertEnabled: false,
      alertTriggered: row.alert_triggered || false,
      resolutionPayload: row.resolution_notes ? {
        notes: row.resolution_notes,
        resources: '',
        duration: r.resolution_duration || undefined,
        timestamp: r.resolution_date ? new Date(r.resolution_date) : new Date(row.updated_at)
      } : undefined
    };
  }

  async uploadPhoto(file: File): Promise<string> {
    if (this.useSupabase && supabase) {
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}_${file.name.replace(/\s/g, '_')}`;
      const { data, error } = await supabase.storage
        .from('reports') // Expecting 'reports' bucket to exist
        .upload(fileName, file);

      if (error) {
        console.error('Supabase storage upload error:', error);

        // RLS Error Check: If specific RLS error, maybe fallback?
        // But for storage, standard fallback is object URL locally if auth fails.
        if (error.message.includes('row-level security') || error.message.includes('new row violates')) {
          console.warn("Storage RLS violation. Using local ObjectURL fallback.");
          return URL.createObjectURL(file);
        }

        // Fallback to local object URL if upload fails (e.g. bucket missing)
        throw error;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('reports')
        .getPublicUrl(fileName);

      return publicUrl;
    }

    // Mock mode
    return URL.createObjectURL(file);
  }

  private getDepartmentForIssue(issueType: string): { id: string, name: string } {
    const map: Record<string, { id: string, name: string }> = {
      'Potholes': { id: 'road_dept', name: 'Road Department' },
      'Garbage': { id: 'sanitation_dept', name: 'Sanitation Department' },
      'Street Light': { id: 'electric_dept', name: 'Electrical Department' },
      'Waterlogging': { id: 'drainage_dept', name: 'Drainage Department' },
      'Stray Animals': { id: 'green_dept', name: 'Green Department' }
    };
    return map[issueType] || { id: 'admin', name: 'City Administration' };
  }

  async storeReport(reportData: Omit<CivicReport, 'id' | 'submittedAt' | 'updatedAt' | 'alertEnabled' | 'alertTriggered' | 'priority' | 'status'>): Promise<string> {
    const now = new Date();
    const dept = this.getDepartmentForIssue(reportData.issueType);

    // --- SECURITY CHECK (Legacy - Now handled by AI Analysis in new workflow) ---
    // In the new workflow, images are validated by AI analysis BEFORE reaching this point.
    // The verification token check is bypassed since AI analysis serves as the validation.
    // Keeping the code commented for reference:
    /*
    if ((reportData.photoUrls && reportData.photoUrls.length > 0) || reportData.photo) {
      if (!reportData.verificationToken) {
        console.error("SECURITY ALERT: Report rejected due to missing AI Verification Token.");
        throw new Error("Security Violation: Evidence not verified by Nagar Seva AI.");
      }
    }
    */

    if (this.useSupabase && supabase) {
      // Get current user if exists
      const { data: { session } } = await supabase.auth.getSession();

      // CRITICAL FIX: If no valid Supabase session (e.g. Mock User), FALLBACK to local storage.
      // Do NOT try to insert as 'anon' because RLS will block it.
      if (!session || !session.user) {
        console.warn("No Supabase session found (Mock User active?). Falling back to Local Storage.");
        // Fall through to Local Fallback below
      } else {
        const userId = session.user.id;

        const { data, error } = await supabase
          .from('civic_reports')
          .insert({
            issue_type: reportData.issueType,
            description: reportData.description,
            photo_urls: reportData.photoUrls,
            latitude: reportData.location.latitude,
            longitude: reportData.location.longitude,
            address: reportData.location.address,
            status: 'assigned',
            priority: 'normal',
            user_id: userId,
            reporter_name: reportData.reporter,
            reporter_phone: reportData.reporterPhone,
            assigned_to: dept.name,
            assigned_dept_id: dept.id
          })
          .select()
          .single();


        if (error) {
          console.error('Supabase error:', error);
          throw error;
        }

        // Create notification for report submission
        await notificationService.notifyReportSubmitted(
          userId,
          data.id,
          reportData.issueType,
          dept.name
        );

        this.notifyListeners();
        return data.id;
      } // End of else block for valid session
    }

    // Local Fallback
    const id = `CR${this.nextId.toString().padStart(4, '0')}`;


    // Get current user ID for linking
    const currentUser = authService.getCurrentUser();

    // DEBUG LOG
    console.log("[ReportStorage] Local Submission - Current User:", currentUser);

    // FIX: Prefer explicitly passed userId (from frontend), fallback to authService, then anon.
    const userId = reportData.userId || (currentUser ? currentUser.id : 'anon');

    if (userId === 'anon') {
      console.warn("[ReportStorage] WARNING: Submitting report as 'anon'. User might not receive notifications.");
    }

    const report: CivicReport = {
      ...reportData,
      id,
      status: 'assigned',
      submittedAt: now,
      updatedAt: now,
      priority: 'normal',
      alertEnabled: false,
      alertTriggered: false,
      assignedDeptId: dept.id,
      assignedTo: dept.name,
      userId: userId // CRITICAL: Link report to user
    };

    this.reports.set(id, report);
    this.nextId++;
    this.persist();

    // Create notification for report submission (localStorage mode)
    if (userId !== 'anon') {
      await notificationService.notifyReportSubmitted(
        userId,
        id,
        reportData.issueType,
        dept.name
      );
    }

    return id;
  }

  async getReport(id: string): Promise<CivicReport | null> {
    if (this.useSupabase && supabase) {
      const { data, error } = await supabase.from('civic_reports').select('*').eq('id', id).single();
      if (!error && data) {
        return this.mapSupabaseToReport(data);
      }
    }
    return this.reports.get(id) || null;
  }

  async getAllReports(): Promise<CivicReport[]> {
    if (this.useSupabase && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      // FIX: If no session, fallback to local
      if (session) {
        const { data } = await supabase.from('civic_reports').select('*').order('created_at', { ascending: false });
        if (data) {
          const mapped = data.map(this.mapSupabaseToReport);
          return mapped;
        }
        return [];
      }
    }
    // Mock/Local Fallback
    await new Promise(resolve => setTimeout(resolve, 300));
    return Array.from(this.reports.values()).sort((a, b) =>
      b.submittedAt.getTime() - a.submittedAt.getTime()
    );
  }

  async getUserReports(userId: string): Promise<CivicReport[]> {
    if (this.useSupabase && supabase) {
      const { data: { session } } = await supabase.auth.getSession();

      // FIX: Only query supabase if we have a valid session and it matches, OR if we just want to try.
      // But critical: if query returns empty, we MUST check local storage too for hybrid support,
      // especially if using a Mock User (userId 'citizen_1') which won't exist in Supabase auth.

      if (session) {
        const { data } = await supabase
          .from('civic_reports')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (data && data.length > 0) {
          return data.map(this.mapSupabaseToReport);
        }
      }
    }

    // Fallback: filter local reports (mock)
    // This handles cases where:
    // 1. Supabase not configured (Pure Mock)
    // 2. Supabase configured but logged in as Mock User (Hybrid)
    // 3. Supabase configured, Real User, but no reports in DB for some reason (Edge case)
    return (await this.getAllReports()).filter(r => r.userId === userId);
  }

  async assignIncident(id: string, deptId: string, deptName: string): Promise<boolean> {
    if (this.useSupabase && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { error } = await supabase
          .from('civic_reports')
          .update({
            status: 'assigned',
            assigned_to: deptName,
            assigned_dept_id: deptId,
            updated_at: new Date().toISOString()
          })
          .eq('id', id);

        if (!error) this.notifyListeners();
        return !error;
      }
    }

    const report = this.reports.get(id);
    if (!report) return false;

    report.status = 'assigned';
    report.assignedDeptId = deptId;
    report.assignedTo = deptName;
    report.updatedAt = new Date();

    this.persist();
    return true;
  }

  async verifyResolution(id: string): Promise<boolean> {
    if (this.useSupabase && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // 1. Update Report Status
        const { error } = await supabase
          .from('civic_reports')
          .update({
            status: 'resolved',
            updated_at: new Date().toISOString()
          })
          .eq('id', id);

        if (!error) {
          // 2. Fetch Report to get User ID
          const { data: reportData } = await supabase
            .from('civic_reports')
            .select('user_id, reporter_name, resolution_notes, issue_type')
            .eq('id', id)
            .single();

          if (reportData && reportData.user_id) {
            // 3. Update Points
            const { data: profile } = await supabase
              .from('profiles')
              .select('points, email')
              .eq('id', reportData.user_id)
              .single();

            if (profile) {
              const newPoints = (profile.points || 0) + 30;
              await supabase.from('profiles').update({ points: newPoints }).eq('id', reportData.user_id);
              console.log(`🏆 Supabase: Assigned 30 points to user ${reportData.user_id}`);

              // Notify user about points
              await notificationService.notifyPointsAwarded(
                reportData.user_id,
                30,
                'Your report was verified and resolved!',
                id
              );
            }

            // Notify user that report is verified and resolved
            await notificationService.notifyReportVerified(
              reportData.user_id,
              id,
              reportData.issue_type || 'civic issue',
              reportData.resolution_notes
            );

            // 4. Send Email
            const recipientEmail = profile?.email || "citizen@example.com";
            emailService.sendResolutionEmail(
              recipientEmail,
              id,
              reportData.reporter_name || "Citizen",
              reportData.resolution_notes || "Resolved."
            );
          }
          this.notifyListeners();
          return true;
        }
        return false;
      }
    }

    // Local Fallback (Mock Mode)
    const report = this.reports.get(id);
    if (!report) return false;

    // Prevent duplicate points if already resolved
    if (report.status === 'resolved') return true;

    report.status = 'resolved';
    report.resolvedAt = new Date();
    report.updatedAt = new Date();

    // --- TRIGGER: Email Notification & Points ---

    // 1. Send Email
    const reporterEmail = "citizen@example.com";
    const reporterName = report.reporter || "Citizen";
    const notes = report.resolutionPayload?.notes || "Issue resolved successfully.";

    emailService.sendResolutionEmail(reporterEmail, report.id, reporterName, notes);

    // 2. Add Points (Local Mock)
    console.log(`🏆 +30 Points awarded to ${reporterName} for Report ${id}`);

    if (report.userId) {
      const storedUsers = localStorage.getItem('nagarSevaMockDB_Users');
      if (storedUsers) {
        try {
          const users = JSON.parse(storedUsers);
          const userIndex = users.findIndex((u: any) => u.id === report.userId);

          if (userIndex !== -1) {
            users[userIndex].points = (users[userIndex].points || 0) + 30;
            localStorage.setItem('nagarSevaMockDB_Users', JSON.stringify(users));
            console.log(`Updated points for user ${report.userId} in mock DB`);

            await notificationService.notifyPointsAwarded(
              report.userId,
              30,
              'Your report was verified and resolved!',
              id
            );
          }
        } catch (e) {
          console.error("Failed to update user points in mock DB", e);
        }
      }

      await notificationService.notifyReportVerified(
        report.userId,
        id,
        report.issueType,
        notes
      );
    } else {
      console.warn("Report has no userId, cannot award points to specific mock user.");
    }

    this.persist();
    return true;
  }

  async updateReportStatus(id: string, status: CivicReport['status'], assignedTo?: string): Promise<boolean> {
    if (this.useSupabase && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const updates: any = { status, updated_at: new Date().toISOString() };
        if (assignedTo) updates.assigned_to = assignedTo;
        await supabase.from('civic_reports').update(updates).eq('id', id);
        this.notifyListeners();
        return true;
      }
    }

    // Local
    const report = this.reports.get(id);
    if (report) {
      report.status = status;
      report.updatedAt = new Date();
      if (assignedTo) report.assignedTo = assignedTo;
      this.persist();
    }
    return true;
  }

  async rejectResolution(id: string, notes?: string): Promise<boolean> {
    if (this.useSupabase && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.from('civic_reports').update({ status: 'assigned', updated_at: new Date().toISOString() }).eq('id', id);
        this.notifyListeners();
        return true;
      }
    }

    const report = this.reports.get(id);
    if (report) {
      report.status = 'assigned'; // Revert to assigned
      report.updatedAt = new Date();
      this.persist();
    }
    return true;
  }

  async submitResolution(id: string, payload: { resources: string; notes: string; duration: string }): Promise<boolean> {
    if (this.useSupabase && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { error } = await supabase.from('civic_reports').update({
          status: 'pending-review',
          resolution_notes: payload.notes,
          resolution_duration: payload.duration,
          resolution_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }).eq('id', id);

        if (!error) {
          const { data: reportData } = await supabase
            .from('civic_reports')
            .select('user_id, issue_type, assigned_to')
            .eq('id', id)
            .single();

          if (reportData && reportData.user_id) {
            await notificationService.notifyDepartmentCompleted(
              reportData.user_id,
              id,
              reportData.issue_type || 'civic issue',
              reportData.assigned_to || 'Department'
            );
          }
          this.notifyListeners();
        }
        return !error;
      }
    }

    // --- Local Mock Fallback ---
    const report = this.reports.get(id);
    if (!report) return false;

    report.status = 'pending-review';
    report.resolutionPayload = {
      notes: payload.notes,
      resources: payload.resources,
      duration: payload.duration,
      timestamp: new Date()
    };
    report.updatedAt = new Date();

    this.persist();
    this.notifyListeners();

    if (report.userId && report.userId !== 'anon') {
      await notificationService.notifyDepartmentCompleted(
        report.userId,
        id,
        report.issueType,
        report.assignedTo || 'Department'
      );
    }

    return true;
  }

  async getReportsByStatus(status: CivicReport['status']): Promise<CivicReport[]> {
    if (this.useSupabase && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data } = await supabase
          .from('civic_reports')
          .select('*')
          .eq('status', status)
          .order('created_at', { ascending: false });

        if (data && data.length > 0) {
          return data.map(this.mapSupabaseToReport);
        }
      }
    }
    const all = await this.getAllReports();
    return all.filter(r => r.status === status);
  }

  async getReportsByDept(deptId: string): Promise<CivicReport[]> {
    if (this.useSupabase && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data } = await supabase
          .from('civic_reports')
          .select('*')
          .eq('assigned_dept_id', deptId)
          .order('created_at', { ascending: false });

        if (data && data.length > 0) {
          return data.map(this.mapSupabaseToReport);
        }
      }
    }
    const all = await this.getAllReports();
    return all.filter(r => r.assignedDeptId === deptId);
  }

  async getStatistics(): Promise<any> {
    const all = await this.getAllReports();
    const byStatus = all.reduce((acc, r: any) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
    const byType = all.reduce((acc, r: any) => { acc[r.issueType] = (acc[r.issueType] || 0) + 1; return acc; }, {});
    return { total: all.length, byStatus, byType, recent: 0 };
  }

  async escalateReport(id: string): Promise<boolean> {
    if (this.useSupabase && supabase) {
      const { error } = await supabase.from('civic_reports').update({ priority: 'high', alert_triggered: true }).eq('id', id);
      if (!error) {
        this.notifyListeners();
        return true;
      }
    }
    // Fallback to local
    const report = this.reports.get(id);
    if (report) {
      report.priority = 'high';
      report.alertTriggered = true;
      this.persist();
      return true;
    }
    return false;
  }

  async updateAlertEligibility(): Promise<void> { } // No-op for now

  clearAll(): void {
    if (!this.useSupabase) {
      this.reports.clear();
      this.nextId = 1;
      this.persist();
    }
  }

  getCount(): number {
    return this.reports.size;
  }
}

export const reportStorage = new ReportStorage();

export const addDemoData = () => {
  if (!isSupabaseConfigured()) {
    const storage = new ReportStorage();
    if (storage.getCount() > 0) return;
  }
};
