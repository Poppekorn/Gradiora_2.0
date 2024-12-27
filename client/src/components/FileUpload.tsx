import { useState, useEffect } from "react";
import { useFiles } from "@/hooks/use-files";
import { useTiles } from "@/hooks/use-tiles";
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
  const { toast } = useToast();

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
      const normalizedNewTag = normalizeTagName(newTagName);

      // Check for exact matches
      const exactMatchExists = tags?.some(
        tag => normalizeTagName(tag.name) === normalizedNewTag
      );

      if (exactMatchExists) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "A tag with this name already exists",
        });
        return;
      }

      // Find similar tags
      const similarTags = tags
        ? findSimilarTags(newTagName, tags.map(t => t.name))
        : [];

      if (similarTags.length > 0) {
        // Show suggestion dialog
        setShowSuggestionDialog(true);
        setSimilarTagSuggestions(similarTags);
        return;
      }

      // If no similar tags found, create the new tag
      await createTag({
        name: newTagName.trim(),
        isStudyUnitTag: false,
      });
      setNewTagName("");
      toast({
        title: "Success",
        description: "Tag created successfully",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create tag",
      });
    }
  };

  // Create study unit tags only once when tiles change
  useEffect(() => {
    const createMissingTags = async () => {
      if (!tiles?.length || !tags?.length) return;

      for (const tile of tiles) {
        const normalizedTileTitle = tile.title.toLowerCase();
        const tagExists = tags.some(
          tag => tag.name.toLowerCase() === normalizedTileTitle && tag.isStudyUnitTag
        );

        if (!tagExists) {
          try {
            await createTag({
              name: tile.title,
              isStudyUnitTag: true,
            });
          } catch (error) {
            console.error(`Failed to create tag for study unit ${tile.title}:`, error);
          }
        }
      }
    };

    createMissingTags();
  }, [tiles, tags, createTag]);

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
                    className="w-[200px]"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCreateTag}
                    disabled={!newTagName.trim()}
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