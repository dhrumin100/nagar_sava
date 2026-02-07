import { Building2, Lock, UserCheck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { authService } from "@/lib/authService";
import { useToast } from "@/hooks/use-toast";

const DeptSignIn = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const user = await authService.login(username);
            if (user && user.role === 'department') {
                toast({ title: "Login Successful", description: `Welcome, ${user.name}` });
                navigate("/dept-dashboard");
            } else {
                toast({ title: "Login Failed", description: "Invalid credentials or unauthorized access.", variant: "destructive" });
            }
        } catch (error) {
            toast({ title: "Error", description: "An error occurred during login.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-[0.05] pointer-events-none">
                <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <pattern id="hex" width="40" height="40" patternUnits="userSpaceOnUse">
                            <path d="M20 0 L40 10 L40 30 L20 40 L0 30 L0 10 Z" fill="none" stroke="currentColor" strokeWidth="0.5" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#hex)" />
                </svg>
            </div>

            <div className="absolute top-4 right-4 z-50">
                <ThemeToggle />
            </div>

            <Card className="w-full max-w-md bg-card/50 backdrop-blur-xl border-civic-orange/20 p-8 shadow-2xl animate-scale-in relative z-10">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 rounded-full bg-civic-orange/10 flex items-center justify-center mb-4 ring-1 ring-civic-orange/30">
                        <Building2 className="w-8 h-8 text-civic-orange" />
                    </div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Department Access</h1>
                    <p className="text-sm text-muted-foreground mt-1 flex items-center">
                        <Lock className="w-3 h-3 mr-1" /> Service Team Login
                    </p>
                </div>

                <form onSubmit={onSubmit} className="space-y-5">


                    <div className="space-y-2">
                        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Department ID</Label>
                        <Select value={username} onValueChange={setUsername}>
                            <SelectTrigger className="bg-background/50 border-white/10 focus:ring-civic-orange/20 h-11">
                                <SelectValue placeholder="Select Department" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="road_dept">Road Department</SelectItem>
                                <SelectItem value="sanitation_dept">Sanitation Department</SelectItem>
                                <SelectItem value="electric_dept">Electrical Department</SelectItem>
                                <SelectItem value="drainage_dept">Drainage Department</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Password</Label>
                        <Input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="bg-background/50 border-white/10 focus:border-civic-orange/50 focus:ring-civic-orange/20"
                        />
                    </div>

                    <Button
                        type="submit"
                        className="w-full bg-gradient-to-r from-civic-orange to-civic-purple hover:opacity-90 text-white shadow-lg shadow-civic-orange/20 h-11"
                        disabled={loading || !username || !password}
                    >
                        {loading ? "Verifying..." : "Access Dashboard"}
                    </Button>
                </form>

                <div className="mt-6 text-center">
                    <Button variant="link" className="text-xs text-muted-foreground" onClick={() => navigate('/signin')}>
                        Back to Citizen Login
                    </Button>
                </div>

                <div className="mt-4 p-3 bg-secondary/10 rounded-lg text-xs text-muted-foreground text-center">
                    <p>Demo Credentials:</p>
                    <p>ID: <code className="bg-background px-1 rounded">road_dept</code> | Pass: <code className="bg-background px-1 rounded">any</code></p>
                </div>
            </Card>
        </div>
    );
};

export default DeptSignIn;
