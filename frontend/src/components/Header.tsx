import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Shield, Users, Award } from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";
import { useState } from "react";

const Header = () => {
  const [isSignInOpen, setIsSignInOpen] = useState(false);

  const { t } = useI18n();
  return (
    <header className="sticky top-0 w-full z-40 bg-background/80 backdrop-blur-md border-b border-border/50 shadow-sm transition-all duration-300">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 group cursor-pointer" onClick={() => window.location.href = '/'}>
            <div className="relative transition-transform duration-300 group-hover:scale-105">
              <img
                src="/algozen.png"
                alt="NagarSewa Logo"
                className="w-10 h-10 rounded-lg object-contain bg-transparent"
              />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-civic-orange rounded-full animate-glow-pulse"></div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight group-hover:text-primary transition-colors">{t("app_name")}</h1>
              <p className="text-xs text-muted-foreground">{t("tagline")}</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center space-x-8">
            {['Features', 'Rewards', 'Success Stories'].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().split(' ')[0]}`}
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors relative group"
              >
                {item}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full"></span>
              </a>
            ))}
          </nav>

          <div className="flex items-center space-x-4">
            <div className="hidden md:block"><LanguageSwitcher /></div>
            <Dialog open={isSignInOpen} onOpenChange={setIsSignInOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="hidden md:flex font-medium hover:bg-primary/10 hover:text-primary">
                  {t("sign_in")}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-center text-2xl font-bold gradient-text">Sign In to NagarSewa</DialogTitle>
                </DialogHeader>
                <div className="p-6 text-center space-y-6">
                  <p className="text-muted-foreground">Choose your preferred sign-in method to access civic services</p>
                  <div className="space-y-3">
                    <Button className="w-full bg-gradient-civic shadow-lg hover:shadow-xl transition-all py-6 text-lg font-semibold">
                      Sign in with Aadhaar
                    </Button>
                    <Button variant="outline" className="w-full py-6 text-lg hover:bg-secondary/5 border-2">
                      Sign in with Mobile
                    </Button>
                    <Button variant="outline" className="w-full py-6 text-lg hover:bg-secondary/5 border-2">
                      Sign in with Email
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button
              variant="default"
              size="sm"
              className="bg-gradient-civic hover:opacity-90 transition-all shadow-md hover:shadow-lg text-white font-semibold px-6"
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Get Started
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
