#!/usr/bin/env python3
import sys
import os
from PIL import Image, ImageDraw, ImageFont
import mammoth
import subprocess

def get_text_preview(doc_path, max_chars=200):
    """Extract text preview from DOC/DOCX file"""
    try:
        # Try mammoth first for DOCX
        with open(doc_path, 'rb') as doc_file:
            try:
                result = mammoth.extract_raw_text(doc_file)
                text = result.value.strip()
                if text:
                    return text[:max_chars]
            except:
                pass
                
        # Fallback to antiword for DOC
        try:
            result = subprocess.run(
                ['antiword', doc_path],
                capture_output=True,
                text=True,
                check=True
            )
            if result.stdout.strip():
                return result.stdout.strip()[:max_chars]
        except:
            pass
            
        return "Preview not available"
        
    except Exception as e:
        print(f"Error extracting text: {str(e)}", file=sys.stderr)
        return "Error generating preview"

def generate_doc_thumbnail(doc_path, output_path, width, height):
    """Generate a thumbnail for a DOC/DOCX file"""
    try:
        # Create a new image with white background
        image = Image.new('RGB', (width, height), 'white')
        draw = ImageDraw.Draw(image)
        
        # Get text preview
        preview_text = get_text_preview(doc_path)
        
        # Draw file type indicator
        draw.rectangle([0, 0, width, 40], fill='#f0f0f0')
        draw.text((10, 10), os.path.splitext(doc_path)[1].upper()[1:], 
                 fill='#333333', align='left')
        
        # Draw preview text
        wrapped_text = []
        current_line = ""
        words = preview_text.split()
        
        # Simple text wrapping
        for word in words:
            if len(current_line + " " + word) * 7 < width - 20:  # Approximate character width
                current_line += (" " + word if current_line else word)
            else:
                wrapped_text.append(current_line)
                current_line = word
                
        if current_line:
            wrapped_text.append(current_line)
            
        # Draw wrapped text
        y_position = 50
        for line in wrapped_text[:10]:  # Limit to 10 lines
            draw.text((10, y_position), line, fill='black', align='left')
            y_position += 20
            
        # Save thumbnail
        image.save(output_path, format='JPEG', quality=85)
        return True
        
    except Exception as e:
        print(f"Error generating DOC thumbnail: {str(e)}", file=sys.stderr)
        return False

if __name__ == "__main__":
    if len(sys.argv) != 5:
        print("Usage: doc_thumbnail.py <doc_path> <output_path> <width> <height>", file=sys.stderr)
        sys.exit(1)
        
    doc_path = sys.argv[1]
    output_path = sys.argv[2]
    width = int(sys.argv[3])
    height = int(sys.argv[4])
    
    if not os.path.exists(doc_path):
        print(f"Document file not found: {doc_path}", file=sys.stderr)
        sys.exit(1)
        
    success = generate_doc_thumbnail(doc_path, output_path, width, height)
    sys.exit(0 if success else 1)
