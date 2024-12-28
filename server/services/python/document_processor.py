import os
from docx import Document
import PyPDF2
import mammoth
import json

def extract_text_from_docx(docx_path):
    try:
        text = ""
        document = Document(docx_path)
        for paragraph in document.paragraphs:
            text += paragraph.text + '\n'
        return text
    except Exception as e:
        return f"Error extracting text from DOCX: {str(e)}"

def extract_text_from_pdf(pdf_path):
    try:
        text = ""
        with open(pdf_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            for page in reader.pages:
                text += page.extract_text()
        return text
    except Exception as e:
        return f"Error extracting text from PDF: {str(e)}"

def extract_text_from_doc(doc_path):
    try:
        with open(doc_path, 'rb') as docx_file:
            result = mammoth.extract_raw_text(docx_file)
            return result.value
    except Exception as e:
        return f"Error extracting text from DOC: {str(e)}"

def extract_text(file_path):
    if not os.path.exists(file_path):
        return json.dumps({"error": "File not found"})

    _, file_extension = os.path.splitext(file_path)
    
    try:
        if file_extension.lower() == '.pdf':
            text = extract_text_from_pdf(file_path)
        elif file_extension.lower() == '.docx':
            text = extract_text_from_docx(file_path)
        elif file_extension.lower() == '.doc':
            text = extract_text_from_doc(file_path)
        elif file_extension.lower() in ['.txt', '.md']:
            with open(file_path, 'r', encoding='utf-8') as file:
                text = file.read()
        else:
            return json.dumps({"error": "Unsupported file format"})

        if not text or len(text.strip()) == 0:
            return json.dumps({"error": "No text content extracted"})

        return json.dumps({"text": text})
    except Exception as e:
        return json.dumps({"error": f"Extraction failed: {str(e)}"})

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
        print(extract_text(file_path))
    else:
        print(json.dumps({"error": "No file path provided"}))
