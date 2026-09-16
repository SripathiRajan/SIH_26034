"""
Image Processing Pipeline
Handles deskewing, CLAHE contrast enhancement, and server-side quality validation.
"""

import cv2
import numpy as np
from typing import Tuple, Dict, Any


class ImagePipeline:
    def __init__(self, clip_limit: float = 2.0, tile_grid_size: Tuple[int, int] = (8, 8)):
        self.clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid_size)

    def preprocess(self, image: np.ndarray) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Runs full preprocessing: quality re-check -> deskew -> CLAHE.
        """
        quality_info = self.check_quality(image)
        deskewed = self.deskew(image)
        enhanced = self.apply_clahe(deskewed)

        return enhanced, quality_info

    def check_quality(self, image: np.ndarray) -> Dict[str, Any]:
        """
        Calculates Laplacian variance and glare ratio.
        """
        if image is None or image.size == 0:
            return {
                "sharpness": 0.0,
                "glare_ratio": 1.0,
                "is_acceptable": False,
            }

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()

        glare_mask = gray > 245
        glare_ratio = np.sum(glare_mask) / gray.size

        return {
            "sharpness": float(round(laplacian_var, 2)),
            "glare_ratio": float(round(glare_ratio, 4)),
            "is_acceptable": bool(laplacian_var >= 80.0 and glare_ratio < 0.08),
        }

    def deskew(self, image: np.ndarray) -> np.ndarray:
        """
        Estimates skew angle from text contours and rotates back to orthogonal alignment.
        """
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]

        coords = np.column_stack(np.where(thresh > 0))
        if coords.shape[0] < 50:
            return image

        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = -(90 + angle)
        elif angle > 45:
            angle = 90 - angle
        else:
            angle = -angle

        # If angle is negligible, skip rotation
        if abs(angle) < 0.5:
            return image

        h, w = image.shape[:2]
        center = (w // 2, h // 2)
        rot_mat = cv2.getRotationMatrix2D(center, angle, 1.0)
        deskewed = cv2.warpAffine(
            image, rot_mat, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
        )
        return deskewed

    def apply_clahe(self, image: np.ndarray) -> np.ndarray:
        """
        Applies Contrast Limited Adaptive Histogram Equalization on L-channel (LAB)
        """
        if len(image.shape) == 2:
            return self.clahe.apply(image)

        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        cl = self.clahe.apply(l)
        enhanced_lab = cv2.merge((cl, a, b))
        return cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)
