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
