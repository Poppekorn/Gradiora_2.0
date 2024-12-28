#!/usr/bin/env python3
import os
import sys
import json
from docx import Document
import PyPDF2
import mammoth
import traceback

def test_doc_processing(file_path: str) -> None:
    """Test DOC file processing with detailed logging."""
    print(f"Starting test with file: {file_path}")
    
    if not os.path.exists(file_path):
        print(f"Error: File not found at {file_path}")
        return
        
    try:
        with open(file_path, 'rb') as doc_file:
            print("1. Testing mammoth.convert_to_markdown...")
            try:
                result = mammoth.convert_to_markdown(doc_file)
                print(f"Markdown conversion result: {result.value[:100]}...")
                print(f"Messages: {result.messages}")
            except Exception as e:
                print(f"Markdown conversion failed: {str(e)}")
                print(traceback.format_exc())

            print("\n2. Testing mammoth.extract_raw_text...")
            doc_file.seek(0)
            try:
                result = mammoth.extract_raw_text(doc_file)
                print(f"Raw text result: {result.value[:100]}...")
            except Exception as e:
                print(f"Raw text extraction failed: {str(e)}")
                print(traceback.format_exc())

            print("\n3. Testing mammoth.convert_to_html...")
            doc_file.seek(0)
            try:
                result = mammoth.convert_to_html(doc_file)
                print(f"HTML conversion result: {result.value[:100]}...")
            except Exception as e:
                print(f"HTML conversion failed: {str(e)}")
                print(traceback.format_exc())

    except Exception as e:
        print(f"Overall test failed: {str(e)}")
        print(traceback.format_exc())

if __name__ == "__main__":
    # Test with a sample file
    test_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), 'uploads')
    
    print("Available files in uploads directory:")
    try:
        files = os.listdir(test_file)
        for f in files:
            if f.endswith('.doc'):
                print(f"Testing DOC file: {f}")
                test_doc_processing(os.path.join(test_file, f))
    except Exception as e:
        print(f"Error listing directory: {str(e)}")
        print(traceback.format_exc())
