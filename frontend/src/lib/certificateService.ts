import { supabase } from './supabaseClient';

export interface CivicCertificate {
    id: string;
    user_id: string;
    certificate_type: string;
    issue_date: string;
    verification_code: string;
    report_count_at_issue: number;
    points_at_issue: number;
}

export const certificateService = {
    /**
     * Fetches all certificates for the current user.
     */
    getMyCertificates: async (): Promise<CivicCertificate[]> => {
        const { data, error } = await supabase
            .from('civic_certificates')
            .select('*')
            .order('issue_date', { ascending: false });

        if (error) {
            console.error('Error fetching certificates:', error);
            return [];
        }
        return data || [];
    },

    /**
     * Claims a certificate via the secure database RPC.
     * @param level 'Bronze' | 'Silver' | 'Gold'
     * @param currentReportCount Current count of reports (passed for record keeping, verified by points)
     */
    claimCertificate: async (level: 'Bronze' | 'Silver' | 'Gold', currentReportCount: number) => {
        // Call the RPC function defined in civic_incentive_system.sql
        const { data, error } = await supabase.rpc('claim_civic_certificate', {
            p_certificate_type: level,
            p_report_count: currentReportCount
        });

        if (error) {
            throw error;
        }
        return data;
    },

    /**
     * Helper to check eligibility based on points.
     */
    checkEligibility: (points: number) => {
        return {
            bronze: points >= 60,
            silver: points >= 120,
            gold: points >= 300,
        };
    }
};
