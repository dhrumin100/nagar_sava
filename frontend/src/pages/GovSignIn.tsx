import { Shield, Lock, KeyRound, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

import { useAuth } from "@/contexts/AuthProvider";

const GovSignIn = () => {
  const navigate = useNavigate();
  const { signInWithPassword } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Credentials Config
  const AUTHORIZED_ID = "1010";
  const AUTHORIZED_EMAIL = "vmc@gmail.com";
  const AUTHORIZED_CODE = "1234";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Strict Client-Side Validation for Demo
    if (username !== AUTHORIZED_ID) {
      setError("Invalid Office ID.");
      setLoading(false);
      return;
    }
    if (email !== AUTHORIZED_EMAIL) {
      setError("Unauthorized Email ID.");
      setLoading(false);
      return;
    }
    if (code !== AUTHORIZED_CODE) {
      setError("Invalid Security Code.");
      setLoading(false);
      return;
    }

    try {
      // Authenticate (Mock: We treat '1234' as the password for this demo user)
      // First, ensure this "Authority" user exists in our local mock DB so signIn works
      const mockDB = JSON.parse(localStorage.getItem('nagarSevaMockDB_Users') || '[]');
      const authorityUser = mockDB.find((u: any) => u.email === AUTHORIZED_EMAIL);

      if (!authorityUser) {
        // Auto-register the Authority if not found (first run)
        mockDB.push({
          id: 'authority_vmc_1010',
          username: AUTHORIZED_EMAIL,
          name: 'Authority VMC',
          role: 'authority', // Important Role
          email: AUTHORIZED_EMAIL,
          password: AUTHORIZED_CODE,
          points: 0
        });
        localStorage.setItem('nagarSevaMockDB_Users', JSON.stringify(mockDB));
      }

      await signInWithPassword(email, code);
      navigate("/gov");
    } catch (err: any) {
      console.error("Gov login failed", err);
      // Fallback for demo if authProvider fails due to strictness elsewhere
      setError("System Error: Use 1010 / vmc@gmail.com / 1234");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Map Texture Background (Simulated with SVG) */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md bg-card/90 backdrop-blur-md border-civic-blue/20 p-8 shadow-2xl animate-scale-in relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-full bg-civic-blue/10 flex items-center justify-center mb-4 ring-1 ring-civic-blue/30">
            <Shield className="w-8 h-8 text-civic-blue" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Authority Login</h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center">
            <Lock className="w-3 h-3 mr-1" /> Secure Official Access Only
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Officer ID / Username</Label>
            <div className="relative">
              <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter Officer ID"
                className="pl-10 bg-background/50 border-white/10 focus:border-civic-blue/50 focus:ring-civic-blue/20"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Authorized Email ID</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@vadodaracorp.in"
              className="bg-background/50 border-white/10 focus:border-civic-blue/50 focus:ring-civic-blue/20"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Security Code</Label>
            <div className="relative">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter security token"
                className="pl-10 bg-background/50 border-white/10 focus:border-civic-blue/50 focus:ring-civic-blue/20"
              />
              <KeyRound className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-civic-blue hover:bg-civic-blue/90 text-white shadow-lg shadow-civic-blue/20 h-11"
            disabled={loading || !username || !email || !code}
          >
            {loading ? "Verifying Credentials..." : "Secure Login"}
          </Button>

          {error && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-center">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </form>

        <div className="mt-6 text-center">
          <Button variant="link" className="text-xs text-muted-foreground" onClick={() => navigate('/signin')}>
            Back to Citizen Login
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default GovSignIn;
