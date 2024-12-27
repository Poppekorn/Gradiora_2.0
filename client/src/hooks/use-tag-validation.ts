import { useState, useCallback, useEffect } from "react";
import { useFiles } from "./use-files";
import { normalizeTagName } from "@/lib/tag-utils";
import { useToast } from "./use-toast";
import type { Tag } from "@db/schema";

interface ValidationResult {
  isValid: boolean;
  message?: string;
  existingTag?: Tag;
}

export function useTagValidation(boardId: number) {
  const { tags } = useFiles(boardId);
  const [validationResult, setValidationResult] = useState<ValidationResult>({ isValid: true });
  const [isValidating, setIsValidating] = useState(false);

  const validateTag = useCallback(
    async (tagName: string): Promise<ValidationResult> => {
      setIsValidating(true);

      try {
        if (!tagName.trim()) {
          return { isValid: false, message: "Tag name cannot be empty" };
        }

        const normalizedNewTag = normalizeTagName(tagName);
        const existingTag = tags?.find(
          tag => normalizeTagName(tag.name) === normalizedNewTag
        );

        if (existingTag) {
          return {
            isValid: false,
            message: "This tag already exists",
            existingTag
          };
        }

        return { isValid: true };
      } finally {
        setIsValidating(false);
      }
    },
    [tags]
  );

  return {
    validateTag,
    validationResult,
    isValidating,
    setValidationResult
  };
}