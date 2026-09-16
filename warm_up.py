import os
import time
import tempfile
import numpy as np
import cv2
from core.logger import logger
from ocr.paddle_engine import run_paddle_ocr
from ocr.easyocr_engine import run_easyocr

def warm_up():
    logger.info("==========================================")
    logger.info("Warming up OCR Model Engines...")
    logger.info("==========================================")
    
    # Create blank dummy image in temp directory
    dummy = np.ones((200, 400, 3), dtype=np.uint8) * 255
    cv2.putText(dummy, "NET WT 500g MRP Rs 150", (20, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        dummy_path = tmp.name
    cv2.imwrite(dummy_path, dummy)

    t0 = time.time()
    try:
        # 1. Warm up EasyOCR (loads and applies INT8 quantization)
        logger.info("1. Warming up EasyOCR (INT8)...")
        t_easy = time.time()
        res_easy = run_easyocr(dummy_path)
        logger.info(f"   ✓ EasyOCR ready in {time.time() - t_easy:.2f}s ({len(res_easy)} text found)")

        # 2. Warm up PaddleOCR (loads MKL-DNN engine)
        logger.info("2. Warming up PaddleOCR (MKL-DNN)...")
        t_pad = time.time()
        res_pad = run_paddle_ocr(dummy_path)
        logger.info(f"   ✓ PaddleOCR ready in {time.time() - t_pad:.2f}s ({len(res_pad)} text found)")

        logger.info("==========================================")
        logger.info(f"All primary OCR engines warmed up in {time.time() - t0:.2f}s!")
        logger.info("==========================================")
    finally:
        import os
        if os.path.exists(dummy_path):
            os.remove(dummy_path)

if __name__ == "__main__":
    warm_up()
