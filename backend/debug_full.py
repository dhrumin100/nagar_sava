
import sys
import os

# Add current directory to path so we can import validator
sys.path.append(os.getcwd())

from validator import ImageValidator

def test_full_validation(image_path, category):
    print(f"Testing full validation for: {image_path} (Category: {category})")
    
    validator = ImageValidator()
    result = validator.validate_image(image_path, category=category)
    print("Validation Result:")
    print(result)

if __name__ == "__main__":
    # Point to the uploaded image
    img_path = r"C:/Users/mecod/.gemini/antigravity/brain/48f8e037-2f9d-4674-979c-75ed0d60e03a/uploaded_media_1769966968840.jpg"
    test_full_validation(img_path, "garbage")
