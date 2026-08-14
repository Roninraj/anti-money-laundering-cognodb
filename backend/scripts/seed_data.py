"""
CognoDB Seed Script for SAML Anti-Money Laundering Dataset.
Seeds CognoDB Cloud using authentic data from the Kaggle AML dataset.
"""

import os
import sys
import logging
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from scripts.load_saml_kaggle import load_saml_dataset, DEFAULT_KAGGLE_CSV

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("seed_data")

def seed_cognodb():
    logger.info("Initiating CognoDB seeding from authentic Kaggle SAML dataset...")
    success = load_saml_dataset(csv_path=DEFAULT_KAGGLE_CSV, max_laundering=10000, max_normal=5000, clear_existing=True)
    if success:
        logger.info("Successfully seeded CognoDB with Kaggle AML dataset.")
    else:
        logger.error("Failed to seed CognoDB with Kaggle AML dataset.")
    return success

if __name__ == "__main__":
    seed_cognodb()
