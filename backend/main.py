import cv2
import numpy as np
from validator import ImageValidator
import os
import json

def create_synthetic_images():
    os.makedirs("test_images", exist_ok=True)
    
    # 1. Valid Dark Image (Night street light)
    # create black image
    img_dark_valid = np.zeros((500, 500, 3), dtype=np.uint8)
    # Add bright spots (lights)
    cv2.circle(img_dark_valid, (100, 100), 10, (255, 255, 255), -1)
    cv2.circle(img_dark_valid, (400, 400), 20, (255, 255, 200), -1)
    cv2.imwrite("test_images/dark_valid.jpg", img_dark_valid)
    
    # 2. Invalid Dark Image (Pitch black/Uniform)
    img_dark_invalid = np.zeros((500, 500, 3), dtype=np.uint8) + 10 # very dark grey
    cv2.imwrite("test_images/dark_invalid.jpg", img_dark_invalid)

    # 3. Valid Blur-like (Smooth Wall)
    # Smooth gradient or solid color
    img_smooth = np.zeros((500, 500, 3), dtype=np.uint8)
    img_smooth[:] = (200, 200, 200) # Wall color
    cv2.imwrite("test_images/smooth_valid.jpg", img_smooth)
    
    # 4. Invalid Blur (Gaussian Blur on Noise)
    img_sharp = np.random.randint(0, 255, (500, 500, 3), dtype=np.uint8)
    img_blur = cv2.GaussianBlur(img_sharp, (25, 25), 0)
    cv2.imwrite("test_images/blur_invalid.jpg", img_blur)
    
    # 5. Screenshot Suspect
    # 1080x1920, with top bar
    img_screenshot = np.zeros((1920, 1080, 3), dtype=np.uint8)
    img_screenshot[:] = (100, 100, 100) # Content
    # Status bar
    img_screenshot[0:60, :] = (0, 0, 0)
    cv2.imwrite("test_images/screenshot_invalid.jpg", img_screenshot)

    return ["test_images/dark_valid.jpg", "test_images/dark_invalid.jpg", "test_images/smooth_valid.jpg", "test_images/blur_invalid.jpg", "test_images/screenshot_invalid.jpg"]

def main():
    print("Generating synthetic test images...")
    image_paths = create_synthetic_images()
    
    validator = ImageValidator()
    
    print("\n--- Running Validation Tests ---\n")
    
    for path in image_paths:
        print(f"Testing {path}...")
        result = validator.validate_image(path)
        # Parse json for pretty printing
        res_obj = json.loads(result)
        print(f"Result: {res_obj['status'].upper()}")
        print(f"Reason: {res_obj['reason']}")
        print(f"Confidence: {res_obj['confidence']}")
        print("-" * 30)

if __name__ == "__main__":
    main()
