import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, RefreshCcw, AlertTriangle, FileText, Info } from "lucide-react";
import { AIAnalysisResult } from "@/lib/aiService";
import { useI18n } from "@/lib/i18n";

interface ImageAnalysisResultProps {
  analysis: AIAnalysisResult;
  photos: File[];
  onContinue: () => void;
  onRetake: () => void;
}

const ImageAnalysisResult = ({ analysis, photos, onContinue, onRetake }: ImageAnalysisResultProps) => {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  // Use the first photo for visualization (assuming single photo analysis for now)
  const photoUrl = photos.length > 0 ? URL.createObjectURL(photos[0]) : '';

  useEffect(() => {
    if (!canvasRef.current || !photoUrl || !analysis.analysis) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = photoUrl;
    img.onload = () => {
      // Set canvas dimensions to match image
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw image
      ctx.drawImage(img, 0, 0);

      // Draw bounding boxes
      if (analysis.analysis?.detections) {
        analysis.analysis.detections.forEach(detection => {
          const [x, y, w, h] = detection.bbox;
          
          // Draw box
          ctx.strokeStyle = '#ef4444'; // Red-500
          ctx.lineWidth = 4;
          ctx.strokeRect(x, y, w, h);
          
          // Draw label background
          ctx.fillStyle = '#ef4444';
          const fontSize = Math.max(16, img.width * 0.02);
          ctx.font = `bold ${fontSize}px sans-serif`;
          const text = `${detection.class} ${(detection.confidence * 100).toFixed(0)}%`;
          const textMetrics = ctx.measureText(text);
          const padding = 6;
          
          ctx.fillRect(x, y - fontSize - padding * 2, textMetrics.width + padding * 2, fontSize + padding * 2);
          
          // Draw label text
          ctx.fillStyle = 'white';
          ctx.fillText(text, x + padding, y - padding);
        });
      }
      
      setImageLoaded(true);
    };

    return () => {
       // Cleanup if needed
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoUrl, analysis]);

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case 'high': return 'bg-destructive text-destructive-foreground';
      case 'medium': return 'bg-civic-orange text-white';
      case 'low': return 'bg-civic-green text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (!analysis.analysis) {
      return (
          <div className="p-6 text-center">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold">Analysis Data Unavailable</h3>
              <p className="text-muted-foreground mb-4">We couldn't retrieve the detailed analysis.</p>
              <Button onClick={onRetake}>Try Again</Button>
          </div>
      )
  }

  const { severity, confidence, explanation, detections } = analysis.analysis;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl bg-background border border-border/50 shadow-elegant max-h-[90vh] overflow-y-auto flex flex-col md:flex-row overflow-hidden">
        
        {/* Left: Image Visualization */}
        <div className="w-full md:w-1/2 p-4 bg-muted/20 flex items-center justify-center min-h-[300px]">
           {photoUrl ? (
               <div className="relative w-full h-full flex items-center justify-center overflow-auto rounded-lg border border-border/50 bg-black/5">
                   <canvas 
                       ref={canvasRef} 
                       className="max-w-full max-h-[60vh] object-contain shadow-sm"
                   />
                   {!imageLoaded && (
                       <img src={photoUrl} className="max-w-full max-h-[60vh] object-contain absolute opacity-0" alt="Analysis Source" />
                   )}
               </div>
           ) : (
               <div className="text-center text-muted-foreground">
                   <p>No image to display</p>
               </div>
           )}
        </div>

        {/* Right: Analysis Details */}
        <div className="w-full md:w-1/2 p-6 flex flex-col">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
                <Info className="w-6 h-6 text-civic-blue" />
                AI Analysis Report
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
                Automated assessment based on visual evidence.
            </p>
          </div>

          <div className="space-y-6 flex-1">
             {/* Key Metrics */}
             <div className="grid grid-cols-2 gap-4">
                 <div className="p-3 bg-muted/50 rounded-lg border border-border/50">
                     <span className="text-xs text-muted-foreground block mb-1">Detected Issue</span>
                     <span className="font-medium capitalize flex items-center gap-2">
                         {detections.length > 0 ? detections[0].class : 'Unknown'}
                         <Badge variant="outline" className="text-xs font-normal ml-auto">
                            {(confidence * 100).toFixed(0)}% Conf.
                         </Badge>
                     </span>
                 </div>
                 <div className="p-3 bg-muted/50 rounded-lg border border-border/50">
                     <span className="text-xs text-muted-foreground block mb-1">Assessed Severity</span>
                     <Badge className={`${getSeverityColor(severity)} hover:${getSeverityColor(severity)}`}>
                         {severity.toUpperCase()}
                     </Badge>
                 </div>
             </div>

             {/* Detailed Explanation */}
             <div className="space-y-2">
                 <h3 className="text-sm font-medium flex items-center gap-2 text-foreground">
                    <FileText className="w-4 h-4" />
                    AI Assessment
                 </h3>
                 <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-lg text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                     {explanation}
                 </div>
                 <p className="text-xs text-muted-foreground italic">
                     * This assessment will be automatically added to your report description.
                 </p>
             </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-8 pt-4 border-t border-border/50">
            <Button variant="outline" onClick={onRetake} className="flex-1">
              <RefreshCcw className="w-4 h-4 mr-2" />
              Retake Photo
            </Button>
            <Button onClick={onContinue} className="flex-1 bg-gradient-civic hover:opacity-90">
              <CheckCircle className="w-4 h-4 mr-2" />
              Continue to Report
            </Button>
          </div>

        </div>
      </Card>
    </div>
  );
};

export default ImageAnalysisResult;
