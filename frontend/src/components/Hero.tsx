import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Camera, MapPin, Smartphone, FileText, Users, ArrowRight, ChevronRight } from "lucide-react";
import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import PhotoCapture from "./PhotoCapture";
import ReportSubmission from "./ReportSubmission";
import ReportSuccess from "./ReportSuccess";
import VerificationModal from "./VerificationModal";
import ImageAnalysisResult from "./ImageAnalysisResult";
import { FeedbackDialog } from "./FeedbackDialog";
import { useI18n } from "@/lib/i18n";
import { reportStorage } from "@/lib/reportStorage";
import { motion, useScroll, useTransform } from "framer-motion";
import { AIAnalysisResult } from "@/lib/aiService";

interface ReportData {
  photos: File[];
  issueType: string;
}

import { useAuth } from "@/contexts/AuthProvider";

const Hero = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuth(); // Get user context
  const [isReportingOpen, setIsReportingOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<'select' | 'location-confirm' | 'location-input' | 'photo' | 'analysis-result' | 'submission' | 'success'>('select');
  const [selectedIssueType, setSelectedIssueType] = useState<string>('');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportId, setReportId] = useState<string>('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reportingPath, setReportingPath] = useState<'onsite' | 'remote' | null>(null);
  const [reportFormData, setReportFormData] = useState<any>(null);
  const [locationData, setLocationData] = useState<{ latitude: number, longitude: number, address: string } | undefined>(undefined);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<AIAnalysisResult | undefined>(undefined);
  const [analyzedPhotos, setAnalyzedPhotos] = useState<File[]>([]);
  const [manualAddressInput, setManualAddressInput] = useState('');
  const [isLocating, setIsLocating] = useState(false);

  // AI Verification State
  const [isVerificationOpen, setIsVerificationOpen] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);

  // Feedback State
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackReportId, setFeedbackReportId] = useState<string | null>(null);
  const [feedbackIssueType, setFeedbackIssueType] = useState<string>('');

  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

  const yText = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const opacityText = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scaleHero = useTransform(scrollYProgress, [0, 1], [1, 1.1]);





  const handleIssueTypeSelect = (issueType: string) => {
    setSelectedIssueType(issueType);
    setCurrentStep('location-confirm');
  };

  const fetchCurrentLocation = () => {
    setIsLocating(true);
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        // Simple reverse geocode or just use coords
        try {
           const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
          );
          const data = await response.json();
          setLocationData({
            latitude,
            longitude,
            address: data.display_name || `Lat: ${latitude}, Long: ${longitude}`
          });
        } catch (e) {
          setLocationData({
            latitude,
            longitude,
            address: `Lat: ${latitude}, Long: ${longitude}`
          });
        }
        setIsLocating(false);
        setCurrentStep('photo');
      },
      (error) => {
        console.error("Error getting location", error);
        alert("Unable to retrieve your location. Please check permissions.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleLocationConfirm = (isAtLocation: boolean) => {
    setReportingPath(isAtLocation ? 'onsite' : 'remote');
    if (isAtLocation) {
      // Fetch GPS then go to photo
      fetchCurrentLocation();
    } else {
      // Go to manual location input
      setCurrentStep('location-input');
    }
  };

  const handleManualLocationSubmit = () => {
    if (!manualAddressInput.trim()) return;
    // Mock coords for manual address or use a geocoder
    setLocationData({
      latitude: 22.3072, // Default/Mock
      longitude: 73.1812,
      address: manualAddressInput
    });
    setCurrentStep('photo');
  };

  const handleAnalysisComplete = (result: AIAnalysisResult, photos: File[]) => {
    setAiAnalysisResult(result);
    setAnalyzedPhotos(photos);
    setCurrentStep('analysis-result');
  };

  const handlePhotoCaptured = async (photos: File[], issueType: string) => {
    // Legacy Handler (Fallback if analysis skipped)
     setPendingPhotos(photos);
     // Skip analysis, go straight to form?
     // Or force simple flow.
     // For now, if no analysis result, just go to submission
     setCurrentStep('submission');
  };

  const handleVerified = async (token: string) => {
    setIsVerificationOpen(false);

    if (reportFormData && pendingPhotos.length > 0) {
      try {
        // Upload photos first
        const photoUrls = await Promise.all(pendingPhotos.map(p => reportStorage.uploadPhoto(p)));

        const finalReportData = {
          ...reportFormData,
          photo: pendingPhotos[0],
          photoUrls: photoUrls,
          status: 'reported' as const,
          verificationToken: token, // Attach the secure token
          userId: user?.id // Explicitly link to current user
        };

        const reportId = await reportStorage.storeReport(finalReportData);
        setReportId(reportId);
        setCurrentStep('success');
      } catch (error) {
        console.error('Failed to submit report with photos:', error);
        alert(error instanceof Error ? error.message : "Failed to upload photos or submit report. Please try again.");
      }
    }
  };

  const handleReportFormComplete = async (formData: any) => {
    // Photos are already captured before the form, so skip the "Add Photos?" popup
    // and submit directly with the photos already attached
    setReportFormData(formData);
    
    try {
      // Use analyzedPhotos (captured before form) if available
      const photosToUpload = analyzedPhotos.length > 0 ? analyzedPhotos : pendingPhotos;
      
      if (photosToUpload.length > 0) {
        // Upload photos
        const photoUrls = await Promise.all(photosToUpload.map(p => reportStorage.uploadPhoto(p)));
        
        const finalReportData = {
          ...formData,
          photo: photosToUpload[0],
          photoUrls: photoUrls,
          status: 'reported' as const,
          userId: user?.id
        };
        
        const reportId = await reportStorage.storeReport(finalReportData);
        setReportId(reportId);
        
        // Go directly to success screen (feedback is in My Reports section)
        setCurrentStep('success');
      } else {
        // No photos - submit without
        const finalReportData = {
          ...formData,
          photo: new File([], 'placeholder.jpg', { type: 'image/jpeg' }),
          photoUrls: [],
          status: 'reported' as const,
          userId: user?.id
        };
        
        const reportId = await reportStorage.storeReport(finalReportData);
        setReportId(reportId);
        
        // Go directly to success screen (feedback is in My Reports section)
        setCurrentStep('success');
      }
    } catch (error) {
      console.error('Failed to submit report:', error);
      alert(error instanceof Error ? error.message : "Failed to submit report. Please try again.");
    }
  };

  const handleReportSuccess = async () => {
    if (reportFormData) {
      const finalReportData = {
        ...reportFormData,
        photo: new File([], 'placeholder.jpg', { type: 'image/jpeg' }),
        photoUrls: [],
        status: 'reported' as const,
        userId: user?.id // Explicitly link to current user
      };

      try {
        const reportId = await reportStorage.storeReport(finalReportData);
        setReportId(reportId);

        // Show feedback dialog FIRST (don't change step yet)
        setFeedbackReportId(reportId);
        setFeedbackIssueType(selectedIssueType);
        setIsFeedbackOpen(true);
        // Success step will be shown after feedback dialog is closed
      } catch (error) {
        console.error('Failed to submit report without photos:', error);
        const id = Math.random().toString(36).substr(2, 9).toUpperCase();
        setReportId(id);

        // Show feedback dialog FIRST (don't change step yet)
        setFeedbackReportId(id);
        setFeedbackIssueType(selectedIssueType);
        setIsFeedbackOpen(true);
        // Success step will be shown after feedback dialog is closed
      }
    }
  };

  const handleCloseReporting = () => {
    setIsReportingOpen(false);
    setCurrentStep('select');
    setSelectedIssueType('');
    setReportData(null);
    setReportFormData(null);
    setReportId('');
    setConfirmOpen(false);
    setReportingPath(null);
  };

  const handleNewReport = () => {
    setCurrentStep('select');
    setSelectedIssueType('');
    setReportData(null);
    setReportFormData(null);
    setReportId('');
    setConfirmOpen(false);
    setReportingPath(null);
  };

  const renderReportingContent = () => {
    switch (currentStep) {
      case 'select':
        return (
          <>
            <DialogHeader>
              <DialogTitle>Select Issue Type</DialogTitle>
            </DialogHeader>
            <div className="p-4 space-y-4">
              <p className="text-muted-foreground">What civic issue would you like to report?</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { type: 'Potholes', icon: Camera },
                  { type: 'Garbage', icon: Camera },
                  { type: 'Street Light', icon: Camera },
                  { type: 'Waterlogging', icon: Camera }
                ].map((issue, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="h-20 flex-col hover:border-primary/50 hover:bg-primary/5 transition-all"
                    onClick={() => handleIssueTypeSelect(issue.type)}
                  >
                    <issue.icon className="w-6 h-6 mb-2" />
                    <span className="text-sm">{issue.type}</span>
                  </Button>
                ))}
              </div>
            </div>
          </>
        );

      case 'location-confirm':
        return (
          <>
            <DialogHeader>
              <DialogTitle>Location Confirmation</DialogTitle>
            </DialogHeader>
            <div className="p-6 space-y-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-gradient-civic rounded-xl flex items-center justify-center mx-auto">
                  <MapPin className="w-8 h-8 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Are you currently at the location of the issue you want to report?
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    This helps us determine the best way to capture location and photo evidence.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <Button
                  onClick={() => handleLocationConfirm(true)}
                  className="h-auto py-6 flex-col bg-gradient-civic hover:opacity-90 space-y-1"
                >
                  <MapPin className="w-6 h-6 mb-1" />
                  <span className="font-semibold text-lg">
                    {isLocating ? "Getting Location..." : "Confirm & Continue"}
                  </span>
                  <span className="text-sm opacity-90">Use GPS & live camera</span>
                </Button>
              </div>
            </div>
          </>
        );

      case 'location-input':
        return (
          <>
            <DialogHeader>
              <DialogTitle>Enter Location</DialogTitle>
            </DialogHeader>
             <div className="p-6 space-y-4">
                <p className="text-muted-foreground">Please enter the address where the issue is located.</p>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Street, Landmark, Area, City..."
                  value={manualAddressInput}
                  onChange={(e) => setManualAddressInput(e.target.value)}
                />
                <Button onClick={handleManualLocationSubmit} className="w-full bg-gradient-civic">
                  Next: Add Photos
                </Button>
             </div>
          </>
        );

      case 'photo':
        return (
          <PhotoCapture
            issueType={selectedIssueType}
            onPhotoCaptured={handlePhotoCaptured}
            onClose={() => handleCloseReporting()}
            modeRestriction={reportingPath === 'onsite' ? 'camera' : 'gallery'}
            location={locationData}
            onAnalysisComplete={handleAnalysisComplete}
          />
        );

      case 'analysis-result':
        return aiAnalysisResult ? (
          <ImageAnalysisResult
            analysis={aiAnalysisResult}
            photos={analyzedPhotos}
            onContinue={() => setCurrentStep('submission')}
            onRetake={() => setCurrentStep('photo')}
          />
        ) : (
          <div className="p-8 text-center flex flex-col items-center justify-center">
             <div className="animate-spin h-8 w-8 border-4 border-civic-blue border-t-transparent rounded-full mb-4" />
             <p>Processing results...</p>
          </div>
        );

      case 'submission':
        return (
          <ReportSubmission
            photos={analyzedPhotos.length > 0 ? analyzedPhotos : pendingPhotos}
            issueType={selectedIssueType}
            onClose={handleCloseReporting}
            onSuccess={handleReportFormComplete}
            reportingPath={reportingPath}
            aiAnalysis={aiAnalysisResult}
          />
        );

      case 'success':
        return (
          <ReportSuccess
            issueType={selectedIssueType}
            reportId={reportId}
            onClose={handleCloseReporting}
            onNewReport={handleNewReport}
          />
        );

      default:
        return null;
    }
  };

  return (
    <>
      <section ref={containerRef} className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-background">
        {/* Dynamic Abstract Background */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            style={{ scale: scaleHero }}
            className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_#ffffff,_#f3f4f6)] dark:bg-[radial-gradient(circle_at_50%_50%,_rgba(17,24,39,1),_rgba(11,17,32,1))]"
          />
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>

          {/* Subtle Moving Orbs - Not Glowy, just depth */}
          <motion.div
            animate={{ y: [0, -20, 0], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 dark:bg-blue-900/20 rounded-full blur-3xl"
          />
          <motion.div
            animate={{ y: [0, 30, 0], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-teal-500/10 dark:bg-teal-900/10 rounded-full blur-3xl"
          />
        </div>

        {/* Content */}
        <motion.div
          style={{ y: yText, opacity: opacityText }}
          className="relative z-10 container mx-auto px-6 text-center"
        >
          <div className="max-w-5xl mx-auto">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="inline-flex items-center space-x-2 bg-slate-100/80 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-full px-4 py-1.5 mb-10"
            >
              <span className="flex h-2 w-2 rounded-full bg-emerald-400"></span>
              <span className="text-sm font-medium text-muted-foreground dark:text-slate-300 tracking-wide">Trusted by 50,000+ citizens</span>
            </motion.div>

            {/* Main Heading */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              className="text-6xl md:text-8xl font-bold text-slate-900 dark:text-white mb-8 leading-[1.1] tracking-tight"
            >
              Report Issues.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-200 dark:to-white">
                Transform Cities.
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
              className="text-xl md:text-2xl text-muted-foreground dark:text-slate-400 font-light leading-relaxed max-w-2xl mx-auto mb-12"
            >
              Empower your community with instant civic reporting. Snap, report, and watch your city become better.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
              className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6 mb-20"
            >
              <Dialog open={isReportingOpen} onOpenChange={setIsReportingOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="lg"
                    className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 px-10 py-7 text-lg font-semibold rounded-full transition-all duration-300 shadow-xl shadow-slate-200/50 dark:shadow-white/5"
                  >
                    Start Reporting <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl w-full">
                  {renderReportingContent()}
                </DialogContent>
              </Dialog>

              <Button
                variant="ghost"
                size="lg"
                className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/5 px-8 py-7 text-lg font-medium rounded-full transition-all duration-300"
                onClick={() => navigate('/my-reports')}
              >
                My Reports <ChevronRight className="ml-1 w-5 h-5" />
              </Button>
            </motion.div>

            {/* Features Preview - Minimalist Cards */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8, ease: "easeOut" }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto"
            >
              {[
                {
                  icon: Camera,
                  title: "Snap & Report",
                  description: "Take a photo and instantly report civic issues"
                },
                {
                  icon: MapPin,
                  title: "Auto-Location",
                  description: "GPS automatically tags your exact location"
                },
                {
                  icon: Users,
                  title: "Community Impact",
                  description: "Join thousands making real change happen"
                }
              ].map((feature, index) => (
                <div
                  key={index}
                  className="bg-white/60 dark:bg-white/5 backdrop-blur-sm border border-slate-200 dark:border-white/5 rounded-2xl p-8 hover:bg-white/80 dark:hover:bg-white/10 transition-all duration-500 group text-left shadow-sm dark:shadow-none"
                >
                  <div className="w-12 h-12 bg-slate-100 dark:bg-white/5 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                    <feature.icon className="w-6 h-6 text-blue-600 dark:text-blue-200" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground dark:text-slate-400 text-sm leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Confirmation: add photos? */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add Photos to Your Report?</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-muted-foreground">
              Would you like to add photos to strengthen your report? Photos help authorities understand and resolve issues faster.
            </p>
            {reportingPath && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium mb-1">
                  {reportingPath === 'onsite' ? '📸 On-site Photo Capture:' : '🖼️ Remote Photo Upload:'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {reportingPath === 'onsite'
                    ? 'You can take live photos using your device camera at the issue location'
                    : 'You can upload existing photos from your device gallery or storage'
                  }
                </p>
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setConfirmOpen(false);
              handleReportSuccess(); // Submit without photos
            }}>Skip Photos</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setConfirmOpen(false);
              setCurrentStep('photo');
            }}>
              {reportingPath === 'onsite' ? 'Take Photos' : 'Upload Photos'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <VerificationModal
        isOpen={isVerificationOpen}
        onClose={() => setIsVerificationOpen(false)}
        imageFile={pendingPhotos[0] || null}
        onVerified={handleVerified}
        category={selectedIssueType}
      />

      <FeedbackDialog
        open={isFeedbackOpen}
        onOpenChange={(open) => {
          setIsFeedbackOpen(open);
          // When feedback dialog is closed, show success screen
          if (!open && reportId) {
            setCurrentStep('success');
          }
        }}
        type="technical_issue"
        reportId={feedbackReportId}
        reportIssueType={feedbackIssueType}
      />
    </>
  );
};

export default Hero;
