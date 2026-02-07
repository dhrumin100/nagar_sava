import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star, MessageSquare } from 'lucide-react';
import { feedbackService } from '@/lib/feedbackService';
import { useAuth } from '@/contexts/AuthProvider';
import { toast } from '@/hooks/use-toast';

interface FeedbackDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    type: 'technical_issue' | 'resolution_satisfaction';
    reportId: string | null;
    reportIssueType?: string;
}

export const FeedbackDialog = ({ open, onOpenChange, type, reportId, reportIssueType }: FeedbackDialogProps) => {
    const { user } = useAuth();
    const [rating, setRating] = useState(0);
    const [hoveredRating, setHoveredRating] = useState(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isTechnical = type === 'technical_issue';
    const title = isTechnical ? 'Report Submission Feedback' : 'Resolution Feedback';
    const description = isTechnical
        ? 'Did you face any technical issues while submitting your report?'
        : 'How satisfied are you with the resolution of your report?';

    const handleSubmit = async () => {
        if (rating === 0) {
            toast({
                title: 'Rating Required',
                description: 'Please provide a rating before submitting.',
                variant: 'destructive'
            });
            return;
        }

        if (!user) {
            toast({
                title: 'Error',
                description: 'You must be logged in to submit feedback.',
                variant: 'destructive'
            });
            return;
        }

        setIsSubmitting(true);

        try {
            // Get user name from localStorage
            const storedUser = localStorage.getItem('nagarSevaUser');
            const userName = storedUser ? JSON.parse(storedUser).full_name || 'Anonymous' : 'Anonymous';

            await feedbackService.createFeedback({
                user_id: user.id,
                report_id: reportId,
                type,
                rating,
                comment: comment.trim() || (isTechnical ? 'No issues reported' : 'No comment provided'),
                user_name: userName,
                report_issue_type: reportIssueType
            });

            toast({
                title: 'Thank You!',
                description: 'Your feedback has been submitted successfully.',
            });

            // Reset form
            setRating(0);
            setComment('');
            onOpenChange(false);
        } catch (error) {
            console.error('Error submitting feedback:', error);
            toast({
                title: 'Error',
                description: 'Failed to submit feedback. Please try again.',
                variant: 'destructive'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSkip = () => {
        setRating(0);
        setComment('');
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-civic-blue" />
                        {title}
                    </DialogTitle>
                    <DialogDescription>
                        {description}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Star Rating */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            {isTechnical ? 'Overall Experience' : 'Satisfaction Level'}
                        </label>
                        <div className="flex items-center gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setRating(star)}
                                    onMouseEnter={() => setHoveredRating(star)}
                                    onMouseLeave={() => setHoveredRating(0)}
                                    className="transition-transform hover:scale-110 focus:outline-none"
                                >
                                    <Star
                                        className={`w-8 h-8 ${star <= (hoveredRating || rating)
                                                ? 'fill-yellow-400 text-yellow-400'
                                                : 'text-gray-300'
                                            }`}
                                    />
                                </button>
                            ))}
                            {rating > 0 && (
                                <span className="ml-2 text-sm text-muted-foreground">
                                    {rating === 5 ? 'Excellent!' : rating === 4 ? 'Good' : rating === 3 ? 'Average' : rating === 2 ? 'Poor' : 'Very Poor'}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Comment */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            {isTechnical ? 'Describe any issues (Optional)' : 'Additional Comments (Optional)'}
                        </label>
                        <Textarea
                            placeholder={
                                isTechnical
                                    ? 'e.g., Photo upload was slow, form was confusing...'
                                    : 'e.g., The issue was resolved quickly and professionally...'
                            }
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            rows={4}
                            className="resize-none"
                        />
                    </div>

                    {/* Info Message */}
                    <div className="bg-muted/50 border border-border rounded-lg p-3 text-xs text-muted-foreground">
                        <p>
                            {isTechnical
                                ? 'Your feedback helps us improve the reporting experience for everyone.'
                                : 'Your feedback helps us ensure quality service delivery.'}
                        </p>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        variant="ghost"
                        onClick={handleSkip}
                        disabled={isSubmitting}
                    >
                        Skip
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting || rating === 0}
                        className="bg-civic-blue hover:bg-civic-blue/90"
                    >
                        {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
