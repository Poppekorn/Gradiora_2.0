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
        print(f"Error extracting text from DOCX: {str(e)}")
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
        print(f"Error extracting text from PDF: {str(e)}")
        return f"Error extracting text from PDF: {str(e)}"

def extract_text_from_doc(doc_path):
    try:
        # First try with mammoth's standard options
        with open(doc_path, 'rb') as docx_file:
            try:
                result = mammoth.convert_to_markdown(docx_file)
                text = result.value
                messages = result.messages  # Capture any warnings or errors

                # Log any conversion messages
                for message in messages:
                    print(f"Mammoth message: {message}")

                if not text.strip():
                    # If no text was extracted, try with raw text extraction
                    docx_file.seek(0)
                    result = mammoth.extract_raw_text(docx_file)
                    text = result.value

                if text.strip():
                    return text
                else:
                    raise Exception("No text content could be extracted")

            except Exception as e:
                print(f"Error in mammoth conversion: {str(e)}")
                raise e

    except Exception as e:
        error_msg = f"Error extracting text from DOC: {str(e)}"
        print(error_msg)
        return error_msg

def extract_text(file_path):
    if not os.path.exists(file_path):
        return json.dumps({"error": "File not found"})

    _, file_extension = os.path.splitext(file_path)
    file_extension = file_extension.lower()

    print(f"Processing file: {file_path} with extension: {file_extension}")

    try:
        text = None
        if file_extension == '.pdf':
            text = extract_text_from_pdf(file_path)
        elif file_extension == '.docx':
            text = extract_text_from_docx(file_path)
        elif file_extension == '.doc':
            text = extract_text_from_doc(file_path)
        elif file_extension in ['.txt', '.md']:
            with open(file_path, 'r', encoding='utf-8') as file:
                text = file.read()
        else:
            return json.dumps({"error": f"Unsupported file format: {file_extension}"})

        if not text or len(text.strip()) == 0:
            return json.dumps({"error": "No text content extracted"})

        print(f"Successfully extracted text, length: {len(text)}")
        return json.dumps({"text": text})

    except Exception as e:
        error_msg = f"Extraction failed: {str(e)}"
        print(f"Error: {error_msg}")
        return json.dumps({"error": error_msg})

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
        print(extract_text(file_path))
    else:
        print(json.dumps({"error": "No file path provided"}))