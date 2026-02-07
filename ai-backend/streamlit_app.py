import streamlit as st
import requests
from PIL import Image, ImageDraw, ImageFont
import io

# Config
API_URL = "http://localhost:8000/analyze-image"

st.set_page_config(page_title="Nagar Seva AI Tester", page_icon="🛣️")

st.title("🛣️ Nagar Seva AI - Pothole Detector")
st.write("Upload an image to test the trained YOLOv8 model via FastAPI.")

# Sidebar Controls
st.sidebar.header("🔧 Model Tuning")
conf_thresh = st.sidebar.slider("Confidence Threshold", 0.0, 1.0, 0.25, 0.05, help="Only show detections with confidence higher than this.")
iou_thresh = st.sidebar.slider("IoU Threshold", 0.0, 1.0, 0.70, 0.05, help="Intersection over Union: Lower values merge boxes more aggressively.")

st.sidebar.markdown("---")
st.sidebar.info("This interface connects to the local FastAPI backend running YOLOv8n (Pothole v13).")

# File uploader
uploaded_file = st.file_uploader("Choose a road image...", type=["jpg", "jpeg", "png"])

if uploaded_file is not None:
    # Display original image
    image = Image.open(uploaded_file)
    st.image(image, caption='Uploaded Image', width="stretch")
    
    # Analyze button
    if st.button('🔍 Analyze Road Condition'):
        with st.spinner('Sending to AI Brain...'):
            try:
                # Prepare file for API
                uploaded_file.seek(0)
                files = {"image": (uploaded_file.name, uploaded_file, uploaded_file.type)}
                data_payload = {
                    "conf_threshold": conf_thresh,
                    "iou_threshold": iou_thresh
                }
                
                # Call API
                response = requests.post(API_URL, files=files, data=data_payload)
                
                if response.status_code == 200:
                    result = response.json()
                    analysis = result["analysis"]
                    debug = result.get("debug_metrics", {})
                    
                    # --- TABBED VIEW ---
                    tab1, tab2, tab3 = st.tabs(["🖼️ Visual Result", "🧪 Debug Metrics", "📄 Raw JSON"])
                    
                    with tab1:
                        # Columns for metrics
                        col1, col2, col3 = st.columns(3)
                        with col1:
                            st.metric("Detected Isse", analysis["issue_type"].upper())
                        with col2:
                            color = "red" if analysis["severity"] == "high" else "orange" if analysis["severity"] == "medium" else "green"
                            st.markdown(f"**Severity:** :{color}[{analysis['severity'].upper()}]")
                        with col3:
                            st.metric("Confidence", f"{analysis['confidence']*100:.1f}%")
                        
                        st.info(f"**AI Explanation:** {analysis['explanation']}")
                        
                        # Draw Bounding Boxes
                        if analysis.get("detections"):
                            st.subheader("📸 Visual Proof")
                            img_draw = image.copy()
                            draw = ImageDraw.Draw(img_draw)
                            
                            # Determine color based on severity
                            box_color = "red"
                            if analysis["severity"] == "medium":
                                box_color = "orange"
                            elif analysis["severity"] == "low":
                                box_color = "#00FF00" # Bright Green

                            for det in analysis["detections"]:
                                x1, y1, bw, bh = det["bbox"]  # Already top-left corner format
                                x2, y2 = x1 + bw, y1 + bh
                                
                                # Draw Box with dynamic color
                                draw.rectangle([x1, y1, x2, y2], outline=box_color, width=2)
                                
                                # Draw Score Label
                                try:
                                    font = ImageFont.load_default()
                                except:
                                    font = None
                                
                                label = f"{det['confidence']*100:.0f}%"
                                # Draw text background for readability? Or just text.
                                # Let's draw text slightly above the box
                                draw.text((x1, y1 - 12), label, fill=box_color, font=font)
                            
                            st.image(img_draw, caption='AI Detected Issues', width="stretch")
                        else:
                            st.success("✅ Road looks clear!")

                    with tab2:
                        st.markdown("### 🧮 How Severity was Calculated")
                        if debug:
                            col_d1, col_d2 = st.columns(2)
                            with col_d1:
                                st.metric("Defect Area (px²)", f"{debug['total_box_area_px']:,.0f}")
                            with col_d2:
                                st.metric("Road Coverage", f"{debug['severity_ratio']:.2%}")
                            
                            st.caption("Severity Logic:")
                            st.code("""
if ratio > 5%: HIGH
elif ratio > 1%: MEDIUM
else: LOW
                            """, language="python")

                    with tab3:
                        st.json(result)
                        
                else:
                    st.error(f"Error {response.status_code}: {response.text}")
                    
            except Exception as e:
                st.error(f"Connection Error: {e}")
                st.warning("Make sure the backend is running on port 8000 using 'python main.py'")
