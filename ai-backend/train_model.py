
from ultralytics import YOLO
import os

def train_pothole_detector():
    # 1. Load the model (Nano for hackathon speed, or Small for better accuracy)
    # Using 'yolov8n.pt' which is pretrained on COCO
    model = YOLO('yolov8n.pt') 

    # 2. Path to our prepared dataset
    data_yaml = r'd:\angry\datasets\pothole_yolo\data.yaml'
    
    print(f"Starting training with dataset: {data_yaml}")
    
    # 3. Train the model
    # epochs=50: Enough for fine-tuning on small dataset
    # imgsz=640: Standard YOLO size
    # plots=True: To see learning curves
    results = model.train(
        data=data_yaml,
        epochs=50,
        imgsz=640,
        batch=4,
        workers=0,
        name='pothole_v1',
        device=0, # Force GPU 0
        patience=10 # Stop early if no improvement
    )
    
    print("Training complete!")
    
    # 4. Validate the model
    metrics = model.val()
    print(f"Validation mAP50-95: {metrics.box.map}")
    
    # 5. Export for deployment (optional but good for speed)
    success = model.export(format='onnx')
    print(f"Model exported: {success}")

if __name__ == '__main__':
    train_pothole_detector()
