import React from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "./ui/button";
import { LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthProvider";

interface GovernmentTopBarProps {
  variant?: "default" | "transparent";
}

const GovernmentTopBar: React.FC<GovernmentTopBarProps> = ({ variant = "default" }) => {
  const isTransparent = variant === "transparent";
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate('/gov-signin');
  };

  return (
    <div className={cn(
      "w-full border-b transition-colors duration-300",
      isTransparent ? "bg-white/80 dark:bg-transparent border-slate-200 dark:border-white/10 text-slate-900 dark:text-white" : "bg-background border-border text-foreground"
    )}>
      <div className="h-1 w-full flex">
        <div className="h-full flex-1 bg-[hsl(25,95%,53%)]"></div>
        <div className="h-full flex-1 bg-white"></div>
        <div className="h-full flex-1 bg-[hsl(142,70%,29%)]"></div>
      </div>
      <div className="container mx-auto px-6 py-2 flex items-center justify-between text-xs sm:text-sm">
        <div className="flex items-center space-x-2">
          <span className={cn("font-semibold", isTransparent ? "text-slate-900 dark:text-white" : "text-foreground")}>Government of India</span>
          <span className={cn(isTransparent ? "text-slate-400 dark:text-white/60" : "text-muted-foreground")}>|</span>
          <span className={cn(isTransparent ? "text-slate-600 dark:text-white/80" : "text-muted-foreground")}>Digital Civic Services Portal</span>
          {!import.meta.env.VITE_SUPABASE_URL && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[10px] font-bold uppercase tracking-wider">
              Local Demo Mode
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className={cn("hidden sm:block", isTransparent ? "text-slate-500 dark:text-white/60" : "text-muted-foreground")}>Secure • Verified • Accessible</div>
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className={cn(
              "h-8 px-3 text-xs",
              isTransparent ? "text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-white dark:hover:bg-white/10" : "text-foreground hover:bg-muted"
            )}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GovernmentTopBar;


