
import os
import shutil
import yaml
from pathlib import Path

def convert_obb_to_bbox(obb_coords):
    """
    Convert OBB (x1,y1, x2,y2, x3,y3, x4,y4) to YOLO BBox (x_center, y_center, width, height)
    """
    # Extract x and y coordinates
    xs = [obb_coords[i] for i in range(0, len(obb_coords), 2)]
    ys = [obb_coords[i+1] for i in range(0, len(obb_coords), 2)]
    
    # Calculate bounding box
    x_min, x_max = min(xs), max(xs)
    y_min, y_max = min(ys), max(ys)
    
    # Calculate center, width, height
    width = x_max - x_min
    height = y_max - y_min
    x_center = x_min + (width / 2)
    y_center = y_min + (height / 2)
    
    return [x_center, y_center, width, height]

def process_dataset(source_root, target_root):
    """
    Convert dataset from OBB to standard YOLO format
    """
    source_path = Path(source_root)
    target_path = Path(target_root)
    
    # Create target directories
    for split in ['train', 'valid', 'test']:
        (target_path / split / 'images').mkdir(parents=True, exist_ok=True)
        (target_path / split / 'labels').mkdir(parents=True, exist_ok=True)

    # Process each split
    for split in ['train', 'valid', 'test']:
        src_images = source_path / split / 'images'
        src_labels = source_path / split / 'labels'
        
        if not src_images.exists():
            continue
            
        print(f"Processing {split} set...")
        
        # Process each label file
        for label_file in src_labels.glob('*.txt'):
            # Read OBB annotations
            with open(label_file, 'r') as f:
                lines = f.readlines()
            
            new_lines = []
            for line in lines:
                parts = list(map(float, line.strip().split()))
                class_id = int(parts[0])
                coords = parts[1:]
                
                # Convert
                bbox = convert_obb_to_bbox(coords)
                
                # Format: class xc yc w h
                new_line = f"{class_id} {bbox[0]:.6f} {bbox[1]:.6f} {bbox[2]:.6f} {bbox[3]:.6f}\n"
                new_lines.append(new_line)
            
            # Write new label file
            dest_label = target_path / split / 'labels' / label_file.name
            with open(dest_label, 'w') as f:
                f.writelines(new_lines)
            
            # Copy corresponding image
            # Find image with same stem (ignoring extension)
            # Image extension could be .jpg, .png etc.
            img_files = list(src_images.glob(f"{label_file.stem}.*"))
            if img_files:
                shutil.copy2(img_files[0], target_path / split / 'images' / img_files[0].name)

    # Create data.yaml
    create_yaml(target_path)

def create_yaml(target_path):
    data = {
        'path': str(target_path.absolute()),
        'train': 'train/images',
        'val': 'valid/images',
        'test': 'test/images',
        'nc': 1,
        'names': ['pothole']
    }
    
    with open(target_path / 'data.yaml', 'w') as f:
        yaml.dump(data, f, default_flow_style=False)
    
    print(f"Dataset preparation complete at {target_path}")

if __name__ == "__main__":
    SOURCE_DATASET = r"d:\Pothole\Pothole.v1-raw.yolov8-obb"
    TARGET_DATASET = r"d:\angry\datasets\pothole_yolo"
    
    print(f"Converting from {SOURCE_DATASET} to {TARGET_DATASET}")
    process_dataset(SOURCE_DATASET, TARGET_DATASET)
