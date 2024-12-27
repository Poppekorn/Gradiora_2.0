import { useState, useCallback, useEffect } from "react";
import { useFiles } from "./use-files";
import { normalizeTagName } from "@/lib/tag-utils";
import { useToast } from "./use-toast";
import { useMutation } from "@tanstack/react-query";
import type { Tag } from "@db/schema";

interface ValidationResult {
  isValid: boolean;
  message?: string;
  existingTag?: Tag;
}

export function useTagValidation(boardId: number) {
  const { tags } = useFiles(boardId);
  const { toast } = useToast();
  const [validationResult, setValidationResult] = useState<ValidationResult>({ isValid: true });

  const validateTag = useCallback(
    async (tagName: string): Promise<ValidationResult> => {
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
    },
    [tags]
  );

  const validateTagMutation = useMutation({
    mutationFn: validateTag,
    onSuccess: (result) => {
      setValidationResult(result);
      if (!result.isValid) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: result.message
        });
      }
    }
  });

  return {
    validateTag: validateTagMutation.mutate,
    validationResult,
    isValidating: validateTagMutation.isPending
  };
}
