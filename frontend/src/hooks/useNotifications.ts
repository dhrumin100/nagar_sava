import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthProvider';
import { toast } from '@/hooks/use-toast';
import { notificationService } from '@/lib/notificationService';

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

export const useNotifications = () => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);

    // Fetch notifications
    const fetchNotifications = async () => {
        if (!user) {
            setNotifications([]);
            setUnreadCount(0);
            setLoading(false);
            return;
        }

        try {
            // Use notification service which handles both Supabase and localStorage
            const data = await notificationService.getNotifications(user.id);
            setNotifications(data || []);
            setUnreadCount(data?.filter(n => !n.read).length || 0);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    // Mark single notification as read
    const markAsRead = async (notificationId: string) => {
        if (!user) return;

        try {
            await notificationService.markAsRead(notificationId, user.id);

            // Update local state
            setNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    // Mark all notifications as read
    const markAllAsRead = async () => {
        if (!user) return;

        try {
            await notificationService.markAllAsRead(user.id);

            // Update local state
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);

            toast({
                title: 'All notifications marked as read',
                duration: 2000,
            });
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    // Delete notification
    const deleteNotification = async (notificationId: string) => {
        if (!user) return;

        try {
            await notificationService.deleteNotification(notificationId, user.id);

            // Update local state
            const notification = notifications.find(n => n.id === notificationId);
            setNotifications(prev => prev.filter(n => n.id !== notificationId));
            if (notification && !notification.read) {
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    };

    // Set up real-time subscription
    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        fetchNotifications();

        if (supabase) {
            // Subscribe to new notifications only if Supabase is configured
            const channel = supabase
                .channel('notifications')
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'notifications',
                        filter: `user_id=eq.${user.id}`,
                    },
                    (payload) => {
                        const newNotification = payload.new as Notification;

                        // Add to state
                        setNotifications(prev => [newNotification, ...prev]);
                        setUnreadCount(prev => prev + 1);

                        // Show toast notification
                        toast({
                            title: newNotification.title,
                            description: newNotification.message,
                            duration: 5000,
                        });
                    }
                )
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'notifications',
                        filter: `user_id=eq.${user.id}`,
                    },
                    (payload) => {
                        const updatedNotification = payload.new as Notification;

                        // Update in state
                        setNotifications(prev =>
                            prev.map(n => n.id === updatedNotification.id ? updatedNotification : n)
                        );

                        // Recalculate unread count
                        setUnreadCount(prev => {
                            const oldNotification = notifications.find(n => n.id === updatedNotification.id);
                            if (oldNotification && !oldNotification.read && updatedNotification.read) {
                                return Math.max(0, prev - 1);
                            }
                            return prev;
                        });
                    }
                )
                .subscribe();

            // HYBRID FIX: Also listen to local events (for Mock Auth notifications)
            const handleNotificationsUpdate = () => {
                fetchNotifications();
            };

            // Listen for same-tab updates
            window.addEventListener('notificationsUpdated', handleNotificationsUpdate);

            // Listen for cross-tab updates (e.g. Dept updating in another tab)
            window.addEventListener('storage', (e) => {
                if (e.key === 'nagarSevaNotifications') { // Hardcoded to match service default if not imported, or import it.
                    fetchNotifications();
                }
            });

            return () => {
                supabase.removeChannel(channel);
                window.removeEventListener('notificationsUpdated', handleNotificationsUpdate);
                window.removeEventListener('storage', handleNotificationsUpdate); // valid because handleNotificationsUpdate ignores args
            };
        } else {
            // For localStorage mode, listen to custom events
            const handleNotificationsUpdate = () => {
                fetchNotifications();
            };

            window.addEventListener('notificationsUpdated', handleNotificationsUpdate);

            return () => {
                window.removeEventListener('notificationsUpdated', handleNotificationsUpdate);
            };
        }
    }, [user]);

    return {
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        refetch: fetchNotifications,
    };
};
