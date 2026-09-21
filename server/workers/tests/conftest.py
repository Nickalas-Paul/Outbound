"""Ensure worker modules can import without a live DB during unit tests."""

from __future__ import annotations

import os

# config.py requires DATABASE_URL at import time; tests never open a connection.
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/outbound_dev",
)
