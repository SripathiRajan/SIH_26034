# Pre-load torch on Windows to avoid DLL entrypoint conflicts with OpenCV/OpenMP
import os
import pytest
from core.database import create_tables

try:
    import torch
except Exception:
    pass

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    create_tables()
