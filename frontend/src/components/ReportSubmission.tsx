import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MapPin, Camera, Clock, CheckCircle, AlertCircle, Loader2, RefreshCw, MapPinOff, HelpCircle, Mic, Square } from "lucide-react";
import { reportStorage, CivicReport } from "@/lib/reportStorage";
import { authService } from "@/lib/authService";
import LocationPermissionGuide from "./LocationPermissionGuide";
import { useI18n } from "@/lib/i18n";
import { AIAnalysisResult } from "@/lib/aiService";

interface ReportSubmissionProps {
  photos: File[];
  issueType: string;
  onClose: () => void;
  onSuccess: (formData: any) => void;
  reportingPath: 'onsite' | 'remote' | null;
  aiAnalysis?: AIAnalysisResult;
}

interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
  source: 'gps' | 'manual' | 'default';
}

const ReportSubmission = ({ photos, issueType, onClose, onSuccess, reportingPath, aiAnalysis }: ReportSubmissionProps) => {
  const { t } = useI18n();
  const [description, setDescription] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isVoiceSupported, setIsVoiceSupported] = useState(true);
  const recognitionRef = useRef<any>(null);
  const baseTranscriptRef = useRef<string>('');
  const [location, setLocation] = useState<LocationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [locationError, setLocationError] = useState<string>('');
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [showManualLocation, setShowManualLocation] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [showLocationGuide, setShowLocationGuide] = useState(false);
  const [subcategory, setSubcategory] = useState<string>('');
  const [subcategoryOtherText, setSubcategoryOtherText] = useState('');

  // Debug logging
  console.log('ReportSubmission rendered with:', { issueType, reportingPath, photos: photos.length });
  const subcategoryMap: Record<string, string[]> = {
    'Street Light': [
      'subcategory.street_light.area_not_working',
      'subcategory.street_light.electric_shock',
      'subcategory.street_light.insufficient_lighting',
      'subcategory.street_light.led_not_working',
      'subcategory.street_light.overhead_line_problem',
      'subcategory.street_light.pole_dangerous',
      'subcategory.street_light.removal_unserviceable',
      'subcategory.street_light.sodium_not_working',
      'subcategory.street_light.sparking_on_pole',
      'subcategory.street_light.switching_time_problem',
      'subcategory.street_light.tube_not_working'
    ],
    'Potholes': [
      'subcategory.potholes.jungle_cutting',
      'subcategory.potholes.damaged_divider',
      'subcategory.potholes.damaged_road',
      'subcategory.potholes.filling_potholes',
      'subcategory.potholes.leveling_trench',
      'subcategory.potholes.patch_work',
      'subcategory.potholes.remove_fallen_trees',
      'subcategory.potholes.remove_wastage_divider',
      'subcategory.potholes.repair_railing',
      'subcategory.potholes.repair_footpath'
    ],
    'Garbage': [
      'subcategory.garbage.clean_footpath',
      'subcategory.garbage.clean_railing',
      'subcategory.garbage.clean_dividers',
      'subcategory.garbage.scraping_not_carried',
      'subcategory.garbage.scraping_not_proper',
      'subcategory.garbage.spot_not_cleaned',
      'subcategory.garbage.spot_not_lifted',
      'subcategory.garbage.lifting_building_materials',
      'subcategory.garbage.lifting_cnd_waste'
    ],
    'Waterlogging': [
      'subcategory.waterlogging.blocked_drains',
      'subcategory.waterlogging.sewage_overflow',
      'subcategory.waterlogging.stagnant_mosquito',
      'subcategory.waterlogging.public_transport',
      'subcategory.waterlogging.overflow_lakes',
      'subcategory.waterlogging.low_lying_area',
      'subcategory.waterlogging.blocked_grills',
      'subcategory.waterlogging.missing_covers',
      'subcategory.waterlogging.around_schools'
    ]
  };

  useEffect(() => {
    setSubcategory('');
    setSubcategoryOtherText('');
  }, [issueType]);

  // Pre-fill form with AI Analysis data
  useEffect(() => {
    if (aiAnalysis?.analysis) {
      if (aiAnalysis.analysis.explanation) {
        setDescription(aiAnalysis.analysis.explanation);
      }
      if (aiAnalysis.analysis.severity) {
        setSeverity(aiAnalysis.analysis.severity);
      }
    }
  }, [aiAnalysis]);

  // voice box removed; using inline mic button below description

  useEffect(() => {
    // Create preview URLs for all photos if any exist
    if (photos.length > 0) {
      const previewUrls = photos.map(photo => URL.createObjectURL(photo));
      setPhotoPreviews(previewUrls);
      // Cleanup preview URLs on unmount
      return () => previewUrls.forEach(url => URL.revokeObjectURL(url));
    }
  }, [photos]);

  useEffect(() => {
    // Handle location based on reporting path
    console.log('Location useEffect triggered with reportingPath:', reportingPath);
    if (reportingPath === 'onsite') {
      // Path A: Auto GPS location for on-site reporting
      console.log('Starting onsite GPS location fetch');
      getCurrentLocation();
    } else if (reportingPath === 'remote') {
      // Path B: Manual location entry for remote reporting
      console.log('Setting up remote location entry');
      setShowManualLocation(true);
    }
  }, [reportingPath]);

  // Initialize SpeechRecognition only when available (client side)
  useEffect(() => {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) {
      setIsVoiceSupported(false);
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = true;
    recognitionRef.current = rec;

    const handleResult = (event: any) => {
      let finalChunk = '';
      let interimChunk = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalChunk += piece;
        else interimChunk += piece;
      }

      if (interimChunk) {
        const base = baseTranscriptRef.current;
        const spacer = base && !base.endsWith(' ') ? ' ' : '';
        setDescription((base + spacer + interimChunk).slice(0, 500));
      }
      if (finalChunk) {
        const base = baseTranscriptRef.current;
        const spacer = base && !base.endsWith(' ') ? ' ' : '';
        const committed = (base + spacer + finalChunk).trimStart();
        baseTranscriptRef.current = committed;
        setDescription(committed.slice(0, 500));
      }
    };
    const handleEnd = () => {
      setIsRecording(false);
    };

    rec.addEventListener('result', handleResult);
    rec.addEventListener('end', handleEnd);

    return () => {
      rec.removeEventListener('result', handleResult);
      rec.removeEventListener('end', handleEnd);
      try { rec.stop(); } catch { }
    };
  }, []);

  const startVoiceCapture = () => {
    const recognition: any = recognitionRef.current;
    if (!recognition) return;
    baseTranscriptRef.current = description; // snapshot current text
    try { recognition.start(); } catch { }
    setIsRecording(true);
  };

  const stopVoiceCapture = () => {
    const recognition: any = recognitionRef.current;
    if (!recognition) return;
    try { recognition.stop(); } catch { }
    setIsRecording(false);
  };

  const getCurrentLocation = async () => {
    setIsLocationLoading(true);
    setLocationError('');
    setLocation(null); // Clear previous location

    console.log('Starting GPS location fetch...');

    try {
      // Check if geolocation is supported
      if (!navigator.geolocation) {
        console.log('Geolocation not supported');
        setLocationError('Geolocation is not supported by your browser');
        setLocation({
          latitude: 22.3072, // Default to Vadodara coordinates
          longitude: 73.1812,
          address: 'Vadodara, Gujarat (Default - Geolocation not supported)',
          source: 'default'
        });
        return;
      }

      // Get current position with timeout
      console.log('Requesting GPS coordinates with high accuracy...');
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Location request timed out'));
        }, 10000); // 10 second timeout

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            clearTimeout(timeoutId);
            console.log('GPS success:', pos);
            resolve(pos);
          },
          (err) => {
            clearTimeout(timeoutId);
            console.log('GPS error:', err);
            reject(err);
          },
          {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 300000 // 5 minutes cache
          }
        );
      });

      const { latitude, longitude } = position.coords;
      console.log('GPS coordinates received:', { latitude, longitude });

      // Clear any previous errors since GPS worked
      setLocationError('');

      // Try to get address from coordinates (reverse geocoding)
      try {
        console.log('Fetching address from coordinates...');
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
        );

        if (response.ok) {
          const data = await response.json();
          console.log('Address data received:', data);
          const address = data.display_name || `Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          setLocation({
            latitude,
            longitude,
            address,
            source: 'gps'
          });
          console.log('GPS location set successfully:', address);
        } else {
          console.log('Reverse geocoding failed, using coordinates');
          setLocation({
            latitude,
            longitude,
            address: `GPS Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
            source: 'gps'
          });
        }
      } catch (err) {
        console.log('Reverse geocoding error:', err);
        setLocation({
          latitude,
          longitude,
          address: `GPS Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
          source: 'gps'
        });
      }
    } catch (err: any) {
      console.error('Location access failed:', err);

      let errorMessage = 'Unable to get your location';
      let defaultLocation: LocationData | null = null;

      if (err instanceof GeolocationPositionError) {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            errorMessage = 'Location permission denied. Please enable location access in your browser settings.';
            console.log('GPS permission denied');
            break;
          case err.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable. Please try again.';
            console.log('GPS position unavailable');
            break;
          case err.TIMEOUT:
            errorMessage = 'Location request timed out. Please try again.';
            console.log('GPS request timeout');
            break;
          default:
            errorMessage = 'Location access failed. Please try again.';
            console.log('GPS unknown error');
        }
      } else if (err instanceof Error && err.message === 'Location request timed out') {
        errorMessage = 'Location request timed out. Please try again.';
        console.log('Custom timeout triggered');
      }

      setLocationError(errorMessage);

      // Only set default location if this is onsite reporting and we failed to get GPS
      if (reportingPath === 'onsite') {
        defaultLocation = {
          latitude: 22.3072,
          longitude: 73.1812,
          address: 'Vadodara, Gujarat (Default - GPS failed)',
          source: 'default'
        };
        setLocation(defaultLocation);
        console.log('Set default location due to GPS failure');
      }
    } finally {
      setIsLocationLoading(false);
    }
  };

  const handleManualLocationSubmit = () => {
    if (manualAddress.trim()) {
      setLocation({
        latitude: 22.3072, // Default coordinates for manual address
        longitude: 73.1812,
        address: manualAddress.trim(),
        source: 'manual'
      });
      setShowManualLocation(false);
      setLocationError('');
    }
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      setError(t('submit.error_description_required'));
      return;
    }
    if (!subcategory) {
      setError(t('submit.subcategory'));
      return;
    }

    if (!location) {
      setError(t('submit.error_location_required'));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Create report data without photos for now
      // Use authenticated user info if available
      const currentUser = authService.getCurrentUser();
      const reporterName = currentUser?.name || 'Citizen User';
      const reporterPhone = currentUser?.username || '+91-9876543210'; // Fallback to username or mock phone

      const reportData = {
        issueType,
        subcategory,
        subcategoryOtherText: subcategory === t('submit.subcategory_other') ? subcategoryOtherText.trim() : undefined,
        description: description.trim(),
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address
        },
        severity,
        reporter: reporterName,
        reporterPhone: reporterPhone
      };

      // Pass report data to parent component for photo handling
      onSuccess(reportData);
    } catch (err) {
      console.error('Failed to prepare report:', err);
      setError(t('submit.error_submit_failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case 'high': return 'bg-destructive text-destructive-foreground';
      case 'medium': return 'bg-civic-orange text-white';
      case 'low': return 'bg-civic-green text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getLocationSourceIcon = (source: string) => {
    switch (source) {
      case 'gps': return <MapPin className="w-4 h-4 text-civic-green" />;
      case 'manual': return <MapPin className="w-4 h-4 text-civic-blue" />;
      case 'default': return <MapPinOff className="w-4 h-4 text-muted-foreground" />;
      default: return <MapPin className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getLocationSourceText = (source: string) => {
    switch (source) {
      case 'gps': return 'GPS Location';
      case 'manual': return 'Manual Entry';
      case 'default': return 'Default Location';
      default: return 'Unknown Source';
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-background/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl bg-background border border-border/50 shadow-elegant max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            {/* Header */}
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-foreground mb-2">Report {issueType} Issue</h2>
              <p className="text-muted-foreground">
                Review your photos and location. Add any additional details before submitting.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Photo and Details */}
              <div className="space-y-4">
                {/* Photo Preview - only show if photos exist */}
                {photos.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium mb-2 block">
                      {t('submit.issue_photo')} ({photos.length} image{photos.length !== 1 ? 's' : ''})
                    </Label>
                    <div className="relative">
                      <img
                        src={photoPreviews[currentPhotoIndex]}
                        alt={`Issue photo ${currentPhotoIndex + 1}`}
                        className="w-full h-48 object-cover rounded-lg border border-border/50"
                      />
                      <Badge className="absolute top-2 left-2 bg-civic-green text-white">
                        {issueType}
                      </Badge>
                      <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
                        {currentPhotoIndex + 1} / {photos.length}
                      </div>
                    </div>

                    {/* Photo Thumbnails */}
                    {photos.length > 1 && (
                      <div className="flex space-x-2 mt-2 overflow-x-auto pb-2">
                        {photoPreviews.map((preview, index) => (
                          <img
                            key={index}
                            src={preview}
                            alt={`Thumbnail ${index + 1}`}
                            className={`w-12 h-12 object-cover rounded cursor-pointer border-2 flex-shrink-0 ${currentPhotoIndex === index ? 'border-civic-blue' : 'border-border/50'
                              }`}
                            onClick={() => setCurrentPhotoIndex(index)}
                          />
                        ))}
                      </div>
                    )}

                    <div className="mt-2 text-xs text-muted-foreground">
                      <div className="flex items-center space-x-4">
                        <span>Current: {formatFileSize(photos[currentPhotoIndex]?.size || 0)}</span>
                        <span>Type: {photos[currentPhotoIndex]?.type || 'Unknown'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Issue Type */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">{t('submit.issue_type')}</Label>
                  <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
                    <Camera className="w-4 h-4 text-civic-blue" />
                    <span className="font-medium capitalize">{issueType}</span>
                  </div>
                </div>

                {/* Subcategory */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">{t('submit.subcategory')}</Label>
                  <Input
                    placeholder={t('submit.subcategory_placeholder')}
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                    className="text-sm"
                    list="subcategory-options"
                  />
                  <datalist id="subcategory-options">
                    {(subcategoryMap[issueType] || []).map((key) => (
                      <option key={key} value={t(key)} />
                    ))}
                    <option value={t('submit.subcategory_other')} />
                  </datalist>
                  {subcategory === t('submit.subcategory_other') && (
                    <div className="mt-2 transition-all">
                      <Textarea
                        placeholder={t('submit.description_placeholder')}
                        value={subcategoryOtherText}
                        onChange={(e) => setSubcategoryOtherText(e.target.value)}
                        className="min-h-[70px]"
                        maxLength={200}
                      />
                    </div>
                  )}
                </div>

                {/* Severity Selection */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">{t('submit.issue_severity')}</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['low', 'medium', 'high'] as const).map((sev) => (
                      <Button
                        key={sev}
                        variant={severity === sev ? "default" : "outline"}
                        size="sm"
                        className={severity === sev ? getSeverityColor(sev) : ""}
                        onClick={() => setSeverity(sev)}
                      >
                        {t(`submit.severity_${sev}`)}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{t('submit.severity_note')}</p>
                </div>
              </div>

              {/* Right Column - Form Fields */}
              <div className="space-y-4">
                {/* Description */}
                <div>
                  <Label htmlFor="description" className="text-sm font-medium mb-2 block">{t('submit.description_label')}</Label>
                  <Textarea
                    id="description"
                    placeholder={t('submit.description_placeholder')}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="min-h-[100px]"
                    maxLength={500}
                  />
                  <div className="mt-1 text-xs text-muted-foreground text-right">
                    {description.length}/500 {t('submit.characters')}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      {isVoiceSupported ? (
                        isRecording ? 'Listening… speak now' : 'Use your voice to fill the description'
                      ) : (
                        'Voice input not supported on this browser'
                      )}
                    </div>
                    <Button
                      type="button"
                      variant={isRecording ? 'destructive' : 'outline'}
                      size="sm"
                      onClick={isRecording ? stopVoiceCapture : startVoiceCapture}
                      disabled={!isVoiceSupported}
                      className="h-8"
                    >
                      {isRecording ? (
                        <>
                          <Square className="w-3.5 h-3.5 mr-2" /> Stop
                        </>
                      ) : (
                        <>
                          <Mic className="w-3.5 h-3.5 mr-2" /> Speak Description
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* AI Analysis Summary (if available) */}
                {aiAnalysis?.analysis && (
                  <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-lg">
                     <div className="flex items-start gap-3">
                       <CheckCircle className="w-5 h-5 text-civic-blue mt-0.5" />
                       <div>
                         <h4 className="text-sm font-semibold text-civic-blue mb-1">AI Verified Details</h4>
                         <p className="text-xs text-muted-foreground">
                            This report has been pre-filled with data from the AI analysis. 
                            Confidence: {(aiAnalysis.analysis.confidence * 100).toFixed(0)}%
                         </p>
                       </div>
                     </div>
                  </div>
                )}

                {/* Location */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">
                      {reportingPath === 'onsite' ? 'Current Location (GPS)' : 'Issue Location'}
                    </Label>
                    <div className="flex items-center space-x-2">
                      {reportingPath === 'onsite' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            console.log('GPS refresh button clicked');
                            getCurrentLocation();
                          }}
                          disabled={isLocationLoading}
                          className="h-6 px-2 text-xs"
                        >
                          <RefreshCw className={`w-3 h-3 mr-1 ${isLocationLoading ? 'animate-spin' : ''}`} />
                          {isLocationLoading ? 'Getting GPS...' : 'Refresh GPS'}
                        </Button>
                      )}
                      {reportingPath === 'onsite' && location && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowManualLocation(!showManualLocation)}
                          className="h-6 px-2 text-xs"
                        >
                          Fine-tune
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowLocationGuide(true)}
                        className="h-6 px-2 text-xs"
                      >
                        <HelpCircle className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {isLocationLoading ? (
                    <div className="flex items-center space-x-2 p-3 bg-civic-blue/10 rounded-lg border border-civic-blue/20">
                      <Loader2 className="w-4 h-4 animate-spin text-civic-blue" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-civic-blue">
                          {reportingPath === 'onsite' ? 'Getting your GPS location...' : 'Processing location...'}
                        </span>
                        <span className="text-xs text-civic-blue/70">
                          Please ensure location permissions are enabled
                        </span>
                      </div>
                    </div>
                  ) : location ? (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
                        {getLocationSourceIcon(location.source)}
                        <span className="text-sm">{location.address}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <div className="flex items-center justify-between">
                          <span>{t('submit.coordinates')}: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</span>
                          <Badge variant="outline" className="text-xs">
                            {getLocationSourceText(location.source)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-muted/50 rounded-lg text-center">
                      <span className="text-sm text-muted-foreground">{t('submit.no_location')}</span>
                    </div>
                  )}

                  {/* Manual Location Input */}
                  {showManualLocation && (
                    <div className="mt-3 space-y-3">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground">
                          {reportingPath === 'remote' ? 'Enter the address where the issue is located:' : 'Fine-tune the location:'}
                        </Label>
                        <Input
                          placeholder={reportingPath === 'remote'
                            ? 'e.g., Street name, Area, City, Pincode'
                            : 'Adjust the address if needed'
                          }
                          value={manualAddress}
                          onChange={(e) => setManualAddress(e.target.value)}
                          className="text-sm"
                        />
                        {reportingPath === 'remote' && (
                          <p className="text-xs text-muted-foreground">
                            💡 Tip: Be as specific as possible to help authorities locate the issue quickly
                          </p>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          onClick={handleManualLocationSubmit}
                          disabled={!manualAddress.trim()}
                          className="flex-1 bg-gradient-civic hover:opacity-90"
                        >
                          {reportingPath === 'remote' ? 'Set Issue Location' : 'Update Location'}
                        </Button>
                        {reportingPath === 'onsite' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowManualLocation(false)}
                            className="flex-1"
                          >
                            Use GPS
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Location Error Display */}
                  {locationError && (
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <p className="text-xs text-amber-700">{locationError}</p>
                      </div>
                      <div className="mt-2 text-xs text-amber-600">
                        <p><strong>{t('submit.enable_location_title')}</strong></p>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                          <li>{t('submit.enable_location_step1')}</li>
                          <li>{t('submit.enable_location_step2')}</li>
                          <li>{t('submit.enable_location_step3')}</li>
                        </ul>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowLocationGuide(true)}
                          className="mt-2 h-6 px-2 text-xs text-amber-700 hover:text-amber-800"
                        >
                          <HelpCircle className="w-3 h-3 mr-1" />
                          {t('submit.get_help')}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Timestamp */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">{t('submit.reported_at')}</Label>
                  <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
                    <Clock className="w-4 h-4 text-civic-orange" />
                    <span className="text-sm">{new Date().toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-border/50">
              <Button variant="outline" onClick={onClose} disabled={isLoading}>{t('common.cancel')}</Button>
              <Button
                onClick={handleSubmit}
                disabled={isLoading || !description.trim() || !location}
                className="bg-gradient-civic hover:opacity-90"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('submit.submitting')}
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Continue Report
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Location Permission Guide Modal */}
      {showLocationGuide && (
        <LocationPermissionGuide
          onClose={() => setShowLocationGuide(false)}
          onRetry={getCurrentLocation}
        />
      )}
    </>
  );
};

export default ReportSubmission;
