import React from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Heading1, Heading2, Text, Image as ImageIcon, List } from "lucide-react";
import { cn } from "@/lib/utils";

interface DocumentSection {
  type: 'heading1' | 'heading2' | 'paragraph' | 'image' | 'list';
  content: string;
  confidence?: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface DocumentLayoutProps {
  sections: DocumentSection[];
  className?: string;
}

const sectionIcons = {
  heading1: Heading1,
  heading2: Heading2,
  paragraph: Text,
  image: ImageIcon,
  list: List,
};

export function DocumentLayout({ sections, className }: DocumentLayoutProps) {
  return (
    <Card className={cn("p-4", className)}>
      <ScrollArea className="h-[600px] w-full">
        <div className="space-y-4">
          {sections.map((section, index) => {
            const Icon = sectionIcons[section.type];
            
            return (
              <div
                key={index}
                className={cn(
                  "p-3 rounded-md border transition-colors hover:bg-accent/50",
                  section.type.startsWith('heading') && "bg-muted"
                )}
                style={{
                  marginLeft: section.type === 'heading2' ? '1rem' : '0',
                }}
              >
                <div className="flex items-start gap-2">
                  <Icon className="h-5 w-5 mt-1 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">
                      {section.content}
                    </div>
                    {section.confidence !== undefined && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Confidence: {Math.round(section.confidence)}%
                      </div>
                    )}
                  </div>
                </div>
                {section.boundingBox && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Position: {section.boundingBox.x}, {section.boundingBox.y}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </Card>
  );
}
