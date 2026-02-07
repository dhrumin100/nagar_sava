import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, ShieldCheck, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

/**
 * Public Verification Page
 * Does not require authentication.
 */
const VerifyCertificate = () => {
    const { token } = useParams<{ token: string }>();
    const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'error'>('loading');
    const [details, setDetails] = useState<any>(null);

    useEffect(() => {
        if (!token) {
            setStatus('invalid');
            return;
        }

        const verify = async () => {
            try {
                // In a real app with backend, we would query by verification_token column.
                // Since this is a demo, we might check if it starts with 'DEMO-' or try to find it in our certificates table if we had that column.
                // Currently our civic_certificates table has 'verification_code' which we can use as the token.

                // Also handle the specific DEMO-TEACHER-VIEW case
                if (token === 'DEMO-TEACHER-VIEW') {
                    // Simulate network delay
                    await new Promise(r => setTimeout(r, 800));
                    setDetails({
                        citizen_name: "Naitik Patel (Demo)",
                        certificate_type: "Honorary Civic Mentor",
                        verification_code: token,
                        issue_date: new Date().toISOString(),
                        valid_until: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString(),
                        points_at_issue: 150
                    });
                    setStatus('valid');
                    return;
                }

                const { data, error } = await supabase
                    .from('civic_certificates')
                    .select('*, profiles:user_id(full_name)')
                    .eq('verification_code', token)
                    .single();

                if (error || !data) {
                    setStatus('invalid');
                } else {
                    setDetails({
                        citizen_name: data.profiles?.full_name || 'Verified Citizen',
                        certificate_type: data.certificate_type,
                        verification_code: data.verification_code,
                        issue_date: data.issue_date,
                        // Assuming validity is 1 year
                        valid_until: new Date(new Date(data.issue_date).setFullYear(new Date(data.issue_date).getFullYear() + 1)).toISOString(),
                        points_at_issue: data.points_at_issue
                    });
                    setStatus('valid');
                }
            } catch (err) {
                console.error(err);
                setStatus('error');
            }
        };

        verify();
    }, [token]);

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">

                <div className="text-center mb-8">
                    <div className="mx-auto w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-4">
                        <ShieldCheck className="w-8 h-8 text-slate-800" />
                    </div>
                    <h1 className="text-xl font-bold text-slate-900 tracking-tight">Civic Certificate Verification</h1>
                    <p className="text-sm text-slate-500 mt-1">NagarSeva Official Records</p>
                </div>

                <Card className="border-slate-200 shadow-sm overflow-hidden">
                    {status === 'loading' && (
                        <CardContent className="py-12 flex flex-col items-center justify-center text-slate-500">
                            <Loader2 className="w-8 h-8 animate-spin mb-4 text-slate-400" />
                            <p>Verifying authenticity...</p>
                        </CardContent>
                    )}

                    {status === 'valid' && details && (
                        <>
                            <div className="bg-emerald-50 border-b border-emerald-100 p-4 flex items-center justify-center gap-2 text-emerald-800 font-medium">
                                <CheckCircle2 className="w-5 h-5" />
                                <span>Certificate is VALID</span>
                            </div>
                            <CardContent className="p-6 space-y-6">
                                <div>
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Issued To</h3>
                                    <p className="text-lg font-semibold text-slate-900">{details.citizen_name}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Type</h3>
                                        <p className="text-sm font-medium text-slate-700">{details.certificate_type}</p>
                                    </div>
                                    <div>
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Status</h3>
                                        <p className="text-sm font-medium text-emerald-600">Active</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Issue Date</h3>
                                        <p className="text-sm text-slate-600">{new Date(details.issue_date).toLocaleDateString()}</p>
                                    </div>
                                    <div>
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Valid Until</h3>
                                        <p className="text-sm text-slate-600">{new Date(details.valid_until).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Verification Code</h3>
                                    <p className="font-mono text-sm bg-slate-50 p-2 rounded border border-slate-100 text-center select-all">
                                        {details.verification_code}
                                    </p>
                                </div>
                                <div className="pt-4 border-t border-slate-100">
                                    <p className="text-xs text-slate-400 text-center italic">
                                        This document was digitally generated and verified by the Civic Administration Authority.
                                    </p>
                                </div>
                            </CardContent>
                        </>
                    )}

                    {status === 'invalid' && (
                        <>
                            <div className="bg-red-50 border-b border-red-100 p-4 flex items-center justify-center gap-2 text-red-800 font-medium">
                                <XCircle className="w-5 h-5" />
                                <span>Certificate INVALID</span>
                            </div>
                            <CardContent className="p-8 text-center space-y-4">
                                <p className="text-slate-600">
                                    The verification token provided does not match any active records in our system.
                                </p>
                                <p className="text-xs text-slate-400">
                                    Include Code: {token || 'N/A'}
                                </p>
                            </CardContent>
                        </>
                    )}

                    {status === 'error' && (
                        <CardContent className="p-8 text-center text-red-600">
                            <p>System error during verification. Please try again later.</p>
                        </CardContent>
                    )}
                </Card>

                <div className="mt-8 text-center">
                    <Link to="/">
                        <Button variant="ghost" className="text-slate-500 hover:text-slate-900">
                            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default VerifyCertificate;
