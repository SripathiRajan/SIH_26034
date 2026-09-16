"""
Reading Order Resolver
Clusters text boxes into natural reading order lines using spatial proximity and baseline heights.
Provides line reconstruction and top-to-bottom, left-to-right token sequencing.
"""

from typing import List
from ..ocr.engine_base import TextPolygon


class ReadingOrderResolver:
    def __init__(self, y_threshold_factor: float = 0.5):
        self.y_threshold_factor = y_threshold_factor

    def resolve_lines(self, tokens: List[TextPolygon]) -> List[List[TextPolygon]]:
        """
        Clusters OCR tokens into distinct visual lines, sorted top-to-bottom and left-to-right.
        """
        if not tokens:
            return []

        # Extract coordinates and bounding centers
        items = []
        for t in tokens:
            x, y, w, h = t.bounding_box_xywh
            items.append({
                "token": t,
                "x": x,
                "y": y,
                "w": w,
                "h": h,
                "cy": y + h / 2.0,
            })

        # Sort primarily by vertical center
        items.sort(key=lambda i: i["cy"])

        # Cluster into horizontal lines
        lines: List[List[dict]] = []
        for item in items:
            placed = False
            for line in lines:
                avg_h = sum(x["h"] for x in line) / len(line)
                avg_cy = sum(x["cy"] for x in line) / len(line)
                # Same line if vertical center difference is within fraction of average height
                if abs(item["cy"] - avg_cy) < (avg_h * self.y_threshold_factor):
                    line.append(item)
                    placed = True
                    break
            if not placed:
                lines.append([item])

        # Sort lines vertically by their average vertical center
        lines.sort(key=lambda line: sum(x["cy"] for x in line) / len(line))

        # Sort tokens inside each line by X coordinate
        result_lines: List[List[TextPolygon]] = []
        for line in lines:
            line.sort(key=lambda i: i["x"])
            result_lines.append([i["token"] for i in line])

        return result_lines

    def sort_tokens(self, tokens: List[TextPolygon]) -> List[TextPolygon]:
        """
        Sorts OCR tokens into flat natural reading order (top-to-bottom, left-to-right).
        """
        lines = self.resolve_lines(tokens)
        ordered: List[TextPolygon] = []
        for line in lines:
            ordered.extend(line)
        return ordered

    def get_ordered_text(self, tokens: List[TextPolygon]) -> str:
        """
        Reconstructs multiline text preserving reading order and layout.
        """
        lines = self.resolve_lines(tokens)
        line_strings = [" ".join(t.text for t in line) for line in lines]
        return "\n".join(line_strings)


# Alias for backward compatibility
ReadingOrderReconstructor = ReadingOrderResolver
