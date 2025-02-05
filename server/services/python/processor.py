#!/usr/bin/env python3
import os
import json
import sys
from docx import Document
import PyPDF2
import mammoth
import traceback
import subprocess
from typing import Dict, Any, Optional, Union
from PIL import Image
import pytesseract
import io

def debug_log(message: str, data: Dict = None) -> None:
    """Print debug messages to stderr with optional data"""
    log_entry = {"message": message}
    if data:
        log_entry["data"] = data
    print(f"Debug: {json.dumps(log_entry)}", file=sys.stderr)

class DocumentProcessor:
    """Handles document processing with robust error handling and logging"""

    @staticmethod
    def process_image(file_path: str) -> Dict[str, Any]:
        """Process image files and extract text with confidence scores"""
        try:
            debug_log("Processing image file", {"path": file_path})

            # Open and verify the image
            with Image.open(file_path) as img:
                # Log image details
                debug_log("Image opened successfully", {
                    "size": f"{img.size[0]}x{img.size[1]}",
                    "mode": img.mode,
                    "format": img.format
                })

                # Convert image to RGB if necessary
                if img.mode not in ('L', 'RGB'):
                    img = img.convert('RGB')
                    debug_log("Image converted to RGB")

                # Extract text using OCR with confidence data
                try:
                    # Get detailed OCR data including confidence scores
                    ocr_data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)

                    # Calculate average confidence for non-empty text
                    confidences = [conf for conf, text in zip(ocr_data['conf'], ocr_data['text']) 
                                 if str(text).strip() and conf != -1]
                    avg_confidence = sum(confidences) / len(confidences) if confidences else 0

                    # Get complete text
                    text = pytesseract.image_to_string(img)

                    debug_log("OCR extraction completed", {
                        "text_length": len(text),
                        "avg_confidence": avg_confidence,
                        "total_words": len(ocr_data['text']),
                        "confidence_values": len(confidences)
                    })

                except Exception as e:
                    debug_log(f"OCR extraction failed: {str(e)}", {
                        "error_type": type(e).__name__,
                        "traceback": traceback.format_exc()
                    })
                    text = ""
                    avg_confidence = 0

                # Get image info
                width, height = img.size
                format_name = img.format or 'unknown'

                # Convert image to base64 for preview
                img_buffer = io.BytesIO()
                img.save(img_buffer, format=format_name)

                result = {
                    "type": "image",
                    "content": {
                        "format": format_name,
                        "width": width,
                        "height": height,
                        "extracted_text": text.strip() if text else None,
                        "ocr_confidence": round(avg_confidence, 2)
                    }
                }

                debug_log("Image processing completed", {
                    "result_type": result["type"],
                    "has_text": bool(result["content"]["extracted_text"]),
                    "confidence": result["content"]["ocr_confidence"]
                })

                return result

        except Exception as e:
            error_details = {
                "error_type": type(e).__name__,
                "traceback": traceback.format_exc()
            }
            debug_log(f"Image processing failed: {str(e)}", error_details)
            return {"error": f"Image processing failed: {str(e)}"}

    @staticmethod
    def process_doc_antiword(file_path: str) -> Optional[str]:
        """Process DOC file using antiword as fallback"""
        try:
            debug_log("Attempting antiword conversion...")
            result = subprocess.run(
                ['antiword', file_path],
                capture_output=True,
                text=True,
                check=True
            )
            if result.stdout.strip():
                debug_log(f"Antiword extraction successful. Length: {len(result.stdout)}")
                return result.stdout
        except subprocess.CalledProcessError as e:
            debug_log(f"Antiword conversion failed: {str(e)}")
            debug_log(f"stderr: {e.stderr}")
        except Exception as e:
            debug_log(f"Antiword error: {str(e)}")
        return None

    @staticmethod
    def process_doc(file_path: str) -> Dict[str, Any]:
        """Process DOC files with multiple fallback methods"""
        try:
            debug_log(f"Processing DOC file: {file_path}")

            if not os.path.exists(file_path):
                return {"error": "File not found"}

            # Try antiword first
            text = DocumentProcessor.process_doc_antiword(file_path)
            if text:
                return {
                    "type": "doc",
                    "content": {
                        "text": text,
                        "method": "antiword"
                    }
                }

            # If antiword fails, try mammoth
            with open(file_path, 'rb') as doc_file:
                methods = [
                    ('markdown', lambda f: mammoth.convert_to_markdown(f)),
                    ('raw_text', lambda f: mammoth.extract_raw_text(f))
                ]

                for method_name, converter in methods:
                    try:
                        debug_log(f"Attempting {method_name} conversion...")
                        doc_file.seek(0)
                        result = converter(doc_file)
                        text = result.value.strip()

                        if text:
                            debug_log(f"Successfully extracted text using {method_name}. Length: {len(text)}")
                            return {
                                "type": "doc",
                                "content": {
                                    "text": text,
                                    "method": method_name
                                }
                            }
                        debug_log(f"{method_name} conversion produced empty result")
                    except Exception as e:
                        debug_log(f"{method_name} conversion failed: {str(e)}")
                        continue

            return {"error": "Failed to extract text using any available method"}

        except Exception as e:
            debug_log(f"Fatal error in DOC processing: {str(e)}")
            debug_log(traceback.format_exc())
            return {"error": f"DOC processing failed: {str(e)}"}

    @staticmethod
    def process_docx(file_path: str) -> Dict[str, Any]:
        """Process DOCX files"""
        try:
            debug_log(f"Processing DOCX file: {file_path}")
            doc = Document(file_path)
            text = "\n".join(paragraph.text for paragraph in doc.paragraphs)

            if not text.strip():
                return {"error": "No text content found in DOCX"}

            return {
                "type": "docx",
                "content": {"text": text}
            }
        except Exception as e:
            debug_log(f"DOCX processing failed: {str(e)}")
            return {"error": f"DOCX processing failed: {str(e)}"}

    @staticmethod
    def process_pdf(file_path: str) -> Dict[str, Any]:
        """Process PDF files"""
        try:
            debug_log(f"Processing PDF file: {file_path}")
            with open(file_path, 'rb') as file:
                reader = PyPDF2.PdfReader(file)
                pages = []
                for page in reader.pages:
                    text = page.extract_text()
                    if text.strip():
                        pages.append(text)

                if not pages:
                    return {"error": "No text content found in PDF"}

                return {
                    "type": "pdf",
                    "content": {"pages": pages}
                }
        except Exception as e:
            debug_log(f"PDF processing failed: {str(e)}")
            return {"error": f"PDF processing failed: {str(e)}"}

    @staticmethod
    def process_text(file_path: str) -> Dict[str, Any]:
        """Process text files"""
        try:
            debug_log(f"Processing text file: {file_path}")
            with open(file_path, 'r', encoding='utf-8') as file:
                text = file.read()
                if not text.strip():
                    return {"error": "Empty text file"}

                return {
                    "type": "text",
                    "content": {"text": text}
                }
        except UnicodeDecodeError:
            # Try different encodings
            for encoding in ['latin-1', 'cp1252']:
                try:
                    with open(file_path, 'r', encoding=encoding) as file:
                        text = file.read()
                        if text.strip():
                            return {
                                "type": "text",
                                "content": {"text": text}
                            }
                except:
                    continue
            return {"error": "Failed to decode text file with supported encodings"}
        except Exception as e:
            debug_log(f"Text file processing failed: {str(e)}")
            return {"error": f"Text file processing failed: {str(e)}"}

def process_document(file_path: str) -> Dict[str, Any]:
    """Main document processing function"""
    try:
        if not os.path.exists(file_path):
            return {"error": "File not found"}

        _, ext = os.path.splitext(file_path)
        ext = ext.lower()

        debug_log(f"Processing file: {file_path} with extension: {ext}")

        processor = DocumentProcessor()

        # Process based on file extension
        if ext == '.doc':
            result = processor.process_doc(file_path)
        elif ext == '.docx':
            result = processor.process_docx(file_path)
        elif ext == '.pdf':
            result = processor.process_pdf(file_path)
        elif ext in ['.txt', '.md']:
            result = processor.process_text(file_path)
        elif ext in ['.jpg', '.jpeg', '.png', '.webp']:
            result = processor.process_image(file_path)
        else:
            result = {"error": f"Unsupported file format: {ext}"}

        # Ensure result is properly formatted
        json_result = json.dumps(result)
        print(json_result)  # Only JSON output goes to stdout
        return result

    except Exception as e:
        error_msg = f"Processing failed: {str(e)}"
        debug_log(f"Fatal error: {error_msg}")
        debug_log(traceback.format_exc())
        json_error = json.dumps({"error": error_msg})
        print(json_error)
        return {"error": error_msg}

if __name__ == "__main__":
    if len(sys.argv) > 1:
        process_document(sys.argv[1])
    else:
        print(json.dumps({"error": "No file path provided"}))