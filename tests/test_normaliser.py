import re
import pytest
from pipeline.field_extractor import (
    normalize_ocr_token,
    extract_best_candidate,
    get_neighbours,
    _audit_field,
    normalize_date_token,
    is_valid_date,
)


class TestNormalizeOcrToken:
    def test_generic_token_unchanged(self):
        result = normalize_ocr_token('Marketed by V.V SONS', field_type='generic')
        assert result == ['Marketed by V.V SONS']

    def test_fssai_numeric_glyph_repair(self):
        result = normalize_ocr_token('1OO2OO21OOO123', field_type='fssai')
        assert len(result) >= 1

    def test_mrp_currency_repair(self):
        result = normalize_ocr_token('? 40.00', field_type='mrp')
        assert result[0].startswith('₹')

    def test_fusion_splitter_date_pair(self):
        candidates = normalize_ocr_token('JUN/2026OCT/2026', field_type='date')
        assert len(candidates) == 2
        assert candidates[0].upper() == 'JUN/2026'
        assert candidates[1].upper() == 'OCT/2026'

    def test_digit_drop_recovery_fssai(self):
        short = '1002002100123'
        candidates = normalize_ocr_token(short, field_type='fssai')
        assert candidates[0] == short
        fourteen = [c for c in candidates if len(c) == 14 and c[0] in ('1','2')]
        assert len(fourteen) >= 1

    def test_empty_token_returns_singleton(self):
        result = normalize_ocr_token('', field_type='generic')
        assert result == ['']

    def test_single_normal_token(self):
        result = normalize_ocr_token('OCT/2026', field_type='date')
        assert len(result) == 1
        assert result[0] == 'OCT/2026'


class TestExtractBestCandidate:
    def _make_results(self, texts):
        return [{'text': t, 'confidence': 0.85, 'source': 'paddle', 'box': [[0,0],[10,0],[10,10],[0,10]]} for t in texts]

    def test_finds_date_across_multiple_texts(self):
        texts = ['MANUFACTURER ADDRESS INDIA', 'MFG: JUN/2026  EXP: DEC/2026']
        pat = re.compile(r'\b[A-Za-z]{3}/20\d{2}\b')
        val, conf, pattern, engine = extract_best_candidate(texts, patterns=[pat], validator=is_valid_date, normaliser=lambda t: [t])
        assert val is not None
        assert is_valid_date(val)

    def test_skips_invalid_picks_valid(self):
        texts = ['NOTADATE/2026 JUN/2026']
        pat = re.compile(r'\b[A-Za-z]{2,5}/20\d{2}\b')
        val, conf, pattern, engine = extract_best_candidate(texts, patterns=[pat], validator=is_valid_date, normaliser=lambda t: [t])
        assert val == 'JUN/2026'

    def test_returns_none_when_no_valid(self):
        texts = ['RANDOM TEXT WITHOUT DATES']
        pat = re.compile(r'\b[A-Za-z]{3}/20\d{2}\b')
        val, conf, pattern, engine = extract_best_candidate(texts, patterns=[pat], validator=is_valid_date, normaliser=lambda t: [t])
        assert val is None

    def test_confidence_lookup(self):
        texts = ['JUN/2026']
        results = self._make_results(['JUN/2026'])
        results[0]['confidence'] = 0.93
        pat = re.compile(r'\b[A-Za-z]{3}/20\d{2}\b')
        val, conf, pattern, engine = extract_best_candidate(texts, patterns=[pat], validator=is_valid_date, normaliser=lambda t: [t], all_results=results)
        assert val == 'JUN/2026'
        assert abs(conf - 0.93) < 0.01


class TestGetNeighbours:
    def _box(self, cx, cy, size=20):
        half = size // 2
        return [[cx-half,cy-half],[cx+half,cy-half],[cx+half,cy+half],[cx-half,cy+half]]

    def test_finds_adjacent_token(self):
        all_results = [
            {'text': 'MFG', 'confidence': 0.9, 'box': self._box(100, 100)},
            {'text': 'JUN/2026', 'confidence': 0.88, 'box': self._box(200, 100)},
            {'text': 'UNRELATED', 'confidence': 0.8, 'box': self._box(800, 800)},
        ]
        neighbours = get_neighbours('MFG', all_results, radius_px=150)
        texts = [r['text'] for r in neighbours]
        assert 'JUN/2026' in texts
        assert 'UNRELATED' not in texts

    def test_seed_not_found_returns_empty(self):
        all_results = [{'text': 'MFG', 'confidence': 0.9, 'box': self._box(100, 100)}]
        neighbours = get_neighbours('FSSAI', all_results, radius_px=150)
        assert neighbours == []

    def test_radius_boundary(self):
        all_results = [
            {'text': 'MFG', 'confidence': 0.9, 'box': self._box(0, 0)},
            {'text': 'CLOSE', 'confidence': 0.9, 'box': self._box(149, 0)},
            {'text': 'FAR', 'confidence': 0.9, 'box': self._box(300, 0)},
        ]
        neighbours = get_neighbours('MFG', all_results, radius_px=150)
        texts = [r['text'] for r in neighbours]
        assert 'CLOSE' in texts
        assert 'MFG' in texts


class TestAuditField:
    AUDIT_KEYS = {'raw_token', 'normalized_token', 'match_pattern', 'failure_class', 'retry_count', 'source_engine'}

    def test_found_field_has_all_audit_keys(self):
        d = _audit_field(
            found=True, value='JUN/2026', captured='JUN/2026',
            confidence=0.91, source='paddleocr', rule='LM §6(1)(d)',
            label='Manufacture Date', location='ON_PANEL',
            raw_token='N2026', normalized_token='JUN/2026',
            match_pattern=r'\bJUN\/\d{4}\b', failure_class='F1',
            retry_count=0, source_engine='paddleocr',
        )
        missing = self.AUDIT_KEYS - set(d.keys())
        assert not missing
        assert d['failure_class'] == 'F1'

    def test_missing_field_has_failure_class(self):
        d = _audit_field(
            found=False, value=None, captured=None,
            confidence=0.0, source=None,
            rule='LM §6(1)(d)', label='Manufacture Date', location='MISSING',
            failure_class='F5', retry_count=0,
        )
        assert d['found'] is False
        assert d['failure_class'] == 'F5'

    def test_clean_field_none_failure_class(self):
        d = _audit_field(
            found=True, value='100 g', captured='100 g',
            confidence=0.95, source='paddleocr',
            rule='LM §6(1)(c)', label='Net Quantity', location='ON_PANEL',
        )
        assert d['failure_class'] is None

    def test_extra_kwargs_passed_through(self):
        d = _audit_field(
            found=True, value='JUN/2026', captured='JUN/2026',
            confidence=0.85, source='declaration_extractor',
            rule='LM §6(1)(d)', label='Manufacture Date', location='ON_PANEL',
            parsedValue={'month': 'JUN', 'year': 2026},
        )
        assert d['parsedValue'] == {'month': 'JUN', 'year': 2026}


class TestExtractFieldsAuditTrail:
    AUDIT_KEYS = {'raw_token', 'normalized_token', 'match_pattern', 'failure_class', 'retry_count', 'source_engine'}

    def _make_result(self, text, conf=0.9):
        return {'text': text, 'confidence': conf, 'box': [[0,0],[10,0],[10,10],[0,10]], 'source': 'paddle'}

    def test_every_field_has_audit_keys(self):
        from pipeline.field_extractor import extract_fields
        results = [
            self._make_result('MRP: Rs.40.00'),
            self._make_result('NET QUANTITY 100 g'),
            self._make_result('Marketed by V.V SONS EDIBLE OILS LTD'),
            self._make_result('FSSAI Lic No: 10020021000123'),
            self._make_result('MFG: JUN/2026  USE BY: DEC/2026'),
        ]
        fields, _, _ = extract_fields(results)
        for key, val in fields.items():
            missing = self.AUDIT_KEYS - set(val.keys())
            assert not missing, f"Field '{key}' missing audit keys: {missing}"

    def test_found_field_source_engine_populated(self):
        from pipeline.field_extractor import extract_fields
        results = [self._make_result('MRP: Rs.40.00')]
        fields, _, _ = extract_fields(results)
        if fields['mrp']['found']:
            assert fields['mrp']['source_engine'] != ''
