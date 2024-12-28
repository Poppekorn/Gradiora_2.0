#!/usr/bin/env python3
import os
import sys
import json
from importlib import import_module

def test_dependencies():
    """Test if all required dependencies are properly installed and accessible"""
    dependencies = {
        'mammoth': 'mammoth',
        'python-docx': 'docx',
        'PyPDF2': 'PyPDF2'
    }
    
    results = {}
    for package, import_name in dependencies.items():
        try:
            module = import_module(import_name)
            results[package] = {
                "status": "OK",
                "version": getattr(module, '__version__', 'unknown')
            }
        except ImportError as e:
            results[package] = {
                "status": "Failed",
                "error": str(e)
            }
    
    return results

def main():
    # Test Python environment
    print("Python Environment:")
    print(f"Python version: {sys.version}")
    print(f"Python executable: {sys.executable}")
    print(f"Current working directory: {os.getcwd()}")
    
    # Test dependencies
    print("\nDependency Test Results:")
    results = test_dependencies()
    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    main()
