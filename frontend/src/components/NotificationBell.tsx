import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/hooks/useNotifications';

const NotificationBell = () => {
    const navigate = useNavigate();
    const { unreadCount } = useNotifications();

    return (
        <div className="relative">
            <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-full h-10 w-10 relative"
                onClick={() => navigate('/notifications')}
            >
                <Bell className="w-5 h-5" />
                {/* Unread Badge */}
                {unreadCount > 0 && (
                    <>
                        <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse border border-background" />
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-background">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    </>
                )}
            </Button>
        </div>
    );
};

export default NotificationBell;
