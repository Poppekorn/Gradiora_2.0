import { type Tile } from "@db/schema";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Link as LinkIcon, Star, Tag } from "lucide-react";
import { format } from "date-fns";

interface BoardCardProps {
  tile: Tile;
}

const priorityColors = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-red-100 text-red-800",
};

const statusColors = {
  not_started: "bg-gray-100 text-gray-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  needs_review: "bg-yellow-100 text-yellow-800",
};

export default function TileCard({ tile }: BoardCardProps) {
  // Parse external links from JSON
  const externalLinks: string[] = Array.isArray(tile.externalLinks) 
    ? tile.externalLinks 
    : (typeof tile.externalLinks === 'string' 
      ? JSON.parse(tile.externalLinks) 
      : []);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start gap-4">
          <h3 className="font-semibold">{tile.title}</h3>
          <Badge 
            className={statusColors[tile.status as keyof typeof statusColors]}
          >
            {tile.status?.replace("_", " ")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {tile.description && (
          <p className="text-sm text-muted-foreground">
            {tile.description}
          </p>
        )}

        <div className="space-y-2">
          {tile.dueDate && (
            <div className="flex items-center text-sm">
              <Calendar className="mr-2 h-4 w-4" />
              {format(new Date(tile.dueDate), "PPP")}
            </div>
          )}

          {tile.priority && (
            <div className="flex items-center text-sm">
              <Star className="mr-2 h-4 w-4" />
              <Badge className={priorityColors[tile.priority as keyof typeof priorityColors]}>
                {tile.priority}
              </Badge>
            </div>
          )}

          {tile.tags && tile.tags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="h-4 w-4" />
              {tile.tags.map((tag: string, index: number) => (
                <Badge key={index} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {externalLinks.length > 0 && (
            <div className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
              <div className="flex flex-wrap gap-2">
                {externalLinks.map((link: string, index: number) => (
                  <a
                    key={index}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    Resource {index + 1}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
      {tile.grade && (
        <CardFooter>
          <div className="text-sm font-medium">
            Grade: {tile.grade}
          </div>
        </CardFooter>
      )}
    </Card>
  );
}