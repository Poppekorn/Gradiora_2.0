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
            # Try different conversion methods in sequence
            methods = [
                ('markdown', lambda f: mammoth.convert_to_markdown(f)),
                ('raw_text', lambda f: mammoth.extract_raw_text(f)),
                ('html', lambda f: mammoth.convert_to_html(f))
            ]

            for method_name, converter in methods:
                try:
                    print(f"Debug: Attempting {method_name} conversion...", file=sys.stderr)
                    doc_file.seek(0)
                    result = converter(doc_file)
                    text = result.value.strip()

                    if text:
                        print(f"Debug: Successfully extracted text using {method_name}. Length: {len(text)}", file=sys.stderr)
                        return {
                            "type": "doc",
                            "content": {
                                "text": text,
                                "messages": [f"Extracted using {method_name} method"]
                            }
                        }
                    else:
                        print(f"Debug: {method_name} conversion produced empty result", file=sys.stderr)
                except Exception as e:
                    print(f"Debug: {method_name} conversion failed: {str(e)}", file=sys.stderr)
                    continue

        # If all methods fail
        error_msg = "Failed to extract text using any available method"
        print(f"Debug: {error_msg}", file=sys.stderr)
        return {"error": error_msg}

    except Exception as e:
        error_msg = f"DOC processing failed: {str(e)}"
        print(f"Debug: Error: {error_msg}", file=sys.stderr)
        print(f"Debug: Traceback: {traceback.format_exc()}", file=sys.stderr)
        return {"error": error_msg}

def process_document(file_path: str) -> dict:
    """Process document and extract text with structure."""
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

        # Ensure the result is JSON serializable and output is properly formatted
        json_result = json.dumps(result)
        print("Debug: Final JSON result:", json_result, file=sys.stderr)
        print(json_result)  # This is the only line that goes to stdout
        return result

    except Exception as e:
        error_msg = f"Processing failed: {str(e)}"
        print(f"Debug: Fatal error: {error_msg}", file=sys.stderr)
        print(f"Debug: Traceback: {traceback.format_exc()}", file=sys.stderr)
        json_error = json.dumps({"error": error_msg})
        print(json_error)
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
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
        process_document(file_path)
    else:
        error = json.dumps({"error": "No file path provided"})
        print(error)