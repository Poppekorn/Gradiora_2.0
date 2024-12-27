import { useState } from "react";
import { useFiles } from "@/hooks/use-files";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { File as FileIcon, Tag, Plus } from "lucide-react";
import { format } from "date-fns";
import type { FileTag, Tag as TagType } from "@db/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface FileListProps {
  boardId: number;
}

interface FileWithTags {
  id: number;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  boardId: number;
  uploadedBy: number;
  createdAt: Date;
  tags: TagType[];
}

export default function FileList({ boardId }: FileListProps) {
  const [selectedFile, setSelectedFile] = useState<FileWithTags | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const { files, isLoading, tags, createTag, addTagToFile, removeTagFromFile } = useFiles(boardId);
  const { toast } = useToast();

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    try {
      // Check if tag already exists
      const tagExists = tags?.some(
        tag => tag.name.toLowerCase() === newTagName.trim().toLowerCase()
      );

      if (tagExists) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "A tag with this name already exists",
        });
        return;
      }

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

  const toggleTag = async (fileId: number, tagId: number, hasTag: boolean) => {
    try {
      if (hasTag) {
        await removeTagFromFile({ fileId, tagId });
      } else {
        await addTagToFile({ fileId, tagId });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update file tags",
      });
    }
  };

  if (isLoading) {
    return <div>Loading files...</div>;
  }

  if (!files?.length) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold text-muted-foreground mb-2">
          No files uploaded
        </h2>
        <p className="text-muted-foreground">
          Upload files and tag them with study units
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {files.map((file: FileWithTags) => (
          <Card 
            key={file.id} 
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => setSelectedFile(file)}
          >
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileIcon className="h-5 w-5" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{file.originalName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(file.createdAt), "PPp")}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-2">
                <Tag className="h-4 w-4 mt-1" />
                <div className="flex flex-wrap gap-2">
                  {file.tags?.map((tag) => (
                    <Badge key={tag.id} variant="secondary">
                      {tag.name}
                      {tag.isStudyUnitTag && " (Study Unit)"}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedFile} onOpenChange={(open) => !open && setSelectedFile(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage File Tags</DialogTitle>
            <DialogDescription>
              {selectedFile?.originalName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                placeholder="New tag name"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCreateTag}
                disabled={!newTagName.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Available Tags</h4>
              <div className="flex flex-wrap gap-2">
                {tags?.map((tag) => {
                  const hasTag = selectedFile?.tags?.some(t => t.id === tag.id);
                  return (
                    <Badge
                      key={tag.id}
                      variant={hasTag ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => selectedFile && toggleTag(selectedFile.id, tag.id, !!hasTag)}
                    >
                      {tag.name}
                      {tag.isStudyUnitTag && " (Study Unit)"}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}