import cv2
import numpy as np
import mediapipe as mp
from PIL import Image, ExifTags
import json
import os

class ImageValidator:
    def __init__(self):
        self.use_mediapipe = False
        self.use_yolo = False
        self.use_ocr = False
        self.pothole_model = None

        # 1. Face Detection (Mediapipe)
        try:
            self.mp_face_detection = mp.solutions.face_detection
            self.face_detection = self.mp_face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.5)
            self.use_mediapipe = True
        except Exception as e:
            print(f"Warning: Mediapipe Face initialization failed ({e}).")
            self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

        # 2. Object Detection (YOLOv8)
        try:
            from ultralytics import YOLO
            # Load Generic Model (Auto-downloads if missing)
            print("Loading YOLOv8n (General Context)...")
            self.model = YOLO('yolov8n.pt') 
            
            # Load Custom Pothole Model (from Kaggle Knowledge)
            # User must place 'pothole_v8.pt' in root
            pothole_model_path = os.path.join(os.path.dirname(__file__), "pothole_v8.pt")
            if os.path.exists(pothole_model_path):
                print(f"Loading Custom Pothole Model: {pothole_model_path}")
                self.pothole_model = YOLO(pothole_model_path)
            else:
                 print("Note: Custom 'pothole_v8.pt' not found. Using General Context only.")
            
            self.use_yolo = True
            print("AI Models Loaded Successfully.")
        except Exception as e:
            print(f"Warning: YOLOv8 initialization failed ({e}). Context checks disabled.")
        
        # 3. OCR for Text Detection (EasyOCR)
        try:
            import easyocr
            print("Loading EasyOCR (Text Detection)...")
            self.reader = easyocr.Reader(['en'], gpu=False, verbose=False)
            self.use_ocr = True
            print("OCR Loaded Successfully.")
        except Exception as e:
            print(f"Warning: EasyOCR initialization failed ({e}). Text detection disabled.")
        
        # Load blacklist on startup
        self.load_blacklist()

    def _compute_hash(self, image):
        """
        Computes a perceptual hash (dhash) of the image.
        """
        # Resize to 9x8 for dhash (difference hash)
        resized = cv2.resize(image, (9, 8))
        gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
        
        # Compare adjacent pixels
        # 9 cols, 8 rows -> 8x8 difference matrix
        hash_str = ""
        for i in range(8):
            for j in range(8):
                if gray[i, j] > gray[i, j+1]:
                    hash_str += "1"
                else:
                    hash_str += "0"
                    
        return hash_str

    def load_blacklist(self):
        """
        Loads hashes of all images in the 'training_data/blacklisted' directory.
        Uses a JSON cache file to speed up subsequent loads.
        """
        blacklist_dir = os.path.join(os.path.dirname(__file__), "training_data", "blacklisted")
        cache_file = os.path.join(os.path.dirname(__file__), "blacklist_cache.json")
        self.blacklist_hashes = set()
        
        if not os.path.exists(blacklist_dir):
            os.makedirs(blacklist_dir, exist_ok=True)
            return

        # Check for cache
        if os.path.exists(cache_file):
            print(f"Loading blacklist from cache ({cache_file})...")
            try:
                with open(cache_file, 'r') as f:
                    cached_hashes = json.load(f)
                    self.blacklist_hashes = set(cached_hashes)
                print(f"Loaded {len(self.blacklist_hashes)} images from cache instantly.")
                return
            except Exception as e:
                print(f"Failed to load cache: {e}. Rebuilding...")

        print(f"Building blacklist cache from {blacklist_dir}...")
        count = 0
        for root, dirs, files in os.walk(blacklist_dir):
            for filename in files:
                path = os.path.join(root, filename)
                try:
                    img = cv2.imread(path)
                    if img is not None:
                        h = self._compute_hash(img)
                        self.blacklist_hashes.add(h)
                        count += 1
                        if count % 200 == 0:
                             print(f"Processed {count} images...")
                except Exception as e:
                    print(f"Failed to learn {filename}: {e}")
        
        # Save to cache
        try:
            with open(cache_file, 'w') as f:
                json.dump(list(self.blacklist_hashes), f)
            print("Blacklist cache saved.")
        except Exception as e:
            print(f"Failed to save cache: {e}")

        print(f"Blacklist learning complete. Memorized {len(self.blacklist_hashes)} unique images.")

    def validate_image(self, image_path, category=None):
        """
        Validates an image based on various checks.
        Prioritizes Context (Object Detection) to avoid false positives on Text/Printed checks.
        """
        if not os.path.exists(image_path):
             return json.dumps({"status": "rejected", "confidence": 1.0, "reason": "File not found"})

        try:
            # Read image using OpenCV
            image = cv2.imread(image_path)
            if image is None:
                return json.dumps({"status": "rejected", "confidence": 1.0, "reason": "Failed to load image"})

            # 0. Check Blacklist
            current_hash = self._compute_hash(image)
            if current_hash in self.blacklist_hashes:
                 return json.dumps({"status": "rejected", "confidence": 1.0, "reason": "Known Blacklisted Image (Stock/Google)"})

            # Basic Quality Checks
            is_dark, reason_dark = self._check_darkness(image)
            if is_dark:
                return json.dumps({"status": "rejected", "confidence": 0.9, "reason": reason_dark})

            is_blurry, reason_blur = self._check_blur(image)
            if is_blurry:
                return json.dumps({"status": "rejected", "confidence": 0.85, "reason": reason_blur})

            # --- SMART CONTEXT CHECK (Moved Up) ---
            # We run this BEFORE Text/Printed checks. 
            # If we find a RELEVANT object (e.g. Toilet, Garbage), we confirm it's a valid scene 
            # and become lenient on background text/signs.
            
            context_confirmed = False
            
            if self.use_yolo:
                is_invalid_context, context_reason, is_relevant_found = self._check_context(image, category)
                
                if is_invalid_context:
                     return json.dumps({"status": "rejected", "confidence": 0.95, "reason": context_reason})
                
                if is_relevant_found:
                    context_confirmed = True

            # Checks that generate false positives on street scenes (Signs, Billboards)
            # SKIP these if we have confirmed context
            if not context_confirmed:
                # Text Density Check (Posters, Documents, Signs)
                # SKIP for 'garbage' as trash often contains text (wrappers, boxes)
                should_check_text = True
                if category and ('garbage' in category.lower() or 'sanitation' in category.lower() or 'trash' in category.lower() or 'waste' in category.lower()):
                     should_check_text = False

                if self.use_ocr and should_check_text:
                    is_text_heavy, text_reason = self._check_text_density(image)
                    if is_text_heavy:
                        return json.dumps({"status": "rejected", "confidence": 0.92, "reason": text_reason})
                
                # Printed Material Detection
                # SKIP for 'garbage' as trash often looks like printed material (cartons, papers)
                if should_check_text: # Using same flag
                    is_printed, print_reason = self._check_printed_material(image)
                    if is_printed:
                        return json.dumps({"status": "rejected", "confidence": 0.88, "reason": print_reason})
                
                # Color Uniformity Check (Professional Posters)
                is_uniform, color_reason = self._check_color_uniformity(image)
                if is_uniform:
                    return json.dumps({"status": "rejected", "confidence": 0.80, "reason": color_reason})

            is_selfie, reason_face = self._check_faces(image)
            if is_selfie:
                return json.dumps({"status": "rejected", "confidence": 0.95, "reason": reason_face})
            
            is_stock, stock_reason = self._check_metadata(image_path)
            if is_stock:
                 return json.dumps({"status": "rejected", "confidence": 0.9, "reason": stock_reason})

            is_screenshot, reason_screenshot = self._check_screenshot(image_path, image)
            if is_screenshot:
                return json.dumps({"status": "rejected", "confidence": 0.7, "reason": reason_screenshot})

            return json.dumps({"status": "approved", "confidence": 1.0, "reason": "All checks passed"})

        except Exception as e:
            return json.dumps({"status": "rejected", "confidence": 0.0, "reason": f"Error processing image: {str(e)}"})
    
    def _check_metadata(self, image_path):
        """
        Checks EXIF/IPTC metadata for Stock keywords or editing software.
        """
        try:
            pil_img = Image.open(image_path)
            exif = pil_img.getexif()
            
            if not exif:
                return False, None 

            # Tags to check: 
            # 270: ImageDescription, 315: Artist, 33432: Copyright, 305: Software, 316: HostComputer
            suspicious_tags = {
                270: 'ImageDescription', 
                315: 'Artist',
                33432: 'Copyright',
                305: 'Software'
            }
            
            stock_keywords = ['getty', 'shutterstock', 'stock', 'adobe', 'alamy', 'depositphotos', 'istock']
            editing_software = ['photoshop', 'gimp', 'canva', 'paint', 'editor']

            for tag_id, tag_name in suspicious_tags.items():
                if tag_id in exif:
                    value = str(exif[tag_id]).lower()
                    
                    # Check for Stock keywords
                    for keyword in stock_keywords:
                        if keyword in value:
                            return True, f"Stock Image Signature found in {tag_name}: '{value}'"
                    
                    # Check for Editing Software
                    for software in editing_software:
                        if software in value:
                            return True, f"Edited Image detected (Software: {value})"

            return False, None
            
        except Exception as e:
            print(f"Metadata check failed: {e}")
            return False, None

    def _check_context(self, image, category=None):
        """
        Uses YOLOv8 Object Detection to verify scene context.
        Returns: (is_invalid, reason, is_relevant_found)
        """
        try:
            if not self.use_yolo:
                 return False, None, False
            
            # Predict
            results = self.model(image, verbose=False) 
            result = results[0]
            
            detected_classes = []
            if result.boxes:
                for box in result.boxes:
                    cls_id = int(box.cls[0])
                    conf = float(box.conf[0])
                    if conf > 0.4: # Threshold
                        class_name = result.names[cls_id]
                        detected_classes.append(class_name)
            
            label = detected_classes
            
            # --- Anti-Spoofing ---
            spoof_objects = {'tv', 'laptop', 'mouse', 'keyboard', 'cell phone', 'remote', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 'book', 'clock', 'vase'}
            
            found_spoof = [obj for obj in label if obj in spoof_objects]
            
            # EXCEPTION: If category is 'garbage', allow bulk waste items found in spoof list
            if category and ('garbage' in category.lower() or 'sanitation' in category.lower()):
                valid_bulk_waste = {'tv', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 'vase', 'clock'}
                found_spoof = [obj for obj in found_spoof if obj not in valid_bulk_waste]

            if found_spoof:
                return True, f"Suspected Screen/Spoof: Detected {', '.join(found_spoof)}", False
            
            poster_indicators = {'book', 'newspaper', 'framed picture', 'wall', 'door', 'window', 'curtain', 'painting'}
            found_poster_indicators = [obj for obj in label if obj in poster_indicators]
            if len(found_poster_indicators) >= 2:
                return True, f"Suspected Poster/Indoor Photo: Detected {', '.join(found_poster_indicators)}", False

            if not category:
                return False, None, False

            cat_lower = category.lower()
            
            # Define Relevance Lists (Same as before)
            # ... [Skipping full list re-definition for brevity, relying on user to keep existing sets if I don't overwrite them]
            # Wait, I am replacing the whole function block, I MUST provide the lists.
            
            # Potholes / Road Issues
            pothole_relevant = {'car', 'bus', 'truck', 'motorcycle', 'bicycle', 'traffic light', 'stop sign', 'fire hydrant', 'bench'}
            pothole_irrelevant = {
                'cat', 'dog', 'bird', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'person',
                'bed', 'couch', 'dining table', 'chair', 'potted plant', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush',
                'door', 'window', 'curtain', 'painting', 'frame', 'wall decoration'
            }

            # Garbage - Extended
            garbage_relevant = {
                'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 
                'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake',
                'couch', 'bed', 'chair', 'dining table', 'toilet', 'sink', 'refrigerator', 'microwave', 'oven', 'toaster', 'tv', 'vase', 'clock', 'potted plant', 'suitcase', 'mattress'
            }
            garbage_irrelevant = {
                'person', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe'
            }
            
            # Street Light
            light_relevant = {'traffic light', 'stop sign', 'car', 'bus', 'truck', 'motorcycle'}
            light_irrelevant = pothole_irrelevant

            # Waterlogging
            water_relevant = {'car', 'bus', 'truck', 'motorcycle', 'bicycle', 'boat', 'umbrella'}
            water_irrelevant = pothole_irrelevant

            # Select Set
            relevant_set = set()
            irrelevant_set = set()

            if 'pothole' in cat_lower or 'road' in cat_lower:
                relevant_set = pothole_relevant
                irrelevant_set = pothole_irrelevant
                
                if hasattr(self, 'pothole_model') and self.pothole_model:
                     ph_results = self.pothole_model(image, verbose=False)
                     if ph_results[0].boxes and len(ph_results[0].boxes) > 0:
                         return False, None, True # Found Pothole!

            elif 'garbage' in cat_lower or 'sanitation' in cat_lower:
                relevant_set = garbage_relevant
                irrelevant_set = garbage_irrelevant
            elif 'light' in cat_lower or 'electric' in cat_lower:
                relevant_set = light_relevant
                irrelevant_set = light_irrelevant
            elif 'water' in cat_lower or 'drainage' in cat_lower:
                relevant_set = water_relevant
                irrelevant_set = water_irrelevant
            
            # Check for Relevant
            found_relevant = [obj for obj in label if obj in relevant_set]
            if found_relevant:
                return False, None, True # FOUND RELEVANT
            
            # Check for Irrelevant
            found_irrelevant = [obj for obj in label if obj in irrelevant_set]
            if found_irrelevant:
                return True, f"Irrelevant Object for {category}: Detected {', '.join(found_irrelevant)}", False
            
            return False, None, False # Neutral
            
        except Exception as e:
            print(f"Context check failed: {e}")
            return False, None, False

    def _check_darkness(self, image):
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        avg_brightness = np.mean(gray)
        
        # Threshold for darkness
        if avg_brightness < 30:
            # Check Standard Deviation (Contrast)
            std_dev = np.std(gray)
            # If std_dev is high, it means there are bright spots (lights). If low, it's uniformly dark.
            if std_dev < 10: # Threshold for "Uniformly black"
                return True, f"Image is too dark (Brightness: {avg_brightness:.2f}, StdDev: {std_dev:.2f})"
            else:
                # Has bright spots, ALLOW
                return False, None
        return False, None

    def _check_blur(self, image):
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        
        # User defined conservative threshold
        if laplacian_var < 80:
            # Borderline/Fail. Check Edge Density.
            edges = cv2.Canny(gray, 100, 200)
            edge_density = np.sum(edges > 0) / edges.size
            
            # If minimal edges, it's likely a smooth surface (wall, road) -> Accept
            if edge_density < 0.01: # 1% edges
                return False, None # Accept as smooth surface
            else:
                return True, f"Image is blurry (Laplacian Var: {laplacian_var:.2f}, Edge Density: {edge_density:.4f})"
        
        return False, None

    def _check_faces(self, image):
        h, w, c = image.shape
        
        if self.use_mediapipe:
            img_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            results = self.face_detection.process(img_rgb)
            
            if results.detections:
                for detection in results.detections:
                    bboxC = detection.location_data.relative_bounding_box
                    bbox_area = bboxC.width * bboxC.height
                    
                    # Check if face > 10% of image
                    if bbox_area > 0.10:
                        return True, f"Face detected covering {bbox_area*100:.1f}% of image (Potential Selfie)"
        else:
            # Fallback: Haar Cascade
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            faces = self.face_cascade.detectMultiScale(gray, 1.1, 4)
            for (x, y, fw, fh) in faces:
                # Calculate relative area
                bbox_area = (fw * fh) / (w * h)
                if bbox_area > 0.10:
                      return True, f"Face detected covering {bbox_area*100:.1f}% of image (Potential Selfie - Haar)"
        
        return False, None

    def _check_screenshot(self, image_path, image):
        # 1. Check EXIF
        try:
            pil_img = Image.open(image_path)
            exif_data = pil_img._getexif()
            if exif_data:
                # If EXIF exists, likely not a screenshot (or at least valid photo)
                return False, None
        except Exception:
            pass # No EXIF or error reading it
            
        # If we reach here, EXIF is missing or unreadable. Run Mismatch Check.
        
        # 2. Resolution Check
        h, w, c = image.shape
        # Common screen resolutions (portrait and landscape) + WhatsApp/Social media compressions
        # This is heuristics. User said "Does the resolution match standard screen resolutions (e.g., 1080x1920)?"
        # Standard width/heights: 1080, 1920, 720, 1280, 1440, 2560, 1170, 2532 (iPhone)
        common_dims = {720, 1280, 1080, 1920, 1440, 2560, 1170, 2532}
        
        is_common_res = (w in common_dims or h in common_dims)
        
        # 3. Status Bar Check (Solid color bars at top/bottom)
        # Check top 3% and bottom 3%
        top_bar = image[0:int(h*0.03), 0:w]
        bottom_bar = image[int(h*0.97):h, 0:w]
        
        # Calculate std dev of color in these regions. If solid color, std dev is low.
        top_std = np.std(top_bar)
        bottom_std = np.std(bottom_bar)
        
        has_solid_bars = top_std < 5 or bottom_std < 5 # Threshold for solid color
        
        if has_solid_bars:
             return True, "Suspected Screenshot (Detected Status Bar / Letterboxing)"
             
        # Resolution match alone is too aggressive for uploaded files (which often lack EXIF)
        # if is_common_res:
        #    return True, "Suspected Screenshot (Resolution match)"
             
        return False, None
    
    def _check_text_density(self, image):
        """
        Detects text-heavy images (posters, documents, signs).
        Uses OCR if available, otherwise uses OpenCV text detection.
        """
        try:
            h, w, c = image.shape
            image_area = h * w
            
            if self.use_ocr:
                # Convert to RGB for EasyOCR
                img_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                
                # Detect text regions
                results = self.reader.readtext(img_rgb, paragraph=False)
                
                if not results:
                    return False, None
                
                # Calculate total text area
                text_area = 0
                text_count = len(results)
                
                for (bbox, text, conf) in results:
                    if conf > 0.3:  # Confidence threshold
                        # bbox is [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
                        points = np.array(bbox, dtype=np.int32)
                        area = cv2.contourArea(points)
                        text_area += area
                
                text_ratio = text_area / image_area
                
                # Reject if >30% text coverage OR >10 text regions (poster/document)
                if text_ratio > 0.30:
                    return True, f"Text-heavy image detected ({text_ratio*100:.1f}% text coverage) - Likely poster/document"
                
                if text_count > 10 and text_ratio > 0.15:
                    return True, f"Multiple text regions detected ({text_count} regions, {text_ratio*100:.1f}% coverage) - Likely poster/sign"
            else:
                # Fallback: Use edge detection + contour analysis for text-like patterns
                gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
                
                # Apply adaptive thresholding to enhance text
                thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2)
                
                # Find contours (text regions typically have many small contours)
                contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                
                # Filter for text-like contours (small, rectangular)
                text_like_contours = 0
                text_area = 0
                
                for contour in contours:
                    area = cv2.contourArea(contour)
                    if 50 < area < image_area * 0.05:  # Small to medium sized
                        x, y, cw, ch = cv2.boundingRect(contour)
                        aspect_ratio = float(cw) / ch if ch > 0 else 0
                        
                        # Text typically has aspect ratio between 0.1 and 10
                        if 0.1 < aspect_ratio < 10:
                            text_like_contours += 1
                            text_area += area
                
                text_ratio = text_area / image_area
                
                # Reject if many text-like regions
                if text_like_contours > 50 and text_ratio > 0.20:
                    return True, f"Text-like patterns detected ({text_like_contours} regions, {text_ratio*100:.1f}% coverage) - Likely poster/document"
            
            return False, None
            
        except Exception as e:
            print(f"Text density check failed: {e}")
            return False, None
    
    def _check_printed_material(self, image):
        """
        Detects printed materials (posters, flyers, papers) using edge pattern analysis.
        Printed materials have distinct characteristics:
        - Sharp, uniform edges (rectangular borders)
        - High edge density in specific patterns
        - Paper texture (when close-up)
        """
        try:
            h, w, c = image.shape
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # 1. Detect rectangular borders (common in posters/documents)
            edges = cv2.Canny(gray, 50, 150)
            contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            # Look for large rectangular contours (poster border)
            image_area = h * w
            for contour in contours:
                area = cv2.contourArea(contour)
                if area > image_area * 0.4:  # Large contour (>40% of image)
                    # Check if rectangular
                    peri = cv2.arcLength(contour, True)
                    approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
                    
                    if len(approx) == 4:  # Rectangular shape
                        # Check aspect ratio (posters are usually standard sizes)
                        x, y, cw, ch = cv2.boundingRect(approx)
                        aspect_ratio = float(cw) / ch if ch > 0 else 0
                        
                        # Common poster ratios: A4 (0.707), Letter (0.773), Square (1.0)
                        common_ratios = [0.707, 0.773, 1.0, 1.414, 1.294]
                        for ratio in common_ratios:
                            if abs(aspect_ratio - ratio) < 0.1 or abs(aspect_ratio - 1/ratio) < 0.1:
                                return True, f"Rectangular border detected (aspect ratio {aspect_ratio:.2f}) - Likely printed material"
            
            # 2. Check for uniform edge patterns (printed text/graphics)
            # Calculate edge density in grid
            grid_size = 4
            cell_h, cell_w = h // grid_size, w // grid_size
            edge_densities = []
            
            for i in range(grid_size):
                for j in range(grid_size):
                    cell = edges[i*cell_h:(i+1)*cell_h, j*cell_w:(j+1)*cell_w]
                    density = np.sum(cell > 0) / cell.size
                    edge_densities.append(density)
            
            # If edge density is very uniform across cells (printed material)
            edge_std = np.std(edge_densities)
            edge_mean = np.mean(edge_densities)
            
            if edge_mean > 0.15 and edge_std < 0.05:
                return True, f"Uniform edge pattern detected (mean: {edge_mean:.2f}, std: {edge_std:.2f}) - Likely printed material"
            
            return False, None
            
        except Exception as e:
            print(f"Printed material check failed: {e}")
            return False, None
    
    def _check_color_uniformity(self, image):
        """
        Detects professional posters with limited color palettes.
        Real-world photos have natural color variations.
        """
        try:
            h, w, c = image.shape
            
            # 1. Analyze color histogram
            # Convert to HSV for better color analysis
            hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
            
            # Calculate histogram for Hue channel
            hist = cv2.calcHist([hsv], [0], None, [180], [0, 180])
            hist = hist.flatten() / (h * w)  # Normalize
            
            # Count dominant colors (peaks in histogram)
            peaks = []
            for i in range(1, len(hist) - 1):
                if hist[i] > 0.05 and hist[i] > hist[i-1] and hist[i] > hist[i+1]:
                    peaks.append(i)
            
            # Professional posters often have 2-4 dominant colors
            if len(peaks) <= 3 and max(hist) > 0.2:
                # Check if large uniform regions exist
                # Quantize colors
                hsv_quantized = hsv.copy()
                hsv_quantized[:, :, 0] = (hsv[:, :, 0] // 30) * 30  # Quantize hue
                
                # Find largest uniform region
                unique, counts = np.unique(hsv_quantized[:, :, 0], return_counts=True)
                max_uniform_ratio = max(counts) / (h * w)
                
                if max_uniform_ratio > 0.6:
                    return True, f"Limited color palette detected ({len(peaks)} dominant colors, {max_uniform_ratio*100:.1f}% uniform) - Likely poster/graphic"
            
            # 2. Check for artificial gradients (design elements)
            # Calculate color variance in horizontal/vertical strips
            mid_h = h // 2
            mid_w = w // 2
            
            h_strip = hsv[mid_h-10:mid_h+10, :, 0]
            v_strip = hsv[:, mid_w-10:mid_w+10, 0]
            
            # If gradient is too smooth (linear), it's likely artificial
            h_grad = np.gradient(np.mean(h_strip, axis=0))
            v_grad = np.gradient(np.mean(v_strip, axis=0))
            
            h_grad_std = np.std(h_grad)
            v_grad_std = np.std(v_grad)
            
            if h_grad_std < 0.5 and v_grad_std < 0.5 and (np.mean(np.abs(h_grad)) > 0.1 or np.mean(np.abs(v_grad)) > 0.1):
                return True, "Artificial gradient detected - Likely designed poster/graphic"
            
            return False, None
            
        except Exception as e:
            print(f"Color uniformity check failed: {e}")
            return False, None
