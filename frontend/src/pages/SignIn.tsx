import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Eye, EyeOff, AlertCircle, Fingerprint, Building2, Phone, User, KeyRound } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/hooks/use-toast";

const SignIn = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { signInWithPassword, signUp } = useAuth();

  // Form States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userName, setUserName] = useState("");
  const [mobile, setMobile] = useState("");

  // OTP States
  const [otp, setOtp] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);

  // UI States
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  // Validation Logic
  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValidMobile = (mobile: string) => /^[0-9]{10}$/.test(mobile);

  const handleSendOtp = () => {
    setError("");
    if (!isValidMobile(mobile)) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    // Simulate OTP Generation
    const mockOtp = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(mockOtp);
    setIsOtpSent(true);

    // Simulate SMS sending delay
    toast({
      title: "OTP Sent",
      description: `Your OTP is: ${mockOtp} (Simulated)`, // In real app, this goes to SMS
      duration: 15000,
    });
    console.log("Simulated OTP:", mockOtp);
  };

  const handleVerifyOtp = () => {
    if (otp === generatedOtp) {
      setIsOtpVerified(true);
      toast({
        title: "Verified",
        description: "Mobile number verified successfully.",
        variant: "default"
      });
      setError("");
    } else {
      setError("Invalid OTP. Please try again.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Common Validation
    if (!email.trim() || !password.trim()) {
      setError(t("Enter email and password"));
      setIsLoading(false);
      return;
    }

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      setIsLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        // Sign Up Specific Validation
        if (!userName.trim()) {
          setError("Please enter your full name.");
          setIsLoading(false);
          return;
        }
        if (!isOtpVerified) {
          setError("Please verify your mobile number first.");
          setIsLoading(false);
          return;
        }

        const data = await signUp(email, password, { full_name: userName, phone: mobile });
        if (data && !data.session && data.user) {
          setError(t("Account created! Please check your email to confirm."));

          // MANUAL PROFILE SYNC: Ensure phone is saved even if trigger misses it
          // Note: We can only write if RLS allows 'update own profile' which is set in schema
          if (mobile && supabase) {
            await supabase.from('profiles').update({ phone: mobile }).eq('id', data.user.id);
          }

          setIsLoading(false);
          return;
        }

        // If auto-login happened (session exists)
        if (data.session && data.user) {
          if (mobile && supabase) {
            await supabase.from('profiles').update({ phone: mobile }).eq('id', data.user.id);
          }
        }

      } else {
        // Sign In
        await signInWithPassword(email, password);
      }
      navigate("/app");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Authentication failed. Check credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLanding = () => {
    navigate("/");
  };

  const toggleMode = () => {
    setError("");
    setIsSignUp(!isSignUp);
    // Reset Form
    setUserName("");
    setMobile("");
    setOtp("");
    setIsOtpSent(false);
    setIsOtpVerified(false);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-background transition-colors duration-300">
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M0 0 L100 100 M100 0 L0 100" stroke="currentColor" strokeWidth="0.5" />
          <circle cx="50" cy="50" r="30" stroke="currentColor" strokeWidth="0.5" fill="none" />
        </svg>
      </div>

      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-civic-orange/20 blur-[100px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-civic-green/20 blur-[100px]" />

      <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md relative z-10 bg-card/50 backdrop-blur-xl border-white/10 shadow-2xl animate-scale-in">
        <div className="p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-civic-orange to-civic-purple rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-civic-orange/20 transform rotate-3 hover:rotate-0 transition-transform duration-300">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-civic-orange via-civic-purple to-civic-blue bg-clip-text text-transparent mb-2">
              {isSignUp ? "Join Nagarseva" : t("welcome_back")}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isSignUp ? "Verified Citizen Registration" : t("signin_subtitle")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Sign Up Fields */}
            {isSignUp && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="userName" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Full Name
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="userName"
                      type="text"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder="Jane Doe"
                      className="pl-9 bg-background/50 border-white/10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mobile" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Mobile Number
                  </Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="mobile"
                        type="tel"
                        value={mobile}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          if (val.length <= 10) setMobile(val);
                        }}
                        placeholder="9876543210"
                        className="pl-9 bg-background/50 border-white/10"
                        disabled={isOtpVerified}
                        required
                      />
                    </div>
                    {!isOtpVerified && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleSendOtp}
                        disabled={mobile.length !== 10 || isOtpSent}
                      >
                        {isOtpSent ? "Resend" : "Send OTP"}
                      </Button>
                    )}
                    {isOtpVerified && (
                      <Button type="button" variant="ghost" size="sm" className="text-green-500 cursor-default hover:text-green-500 hover:bg-transparent">
                        <Shield className="w-4 h-4 mr-1" /> Verified
                      </Button>
                    )}
                  </div>
                </div>

                {isOtpSent && !isOtpVerified && (
                  <div className="space-y-2 animate-fade-in">
                    <Label htmlFor="otp" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Verify OTP
                    </Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="otp"
                          type="text"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          placeholder="Enter OTP"
                          className="pl-9 bg-background/50 border-white/10"
                          maxLength={4}
                        />
                      </div>
                      <Button type="button" onClick={handleVerifyOtp} size="sm">
                        Verify
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="bg-background/50 border-white/10 transition-all"
                disabled={isLoading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("password")}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("password")}
                  className="pr-10 bg-background/50 border-white/10 transition-all"
                  required
                  disabled={isLoading}
                  minLength={6}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 text-muted-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg animate-fade-in">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  <p className="text-xs text-destructive font-medium">{error}</p>
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-civic-orange to-civic-purple hover:opacity-90 shadow-lg text-white font-semibold h-11"
              disabled={isLoading || (isSignUp && !isOtpVerified)}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Processing...</span>
                </div>
              ) : (
                isSignUp ? "Create Account" : t("sign_in")
              )}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Button
              variant="link"
              className="text-xs text-civic-orange hover:text-civic-purple transition-colors"
              onClick={toggleMode}
            >
              {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
            </Button>
          </div>

          {!isSignUp && (
            <div className="mt-6 space-y-3">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/50" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Secure Access</span>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <Button
                  variant="outline"
                  className="w-full border-civic-green/20 hover:bg-civic-green/5 text-civic-green"
                  onClick={() => window.open("https://myaadhaar.uidai.gov.in/login", "_blank")}
                >
                  <Fingerprint className="w-4 h-4 mr-2" />
                  Login with Aadhaar
                </Button>
              </div>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-border/50">
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="ghost"
                className="w-full text-xs h-auto py-2 text-muted-foreground"
                onClick={() => navigate('/gov-signin')}
              >
                <Shield className="w-3 h-3 mr-2" />
                Authority Login
              </Button>
              <Button
                variant="ghost"
                className="w-full text-xs h-auto py-2 text-muted-foreground"
                onClick={() => navigate('/dept-signin')}
              >
                <Building2 className="w-3 h-3 mr-2" />
                Dept. Access
              </Button>
            </div>
          </div>

          <div className="mt-4 text-center">
            <Button
              variant="link"
              onClick={handleBackToLanding}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {t("back_to_landing")}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default SignIn;
