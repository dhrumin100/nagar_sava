
import torch
import sys

def check_gpu():
    print(f"Python: {sys.version}")
    print(f"PyTorch: {torch.__version__}")
    
    if torch.cuda.is_available():
        print("✅ CUDA is available!")
        print(f"🔢 GPU Count: {torch.cuda.device_count()}")
        print(f"🏎️ Current Device: {torch.cuda.current_device()}")
        print(f"🏷️ Device Name: {torch.cuda.get_device_name(0)}")
        
        # Test tensor allocation
        try:
            x = torch.tensor([1.0, 2.0]).cuda()
            print("💾 Tensor allocation on GPU: SUCCESS")
        except Exception as e:
            print(f"❌ Tensor allocation on GPU: FAILED ({e})")
    else:
        print("❌ CUDA is NOT available. Using CPU.")

if __name__ == "__main__":
    check_gpu()
