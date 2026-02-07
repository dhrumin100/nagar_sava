import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Bell, CheckCheck, Trash2, Filter } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

const Notifications = () => {
    const navigate = useNavigate();
    const { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
    const [filter, setFilter] = useState<'all' | 'unread'>('all');

    const filteredNotifications = filter === 'unread'
        ? notifications.filter(n => !n.read)
        : notifications;

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'report_submitted':
                return '📤';
            case 'report_verified':
                return '✅';
            case 'report_in_progress':
                return '⚙️';
            case 'report_resolved':
                return '🎉';
            case 'report_rejected':
                return '❌';
            case 'points_earned':
                return '🌟';
            default:
                return '📢';
        }
    };

    const handleNotificationClick = (notification: typeof notifications[0]) => {
        if (!notification.read) {
            markAsRead(notification.id);
        }

        // Navigate to report details if report_id exists
        if (notification.report_id) {
            navigate(`/my-reports`);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate(-1)}
                                className="rounded-full"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                            <div>
                                <h1 className="text-2xl font-bold text-foreground flex items-center space-x-2">
                                    <Bell className="w-6 h-6" />
                                    <span>Notifications</span>
                                </h1>
                                <p className="text-sm text-muted-foreground">
                                    {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
                                </p>
                            </div>
                        </div>

                        {unreadCount > 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={markAllAsRead}
                                className="flex items-center space-x-2"
                            >
                                <CheckCheck className="w-4 h-4" />
                                <span className="hidden sm:inline">Mark all as read</span>
                            </Button>
                        )}
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex items-center space-x-2 mt-4">
                        <Button
                            variant={filter === 'all' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setFilter('all')}
                            className="rounded-full"
                        >
                            All ({notifications.length})
                        </Button>
                        <Button
                            variant={filter === 'unread' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setFilter('unread')}
                            className="rounded-full"
                        >
                            Unread ({unreadCount})
                        </Button>
                    </div>
                </div>
            </div>

            {/* Notifications List */}
            <div className="container mx-auto px-4 py-6 max-w-3xl">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : filteredNotifications.length === 0 ? (
                    <Card className="p-12 text-center">
                        <div className="flex flex-col items-center space-y-4">
                            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
                                <Bell className="w-10 h-10 text-muted-foreground" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-foreground mb-2">
                                    {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    {filter === 'unread'
                                        ? 'All your notifications have been read'
                                        : 'When you submit reports or receive updates, they\'ll appear here'}
                                </p>
                            </div>
                            {filter === 'unread' && notifications.length > 0 && (
                                <Button
                                    variant="outline"
                                    onClick={() => setFilter('all')}
                                    className="mt-4"
                                >
                                    View all notifications
                                </Button>
                            )}
                        </div>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {filteredNotifications.map((notification) => (
                            <Card
                                key={notification.id}
                                className={`p-4 cursor-pointer transition-all hover:shadow-md ${!notification.read ? 'bg-primary/5 border-primary/20' : ''
                                    }`}
                                onClick={() => handleNotificationClick(notification)}
                            >
                                <div className="flex items-start space-x-4">
                                    {/* Icon */}
                                    <div className="flex-shrink-0 text-3xl">
                                        {getNotificationIcon(notification.type)}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between space-x-2">
                                            <h3 className="font-semibold text-foreground flex items-center space-x-2">
                                                <span>{notification.title}</span>
                                                {!notification.read && (
                                                    <Badge variant="default" className="text-xs">New</Badge>
                                                )}
                                            </h3>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 flex-shrink-0"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteNotification(notification.id);
                                                }}
                                            >
                                                <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                                            </Button>
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                            {notification.message}
                                        </p>
                                        <div className="flex items-center space-x-4 mt-2">
                                            <span className="text-xs text-muted-foreground">
                                                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                            </span>
                                            {notification.metadata?.issue_type && (
                                                <Badge variant="outline" className="text-xs">
                                                    {notification.metadata.issue_type}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Notifications;
