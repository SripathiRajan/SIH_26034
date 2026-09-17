import threading
from core.config import CACHE_DIR, EASYOCR_CACHE, VLM_MODEL_ID, USE_GPU
from core.logger import logger

try:
    import torch
    import torch.nn as nn
    from transformers import PretrainedConfig, RobertaTokenizer, AutoProcessor, AutoModelForCausalLM

    # Monkeypatches for Florence-2 dynamic architecture compatibility
    orig_c = PretrainedConfig.__getattribute__
    PretrainedConfig.__getattribute__ = lambda self, name: (
        None if name == 'forced_bos_token_id' and name not in self.__dict__
        else orig_c(self, name)
    )

    orig_m = nn.Module.__getattr__
    nn.Module.__getattr__ = lambda self, name: (
        True if name == '_supports_sdpa' and name not in self.__dict__
        else orig_m(self, name)
    )

    if not hasattr(RobertaTokenizer, "additional_special_tokens"):
        RobertaTokenizer.additional_special_tokens = property(
            lambda self: getattr(self, '_additional_special_tokens', [])
        )
    HAS_TORCH = True
except Exception as e:
    torch = None
    nn = None
    HAS_TORCH = False
    logger.warning(f"PyTorch / Transformers not available: {e}")

class ModelRegistry:
    """
    Singleton registry to load neural models ONCE at startup and reuse them.
    Also implements dynamic INT8 quantization for PyTorch models.
    """
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(ModelRegistry, cls).__new__(cls)
                cls._instance._init_models()
            return cls._instance

    def _init_models(self):
        self.easyocr_reader = None
        self.paddle_ocr = None
        self.surya_det = None
        self.vlm_processor = None
        self.vlm_model = None

    def get_easyocr_reader(self):
        if self.easyocr_reader is None:
            with self._lock:
                if self.easyocr_reader is None:
                    import easyocr
                    logger.info("Initializing EasyOCR Reader...")
                    reader = easyocr.Reader(['en'], gpu=USE_GPU, model_storage_directory=EASYOCR_CACHE)
                    # Quantize EasyOCR CRNN recognition model to INT8 on CPU
                    if not USE_GPU and hasattr(reader, 'recognizer') and hasattr(reader.recognizer, 'module'):
                        try:
                            reader.recognizer.module = torch.quantization.quantize_dynamic(
                                reader.recognizer.module, {nn.Linear, nn.LSTM}, dtype=torch.qint8
                            )
                            logger.info("✓ Dynamically quantized EasyOCR recognizer to INT8")
                        except Exception as e:
                            logger.warning(f"Failed to quantize EasyOCR recognizer: {e}")
                    self.easyocr_reader = reader
        return self.easyocr_reader

    def get_paddle_ocr(self):
        if self.paddle_ocr is None:
            with self._lock:
                if self.paddle_ocr is None:
                    from paddleocr import PaddleOCR
                    logger.info("Initializing PaddleOCR with MKL-DNN acceleration...")
                    try:
                        self.paddle_ocr = PaddleOCR(
                            use_angle_cls=True,
                            lang="en",
                            show_log=False,
                            enable_mkldnn=False,
                        )
                    except Exception:
                        self.paddle_ocr = PaddleOCR(use_angle_cls=True, lang="en")
        return self.paddle_ocr

    def get_surya_detector(self):
        if self.surya_det is None:
            with self._lock:
                if self.surya_det is None:
                    from surya.detection import DetectionPredictor
                    logger.info("Initializing Surya Detection Predictor...")
                    det = DetectionPredictor()
                    self.surya_det = det
        return self.surya_det

    def get_florence2(self):
        if self.vlm_processor is None or self.vlm_model is None:
            with self._lock:
                if self.vlm_model is None:
                    logger.info(f"Loading Florence-2 VLM ({VLM_MODEL_ID})...")
                    proc = AutoProcessor.from_pretrained(
                        VLM_MODEL_ID, cache_dir=CACHE_DIR, trust_remote_code=True
                    )
                    mdl = AutoModelForCausalLM.from_pretrained(
                        VLM_MODEL_ID, cache_dir=CACHE_DIR, trust_remote_code=True
                    ).float()
                    mdl.eval()

                    self.vlm_processor = proc
                    self.vlm_model = mdl
        return self.vlm_processor, self.vlm_model

registry = ModelRegistry()
