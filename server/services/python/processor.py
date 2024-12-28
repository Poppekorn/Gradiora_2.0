#!/usr/bin/env python3
import os
import json
from docx import Document
import PyPDF2
import mammoth
import openai
from typing import Dict, Union, Optional

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

def process_document(file_path: str) -> Dict[str, Union[str, Dict[str, str]]]:
    """Process document and extract text."""
    try:
        if not os.path.exists(file_path):
            return {"error": "File not found"}

        _, file_extension = os.path.splitext(file_path)
        ext = file_extension.lower()

        print(f"Processing file: {file_path} with extension: {ext}")  # Debug log

        # Extract text based on file type
        if ext == '.pdf':
            text = extract_text_from_pdf(file_path)
        elif ext == '.docx':
            text = extract_text_from_docx(file_path)
        elif ext == '.doc':
            text = extract_text_from_doc(file_path)
        elif ext in ['.txt', '.md']:
            with open(file_path, 'r', encoding='utf-8') as file:
                text = file.read()
        else:
            return {"error": f"Unsupported file format: {ext}"}

        # Validate extracted text
        if not text or len(text.strip()) == 0:
            return {"error": "No text content extracted"}

        print(f"Successfully extracted text, length: {len(text)}")  # Debug log
        return {"text": text}

    except Exception as e:
        error_msg = f"Processing failed: {str(e)}"
        print(f"Error: {error_msg}")  # Debug log
        return {"error": error_msg}

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

    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        sys.exit(1)

    file_path = sys.argv[1]
    result = process_document(file_path)
    print(json.dumps(result))