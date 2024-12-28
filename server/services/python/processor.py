#!/usr/bin/env python3
import os
import json
from docx import Document
import PyPDF2
import mammoth
import base64
from typing import Dict, Union, Optional, List, Any
import traceback

def process_doc_file(file_path: str) -> Dict[str, Any]:
    """Process DOC file with enhanced error handling and logging."""
    try:
        print(f"Starting DOC file processing: {file_path}")

        if not os.path.exists(file_path):
            print(f"File not found: {file_path}")
            return {"error": "File not found"}

        with open(file_path, 'rb') as doc_file:
            # First try mammoth's markdown conversion
            try:
                print("Attempting markdown conversion...")
                result = mammoth.convert_to_markdown(doc_file)
                text = result.value

                # Log any conversion messages
                for message in result.messages:
                    print(f"Mammoth conversion message: {message}")

                if text.strip():
                    print(f"Successfully extracted text with markdown conversion. Length: {len(text)}")
                    return {
                        "type": "doc",
                        "content": {
                            "text": text,
                            "messages": [str(msg) for msg in result.messages]
                        }
                    }
            except Exception as markdown_error:
                print(f"Markdown conversion failed: {str(markdown_error)}")
                print("Falling back to raw text extraction...")

            # If markdown fails, try raw text extraction
            doc_file.seek(0)
            try:
                result = mammoth.extract_raw_text(doc_file)
                text = result.value

                if text.strip():
                    print(f"Successfully extracted raw text. Length: {len(text)}")
                    return {
                        "type": "doc",
                        "content": {
                            "text": text,
                            "messages": ["Extracted using raw text method"]
                        }
                    }
                else:
                    print("Raw text extraction produced empty result")
            except Exception as raw_error:
                print(f"Raw text extraction failed: {str(raw_error)}")

            # If both methods fail, try alternative options
            doc_file.seek(0)
            try:
                # Try with different transform options
                result = mammoth.convert_to_html(doc_file, transform_document=mammoth.transforms.paragraph(lambda p: p))
                text = result.value

                if text.strip():
                    print(f"Successfully extracted text with HTML conversion. Length: {len(text)}")
                    return {
                        "type": "doc",
                        "content": {
                            "text": text,
                            "messages": ["Extracted using HTML conversion method"]
                        }
                    }
            except Exception as html_error:
                print(f"HTML conversion failed: {str(html_error)}")

        # If all extraction methods fail
        error_msg = "Failed to extract text using any available method"
        print(error_msg)
        return {"error": error_msg}

    except Exception as e:
        error_msg = f"DOC processing failed: {str(e)}\n{traceback.format_exc()}"
        print(f"Error: {error_msg}")
        return {"error": error_msg}

def process_document(file_path: str) -> Dict[str, Any]:
    """Process document and extract text with structure."""
    try:
        if not os.path.exists(file_path):
            return {"error": "File not found"}

        _, file_extension = os.path.splitext(file_path)
        ext = file_extension.lower()

        print(f"Processing file: {file_path} with extension: {ext}")

        if ext == '.doc':
            return process_doc_file(file_path)
        elif ext == '.docx':
            doc = Document(file_path)
            return {
                "type": "docx",
                "content": {"text": "\n".join(paragraph.text for paragraph in doc.paragraphs)}
            }
        elif ext == '.pdf':
            with open(file_path, 'rb') as file:
                reader = PyPDF2.PdfReader(file)
                content = {
                    "metadata": reader.metadata,
                    "pages": []
                }
                for page in reader.pages:
                    content["pages"].append(page.extract_text())
                return {
                    "type": "pdf",
                    "content": content
                }
        elif ext in ['.txt', '.md']:
            with open(file_path, 'r', encoding='utf-8') as file:
                return {
                    "type": "text",
                    "content": {
                        "text": file.read()
                    }
                }
        else:
            return {"error": f"Unsupported file format: {ext}"}

    except Exception as e:
        error_msg = f"Processing failed: {str(e)}\n{traceback.format_exc()}"
        print(f"Error: {error_msg}")
        return {"error": error_msg}

def extract_text_from_docx(docx_path: str) -> str:
    """Extract text from DOCX files."""
    try:
        text = ""
        doc = Document(docx_path)
        for paragraph in doc.paragraphs:
            text += paragraph.text + '\n'

        # Check for empty content
        if not text.strip():
            raise Exception("No text content found in DOCX file")

        return text
    except Exception as e:
        raise Exception(f"Error extracting text from DOCX: {str(e)}")

def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract text from PDF files."""
    try:
        text = ""
        with open(pdf_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            for page in reader.pages:
                text += page.extract_text() + '\n'

        # Check for empty content
        if not text.strip():
            raise Exception("No text content found in PDF file")

        return text
    except Exception as e:
        raise Exception(f"Error extracting text from PDF: {str(e)}")

def extract_text_from_doc(doc_path: str) -> str:
    """Extract text from DOC files using mammoth."""
    try:
        # First try using mammoth's raw text extraction
        with open(doc_path, 'rb') as doc_file:
            try:
                result = mammoth.extract_raw_text(doc_file)
                text = result.value

                # If text is empty, try with different options
                if not text.strip():
                    doc_file.seek(0)
                    result = mammoth.extract_raw_text(doc_file, convert_options={
                        "preserve_empty_paragraphs": True,
                        "include_default_style_map": True
                    })
                    text = result.value

                if not text.strip():
                    raise Exception("No text content found in DOC file")

                return text

            except Exception as mammoth_error:
                # If mammoth fails, try reading as binary and decode
                doc_file.seek(0)
                content = doc_file.read()
                try:
                    # Try different encodings
                    for encoding in ['utf-8', 'latin-1', 'cp1252']:
                        try:
                            text = content.decode(encoding)
                            if text.strip():
                                return text
                        except:
                            continue
                except:
                    raise Exception(f"Failed to extract text with mammoth: {str(mammoth_error)}")

                raise Exception("Could not extract text content from DOC file")

    except Exception as e:
        raise Exception(f"Error extracting text from DOC: {str(e)}")

def summarize_text(text: str, education_level: str = "high_school") -> Dict[str, str]:
    """Summarize text using OpenAI API."""
    try:
        response = openai.chat.completions.create(
            model="gpt-4",
            messages=[
                {
                    "role": "system",
                    "content": f"You are an expert academic content analyzer for {education_level} students. "
                              "Process the text and provide a concise analysis in JSON format with two sections: "
                              "summary (key points as bullet points) and explanation (detailed analysis connecting the concepts)."
                },
                {"role": "user", "content": text}
            ],
            temperature=0.3,
            response_format={"type": "json_object"}
        )

        result = json.loads(response.choices[0].message.content)
        return {
            "summary": result.get("summary", ""),
            "explanation": result.get("explanation", "")
        }
    except Exception as e:
        return {
            "error": f"Summarization failed: {str(e)}",
            "summary": "",
            "explanation": ""
        }

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
        result = process_document(file_path)
        print(json.dumps(result))
    else:
        print(json.dumps({"error": "No file path provided"}))