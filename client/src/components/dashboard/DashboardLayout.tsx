import { useState } from "react";
import GridLayout from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { Card } from "@/components/ui/card";

interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

const defaultLayout: LayoutItem[] = [
  { i: "progress", x: 0, y: 0, w: 6, h: 4, minW: 4, minH: 3 },
  { i: "deadlines", x: 6, y: 0, w: 6, h: 4, minW: 4, minH: 3 },
  { i: "activities", x: 0, y: 4, w: 8, h: 4, minW: 4, minH: 3 },
  { i: "quickActions", x: 8, y: 4, w: 4, h: 4, minW: 3, minH: 3 },
];

export default function DashboardLayout() {
  const [layout, setLayout] = useState(defaultLayout);

  const handleLayoutChange = (newLayout: LayoutItem[]) => {
    setLayout(newLayout);
    // TODO: Save layout to user preferences
  };

  return (
    <div className="p-6">
      <GridLayout
        className="layout"
        layout={layout}
        cols={12}
        rowHeight={100}
        width={1200}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".widget-header"
        margin={[16, 16]}
      >
        <Card key="progress" className="overflow-hidden">
          <div className="widget-header p-4 bg-background border-b cursor-move">
            Study Progress
          </div>
          <div className="p-4">Progress Widget Content</div>
        </Card>

        <Card key="deadlines" className="overflow-hidden">
          <div className="widget-header p-4 bg-background border-b cursor-move">
            Upcoming Deadlines
          </div>
          <div className="p-4">Deadlines Widget Content</div>
        </Card>

        <Card key="activities" className="overflow-hidden">
          <div className="widget-header p-4 bg-background border-b cursor-move">
            Recent Activities
          </div>
          <div className="p-4">Activities Widget Content</div>
        </Card>

        <Card key="quickActions" className="overflow-hidden">
          <div className="widget-header p-4 bg-background border-b cursor-move">
            Quick Actions
          </div>
          <div className="p-4">Quick Actions Widget Content</div>
        </Card>
      </GridLayout>
    </div>
  );
}
