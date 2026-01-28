#!/usr/bin/env python3
"""Background removal using rembg (local AI model)"""
import sys
from pathlib import Path
from rembg import remove
from PIL import Image
import io

def remove_background(input_path, output_path):
    """Remove background from image and save result"""
    with open(input_path, 'rb') as f:
        input_data = f.read()

    output_data = remove(input_data)

    with open(output_path, 'wb') as f:
        f.write(output_data)

    print(f"OK: {output_path}")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python remove_bg.py <input_path> <output_path>", file=sys.stderr)
        sys.exit(1)

    try:
        remove_background(sys.argv[1], sys.argv[2])
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
