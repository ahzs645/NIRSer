import { useState } from "react";
import { Activity, Boxes, ChartSpline, FolderSearch } from "lucide-react";
import { Button } from "../../components/ui/button";
import { BrunoDevTool } from "./BrunoDevTool";
import { BcmdDevTool } from "./bcmd/BcmdDevTool";
import { SourceAuditPanel } from "./SourceAuditPanel";
import { GraphingDevTool } from "./GraphingDevTool";

type DevToolTab = "bruno" | "bcmd" | "graphing" | "source";

export function DevToolsPanel() {
  const [tab, setTab] = useState<DevToolTab>("bruno");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={tab === "bruno" ? "primary" : "secondary"} onClick={() => setTab("bruno")}>
          <Activity size={16} /> BRUNO
        </Button>
        <Button type="button" variant={tab === "bcmd" ? "primary" : "secondary"} onClick={() => setTab("bcmd")}>
          <Boxes size={16} /> BCMD
        </Button>
        <Button type="button" variant={tab === "graphing" ? "primary" : "secondary"} onClick={() => setTab("graphing")}>
          <ChartSpline size={16} /> Graphing
        </Button>
        <Button type="button" variant={tab === "source" ? "primary" : "secondary"} onClick={() => setTab("source")}>
          <FolderSearch size={16} /> Source Audit
        </Button>
      </div>
      {tab === "bruno" ? <BrunoDevTool /> : tab === "bcmd" ? <BcmdDevTool /> : tab === "graphing" ? <GraphingDevTool /> : <SourceAuditPanel />}
    </div>
  );
}
