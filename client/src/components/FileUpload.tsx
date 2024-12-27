import { useState, useEffect } from "react";
import { useFiles } from "@/hooks/use-files";
import { useTiles } from "@/hooks/use-tiles";
import { useBoards } from "@/hooks/use-boards";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Upload, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Tag } from "@db/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { findSimilarTags, normalizeTagName } from "@/lib/tag-utils";
import { useTagValidation } from "@/hooks/use-tag-validation";
import cn from 'classnames';

interface FileUploadProps {
  boardId: number;
  children: React.ReactNode;
}

const ALLOWED_FILE_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'text/plain',
  'text/csv',
  // Archives
  'application/zip',
  'application/x-rar-compressed',
];

export default function FileUpload({ boardId, children }: FileUploadProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [showSuggestionDialog, setShowSuggestionDialog] = useState(false);
  const [similarTagSuggestions, setSimilarTagSuggestions] = useState<string[]>([]);

  const { uploadFile, createTag, tags } = useFiles(boardId);
  const { tiles } = useTiles(boardId);
  const { boards } = useBoards();
  const { toast } = useToast();
  const { validateTag, validationResult, isValidating, setValidationResult } = useTagValidation(boardId);

  // Create board tag when component mounts
  useEffect(() => {
    const createBoardTag = async () => {
      const board = boards?.find(b => b.id === boardId);
      if (!board) return;

      const boardTagName = board.name;
      const boardTagExists = tags?.some(
        tag => normalizeTagName(tag.name) === normalizeTagName(boardTagName)
      );

      if (!boardTagExists) {
        try {
          await createTag({
            name: boardTagName,
            isStudyUnitTag: false,
          });
        } catch (error) {
          console.error(`Failed to create board tag: ${error}`);
        }
      }
    };

    createBoardTag();
  }, [boards, boardId, tags, createTag]);

  // Create study unit tags
  useEffect(() => {
    const createStudyUnitTags = async () => {
      if (!tiles?.length) return;

      for (const tile of tiles) {
        const tileTagExists = tags?.some(
          tag => normalizeTagName(tag.name) === normalizeTagName(tile.title) && tag.isStudyUnitTag
        );

        if (!tileTagExists) {
          try {
            await createTag({
              name: tile.title,
              isStudyUnitTag: true,
            });
          } catch (error) {
            console.error(`Failed to create study unit tag: ${error}`);
          }
        }
      }
    };

    createStudyUnitTags();
  }, [tiles, tags, createTag]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        toast({
          variant: "destructive",
          title: "Invalid file type",
          description: "Please upload a valid document, image, or archive file.",
        });
        e.target.value = '';
        return;
      }

      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        toast({
          variant: "destructive",
          title: "File too large",
          description: "Please upload a file smaller than 50MB.",
        });
        e.target.value = '';
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("tags", JSON.stringify(selectedTags));

      await uploadFile(formData);

      toast({
        title: "Success",
        description: "File uploaded successfully",
      });
      setOpen(false);
      setSelectedFile(null);
      setSelectedTags([]);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload file",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    try {
      const validation = await validateTag(newTagName);

      if (!validation.isValid) {
        if (validation.existingTag) {
          // If there's an existing tag, use it
          const tagId = validation.existingTag.id;
          if (!selectedTags.includes(tagId)) {
            setSelectedTags(prev => [...prev, tagId]);
          }
          setNewTagName("");
          toast({
            title: "Tag selected",
            description: "Using existing tag"
          });
        } else {
          toast({
            variant: "destructive",
            title: "Error",
            description: validation.message
          });
        }
        return;
      }

      // Create new tag
      const tag = await createTag({
        name: newTagName.trim(),
        isStudyUnitTag: false,
      });

      if (tag) {
        setSelectedTags(prev => [...prev, tag.id]);
      }

      setNewTagName("");
      setValidationResult({ isValid: true });
      toast({
        title: "Success",
        description: "Tag created successfully"
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create tag"
      });
    }
  };

  useEffect(() => {
    if (newTagName.trim()) {
      const timer = setTimeout(async () => {
        const result = await validateTag(newTagName);
        setValidationResult(result);
      }, 300);

      return () => clearTimeout(timer);
    } else {
      setValidationResult({ isValid: true });
    }
  }, [newTagName, validateTag, setValidationResult]);

  const toggleTag = (tagId: number) => {
    setSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload File</DialogTitle>
            <DialogDescription>
              Upload a file and assign it to specific study units or add custom tags.
              Supported formats: images, documents, and archives up to 50MB.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file">File *</Label>
              <Input
                id="file"
                type="file"
                onChange={handleFileChange}
                accept={ALLOWED_FILE_TYPES.join(',')}
                required
              />
              <p className="text-xs text-muted-foreground">
                Maximum file size: 50MB
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Tags</Label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="New tag name"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    className={cn(
                      "w-[200px]",
                      !validationResult.isValid && "border-red-500",
                      isValidating && "opacity-50"
                    )}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCreateTag}
                    disabled={!newTagName.trim() || isValidating}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border rounded-lg">
                {tags?.map((tag: Tag) => (
                  <Badge
                    key={tag.id}
                    variant={selectedTags.includes(tag.id) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleTag(tag.id)}
                  >
                    {tag.name}
                    {tag.isStudyUnitTag && " (Study Unit)"}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !selectedFile}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={showSuggestionDialog} onOpenChange={setShowSuggestionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Similar Tags Found</AlertDialogTitle>
            <AlertDialogDescription>
              We found similar existing tags. Would you like to use one of these instead?
              <div className="mt-4 space-y-2">
                {similarTagSuggestions.map((tagName) => (
                  <div
                    key={tagName}
                    className="p-2 border rounded hover:bg-accent cursor-pointer"
                    onClick={() => {
                      setNewTagName(tagName);
                      setShowSuggestionDialog(false);
                    }}
                  >
                    {tagName}
                  </div>
                ))}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setShowSuggestionDialog(false);
                await createTag({
                  name: newTagName.trim(),
                  isStudyUnitTag: false,
                });
                setNewTagName("");
                toast({
                  title: "Success",
                  description: "Tag created successfully",
                });
              }}
            >
              Create New Tag Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}