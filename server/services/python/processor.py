#!/usr/bin/env python3
import os
import json
import sys
from docx import Document
import PyPDF2
import mammoth
import traceback

def process_doc_file(file_path: str) -> dict:
    """Process DOC file with enhanced error handling and logging."""
    try:
        print(f"Debug: Starting DOC file processing: {file_path}", file=sys.stderr)

        if not os.path.exists(file_path):
            print(f"Debug: File not found: {file_path}", file=sys.stderr)
            return {"error": "File not found"}

        with open(file_path, 'rb') as doc_file:
            # Test markdown conversion first
            print("Debug: Attempting markdown conversion...", file=sys.stderr)
            try:
                result = mammoth.convert_to_markdown(doc_file)
                text = result.value.strip()

                if text:
                    print(f"Debug: Markdown conversion successful. Text length: {len(text)}", file=sys.stderr)
                    return {
                        "type": "doc",
                        "content": {
                            "text": text
                        }
                    }
            except Exception as e:
                print(f"Debug: Markdown conversion failed: {str(e)}", file=sys.stderr)

            # Try raw text extraction as fallback
            print("Debug: Attempting raw text extraction...", file=sys.stderr)
            doc_file.seek(0)
            try:
                result = mammoth.extract_raw_text(doc_file)
                text = result.value.strip()

                if text:
                    print(f"Debug: Raw text extraction successful. Text length: {len(text)}", file=sys.stderr)
                    return {
                        "type": "doc",
                        "content": {
                            "text": text
                        }
                    }
            except Exception as e:
                print(f"Debug: Raw text extraction failed: {str(e)}", file=sys.stderr)

        error_msg = "Failed to extract text from DOC file"
        print(f"Debug: {error_msg}", file=sys.stderr)
        return {"error": error_msg}

    except Exception as e:
        error_msg = f"DOC processing failed: {str(e)}"
        print(f"Debug: Error: {error_msg}", file=sys.stderr)
        print(f"Debug: Traceback: {traceback.format_exc()}", file=sys.stderr)
        return {"error": error_msg}

def process_document(file_path: str) -> dict:
    """Process document and extract text."""
    try:
        if not os.path.exists(file_path):
            return {"error": "File not found"}

        _, file_extension = os.path.splitext(file_path)
        ext = file_extension.lower()

        print(f"Debug: Processing file: {file_path} with extension: {ext}", file=sys.stderr)

        result = None
        if ext == '.doc':
            result = process_doc_file(file_path)
        elif ext == '.docx':
            try:
                doc = Document(file_path)
                result = {
                    "type": "docx",
                    "content": {
                        "text": "\n".join(paragraph.text for paragraph in doc.paragraphs)
                    }
                }
            except Exception as e:
                print(f"Debug: DOCX processing failed: {str(e)}", file=sys.stderr)
                result = {"error": f"DOCX processing failed: {str(e)}"}
        elif ext == '.pdf':
            try:
                with open(file_path, 'rb') as file:
                    reader = PyPDF2.PdfReader(file)
                    pages = [page.extract_text() for page in reader.pages]
                    result = {
                        "type": "pdf",
                        "content": {
                            "pages": pages
                        }
                    }
            except Exception as e:
                print(f"Debug: PDF processing failed: {str(e)}", file=sys.stderr)
                result = {"error": f"PDF processing failed: {str(e)}"}
        elif ext in ['.txt', '.md']:
            try:
                with open(file_path, 'r', encoding='utf-8') as file:
                    result = {
                        "type": "text",
                        "content": {
                            "text": file.read()
                        }
                    }
            except Exception as e:
                print(f"Debug: Text file processing failed: {str(e)}", file=sys.stderr)
                result = {"error": f"Text file processing failed: {str(e)}"}
        else:
            result = {"error": f"Unsupported file format: {ext}"}

        json_result = json.dumps(result)
        print(json_result)  # Only JSON output goes to stdout
        return result

    except Exception as e:
        error_msg = f"Processing failed: {str(e)}"
        print(f"Debug: Fatal error: {error_msg}", file=sys.stderr)
        print(f"Debug: Traceback: {traceback.format_exc()}", file=sys.stderr)
        json_error = json.dumps({"error": error_msg})
        print(json_error)
        return {"error": error_msg}

if __name__ == "__main__":
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
        process_document(file_path)
    else:
        error = json.dumps({"error": "No file path provided"})
        print(error)