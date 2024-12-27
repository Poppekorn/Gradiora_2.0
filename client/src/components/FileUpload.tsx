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
      console.error("Failed to upload file:", error);
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
      console.error("Failed to create tag:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create tag",
      });
    }
  };

  // Ensure study unit tags exist when the component mounts or tiles change
  useEffect(() => {
    const createMissingTags = async () => {
      if (!tiles) return;

      // Create tags for each study unit if they don't exist
      for (const tile of tiles) {
        const tagExists = tags?.some(
          tag => tag.name === tile.title && tag.isStudyUnitTag
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
  }, [tiles, tags]);

  const toggleTag = (tagId: number) => {
    setSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  return (
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
  );
}