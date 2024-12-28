#!/usr/bin/env python3
import os
import sys
import json
import mammoth

def test_doc_file(file_path: str) -> None:
    """Test DOC file processing with detailed logging."""
    print(f"Starting test with file: {file_path}", file=sys.stderr)
    
    if not os.path.exists(file_path):
        print(f"Error: File not found at {file_path}", file=sys.stderr)
        return
        
    try:
        with open(file_path, 'rb') as doc_file:
            # Test each method separately
            print("\n1. Testing mammoth.convert_to_markdown...", file=sys.stderr)
            try:
                result = mammoth.convert_to_markdown(doc_file)
                print(f"Success! Text length: {len(result.value)}", file=sys.stderr)
                print(json.dumps({"type": "doc", "content": {"text": result.value}}))
                return
            except Exception as e:
                print(f"Markdown conversion failed: {str(e)}", file=sys.stderr)

    except Exception as e:
        print(f"Overall test failed: {str(e)}", file=sys.stderr)
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    test_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), 'uploads')
    files = os.listdir(test_dir)
    for f in files:
        if f.endswith('.doc'):
            print(f"\nTesting DOC file: {f}", file=sys.stderr)
            test_doc_file(os.path.join(test_dir, f))
            break
