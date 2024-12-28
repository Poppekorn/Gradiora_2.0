#!/usr/bin/env python3
import os
import json
from docx import Document
import PyPDF2
import mammoth
import openai
from typing import Dict, Union, Optional

# Set up OpenAI client
openai.api_key = os.getenv("OPENAI_API_KEY")

def extract_text_from_docx(docx_path: str) -> str:
    """Extract text from DOCX files."""
    try:
        text = ""
        doc = Document(docx_path)
        for paragraph in doc.paragraphs:
            text += paragraph.text + '\n'
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
        return text
    except Exception as e:
        raise Exception(f"Error extracting text from PDF: {str(e)}")

def extract_text_from_doc(doc_path: str) -> str:
    """Extract text from DOC files using mammoth."""
    try:
        with open(doc_path, 'rb') as docx_file:
            result = mammoth.extract_raw_text(docx_file)
            return result.value
    except Exception as e:
        raise Exception(f"Error extracting text from DOC: {str(e)}")

def process_document(file_path: str) -> Dict[str, Union[str, Dict[str, str]]]:
    """Process document and extract text."""
    try:
        if not os.path.exists(file_path):
            return {"error": "File not found"}

        _, file_extension = os.path.splitext(file_path)
        ext = file_extension.lower()

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

        return {"text": text}

    except Exception as e:
        return {"error": f"Processing failed: {str(e)}"}

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
    
    # If text extraction successful and summarize flag is present
    if len(sys.argv) > 2 and sys.argv[2] == "--summarize" and "text" in result:
        education_level = sys.argv[3] if len(sys.argv) > 3 else "high_school"
        summary_result = summarize_text(result["text"], education_level)
        result.update(summary_result)
    
    print(json.dumps(result))
