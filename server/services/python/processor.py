#!/usr/bin/env python3
import os
import json
from docx import Document
from docx.document import Document as _Document
from docx.oxml.table import CT_Tbl
from docx.oxml.text.paragraph import CT_P
from docx.table import _Cell, Table, _Row
from docx.text.paragraph import Paragraph
import PyPDF2
import mammoth
import base64
from typing import Dict, Union, Optional, List, Any
from datetime import datetime

def extract_metadata_docx(doc: Document) -> Dict[str, Any]:
    """Extract metadata from DOCX files."""
    try:
        core_properties = doc.core_properties
        return {
            "author": core_properties.author or "Unknown",
            "created": core_properties.created.isoformat() if core_properties.created else None,
            "modified": core_properties.modified.isoformat() if core_properties.modified else None,
            "title": core_properties.title or "",
            "subject": core_properties.subject or "",
            "keywords": core_properties.keywords or "",
            "category": core_properties.category or "",
            "comments": core_properties.comments or ""
        }
    except Exception as e:
        print(f"Warning: Error extracting metadata: {str(e)}")
        return {}

def iter_block_items(parent: _Document) -> List[Union[Paragraph, Table]]:
    """Iterate through all paragraphs and tables in a document."""
    if isinstance(parent, _Document):
        parent_elm = parent.element.body
    elif isinstance(parent, _Cell):
        parent_elm = parent._tc
    else:
        raise ValueError("Something's not right")

    for child in parent_elm.iterchildren():
        if isinstance(child, CT_P):
            yield Paragraph(child, parent)
        elif isinstance(child, CT_Tbl):
            yield Table(child, parent)

def extract_table_data(table: Table) -> List[List[str]]:
    """Extract data from a table."""
    data = []
    for row in table.rows:
        row_data = []
        for cell in row.cells:
            # Get all text from the cell, including from nested tables
            text = ""
            for paragraph in cell.paragraphs:
                text += paragraph.text + "\n"
            row_data.append(text.strip())
        data.append(row_data)
    return data

def extract_text_with_structure_docx(doc_path: str) -> Dict[str, Any]:
    """Extract text and structure from DOCX files."""
    try:
        doc = Document(doc_path)
        content = {
            "metadata": extract_metadata_docx(doc),
            "sections": [],
            "tables": [],
            "headers": [],
            "footers": []
        }

        # Process document sections
        current_section = {"heading": "", "content": [], "level": 0}

        for block in iter_block_items(doc):
            if isinstance(block, Paragraph):
                # Check if it's a heading
                if block.style.name.startswith('Heading'):
                    # Save previous section if it exists
                    if current_section["content"]:
                        content["sections"].append(current_section.copy())

                    # Start new section
                    level = int(block.style.name.replace('Heading ', ''))
                    current_section = {
                        "heading": block.text,
                        "content": [],
                        "level": level
                    }
                else:
                    # Regular paragraph
                    style_info = {
                        "bold": any(run.bold for run in block.runs),
                        "italic": any(run.italic for run in block.runs),
                        "underline": any(run.underline for run in block.runs)
                    }
                    current_section["content"].append({
                        "type": "paragraph",
                        "text": block.text,
                        "style": style_info
                    })

            elif isinstance(block, Table):
                table_data = extract_table_data(block)
                content["tables"].append({
                    "data": table_data,
                    "row_count": len(table_data),
                    "col_count": len(table_data[0]) if table_data else 0
                })

        # Add the last section
        if current_section["content"]:
            content["sections"].append(current_section)

        # Process headers and footers
        for section in doc.sections:
            if section.header.paragraphs:
                content["headers"].append([p.text for p in section.header.paragraphs if p.text])
            if section.footer.paragraphs:
                content["footers"].append([p.text for p in section.footer.paragraphs if p.text])

        return content

    except Exception as e:
        raise Exception(f"Error extracting structured content from DOCX: {str(e)}")

def process_document(file_path: str) -> Dict[str, Any]:
    """Process document and extract text with structure."""
    try:
        if not os.path.exists(file_path):
            return {"error": "File not found"}

        _, file_extension = os.path.splitext(file_path)
        ext = file_extension.lower()

        print(f"Processing file: {file_path} with extension: {ext}")

        if ext == '.docx':
            content = extract_text_with_structure_docx(file_path)
            return {
                "type": "docx",
                "content": content
            }
        elif ext == '.doc':
            # For .doc files, use mammoth with enhanced options
            try:
                with open(file_path, 'rb') as doc_file:
                    result = mammoth.extract_raw_text(doc_file, {
                        "include_default_style_map": True,
                        "preserve_empty_paragraphs": True
                    })
                    return {
                        "type": "doc",
                        "content": {
                            "text": result.value,
                            "messages": [str(msg) for msg in result.messages]
                        }
                    }
            except Exception as doc_error:
                raise Exception(f"Error processing DOC file: {str(doc_error)}")
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
        error_msg = f"Processing failed: {str(e)}"
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

    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        sys.exit(1)

    file_path = sys.argv[1]
    result = process_document(file_path)
    print(json.dumps(result))