import { useFiles } from "@/hooks/use-files";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { File as FileIcon, Tag } from "lucide-react";
import { format } from "date-fns";
import type { FileTag, Tag as TagType } from "@db/schema";

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
  const { files, isLoading } = useFiles(boardId);

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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {files.map((file: FileWithTags) => (
        <Card key={file.id}>
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
  );
}