
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthProvider";
import { feedbackService, Feedback } from "@/lib/feedbackService";
import GovernmentTopBar from "@/components/GovernmentTopBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MessageSquare, Star, Clock, AlertCircle } from "lucide-react";

const MyFeedback = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadFeedback = async () => {
            if (!user) return;
            try {
                const data = await feedbackService.getFeedbackByUser(user.id);
                setFeedbacks(data);
            } catch (error) {
                console.error("Failed to load feedback:", error);
            } finally {
                setLoading(false);
            }
        };

        loadFeedback();
    }, [user]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-civic-blue/5 via-background to-civic-green/5 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading your feedback history...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <GovernmentTopBar />
            <div className="flex-1 bg-gradient-to-br from-civic-blue/5 via-background to-civic-green/5">
                <div className="container mx-auto px-6 py-8">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center space-x-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(-1)}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back
                            </Button>
                            <div>
                                <h1 className="text-3xl font-bold text-foreground">My Feedback</h1>
                                <p className="text-muted-foreground">History of your valuable contributions and ratings</p>
                            </div>
                        </div>
                    </div>

                    {/* Feedback List */}
                    {feedbacks.length === 0 ? (
                        <Card className="bg-gradient-card border-border/50">
                            <CardContent className="p-12 text-center">
                                <div className="w-16 h-16 bg-muted rounded-xl flex items-center justify-center mx-auto mb-4">
                                    <MessageSquare className="w-8 h-8 text-muted-foreground" />
                                </div>
                                <h3 className="text-lg font-semibold text-foreground mb-2">No Feedback Yet</h3>
                                <p className="text-muted-foreground mb-6">
                                    You haven't provided any feedback yet. Share your experience when your reports are resolved!
                                </p>
                                <Button
                                    onClick={() => navigate('/my-reports')}
                                    className="bg-gradient-civic hover:opacity-90"
                                >
                                    Go to My Reports
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-6">
                            {feedbacks.map((item) => (
                                <Card key={item.id} className="bg-gradient-card border-border/50 hover:shadow-card transition-all duration-300">
                                    <CardContent className="p-6">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center space-x-3 mb-2">
                                                    <Badge variant={item.type === 'resolution_satisfaction' ? 'default' : 'secondary'} className="capitalize">
                                                        {item.type.replace('_', ' ')}
                                                    </Badge>
                                                    {item.rating > 0 && (
                                                        <div className="flex items-center text-amber-500">
                                                            {[...Array(5)].map((_, i) => (
                                                                <Star key={i} className={`w-4 h-4 ${i < item.rating ? 'fill-current' : 'text-gray-300'}`} />
                                                            ))}
                                                        </div>
                                                    )}
                                                    <span className="text-xs text-muted-foreground flex items-center">
                                                        <Clock className="w-3 h-3 mr-1" />
                                                        {new Date(item.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>

                                                {item.type === 'resolution_satisfaction' && (
                                                    <p className="text-sm text-muted-foreground mb-2">
                                                        Feedback for Report ID: <span className="font-mono text-foreground font-medium">{item.report_id || 'N/A'}</span>
                                                    </p>
                                                )}

                                                {item.comment ? (
                                                    <p className="text-foreground italic">"{item.comment}"</p>
                                                ) : (
                                                    <p className="text-muted-foreground italic text-sm">No comment provided.</p>
                                                )}
                                            </div>

                                            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center ml-4 shrink-0">
                                                {item.type === 'technical_issue' ? (
                                                    <AlertCircle className="w-5 h-5 text-muted-foreground" />
                                                ) : (
                                                    <MessageSquare className="w-5 h-5 text-muted-foreground" />
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MyFeedback;
