from PIL import Image
import os

def resize_and_convert(input_path, output_path, size=(1280, 800)):
    if not os.path.exists(input_path):
        print(f"File not found: {input_path}")
        return
    
    with Image.open(input_path) as img:
        # Convert to RGB if necessary (for JPEG)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        
        # Resize using LANCZOS for high quality
        img_resized = img.resize(size, Image.Resampling.LANCZOS)
        
        # Save as JPEG
        img_resized.save(output_path, "JPEG", quality=95)
        print(f"Created: {output_path}")

if __name__ == "__main__":
    base_path = "c:\\plugin_project"
    
    # 1. Main inspect image
    resize_and_convert(
        os.path.join(base_path, "naver_main_inspect.png"),
        os.path.join(base_path, "screenshot_main_1280x800.jpg")
    )
    
    # 2. Verify V34 image
    resize_and_convert(
        os.path.join(base_path, "naver_verify_v34.png"),
        os.path.join(base_path, "screenshot_verify_1280x800.jpg")
    )
