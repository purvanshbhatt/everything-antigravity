"""
pytest configuration and path setup for everything-antigravity.
Ensures that the repository root is on sys.path when running pytest
from anywhere.
"""

import sys
from pathlib import Path

# Add repository root to sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
