import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, Upload, X, RotateCcw, CheckCircle, AlertCircle, Smartphone, Loader2, MapPin, Clock, Shield } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { imageValidator, ValidationResult } from "@/utils/imageValidator";
import { analyzeImage, AIAnalysisResult } from "@/lib/aiService";

interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
}

interface PhotoCaptureProps {
  issueType: string;
  onPhotoCaptured: (photos: File[], issueType: string) => void;
  onClose: () => void;
  modeRestriction?: 'camera' | 'gallery';
  location?: LocationData;
  onAnalysisComplete?: (result: AIAnalysisResult, photos: File[]) => void;
}

const PhotoCapture = ({ issueType, onPhotoCaptured, onClose, modeRestriction, location, onAnalysisComplete }: PhotoCaptureProps) => {
  const { t } = useI18n();
  const [captureMode, setCaptureMode] = useState<'select' | 'camera' | 'preview'>('select');
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);  // Geotagged files for display
  const [rawPhotoFiles, setRawPhotoFiles] = useState<File[]>([]);  // Raw files for AI analysis
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [isCameraSupported, setIsCameraSupported] = useState(false);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [processingCount, setProcessingCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryOpenedRef = useRef(false);

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsMobile(isMobileDevice || isTouchDevice);
    };

    checkMobile();
  }, []);

  // Check if camera is supported
  useEffect(() => {
    const checkCameraSupport = async () => {
      try {
        // Check if getUserMedia is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setIsCameraSupported(false);
          return;
        }

        // Check if there are video input devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasCamera = devices.some(device => device.kind === 'videoinput');
        setIsCameraSupported(hasCamera);
      } catch (err) {
        setIsCameraSupported(false);
      }
    };

    checkCameraSupport();
  }, []);

  // Auto-navigate based on restriction
  useEffect(() => {
    if (modeRestriction === 'camera') {
      setCaptureMode('select');
      startCamera();
    } else if (modeRestriction === 'gallery') {
      setCaptureMode('select');
      if (!galleryOpenedRef.current) {
        galleryOpenedRef.current = true;
        setTimeout(() => openFileDialog(), 0);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeRestriction]);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const getMapImage = async (lat: number, lon: number): Promise<HTMLImageElement | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      // Using Yandex Static Maps as a reliable fallback for now, or could use OSM static maps if available
      // Note: In a real prod app, use a paid Google/Mapbox/Geoapify key. 
      // For now, we try to fetch a static map. If it fails, we resolve null.
      // Trying a generic OSM tile or similar might be flaky without a proper static map server.
      // Let's try a reliable public static map service or fallback to none.
      // Using a placeholder generated on canvas if this fails.

      // Attempt to use a public static map endpoint (OpenStreetMap-based)
      // This is a demo endpoint, might be rate limited.
      img.src = `https://static-maps.yandex.ru/1.x/?lang=en-US&ll=${lon},${lat}&z=15&l=map&size=200,200`;

      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
    });
  };

  const processImageWithGeoTag = async (source: HTMLVideoElement | File): Promise<{ file: File, preview: string, rawFile?: File }> => {
    return new Promise(async (resolve, reject) => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) throw new Error('Canvas not available');

        let width, height;
        let sourceImg: HTMLImageElement | HTMLVideoElement;

        if (source instanceof File) {
          sourceImg = new Image();
          await new Promise((res, rej) => {
            sourceImg.onload = res;
            sourceImg.onerror = rej;
            (sourceImg as HTMLImageElement).src = URL.createObjectURL(source);
          });
          width = (sourceImg as HTMLImageElement).width;
          height = (sourceImg as HTMLImageElement).height;
        } else {
          sourceImg = source;
          width = source.videoWidth;
          height = source.videoHeight;
        }

        // Set canvas size
        canvas.width = width;
        canvas.height = height;

        // Draw original image
        ctx.drawImage(sourceImg, 0, 0, width, height);

        // --- GEO TAG OVERLAY (Compact Version) ---
        if (location) {
          const overlayHeight = Math.max(height * 0.12, 100); // Reduced: 12% of height or min 100px
          const padding = overlayHeight * 0.08;

          // Semi-transparent black background at bottom
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(0, height - overlayHeight, width, overlayHeight);

          // Map Thumbnail (Left side)
          const mapSize = overlayHeight - (padding * 2);
          const mapX = padding;
          const mapY = height - overlayHeight + padding;

          try {
            const mapImg = await getMapImage(location.latitude, location.longitude);
            if (mapImg) {
              ctx.save();
              // Create rounded rect for map
              ctx.beginPath();
              ctx.roundRect(mapX, mapY, mapSize, mapSize, 10);
              ctx.clip();
              ctx.drawImage(mapImg, mapX, mapY, mapSize, mapSize);
              ctx.restore();

              // Draw border around map
              ctx.strokeStyle = 'white';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.roundRect(mapX, mapY, mapSize, mapSize, 10);
              ctx.stroke();
            } else {
              // Draw placeholder map
              ctx.fillStyle = '#334155';
              ctx.fillRect(mapX, mapY, mapSize, mapSize);
              ctx.fillStyle = '#94a3b8';
              ctx.font = `${mapSize * 0.2}px Arial`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('No Map', mapX + mapSize / 2, mapY + mapSize / 2);
            }
          } catch (e) {
            console.error('Error drawing map:', e);
          }

          // Text Info (Right Data)
          const textX = mapX + mapSize + padding;
          const textYStart = height - overlayHeight + padding;
          const contentWidth = width - textX - padding;

          ctx.fillStyle = 'white';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';

          // Address processing
          const address = location.address || 'Unknown Location';

          // 1. Location Header
          let fontSize = overlayHeight * 0.15;
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.fillText('Location', textX, textYStart);

          // 2. Address (Multiline)
          const addressFontSize = overlayHeight * 0.12;
          ctx.font = `${addressFontSize}px sans-serif`;
          const lineHeight = addressFontSize * 1.4;
          let currentTextY = textYStart + (fontSize * 1.5);

          // Simple word wrap
          const words = address.split(' ');
          let line = '';
          let lines = [];

          for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            if (metrics.width > contentWidth && n > 0) {
              lines.push(line);
              line = words[n] + ' ';
            } else {
              line = testLine;
            }
          }
          lines.push(line);

          // Limit lines to prevent overflow
          const maxLines = 3;
          lines = lines.slice(0, maxLines);

          lines.forEach(l => {
            ctx.fillText(l, textX, currentTextY);
            currentTextY += lineHeight;
          });

          // 3. Coordinates & Date
          const metaFontSize = overlayHeight * 0.10;
          ctx.font = `${metaFontSize}px monospace`;
          ctx.fillStyle = '#cbd5e1'; // Light gray

          const metaY = height - padding - (metaFontSize * 3); // Position near bottom of overlay

          const dateStr = new Date().toLocaleString('en-IN', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });

          ctx.fillText(`Lat: ${location.latitude.toFixed(6)} Long: ${location.longitude.toFixed(6)}`, textX, metaY);
          ctx.fillText(dateStr, textX, metaY + (metaFontSize * 1.4));
        }

        canvas.toBlob((blob) => {
          if (blob) {
            const timestamp = Date.now();
            const fileName = source instanceof File ? source.name : `civic-issue-${timestamp}.jpg`;
            const newFile = new File([blob], fileName, { type: 'image/jpeg', lastModified: timestamp });
            const previewUrl = URL.createObjectURL(blob);
            // Include the original raw file for AI analysis (only available for File sources)
            const rawFile = source instanceof File ? source : undefined;
            resolve({ file: newFile, preview: previewUrl, rawFile });
          } else {
            reject(new Error('Failed to generate blob'));
          }
        }, 'image/jpeg', 0.9);

      } catch (err) {
        reject(err);
      }
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      setError('Please select valid image files');
      return;
    }

    if (photoFiles.length + imageFiles.length > 5) {
      setError('Maximum 5 images allowed');
      return;
    }

    setProcessingCount(prev => prev + imageFiles.length);
    setError('');

    try {
      // Store raw files directly WITHOUT geotag overlay
      // Geotag will be added only at final submission
      const validResults: { file: File, preview: string }[] = [];
      
      for (const file of imageFiles) {
        // Create simple preview URL from original file
        const previewUrl = URL.createObjectURL(file);
        
        // Optional: Server-side validation (using raw file)
        const formData = new FormData();
        formData.append('image', file);
        formData.append('category', issueType);

        try {
          const verifyRes = await fetch(`${import.meta.env.VITE_API_BASE_URL}/verify`, {
            method: 'POST',
            body: formData
          });

          if (verifyRes.ok) {
            const result = await verifyRes.json();
            if (result.status === 'rejected') {
              setError(`Image rejected: ${result.reason}`);
              URL.revokeObjectURL(previewUrl);
              console.log(`Image rejected: ${result.reason}`);
            } else {
              validResults.push({ file, preview: previewUrl });
            }
          } else {
            // Validation service unavailable - still allow the image
            console.warn("Validation service unavailable, allowing image");
            validResults.push({ file, preview: previewUrl });
          }
        } catch (e) {
          // Network error - still allow the image for offline-first support
          console.warn("Validation failed, allowing image:", e);
          validResults.push({ file, preview: previewUrl });
        }
      }

      if (validResults.length > 0) {
        const newFiles = validResults.map(r => r.file);
        const newPreviews = validResults.map(r => r.preview);

        // Store same files in both arrays (no geotag processing now)
        setRawPhotoFiles(prev => [...prev, ...newFiles]);
        setPhotoFiles(prev => [...prev, ...newFiles]);
        setPhotoPreviews(prev => [...prev, ...newPreviews]);
        
        if (photoFiles.length === 0) {
          setCaptureMode('preview');
        }
      } else if (imageFiles.length > 0 && validResults.length === 0) {
        if (!error) setError('Images rejected by automated quality check.');
      }

    } catch (err) {
      console.error('Error processing photos:', err);
      setError('Failed to process photos. Please try again.');
    } finally {
      setProcessingCount(prev => prev - imageFiles.length);
      // Reset file input
      if (event.target) event.target.value = '';
    }
  };

  const startCamera = async () => {
    try {
      setIsLoading(true);
      setError('');

      // Check if we're in HTTPS or localhost (allow for development)
      if (window.location.protocol !== 'https:' &&
        !['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname)) {
        setError('Camera access requires HTTPS. Please use a secure connection.');
        setIsLoading(false);
        return;
      }

      // Stop any existing stream first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Try different constraints in order of preference
      const constraintOptions = [
        {
          video: {
            facingMode: isMobile ? 'environment' : 'user',
            width: { ideal: 1920, max: 1920 },
            height: { ideal: 1080, max: 1080 }
          }
        },
        {
          video: {
            facingMode: isMobile ? 'environment' : 'user',
            width: { ideal: 1280, max: 1280 },
            height: { ideal: 720, max: 720 }
          }
        },
        {
          video: {
            width: { ideal: 640, max: 640 },
            height: { ideal: 480, max: 480 }
          }
        },
        {
          video: true // Fallback to basic video
        }
      ];

      let stream = null;
      let constraintError = null;

      // Try each constraint until one works
      for (const constraints of constraintOptions) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          break;
        } catch (err) {
          constraintError = err;
          console.warn('Failed with constraints:', constraints, err);
        }
      }

      if (!stream) {
        throw constraintError || new Error('Failed to start camera');
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        // Wait for video metadata to load
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play()
              .then(() => {
                console.log('Video playing successfully');
                setCaptureMode('camera');
                setIsLoading(false);
              })
              .catch((playErr) => {
                console.error('Video play error:', playErr);
                setError('Failed to start camera preview. Please try again.');
                setIsLoading(false);
              });
          }
        };

        // Handle errors
        videoRef.current.onerror = (err) => {
          console.error('Video element error:', err);
          setError('Camera preview failed. Please try again.');
          setIsLoading(false);
        };
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      let errorMessage = 'Failed to access camera. Please try again.';

      if (err instanceof Error) {
        switch (err.name) {
          case 'NotAllowedError':
            errorMessage = 'Camera access denied. Please allow camera permissions in your browser and try again.';
            break;
          case 'NotFoundError':
            errorMessage = 'No camera found on this device. Please use file upload instead.';
            break;
          case 'NotReadableError':
            errorMessage = 'Camera is being used by another application. Please close other apps and try again.';
            break;
          case 'OverconstrainedError':
            errorMessage = 'Camera constraints not supported. Trying basic camera access.';
            break;
          case 'SecurityError':
            errorMessage = 'Camera access blocked by security settings. Please check your browser permissions.';
            break;
        }
      }

      setError(errorMessage);
      setIsLoading(false);
    }
  };

  const capturePhoto = async () => {
    if (photoFiles.length >= 5) {
      setError('Maximum 5 images allowed');
      return;
    }

    if (!videoRef.current) {
      setError('Camera not ready. Please try again.');
      return;
    }

    const video = videoRef.current;

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setError('Camera not ready. Please wait for the camera to load.');
      return;
    }

    setProcessingCount(prev => prev + 1);

    try {
      // Capture RAW image from video (without geotag)
      // Geotag will be added only at final submission
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Canvas context unavailable');
      }
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Create file from canvas
      const blob = await new Promise<Blob | null>((resolve) => 
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
      );
      
      if (!blob) {
        throw new Error('Failed to create image blob');
      }
      
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const preview = URL.createObjectURL(blob);

      // VALIDATION
      const img = new Image();
      img.src = preview;
      await new Promise(r => img.onload = r);
      const validation = await imageValidator.validateImage(img);

      if (validation.status === 'rejected') {
        setError(`Image rejected: ${validation.reason}`);
        URL.revokeObjectURL(preview);
        return;
      }

      console.log('Photo captured (raw):', file.name, file.size, 'bytes');

      // Store raw file (same in both arrays now - no geotag processing)
      setRawPhotoFiles(prev => [...prev, file]);
      setPhotoFiles(prev => [...prev, file]);
      setPhotoPreviews(prev => [...prev, preview]);
      setCurrentPhotoIndex(photoFiles.length);

      // Don't stop camera after first photo - allow multiple captures
      if (photoFiles.length + 1 >= 5) {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        setCaptureMode('preview');
      } else {
        setError('');
        const originalError = error;
        setError(`Photo ${photoFiles.length + 1} captured! ${5 - (photoFiles.length + 1)} more allowed.`);
        setTimeout(() => setError(originalError), 2000);
      }
    } catch (err) {
      console.error('Photo capture error:', err);
      setError('Failed to capture photo. Please try again.');
    } finally {
      setProcessingCount(prev => prev - 1);
    }
  };

  const retakePhoto = () => {
    setPhotoFiles([]);
    setPhotoPreviews([]);
    setCaptureMode('select');
    setError('');
    setCurrentPhotoIndex(0);
  };

  const removePhoto = (index: number) => {
    setPhotoFiles(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
    if (currentPhotoIndex >= index && currentPhotoIndex > 0) {
      setCurrentPhotoIndex(currentPhotoIndex - 1);
    }
  };

  const submitReport = async () => {
    if (photoFiles.length > 0) {
      // If parent provided analysis callback, run AI analysis first
      if (onAnalysisComplete) {
        setIsAnalyzing(true);
        try {
          // Use RAW photo (without geotag overlay) for AI analysis
          // Fall back to geotagged if raw not available (e.g., from camera capture)
          const rawPhoto = rawPhotoFiles[currentPhotoIndex] || rawPhotoFiles[rawPhotoFiles.length - 1];
          const photoToAnalyze = rawPhoto || photoFiles[currentPhotoIndex] || photoFiles[photoFiles.length - 1];
          
          console.log("Starting AI analysis on RAW photo:", photoToAnalyze.name);
          const result = await analyzeImage(
            photoToAnalyze, 
            location?.latitude, 
            location?.longitude
          );
          
          console.log("AI Analysis complete:", result);
          // Pass the geotagged files for display/storage, but analysis used raw
          onAnalysisComplete(result, photoFiles);
        } catch (err: any) {
          console.error("AI Analysis failed:", err);
          setError(`AI Analysis failed: ${err.message}. Continuing without analysis.`);
          // Fallback after short delay if analysis fails
          setTimeout(() => {
             onPhotoCaptured(photoFiles, issueType);
          }, 2000);
        } finally {
          setIsAnalyzing(false);
        }
      } else {
        // Standard flow
        onPhotoCaptured(photoFiles, issueType);
      }
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-background border border-border/50 shadow-elegant">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground">{t('photo.header_title',)} {issueType}</h2>
              <p className="text-sm text-muted-foreground">{t('photo.header_subtitle')}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
              disabled={processingCount > 0}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Processing Indicator */}
          {processingCount > 0 && (
            <div className="absolute inset-0 z-50 bg-background/50 flex flex-col items-center justify-center rounded-lg backdrop-blur-sm">
              <Loader2 className="w-10 h-10 animate-spin text-civic-blue mb-2" />
              <p className="font-medium text-foreground">Processing...</p>
            </div>
          )}

          {/* Mode Selection */}
          {captureMode === 'select' && (
            <div className="space-y-4">
              {/* Show mode-specific instructions */}
              <div className="p-3 bg-muted/30 rounded-lg border border-border/30">
                <p className="text-sm text-muted-foreground text-center">
                  {modeRestriction === 'camera'
                    ? '📸 On-site reporting: Use your device camera to capture live photos of the issue'
                    : modeRestriction === 'gallery'
                      ? '🖼️ Remote reporting: Upload photos from your device gallery or storage'
                      : 'Choose how you want to add photos to your report'
                  }
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {/* Camera option - only for onsite reporting or when not restricted */}
                {isCameraSupported && modeRestriction === 'camera' && (
                  <Button
                    onClick={startCamera}
                    disabled={isLoading}
                    className="h-16 flex-col bg-gradient-civic hover:opacity-90"
                  >
                    <Camera className="w-6 h-6 mb-2" />
                    <span>{isLoading ? 'Starting Camera...' : 'Take Live Photos'}</span>
                    <span className="text-xs opacity-80">Use device camera</span>
                  </Button>
                )}

                {/* Gallery option - prioritized for remote reporting, available for both */}
                {modeRestriction === 'gallery' ? (
                  <Button
                    onClick={openFileDialog}
                    className="h-16 flex-col bg-gradient-civic hover:opacity-90"
                  >
                    <Upload className="w-6 h-6 mb-2" />
                    <span>Upload from Gallery</span>
                    <span className="text-xs opacity-80">Select from device storage</span>
                  </Button>
                ) : modeRestriction === 'camera' ? (
                  <Button
                    onClick={openFileDialog}
                    variant="outline"
                    className="h-12 flex-row"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    <span className="text-sm">Or upload from gallery</span>
                  </Button>
                ) : (
                  <Button
                    onClick={openFileDialog}
                    variant="outline"
                    className="h-16 flex-col"
                  >
                    <Upload className="w-6 h-6 mb-2" />
                    <span>Upload from Gallery</span>
                    <span className="text-xs opacity-80">Select from device storage</span>
                  </Button>
                )}
              </div>

              {!isCameraSupported && modeRestriction === 'camera' && (
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <AlertCircle className="w-4 h-4 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Camera not available on this device. Please use gallery upload instead.</p>
                </div>
              )}

              {modeRestriction === 'gallery' && (
                <div className="text-center p-3 bg-civic-blue/10 rounded-lg border border-civic-blue/20">
                  <AlertCircle className="w-4 h-4 mx-auto mb-2 text-civic-blue" />
                  <p className="text-xs text-civic-blue">
                    📱 Remote Reporting: Camera access is disabled for remote reporting. Please upload existing photos from your gallery.
                  </p>
                </div>
              )}

              {/* Mobile Tips */}
              {isMobile && (
                <div className="text-center p-3 bg-civic-blue/5 border border-civic-blue/20 rounded-lg">
                  <Smartphone className="w-4 h-4 mx-auto mb-2 text-civic-blue" />
                  <p className="text-xs text-civic-blue">
                    {modeRestriction === 'camera'
                      ? '💡 Tip: For best live photos, hold your phone steady and ensure good lighting at the issue location'
                      : modeRestriction === 'gallery'
                        ? '💡 Tip: Select clear, well-lit photos that show the issue details clearly'
                        : t('photo.tip')
                    }
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Camera Mode */}
          {captureMode === 'camera' && (
            <div className="space-y-4">
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  className="w-full h-64 object-cover"
                  autoPlay
                  playsInline
                  muted
                />
                <div className="absolute inset-0 border-4 border-white/20 rounded-lg pointer-events-none"></div>
                {/* Camera overlay for better UX */}
                <div className="absolute top-4 left-4 bg-black/50 text-white px-2 py-1 rounded text-xs">
                  📱 Live Camera
                </div>
                {/* Photo counter overlay */}
                {photoFiles.length > 0 && (
                  <div className="absolute top-4 right-4 bg-civic-green/90 text-white px-2 py-1 rounded text-xs">
                    {photoFiles.length} photo{photoFiles.length !== 1 ? 's' : ''} taken
                  </div>
                )}
              </div>

              {/* Photo thumbnails if any photos taken */}
              {photoFiles.length > 0 && (
                <div className="flex space-x-2 overflow-x-auto pb-2">
                  {photoPreviews.map((preview, index) => (
                    <div key={index} className="relative flex-shrink-0">
                      <img
                        src={preview}
                        alt={`Photo ${index + 1}`}
                        className="w-12 h-12 object-cover rounded border-2 border-civic-green"
                      />
                      <div className="absolute -top-1 -right-1 bg-civic-green text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                        {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-center space-x-3">
                <Button
                  onClick={capturePhoto}
                  className="bg-gradient-civic hover:opacity-90"
                  size="lg"
                  disabled={photoFiles.length >= 5 || processingCount > 0}
                >
                  <Camera className="w-5 h-5 mr-2" />
                  {photoFiles.length === 0
                    ? 'Take Photo'
                    : photoFiles.length >= 5
                      ? 'Max Photos Reached'
                      : `Take Photo (${photoFiles.length + 1}/5)`
                  }
                </Button>

                {/* Show done button if photos taken */}
                {photoFiles.length > 0 && (
                  <Button
                    onClick={() => {
                      // Stop camera and go to preview
                      if (streamRef.current) {
                        streamRef.current.getTracks().forEach(track => track.stop());
                        streamRef.current = null;
                      }
                      setCaptureMode('preview');
                    }}
                    variant="outline"
                    size="lg"
                    className="border-civic-green text-civic-green hover:bg-civic-green/10"
                    disabled={processingCount > 0}
                  >
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Done ({photoFiles.length})
                  </Button>
                )}

                <Button
                  onClick={retakePhoto}
                  variant="outline"
                  size="lg"
                  disabled={processingCount > 0}
                >
                  <RotateCcw className="w-5 h-5 mr-2" />
                  {photoFiles.length > 0 ? 'Clear All' : 'Cancel'}
                </Button>
              </div>
            </div>
          )}

          {/* Preview Mode */}
          {captureMode === 'preview' && (
            <div className="space-y-4">
              {/* AI Verification Overlay */}
              {isAnalyzing && (
                <div className="fixed inset-0 bg-background/95 backdrop-blur-md z-[60] flex items-center justify-center">
                  <div className="text-center space-y-6 p-8 max-w-sm">
                    {/* Animated Logo/Shield */}
                    <div className="relative mx-auto w-24 h-24">
                      <div className="absolute inset-0 bg-gradient-civic rounded-full animate-ping opacity-30"></div>
                      <div className="absolute inset-2 bg-gradient-civic rounded-full animate-pulse opacity-50"></div>
                      <div className="relative w-24 h-24 bg-gradient-civic rounded-full flex items-center justify-center shadow-lg">
                        <Shield className="w-12 h-12 text-white animate-pulse" />
                      </div>
                    </div>
                    
                    {/* Title */}
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-foreground">NagarSeva AI</h3>
                      <p className="text-muted-foreground text-sm">Verifying Evidence</p>
                    </div>
                    
                    {/* Progress Animation */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-2 h-2 bg-civic-blue rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-civic-blue rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-civic-blue rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                      <p className="text-xs text-muted-foreground">Analyzing image for civic issue detection...</p>
                    </div>
                    
                    {/* Verification Steps */}
                    <div className="bg-muted/50 rounded-lg p-4 text-left space-y-2">
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                        <CheckCircle className="w-3 h-3 text-civic-green" />
                        <span>Photo received</span>
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                        <CheckCircle className="w-3 h-3 text-civic-green" />
                        <span>Location verified</span>
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-civic-blue">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>AI analyzing content...</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Main Photo Display with Geo-Tag */}
              <div className="relative">
                <img
                  src={photoPreviews[currentPhotoIndex]}
                  alt={`Photo ${currentPhotoIndex + 1}`}
                  className="w-full h-64 object-cover rounded-lg border border-border/50"
                />
                {/* Issue Type Badge - Top Left */}
                <Badge className="absolute top-2 left-2 bg-civic-green text-white">
                  {issueType}
                </Badge>
                {/* Photo Counter - Top Right */}
                <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
                  {currentPhotoIndex + 1} of {photoFiles.length}
                </div>
                
                {/* Geo-Tag Overlay - Bottom Left */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-3 rounded-b-lg">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      {/* Location Name */}
                      {location?.address && (
                        <div className="flex items-center space-x-1.5">
                          <MapPin className="w-3 h-3 text-civic-blue flex-shrink-0" />
                          <span className="text-white text-xs font-medium truncate max-w-[200px]" title={location.address}>
                            {location.address.split(',').slice(0, 2).join(',')}
                          </span>
                        </div>
                      )}
                      {/* Coordinates */}
                      {location?.latitude && location?.longitude && (
                        <div className="flex items-center space-x-1.5">
                          <span className="text-white/70 text-[10px] font-mono">
                            {location.latitude.toFixed(5)}°, {location.longitude.toFixed(5)}°
                          </span>
                        </div>
                      )}
                      {/* Timestamp */}
                      <div className="flex items-center space-x-1.5">
                        <Clock className="w-3 h-3 text-white/70 flex-shrink-0" />
                        <span className="text-white/70 text-[10px]">
                          {new Date().toLocaleString('en-IN', { 
                            day: '2-digit', 
                            month: 'short', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                    {/* Verified Badge */}
                    <div className="bg-civic-green/90 backdrop-blur-sm px-2 py-1 rounded flex items-center space-x-1">
                      <Shield className="w-3 h-3 text-white" />
                      <span className="text-white text-[10px] font-medium">GeoTagged</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Photo Thumbnails */}
              {photoFiles.length > 1 && (
                <div className="flex space-x-2 overflow-x-auto pb-2">
                  {photoPreviews.map((preview, index) => (
                    <div key={index} className="relative flex-shrink-0">
                      <img
                        src={preview}
                        alt={`Thumbnail ${index + 1}`}
                        className={`w-16 h-16 object-cover rounded-lg cursor-pointer border-2 ${currentPhotoIndex === index ? 'border-civic-blue' : 'border-border/50'
                          }`}
                        onClick={() => setCurrentPhotoIndex(index)}
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute -top-1 -right-1 w-6 h-6 p-0 rounded-full"
                        onClick={() => removePhoto(index)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add More Photos Button */}
              {photoFiles.length < 5 && (
                <div className="flex justify-center gap-2">
                  {isCameraSupported && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        startCamera();
                      }}
                      className="text-sm border-civic-blue text-civic-blue hover:bg-civic-blue/10"
                      disabled={processingCount > 0}
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Take More Photos
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={openFileDialog}
                    className="text-sm"
                    disabled={processingCount > 0}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload More ({photoFiles.length}/5)
                  </Button>
                </div>
              )}

              <div className="flex justify-center space-x-3">
                <Button
                  onClick={submitReport}
                  className="bg-gradient-civic hover:opacity-90"
                  size="lg"
                  disabled={processingCount > 0 || isAnalyzing}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Continue with {photoFiles.length} photo{photoFiles.length !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
                <Button
                  onClick={retakePhoto}
                  variant="outline"
                  size="lg"
                  disabled={processingCount > 0 || isAnalyzing}
                >
                  <RotateCcw className="w-5 h-5 mr-2" />
                  Clear All
                </Button>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-destructive" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            capture={isMobile ? "environment" : undefined}
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Hidden canvas for camera capture */}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      </Card>
    </div>
  );
};

export default PhotoCapture;
