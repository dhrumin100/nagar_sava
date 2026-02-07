import { supabase } from './supabaseClient';

export interface Feedback {
    id: string;
    user_id: string;
    report_id: string | null;
    type: 'technical_issue' | 'resolution_satisfaction';
    rating: number; // 1-5 stars
    comment: string;
    created_at: string;
    user_name?: string;
    report_issue_type?: string;
}

class FeedbackService {
    private storageKey = 'nagarSevaFeedback';

    // Create feedback
    async createFeedback(feedback: Omit<Feedback, 'id' | 'created_at'>): Promise<void> {
        const newFeedback: Feedback = {
            ...feedback,
            id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            created_at: new Date().toISOString()
        };

        if (supabase) {
            try {
                await supabase.from('feedback').insert(newFeedback);
                return;
            } catch (error) {
                console.error('Error creating feedback in Supabase:', error);
                // Fallback to localStorage
                this.saveToLocalStorage(newFeedback);
            }
        } else {
            // Use localStorage
            this.saveToLocalStorage(newFeedback);
        }
    }

    private saveToLocalStorage(feedback: Feedback): void {
        const existing = this.getFromLocalStorage();
        existing.unshift(feedback);
        localStorage.setItem(this.storageKey, JSON.stringify(existing));
    }

    private getFromLocalStorage(): Feedback[] {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error reading feedback from localStorage:', error);
            return [];
        }
    }

    // Get all feedback (for government dashboard)
    async getAllFeedback(): Promise<Feedback[]> {
        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('feedback')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (!error && data) {
                    return data;
                }
            } catch (error) {
                console.error('Error fetching feedback from Supabase:', error);
            }
        }

        // Fallback to localStorage
        return this.getFromLocalStorage();
    }

    // Get feedback by user
    async getFeedbackByUser(userId: string): Promise<Feedback[]> {
        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('feedback')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false });

                if (!error && data) {
                    return data;
                }
            } catch (error) {
                console.error('Error fetching user feedback from Supabase:', error);
            }
        }

        // Fallback to localStorage
        const all = this.getFromLocalStorage();
        return all.filter(f => f.user_id === userId);
    }

    // Get feedback by report
    async getFeedbackByReport(reportId: string): Promise<Feedback[]> {
        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('feedback')
                    .select('*')
                    .eq('report_id', reportId)
                    .order('created_at', { ascending: false });

                if (!error && data) {
                    return data;
                }
            } catch (error) {
                console.error('Error fetching report feedback from Supabase:', error);
            }
        }

        // Fallback to localStorage
        const all = this.getFromLocalStorage();
        return all.filter(f => f.report_id === reportId);
    }

    // Get feedback statistics
    async getFeedbackStats(): Promise<{
        total: number;
        technical: number;
        resolution: number;
        averageRating: number;
        ratingDistribution: Record<number, number>;
    }> {
        const allFeedback = await this.getAllFeedback();

        const stats = {
            total: allFeedback.length,
            technical: allFeedback.filter(f => f.type === 'technical_issue').length,
            resolution: allFeedback.filter(f => f.type === 'resolution_satisfaction').length,
            averageRating: 0,
            ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        };

        if (allFeedback.length > 0) {
            const totalRating = allFeedback.reduce((sum, f) => sum + f.rating, 0);
            stats.averageRating = totalRating / allFeedback.length;

            allFeedback.forEach(f => {
                stats.ratingDistribution[f.rating]++;
            });
        }

        return stats;
    }
}

export const feedbackService = new FeedbackService();
