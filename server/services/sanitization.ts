import Logger from "../utils/logger";
import { encode } from "html-entities";

interface SanitizationOptions {
  allowHtml?: boolean;
  maxLength?: number;
  normalizeWhitespace?: boolean;
  removeControlChars?: boolean;
}

export function sanitizeContent(
  content: string,
  options: SanitizationOptions = {}
): string {
  try {
    Logger.info("[Sanitization] Starting content sanitization", {
      contentLength: content.length,
      options
    });

    if (!content) {
      return "";
    }

    let sanitized = content;

    // Remove potentially harmful control characters
    if (options.removeControlChars !== false) {
      sanitized = sanitized
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '') // Remove control characters
        .replace(/\u0000/g, '') // Remove null bytes
        .replace(/[\uFDD0-\uFDEF\uFFFE\uFFFF\u{1FFFE}\u{1FFFF}\u{2FFFE}\u{2FFFF}\u{3FFFE}\u{3FFFF}\u{4FFFE}\u{4FFFF}\u{5FFFE}\u{5FFFF}\u{6FFFE}\u{6FFFF}\u{7FFFE}\u{7FFFF}\u{8FFFE}\u{8FFFF}\u{9FFFE}\u{9FFFF}\u{AFFFE}\u{AFFFF}\u{BFFFE}\u{BFFFF}\u{CFFFE}\u{CFFFF}\u{DFFFE}\u{DFFFF}\u{EFFFE}\u{EFFFF}\u{FFFFE}\u{FFFFF}\u{10FFFE}\u{10FFFF}]/gu, ''); // Remove non-characters
    }

    // Normalize whitespace if requested
    if (options.normalizeWhitespace !== false) {
      sanitized = sanitized
        .replace(/[^\S\r\n]+/g, ' ') // Replace multiple spaces with single space
        .replace(/\r\n|\r|\n/g, '\n') // Normalize line endings
        .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
        .trim();
    }

    // Encode HTML if not explicitly allowed
    if (!options.allowHtml) {
      sanitized = encode(sanitized);
    }

    // Truncate if maxLength is specified
    if (options.maxLength && options.maxLength > 0) {
      sanitized = sanitized.slice(0, options.maxLength);
    }

    // Validate the sanitized content
    if (!/^[\x20-\x7E\s\n]*$/g.test(sanitized)) {
      Logger.warn("[Sanitization] Content contains non-printable characters after sanitization");
    }

    Logger.info("[Sanitization] Content sanitized successfully", {
      originalLength: content.length,
      sanitizedLength: sanitized.length
    });

    return sanitized;
  } catch (error) {
    Logger.error("[Sanitization] Error sanitizing content:", {
      error: error instanceof Error ? error.message : String(error)
    });
    throw new Error("Failed to sanitize content");
  }
}

export function validateContentSafety(content: string): boolean {
  try {
    Logger.info("[Sanitization] Validating content safety", {
      contentLength: content.length
    });

    // Check for potential XSS patterns
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /data:/gi,
      /vbscript:/gi,
      /on\w+\s*=/gi
    ];

    for (const pattern of xssPatterns) {
      if (pattern.test(content)) {
        Logger.warn("[Sanitization] Potential XSS detected", {
          pattern: pattern.toString()
        });
        return false;
      }
    }

    // Check for extremely long lines (potential DoS)
    const maxLineLength = 10000;
    const lines = content.split('\n');
    if (lines.some(line => line.length > maxLineLength)) {
      Logger.warn("[Sanitization] Found extremely long line", {
        maxLineLength
      });
      return false;
    }

    // Check character distribution (potential binary/encrypted content)
    const charCounts = new Map<string, number>();
    for (const char of content) {
      charCounts.set(char, (charCounts.get(char) || 0) + 1);
    }
    
    const uniqueChars = charCounts.size;
    const contentLength = content.length;
    const charDistributionRatio = uniqueChars / contentLength;

    // Unusual character distribution might indicate non-text content
    if (charDistributionRatio < 0.01 || charDistributionRatio > 0.95) {
      Logger.warn("[Sanitization] Suspicious character distribution", {
        uniqueChars,
        contentLength,
        ratio: charDistributionRatio
      });
      return false;
    }

    Logger.info("[Sanitization] Content passed safety validation");
    return true;
  } catch (error) {
    Logger.error("[Sanitization] Error validating content safety:", {
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}
