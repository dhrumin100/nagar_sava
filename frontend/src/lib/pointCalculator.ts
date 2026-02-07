
import { Database } from "@/types/database.types";

type CivicReport = Database['public']['Tables']['civic_reports']['Row'];

import { Feedback } from "./feedbackService";

export interface PointBreakdown {
    photoPoints: number;
    resolutionPoints: number;
    validationPoints: number;
    feedbackPoints: number; // Replaces priorityPoints in UI focus, but we keep structure flexible
    priorityPoints: number;
    documentationPoints: number;
    monthlyBonus: number;
    total: number;
}

export const calculateUserPoints = (reports: CivicReport[], feedbacks: Feedback[] = []): PointBreakdown => {
    let breakdown: PointBreakdown = {
        photoPoints: 0,
        resolutionPoints: 0,
        validationPoints: 0,
        feedbackPoints: 0,
        priorityPoints: 0,
        documentationPoints: 0,
        monthlyBonus: 0,
        total: 0
    };

    const activeMonths = new Set<string>();

    reports.forEach(report => {
        // 1. Photo report submission (+10 pts)
        if (report.photo_urls && report.photo_urls.length > 0) {
            breakdown.photoPoints += 10;
        }

        // 2. Issue resolution verification (+30 pts)
        // Awarded if the issue is resolved
        if (report.status === 'resolved') {
            breakdown.resolutionPoints += 30;
        }

        // 3. Community validation (+5 pts)
        // Awarded if verified or resolved (assuming resolved implies valid)
        if (report.status === 'verified' || report.status === 'resolved') {
            breakdown.validationPoints += 5;
        }

        // 4. High-priority issue report (+25 pts)
        if (report.priority === 'High' || report.priority === 'Critical' || report.alert_triggered) {
            breakdown.priorityPoints += 25;
        }

        // 5. Follow-up documentation (+8 pts)
        // Awarded for detailed descriptions (heuristic) or resolution notes
        if (report.description && report.description.length > 100) {
            breakdown.documentationPoints += 8;
        }

        // Track unique months for consistency bonus
        if (report.created_at) {
            const date = new Date(report.created_at);
            const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
            activeMonths.add(monthKey);
        }
    });

    // 6. Monthly consistency bonus (+60 pts)
    // Awarded for each active month after the first one? Or just for being active this month?
    // 6. Monthly consistency bonus (+60 pts)
    // Awarded for each active month after the first one? Or just for being active this month?
    // Let's interpret as: 60 pts per active month.
    breakdown.monthlyBonus = activeMonths.size * 60;

    // 7. Feedback Points (+5 pts per feedback)
    if (feedbacks && feedbacks.length > 0) {
        breakdown.feedbackPoints = feedbacks.length * 5;
    }

    // Calculate Total
    breakdown.total =
        breakdown.photoPoints +
        breakdown.resolutionPoints +
        breakdown.validationPoints +
        breakdown.priorityPoints +
        breakdown.feedbackPoints +
        breakdown.documentationPoints +
        breakdown.monthlyBonus;

    return breakdown;
};

export const getLevel = (points: number) => {
    if (points < 100) return { name: 'Novice Citizen', min: 0, max: 100 };
    if (points < 300) return { name: 'Guardian', min: 100, max: 300 };
    if (points < 600) return { name: 'Sentinel', min: 300, max: 600 };
    if (points < 1000) return { name: 'Champion', min: 600, max: 1000 };
    return { name: 'Legend', min: 1000, max: 10000 };
};
