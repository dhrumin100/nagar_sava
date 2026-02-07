
import cv2
from ultralytics import YOLO
import sys

def test_image(image_path):
    print(f"Testing image: {image_path}")
    model = YOLO('yolov8n.pt')
    results = model(image_path)
    
    for r in results:
        print("Detected objects:")
        for box in r.boxes:
            cls_id = int(box.cls[0])
            name = r.names[cls_id]
            conf = float(box.conf[0])
            print(f"- {name}: {conf:.2f}")

if __name__ == "__main__":
    test_image(r"C:/Users/mecod/.gemini/antigravity/brain/48f8e037-2f9d-4674-979c-75ed0d60e03a/uploaded_media_1769966968840.jpg")
