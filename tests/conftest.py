# Pre-load torch on Windows to avoid DLL entrypoint conflicts with OpenCV/OpenMP.
# Env vars MUST be set before torch/paddle import — duplicate OpenMP runtimes
# otherwise cause native access violations during parallel model init.
import os
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")

import pytest
from core.database import create_tables

try:
    import torch
except Exception:
    pass

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    create_tables()


@pytest.fixture(scope="session", autouse=True)
def isolate_llm_keys():
    """
    Keep the pytest suite hermetic: neutralize GROQ/GEMINI keys so chatbot tests
    exercise deterministic statutory-template fallback instead of real network
    calls. Live LLM integration is verified against a running server, not pytest.
    """
    from app import config as app_config

    saved_settings = (app_config.settings.GROQ_API_KEY, app_config.settings.GEMINI_API_KEY)
    saved_env = (os.environ.get("GROQ_API_KEY"), os.environ.get("GEMINI_API_KEY"))

    app_config.settings.GROQ_API_KEY = None
    app_config.settings.GEMINI_API_KEY = None
    os.environ.pop("GROQ_API_KEY", None)
    os.environ.pop("GEMINI_API_KEY", None)
    yield
    app_config.settings.GROQ_API_KEY = saved_settings[0]
    app_config.settings.GEMINI_API_KEY = saved_settings[1]
    if saved_env[0] is not None:
        os.environ["GROQ_API_KEY"] = saved_env[0]
    if saved_env[1] is not None:
        os.environ["GEMINI_API_KEY"] = saved_env[1]
