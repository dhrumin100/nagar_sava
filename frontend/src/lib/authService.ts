import { supabase, isSupabaseConfigured } from './supabaseClient';

export type UserRole = 'citizen' | 'authority' | 'department';

export interface User {
    id: string;
    username: string;
    role: UserRole;
    deptId?: string; // Only for department users
    name: string;
    email?: string; // Added email for notifications
    phone?: string; // Added phone for profile details
    points?: number; // Added points for gamification
}

// Mock Users
const MOCK_USERS: User[] = [
    { id: 'auth_1', username: 'admin', role: 'authority', name: 'City Administrator', email: 'admin@nagarseva.gov', phone: '+91 98765 43210', points: 0 },
    { id: 'citizen_1', username: 'citizen', role: 'citizen', name: 'Rahul Sharma', email: 'rahul.sharma@example.com', phone: '+91 98989 89898', points: 120 },
    { id: 'dept_road', username: 'road_dept', role: 'department', deptId: 'road_dept', name: 'Road Department', email: 'roads@nagarseva.gov' },
    { id: 'dept_sanitation', username: 'sanitation_dept', role: 'department', deptId: 'sanitation_dept', name: 'Sanitation Department', email: 'sanitation@nagarseva.gov' },
    { id: 'dept_electric', username: 'electric_dept', role: 'department', deptId: 'electric_dept', name: 'Electrical Department', email: 'electric@nagarseva.gov' },
    { id: 'dept_drainage', username: 'drainage_dept', role: 'department', deptId: 'drainage_dept', name: 'Drainage Department', email: 'drainage@nagarseva.gov' },
    { id: 'dept_green', username: 'green_dept', role: 'department', deptId: 'green_dept', name: 'Green Department', email: 'green@nagarseva.gov' },
];

const getMockUsers = (): User[] => {
    const stored = localStorage.getItem('nagarSevaMockDB_Users');
    let users: User[] = stored ? JSON.parse(stored) : [];

    // Ensure default mock users always exist (restore if deleted/missing)
    let dirty = false;
    MOCK_USERS.forEach(mockU => {
        if (!users.find(u => u.username === mockU.username)) {
            users.push(mockU);
            dirty = true;
        }
    });

    if (!stored || dirty) {
        localStorage.setItem('nagarSevaMockDB_Users', JSON.stringify(users));
    }
    return users;
};

export const authService = {
    login: async (username: string): Promise<User | null> => {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));

        const users = getMockUsers();
        const user = users.find(u => u.username === username);

        if (user) {
            localStorage.setItem('nagarSevaUser', JSON.stringify(user));
            return user;
        }
        return null;
    },

    logout: () => {
        localStorage.removeItem('nagarSevaUser');
    },

    getCurrentUser: (): User | null => {
        const stored = localStorage.getItem('nagarSevaUser');
        if (stored) {
            const sessionUser = JSON.parse(stored);
            // Always fetch fresh data from "DB" to get latest points
            const users = getMockUsers();
            const freshUser = users.find(u => u.id === sessionUser.id);
            return freshUser || sessionUser;
        }
        return null;
    },

    getUserSession: async (): Promise<User | null> => {
        if (isSupabaseConfigured() && supabase) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                return {
                    id: session.user.id,
                    username: session.user.email || 'user',
                    role: 'citizen',
                    name: session.user.user_metadata?.full_name || 'Citizen',
                    email: session.user.email,
                    phone: session.user.phone
                };
            }
        }
        // Fallback to local session
        return authService.getCurrentUser();
    },

    fetchFreshProfile: async (userId: string): Promise<Partial<User> | null> => {
        if (isSupabaseConfigured() && supabase) {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error || !data) return null;

            return {
                id: data.id,
                email: data.email || undefined,
                name: data.full_name || 'Citizen',
                role: (data.role as UserRole) || 'citizen',
                deptId: data.dept_id || undefined,
                phone: (data as any).phone || undefined,
                points: data.points || 0
            };
        }

        // Mock Fallback
        const users = getMockUsers();
        const user = users.find(u => u.id === userId);
        return user || null;
    }
};
