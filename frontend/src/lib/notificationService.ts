import { supabase } from './supabaseClient';

export interface Notification {
    id: string;
    user_id: string;
    report_id: string | null;
    type: string;
    title: string;
    message: string;
    read: boolean;
    created_at: string;
    metadata: Record<string, any>;
}

export const NOTIFICATION_STORAGE_KEY = 'nagarSevaNotifications';

class NotificationService {
    private storageKey = NOTIFICATION_STORAGE_KEY;

    // Create a notification (works with or without Supabase)
    async createNotification(notification: Omit<Notification, 'id' | 'created_at' | 'read'>): Promise<void> {
        const newNotification: Notification = {
            ...notification,
            id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            created_at: new Date().toISOString(),
            read: false
        };

        if (supabase) {
            // Use Supabase if configured
            try {
                await supabase.from('notifications').insert(newNotification);
            } catch (error) {
                console.error('Error creating notification in Supabase:', error);
                // Fallback to localStorage
                this.saveToLocalStorage(newNotification);
            }
        } else {
            // Use localStorage
            this.saveToLocalStorage(newNotification);
        }
    }

    private saveToLocalStorage(notification: Notification): void {
        const existing = this.getFromLocalStorage();
        existing.unshift(notification);
        localStorage.setItem(this.storageKey, JSON.stringify(existing));

        // Trigger storage event for other components to update
        window.dispatchEvent(new Event('notificationsUpdated'));
        // Also trigger native storage event for cross-tab
        window.dispatchEvent(new StorageEvent('storage', {
            key: this.storageKey,
            newValue: JSON.stringify(existing)
        }));
    }

    private getFromLocalStorage(): Notification[] {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error reading notifications from localStorage:', error);
            return [];
        }
    }

    // Get all notifications for a user
    async getNotifications(userId: string): Promise<Notification[]> {
        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('notifications')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false });

                if (!error && data) {
                    return data;
                }
            } catch (error) {
                console.error('Error fetching notifications from Supabase:', error);
            }
        }

        // Fallback to localStorage
        const all = this.getFromLocalStorage();
        return all.filter(n => n.user_id === userId);
    }

    // Mark notification as read
    async markAsRead(notificationId: string, userId: string): Promise<void> {
        if (supabase) {
            try {
                await supabase
                    .from('notifications')
                    .update({ read: true })
                    .eq('id', notificationId)
                    .eq('user_id', userId);
                return;
            } catch (error) {
                console.error('Error marking notification as read in Supabase:', error);
            }
        }

        // Fallback to localStorage
        const all = this.getFromLocalStorage();
        const updated = all.map(n =>
            n.id === notificationId && n.user_id === userId
                ? { ...n, read: true }
                : n
        );
        localStorage.setItem(this.storageKey, JSON.stringify(updated));
        window.dispatchEvent(new Event('notificationsUpdated'));
    }

    // Mark all as read
    async markAllAsRead(userId: string): Promise<void> {
        if (supabase) {
            try {
                await supabase
                    .from('notifications')
                    .update({ read: true })
                    .eq('user_id', userId)
                    .eq('read', false);
                return;
            } catch (error) {
                console.error('Error marking all notifications as read in Supabase:', error);
            }
        }

        // Fallback to localStorage
        const all = this.getFromLocalStorage();
        const updated = all.map(n =>
            n.user_id === userId ? { ...n, read: true } : n
        );
        localStorage.setItem(this.storageKey, JSON.stringify(updated));
        window.dispatchEvent(new Event('notificationsUpdated'));
    }

    // Delete notification
    async deleteNotification(notificationId: string, userId: string): Promise<void> {
        if (supabase) {
            try {
                await supabase
                    .from('notifications')
                    .delete()
                    .eq('id', notificationId)
                    .eq('user_id', userId);
                return;
            } catch (error) {
                console.error('Error deleting notification from Supabase:', error);
            }
        }

        // Fallback to localStorage
        const all = this.getFromLocalStorage();
        const filtered = all.filter(n => !(n.id === notificationId && n.user_id === userId));
        localStorage.setItem(this.storageKey, JSON.stringify(filtered));
        window.dispatchEvent(new Event('notificationsUpdated'));
    }

    // Helper: Create report submission notification
    async notifyReportSubmitted(userId: string, reportId: string, issueType: string, departmentName: string): Promise<void> {
        await this.createNotification({
            user_id: userId,
            report_id: reportId,
            type: 'report_submitted',
            title: '✅ Report Submitted Successfully',
            message: `Your ${issueType} report (${reportId}) has been submitted and assigned to ${departmentName}.`,
            metadata: {
                reportId,
                issueType,
                department: departmentName,
                status: 'assigned'
            }
        });
    }

    // Helper: Create report status update notification
    async notifyReportStatusUpdate(userId: string, reportId: string, status: string, message: string): Promise<void> {
        const statusEmojis: Record<string, string> = {
            'assigned': '📋',
            'in-progress': '🔧',
            'pending-review': '👀',
            'resolved': '✅'
        };

        await this.createNotification({
            user_id: userId,
            report_id: reportId,
            type: 'status_update',
            title: `${statusEmojis[status] || '📢'} Report Status Updated`,
            message,
            metadata: {
                reportId,
                status
            }
        });
    }

    // Helper: Create points awarded notification
    async notifyPointsAwarded(userId: string, points: number, reason: string, reportId?: string): Promise<void> {
        const isCredit = points > 0;
        const emoji = isCredit ? '🏆' : '⚠️';
        const action = isCredit ? 'earned' : 'deducted';
        const absPoints = Math.abs(points);

        await this.createNotification({
            user_id: userId,
            report_id: reportId || null,
            type: isCredit ? 'points_credited' : 'points_debited',
            title: `${emoji} Points ${isCredit ? 'Earned' : 'Deducted'}!`,
            message: `You ${action} ${absPoints} points! ${reason}`,
            metadata: {
                points,
                reason,
                reportId
            }
        });
    }

    // Helper: Department completed report notification
    async notifyDepartmentCompleted(userId: string, reportId: string, issueType: string, departmentName: string): Promise<void> {
        await this.createNotification({
            user_id: userId,
            report_id: reportId,
            type: 'department_completed',
            title: '🔧 Department Completed Work',
            message: `${departmentName} has completed work on your ${issueType} report (${reportId}). It is now pending verification by authorities.`,
            metadata: {
                reportId,
                issueType,
                department: departmentName,
                status: 'pending-review'
            }
        });
    }

    // Helper: Report verified and resolved by authority
    async notifyReportVerified(userId: string, reportId: string, issueType: string, resolutionNotes?: string): Promise<void> {
        await this.createNotification({
            user_id: userId,
            report_id: reportId,
            type: 'report_verified',
            title: '✅ Report Verified & Resolved',
            message: `Your ${issueType} report (${reportId}) has been verified and resolved by the authority. ${resolutionNotes ? `Notes: ${resolutionNotes}` : 'Thank you for your contribution!'}`,
            metadata: {
                reportId,
                issueType,
                status: 'resolved',
                resolutionNotes
            }
        });
    }
}

export const notificationService = new NotificationService();
