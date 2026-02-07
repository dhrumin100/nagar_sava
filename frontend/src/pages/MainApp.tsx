import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogOut, User } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Milestones from "@/components/Milestones";
import Map from "@/components/Map";
import Rewards from "@/components/Rewards";
import SuccessStories from "@/components/SuccessStories";
import Footer from "@/components/Footer";
import GovernmentTopBar from "@/components/GovernmentTopBar";
import { useAuth } from "@/contexts/AuthProvider";
import NotificationBell from "@/components/NotificationBell";

const MainApp = () => {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const checkRole = async () => {
      if (user) {
        // Check local storage first for speed or legacy
        const local = localStorage.getItem("nagarSevaUser");
        if (local) {
          const parsed = JSON.parse(local);
          if (parsed.role === 'department') {
            navigate('/dept-dashboard');
            return;
          }
        }

        // Verify with DB only if Supabase is configured
        if (supabase) {
          try {
            const { data } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single();
            if (data) {
              if (data.role === 'department') {
                navigate('/dept-dashboard');
              } else {
                setUserRole(data.role);
              }
            }
          } catch (error) {
            console.error('Error fetching user role from Supabase:', error);
            // Fallback to localStorage or default
            const local = localStorage.getItem("nagarSevaUser");
            if (local) {
              const parsed = JSON.parse(local);
              setUserRole(parsed.role || 'citizen');
            } else {
              setUserRole('citizen');
            }
          }
        } else {
          // If Supabase is not configured, use localStorage or default to citizen
          const local = localStorage.getItem("nagarSevaUser");
          if (local) {
            const parsed = JSON.parse(local);
            setUserRole(parsed.role || 'citizen');
          } else {
            setUserRole('citizen');
          }
        }
      }
    };
    checkRole();
  }, [user, navigate]);

  // Use email or fallback to deprecated localStorage for mock mode/legacy
  const getDisplayUser = () => {
    if (userRole === 'department') return "Department"; // Should be redirected anyway
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name;
    if (user?.email) return user.email.split('@')[0];
    const local = localStorage.getItem("nagarSevaUser");
    if (local && local.includes('{')) {
      try {
        const u = JSON.parse(local);
        // Navbar Identity Fix: Ensure we don't show Dept Name
        return u.role === 'department' ? 'Citizen' : u.name;
      } catch { return "Citizen"; }
    }
    return "Citizen";
  };
  const username = getDisplayUser();

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <GovernmentTopBar variant="transparent" />

      {/* Custom Header with Logout - Static Glassmorphism Nav */}
      <header className="relative w-full z-50 py-3">
        <div className="container mx-auto px-6">
          <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-slate-200/50 dark:border-white/10 rounded-full px-6 py-3 flex items-center justify-between shadow-lg shadow-black/5">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div
                  className="w-10 h-10 bg-gradient-to-br from-blue-500 to-teal-400 rounded-full flex items-center justify-center shadow-inner cursor-pointer"
                  onClick={() => navigate('/profile')}
                >
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white dark:border-[#0B1120] rounded-full"></div>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Nagar Seva</h1>
                <p className="text-[10px] text-muted-foreground dark:text-slate-400 uppercase tracking-wider font-medium">Citizen Portal</p>
              </div>
            </div>

            <nav className="hidden md:flex items-center space-x-1">
              {['Features', 'Rewards', 'Success Stories'].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase().replace(' ', '')}`}
                  className="text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 px-4 py-2 rounded-full transition-all duration-200"
                >
                  {item}
                </a>
              ))}
              <button
                onClick={() => navigate('/my-reports')}
                className="text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 px-4 py-2 rounded-full transition-all duration-200"
              >
                My Reports
              </button>
              <button
                onClick={() => navigate('/my-feedback')}
                className="text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 px-4 py-2 rounded-full transition-all duration-200"
              >
                My Feedback
              </button>
              <button
                onClick={() => navigate('/profile')}
                className="text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 px-4 py-2 rounded-full transition-all duration-200"
              >
                My Profile
              </button>
            </nav>

            <div className="flex items-center space-x-4">
              <ThemeToggle />
              {/* Notification Bell */}
              <NotificationBell />

              <span className="hidden sm:block text-xs text-muted-foreground dark:text-slate-400 text-right">
                Welcome,<br />
                <span className="text-foreground dark:text-white font-medium">{username}</span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="text-muted-foreground dark:text-slate-400 hover:text-foreground dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-full h-10 w-10"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Hero />
        <Features />
        <div id="milestones">
          <Milestones />
        </div>
        <Map />
        <Rewards />
        <div id="leaderboard">
          <SuccessStories />
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default MainApp;

