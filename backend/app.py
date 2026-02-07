from flask import Flask, request, jsonify
from flask_cors import CORS
import os
os.environ['FLASK_SKIP_DOTENV'] = '1' # Prevent crash on corrupted .env file
import hashlib
import time
import json
from validator import ImageValidator
import cv2
import numpy as np

app = Flask(__name__)
CORS(app)  # Allow Cross-Origin requests from React

# Initialize Validator
validator = ImageValidator()

# Secret key for token generation (In prod, use env var)
SECRET_KEY = "NAGAR_SEVA_SECURE_KEY_2025"

def generate_verification_token(image_bytes):
    """
    Generates a secure token based on image content and timestamp.
    This ensures the token is linked to THIS specific image.
    """
    timestamp = str(int(time.time()))
    # Create a hash of the image content to ensure integrity (Anti-Swap)
    image_hash = hashlib.sha256(image_bytes).hexdigest()
    
    # Sign the token
    payload = f"{image_hash}|{timestamp}|{SECRET_KEY}"
    token = hashlib.sha256(payload.encode()).hexdigest()
    
    return f"{token}.{timestamp}"

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "service": "AI Verification Microservice"})

@app.route('/verify', methods=['POST'])
def verify_image():
    if 'image' not in request.files:
        return jsonify({"status": "rejected", "reason": "No image provided"}), 400
    
    file = request.files['image']
    
    # Read image into memory for processing
    # Convert to numpy array for OpenCV
    file_bytes = file.read()
    nparr = np.frombuffer(file_bytes, np.uint8)
    img_cv2 = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img_cv2 is None:
        return jsonify({"status": "rejected", "reason": "Invalid image format"}), 400

    # Save temp file for validator (older validator logic uses file path)
    # Refactoring validator to use memory or saving temp
    temp_path = f"temp_{int(time.time())}.jpg"
    cv2.imwrite(temp_path, img_cv2)
    
    try:
        # Run AI Checks
        category = request.form.get('category', None)
        # Note: validator.validate_image expects a path currently.
        # We process the result string (JSON) from validator
        result_json_str = validator.validate_image(temp_path, category=category)
        result = json.loads(result_json_str)
        
        # Cleanup
        if os.path.exists(temp_path):
            os.remove(temp_path)

        if result['status'] == 'approved':
            # Generate Anti-Bypass Token
            token = generate_verification_token(file_bytes)
            return jsonify({
                "status": "approved",
                "confidence": result['confidence'],
                "verification_token": token,
                "message": "Evidence Verified & Secured"
            })
        else:
            return jsonify({
                "status": "rejected",
                "reason": result.get('reason', 'AI Validation Failed'),
                "confidence": result.get('confidence', 0)
            })

    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        print(f"Error: {e}")
        return jsonify({"status": "error", "reason": "Internal Server Error"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
