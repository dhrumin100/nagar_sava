
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import shutil
import os
from pathlib import Path
from ultralytics import YOLO
import cv2
import numpy as np
from datetime import datetime
from typing import Optional
from dotenv import load_dotenv
from groq import Groq
import json
import time

load_dotenv()

# Initialize Groq Client
client = None
if os.getenv("GROQ_API_KEY"):
    client = Groq(api_key=os.getenv("GROQ_API_KEY"))

SYSTEM_PROMPT = """
You are an AI expert in road safety. 
Analyze the pothole data and generate a very short, simple explanation (1-2 sentences max). 
Use easy-to-understand English.
Input: Detection count, severity area ratio, and confidence.
Output: A JSON object with a single key "explanation".
"""

app = FastAPI(title="Nagar Seva AI Service", description="AI Backend for Road Condition Analysis")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for dev flexibility 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model variable
model = None
MODEL_PATH = r"d:\angry\ai-backend\runs\detect\pothole_v14\weights\best.pt"  # GPU-trained model (better mAP50)

def load_model():
    global model
    try:
        if os.path.exists(MODEL_PATH):
            print(f"Loading model from {MODEL_PATH}...")
            model = YOLO(MODEL_PATH)
            print("✅ Model loaded successfully!")
        else:
            print(f"⚠️ Model not found at {MODEL_PATH}. Using 'yolov8n.pt' for testing/mocking.")
            model = YOLO('yolov8n.pt') # Fallback
    except Exception as e:
        print(f"❌ Failed to load model: {e}")

@app.on_event("startup")
async def startup_event():
    load_model()

@app.get("/")
def read_root():
    return {"status": "online", "service": "Nagar Seva AI"}

@app.post("/analyze-image")
async def analyze_image(
    image: UploadFile = File(...),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    conf_threshold: float = Form(0.40),  # Confidence threshold
    iou_threshold: float = Form(0.70),
    box_padding: float = Form(0.0), # Percentage to expand/shrink box (e.g. -0.1 to shrink 10%)
    box_offset_y: int = Form(0)     # Pixels to shift box up/down (e.g. 10 to shift down)
):
    start_time = time.time()
    temp_filename = None # Initialize to None
    try:
        # Create a temp file
        temp_filename = f"temp_{int(time.time())}_{image.filename}" # Changed image.filename to file.filename in instruction, but keeping image.filename as per original context
        
        try:
            with open(temp_filename, "wb") as buffer:
                shutil.copyfileobj(image.file, buffer) # Changed image.file to file.file in instruction, but keeping image.file as per original context
            
            # Read image to get dimensions
            img = cv2.imread(temp_filename)
            if img is None:
                 raise HTTPException(status_code=400, detail="Invalid image file")
            
            height, width, _ = img.shape
            img_area = width * height
            
            # Run inference
            if not model:
                raise HTTPException(status_code=503, detail="Model not loaded")
            
            results = model.predict(temp_filename, save=False, conf=conf_threshold, iou=iou_threshold)
            
            # Process results
            detections = []
            total_box_area = 0
            box_count = 0
            max_conf = 0.0

            for result in results:
                for box in result.boxes:
                    box_count += 1
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    conf = float(box.conf[0])
                    cls = int(box.cls[0])
                    
                    # Calculate area of pothole
                    w_box = x2 - x1
                    h_box = y2 - y1
                    box_area = w_box * h_box
                    total_box_area += box_area
                    
                    # Apply calibration/formula adjustments
                    if box_padding != 0.0:
                        w_change = w_box * box_padding
                        h_change = h_box * box_padding
                        x1 -= w_change / 2
                        x2 += w_change / 2
                        y1 -= h_change / 2
                        y2 += h_change / 2
                        # Recalculate dimensions
                        w_box = x2 - x1
                        h_box = y2 - y1

                    if box_offset_y != 0:
                        y1 += box_offset_y
                        y2 += box_offset_y
                    
                    if conf > max_conf:
                        max_conf = conf
                    
                    detections.append({
                        "class": model.names[cls],
                        "confidence": conf,
                        "bbox": [x1, y1, w_box, h_box], # x, y, w, h format
                        "area_px": box_area,
                        "area_ratio": box_area / img_area
                    })
                    
            # Calculate severity
            severity = "low"
            area_ratio = total_box_area / img_area
            
            if area_ratio > 0.05: # Changed from 0.30 to 0.05 for high severity
                severity = "high"
            elif area_ratio > 0.01: # Changed from 0.05 to 0.01 for medium severity
                severity = "medium"
            
            # Explicitly define severity_ratio variable if it was missing in previous versions
            severity_ratio = area_ratio

            # Generate Explanation via Groq
            explanation = "No significant road defects detected."
            detected_issue = "normal_road"

            if box_count > 0:
                detected_issue = "pothole"
                groq_explanation = None
                
                if client:
                    try:
                        input_data = {
                            "issue": detected_issue,
                            "count": len(detections),
                            "severity": severity,
                            "severity_ratio": round(area_ratio, 4),
                            "max_confidence": round(max_conf, 2)
                        }
                        
                        completion = client.chat.completions.create(
                            model="llama-3.3-70b-versatile",
                            messages=[
                                {"role": "system", "content": SYSTEM_PROMPT},
                                {"role": "user", "content": json.dumps(input_data)}
                            ],
                            temperature=0.5,
                            max_tokens=100,
                            response_format={"type": "json_object"}
                        )
                        groq_explanation = json.loads(completion.choices[0].message.content).get("explanation")
                    except Exception as e:
                        print(f"⚠️ Groq Generation Failed: {e}")
                
                if groq_explanation:
                    explanation = groq_explanation
                else:
                    explanation = f"Detected {len(detections)} defect(s) covering {area_ratio:.1%} of road surface."
            else:
                detected_issue = "normal_road"
                severity = "low"
                explanation = "No significant road defects detected."
                
            # Cleanup
            os.remove(temp_filename)
            
            return {
                "success": True,
                "analysis": {
                    "issue_type": detected_issue,
                    "severity": severity,
                    "confidence": max_conf,
                    "box_count": len(detections),
                    "detections": detections,
                    "explanation": explanation,
                    "detected_at": datetime.now().isoformat()
                },
                "debug_metrics": {
                    "image_dim": [width, height],
                    "total_box_area_px": total_box_area,
                    "severity_ratio": area_ratio,
                    "inference_params": {
                        "conf": conf_threshold,
                        "iou": iou_threshold
                    }
                }
            }
            

        except Exception as e:
            # Re-raise logic or handle cleanup if needed
            raise e

    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
