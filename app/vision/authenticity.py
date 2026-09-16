"""
Authenticity Verification Service
Provides brand logo authenticity verification with fallback/stub scoring.
"""

import logging
from typing import Optional, Dict
import numpy as np

logger = logging.getLogger(__name__)


class AuthenticityVerifier:
    def __init__(self):
        # Known registered brands catalog
        self._registered_brands = {
            "britannia": 0.88,
            "tata": 0.92,
            "tata tea": 0.92,
            "maggi": 0.85,
            "nestle": 0.86,
            "amul": 0.90,
            "haldiram": 0.84,
            "parle": 0.87,
            "itc": 0.89,
            "dabur": 0.85,
        }

    def verify(self, image: Optional[np.ndarray], brand_name: Optional[str]) -> Optional[float]:
        """
        Returns authenticityScore (0.0 to 1.0), or None if brand has no reference template.
        """
        if not brand_name:
            return None

        normalized_brand = brand_name.strip().lower()
        for key, score in self._registered_brands.items():
            if key in normalized_brand or normalized_brand in key:
                return score

        # If brand has no reference template in catalog, return None
        return None
