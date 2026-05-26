import { useState } from "react";
import { Activity, Boxes } from "lucide-react";
import { Button } from "../../components/ui/button";
import { BrunoDevTool } from "./BrunoDevTool";
import { BcmdDevTool } from "./bcmd/BcmdDevTool";

type DevToolTab = "bruno" | "bcmd";

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
      </div>
      {tab === "bruno" ? <BrunoDevTool /> : <BcmdDevTool />}
    </div>
  );
}
