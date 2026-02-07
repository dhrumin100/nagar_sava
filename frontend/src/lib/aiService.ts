import axios from 'axios';

// Interface for AI analysis response based on backend 'main.py'
export interface AIAnalysisResult {
  success: boolean;
  analysis: {
    issue_type: string;
    severity: 'low' | 'medium' | 'high';
    confidence: number;
    box_count: number;
    detections: Array<{
      class: string;
      confidence: number;
      bbox: [number, number, number, number]; // x, y, w, h
      area_px: number;
      area_ratio: number;
    }>;
    explanation: string;
    detected_at: string;
  };
  debug_metrics?: {
    image_dim: [number, number];
    total_box_area_px: number;
    severity_ratio: number;
    inference_params: {
      conf: number;
      iou: number;
    };
  };
  error?: string;
}

export const analyzeImage = async (
  imageFile: File,
  latitude?: number,
  longitude?: number
): Promise<AIAnalysisResult> => {
  const formData = new FormData();
  formData.append('image', imageFile);
  
  if (latitude) formData.append('latitude', latitude.toString());
  if (longitude) formData.append('longitude', longitude.toString());
  
  // Default params as per backend
  formData.append('conf_threshold', '0.40');
  formData.append('iou_threshold', '0.70');

  try {
    const backendUrl = import.meta.env.VITE_AI_BACKEND_URL || 'http://localhost:8000';
    console.log(`Sending image to AI backend at: ${backendUrl}/analyze-image`);
    
    const response = await axios.post(`${backendUrl}/analyze-image`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (response.data && response.data.success) {
      return response.data as AIAnalysisResult;
    } else {
      throw new Error(response.data?.error || 'Analysis failed');
    }
  } catch (error) {
    console.error('AI Analysis Error:', error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data?.detail || 'Server error during analysis');
    }
    throw new Error('Network error or AI service unavailable');
  }
};
