import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/field";
import { formatNumber } from "../../lib/utils";

type MarksCardProps = {
  coordinate: { chart: string; x: number; y: number } | null;
  markDraft: string;
  setMarkDraft: (value: string) => void;
  marks: number[];
  onAddMark: () => void;
  onUpdateMark: (index: number, value: string) => void;
  onDeleteMark: (index: number) => void;
  onExportMarks: () => void;
};

export function MarksCard({
  coordinate,
  markDraft,
  setMarkDraft,
  marks,
  onAddMark,
  onUpdateMark,
  onDeleteMark,
  onExportMarks,
}: MarksCardProps) {
  const [menu, setMenu] = useState<{ index: number; x: number; y: number } | null>(null);

  // Close the right-click menu on Escape.
  useEffect(() => {
    if (!menu) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Marks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
          Coordinates: {coordinate ? `${coordinate.chart} x ${formatNumber(coordinate.x)} y ${formatNumber(coordinate.y)}` : "move over a chart"}
        </div>
        <Input
          placeholder="Mark time (seconds)"
          value={markDraft}
          onChange={(event) => setMarkDraft(event.target.value)}
        />
        <Button className="w-full" onClick={onAddMark}>
          {markDraft ? "Add Mark at Typed Time" : coordinate ? "Add Mark at Coordinate" : "Add Mark at Current Time"}
        </Button>
        <div className="max-h-28 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-2 text-sm">
          {marks.map((mark, index) => (
            <div
              key={`${mark}-${index}`}
              className="mb-2 grid grid-cols-[1fr_88px_28px] items-center gap-2 last:mb-0"
              onContextMenu={(event) => {
                event.preventDefault();
                setMenu({ index, x: event.clientX, y: event.clientY });
              }}
            >
              <span>Mark {index + 1}</span>
              <Input
                id={`mark-input-${index}`}
                className="h-8"
                value={formatNumber(mark)}
                onChange={(event) => onUpdateMark(index, event.target.value)}
                aria-label={`Mark ${index + 1}`}
              />
              <Button size="icon" variant="ghost" onClick={() => onDeleteMark(index)} aria-label={`Delete mark ${index + 1}`}>
                ×
              </Button>
            </div>
          ))}
        </div>
        <Button variant="ghost" onClick={onExportMarks}>
          <Download size={16} /> Export Marks
        </Button>
      </CardContent>
      {menu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenu(null)}
            onContextMenu={(event) => {
              event.preventDefault();
              setMenu(null);
            }}
          />
          <div
            role="menu"
            className="fixed z-50 min-w-28 overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg"
            style={{ top: menu.y, left: menu.x }}
          >
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-1 text-left hover:bg-slate-100"
              onClick={() => {
                const input = document.getElementById(`mark-input-${menu.index}`) as HTMLInputElement | null;
                input?.focus();
                input?.select();
                setMenu(null);
              }}
            >
              Edit
            </button>
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-1 text-left text-red-600 hover:bg-red-50"
              onClick={() => {
                onDeleteMark(menu.index);
                setMenu(null);
              }}
            >
              Delete
            </button>
          </div>
        </>
      )}
    </Card>
  );
}
