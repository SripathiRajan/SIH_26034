import cv2
import numpy as np
import os
from typing import Tuple
from core.config import MAX_IMAGE_LONG_EDGE

def compute_sharpness(image_path_or_mat) -> float:
    """Calculates Laplacian variance as a proxy for image sharpness."""
    if isinstance(image_path_or_mat, str):
        img = cv2.imread(image_path_or_mat, cv2.IMREAD_GRAYSCALE)
    else:
        if len(image_path_or_mat.shape) == 3:
            img = cv2.cvtColor(image_path_or_mat, cv2.COLOR_BGR2GRAY)
        else:
            img = image_path_or_mat

    if img is None:
        return 0.0
    return float(cv2.Laplacian(img, cv2.CV_64F).var())

def resize_for_ocr(image_path: str, max_long_edge: int = MAX_IMAGE_LONG_EDGE) -> Tuple[str, bool]:
    """
    Downscales large high-resolution images (e.g., 12MP/4K camera captures)
    to a max long edge (e.g. 1600px). Drastically reduces inference time from minutes to seconds
    with zero loss in OCR accuracy.
    Returns: (path_to_use, is_temporary)
    """
    img = cv2.imread(image_path)
    if img is None:
        return image_path, False

    h, w = img.shape[:2]
    max_dim = max(h, w)

    if max_dim <= max_long_edge:
        return image_path, False

    scale = max_long_edge / float(max_dim)
    new_w = int(w * scale)
    new_h = int(h * scale)

    resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)

    base, ext = os.path.splitext(image_path)
    optimized_path = f"{base}_opt{ext}"
    cv2.imwrite(optimized_path, resized)
    return optimized_path, True

def apply_clahe_sharpen(img_bgr: np.ndarray) -> np.ndarray:
    """Applies CLAHE contrast enhancement and unsharp masking to an image array."""
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    blurred = cv2.GaussianBlur(enhanced, (0, 0), 3)
    sharpened = cv2.addWeighted(enhanced, 1.5, blurred, -0.5, 0)
    return cv2.cvtColor(sharpened, cv2.COLOR_GRAY2BGR)


def enhance_image(image_path: str) -> str:
    """
    Applies CLAHE contrast enhancement and unsharp mask.
    Used during targeted retries for faint/micro-printed text.
    """
    img = cv2.imread(image_path)
    if img is None:
        return image_path

    enhanced_bgr = apply_clahe_sharpen(img)

    base, ext = os.path.splitext(image_path)
    tmp_path = f"{base}_enhanced{ext}"
    cv2.imwrite(tmp_path, enhanced_bgr)
    return tmp_path


def check_glare(image_path: str, threshold: float = 0.18) -> Tuple[bool, float]:
    """
    Computes the ratio of overexposed pixels (luma > 246).
    Returns (is_acceptable: bool, glare_ratio: float).
    Codebase 2 spec: reject/warn on images where glare_ratio > 0.18.
    """
    img = cv2.imread(image_path)
    if img is None:
        return True, 0.0
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    overexposed = np.sum(gray > 246)
    ratio = float(overexposed) / float(gray.size)
    return ratio <= threshold, round(ratio, 4)


def crop_region_around_keyword(
    image_path: str,
    keyword_bbox: list,
    padding_px: int = 80,
) -> str:
    """
    Layer 4 – Targeted Crop Re-OCR.

    Crops a padded region around `keyword_bbox` (a list of [x, y] points)
    from `image_path` and writes it to a temp file for focused OCR.

    Returns path to the cropped image, or the original path if it fails.
    The caller is responsible for deleting the temp file after use.
    """
    img = cv2.imread(image_path)
    if img is None or not keyword_bbox:
        return image_path

    pts = np.array(keyword_bbox, dtype=np.float32)
    x1 = max(0, int(pts[:, 0].min()) - padding_px)
    y1 = max(0, int(pts[:, 1].min()) - padding_px)
    x2 = min(img.shape[1], int(pts[:, 0].max()) + padding_px)
    y2 = min(img.shape[0], int(pts[:, 1].max()) + padding_px)

    if x2 <= x1 or y2 <= y1:
        return image_path

    crop = img[y1:y2, x1:x2]

    # Apply CLAHE + unsharp mask to the crop for better OCR on faint text
    crop_bgr = apply_clahe_sharpen(crop)

    base, ext = os.path.splitext(image_path)
    crop_path = f"{base}_crop_{x1}_{y1}{ext}"
    cv2.imwrite(crop_path, crop_bgr)
    return crop_path


def deskew_perspective(image_path: str) -> str:
    """
    Detects the dominant rectangular boundary of a product label and corrects
    perspective skew using contour minAreaRect + warpPerspective.

    Returns path to deskewed image (new temp file).
    If detection fails or skew is < 2 degrees, returns the original path unchanged.
    Codebase 2 spec: Hough / minAreaRect perspective correction.
    """
    img = cv2.imread(image_path)
    if img is None:
        return image_path

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return image_path

    # Find largest contour by area — typically the label boundary
    largest = max(contours, key=cv2.contourArea)
    if cv2.contourArea(largest) < (img.shape[0] * img.shape[1] * 0.1):
        # Contour too small — not a reliable label boundary, skip
        return image_path

    rect = cv2.minAreaRect(largest)
    angle = rect[2]

    # Normalize angle from minAreaRect
    if angle < -45:
        angle = 90 + angle
    elif angle > 45:
        angle = angle - 90

    # Only deskew if skew is meaningful (2–45 degrees)
    if abs(angle) < 2.0 or abs(angle) > 45.0:
        return image_path

    h, w = img.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    deskewed = cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_LINEAR,
                             borderMode=cv2.BORDER_REPLICATE)

    base, ext = os.path.splitext(image_path)
    out_path = f"{base}_deskewed{ext}"
    cv2.imwrite(out_path, deskewed)
    return out_path

