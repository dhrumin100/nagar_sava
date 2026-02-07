from ultralytics import YOLO
import os

# Define dataset path
DATA_YAML = r"d:\angry\datasets\pothole_yolo\data.yaml"

def train_model():
    # Load a pretrained YOLOv8n model
    model = YOLO('yolov8n.pt') 

    # Train the model
    # We use a new name 'pothole_v15' to avoid overwriting v14 immediately
    results = model.train(
        data=DATA_YAML,
        epochs=50,
        imgsz=640,
        batch=4,
        name='pothole_v15', 
        device='0', # Use GPU. Change to 'cpu' if no GPU available
        patience=10,
        save=True
    )
    
    print("✅ Training Complete!")
    print(f"Best model saved at: {results.save_dir}/weights/best.pt")

if __name__ == '__main__':
    train_model()
