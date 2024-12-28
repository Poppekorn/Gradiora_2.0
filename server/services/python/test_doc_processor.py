#!/usr/bin/env python3
import os
import sys
import json

def test_dependencies():
    """Test if all required dependencies are properly installed and accessible"""
    dependencies = {
        'python-docx': 'docx',
        'PyPDF2': 'PyPDF2',
        'mammoth': 'mammoth'
    }
    
    results = {}
    for package, import_name in dependencies.items():
        try:
            __import__(import_name)
            results[package] = "OK"
        except ImportError as e:
            results[package] = f"Failed: {str(e)}"
    
    return results

def main():
    # Test dependencies
    results = test_dependencies()
    print("Dependency Test Results:")
    print(json.dumps(results, indent=2))
    
    # Test Python environment
    print("\nPython Environment:")
    print(f"Python version: {sys.version}")
    print(f"Current directory: {os.getcwd()}")
    print(f"Files in current directory: {os.listdir('.')}")

if __name__ == "__main__":
    main()
