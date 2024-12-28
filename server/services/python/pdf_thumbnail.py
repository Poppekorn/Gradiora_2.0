#!/usr/bin/env python3
import sys
import os
from pdf2image import convert_from_path
from PIL import Image

def generate_pdf_thumbnail(pdf_path, output_path, width, height):
    """Generate a thumbnail for the first page of a PDF file"""
    try:
        # Convert first page of PDF to image
        images = convert_from_path(
            pdf_path,
            first_page=1,
            last_page=1,
            size=(width, height)
        )
        
        if not images:
            raise Exception("No pages found in PDF")
            
        # Get first page and save as thumbnail
        thumbnail = images[0]
        thumbnail.save(output_path, format='JPEG', quality=85)
        return True
        
    except Exception as e:
        print(f"Error generating PDF thumbnail: {str(e)}", file=sys.stderr)
        return False

if __name__ == "__main__":
    if len(sys.argv) != 5:
        print("Usage: pdf_thumbnail.py <pdf_path> <output_path> <width> <height>", file=sys.stderr)
        sys.exit(1)
        
    pdf_path = sys.argv[1]
    output_path = sys.argv[2]
    width = int(sys.argv[3])
    height = int(sys.argv[4])
    
    if not os.path.exists(pdf_path):
        print(f"PDF file not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)
        
    success = generate_pdf_thumbnail(pdf_path, output_path, width, height)
    sys.exit(0 if success else 1)
