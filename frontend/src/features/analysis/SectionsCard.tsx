import { Download, Save } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input, Select } from "../../components/ui/field";
import { formatNumber } from "../../lib/utils";
import type { Section } from "../../types/nirs";

type SectionDraft = {
  name: string;
  initialTime: string;
  endTime: string;
};

type SectionsCardProps = {
  sections: Section[];
  activeSectionId: string;
  setActiveSectionId: (id: string) => void;
  sectionDraft: SectionDraft;
  sectionDraftValid: boolean;
  setSectionDraft: (draft: SectionDraft) => void;
  onAddSection: () => void;
  onUpdateActiveSection: () => void;
  onDeleteActiveSection: () => void;
  onSaveAnalysis: () => void;
  onExportSectionStats: () => void;
  onExportHbValues: () => void;
};

export function SectionsCard({
  sections,
  activeSectionId,
  setActiveSectionId,
  sectionDraft,
  sectionDraftValid,
  setSectionDraft,
  onAddSection,
  onUpdateActiveSection,
  onDeleteActiveSection,
  onSaveAnalysis,
  onExportSectionStats,
  onExportHbValues,
}: SectionsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sections</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Select value={activeSectionId} onChange={(event) => setActiveSectionId(event.target.value)}>
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.name} ({formatNumber(section.initialTime)}-{formatNumber(section.endTime)}s)
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-3 gap-2">
          <Input placeholder="Name" value={sectionDraft.name} onChange={(event) => setSectionDraft({ ...sectionDraft, name: event.target.value })} />
          <Input
            type="number"
            placeholder="Start"
            value={sectionDraft.initialTime}
            onChange={(event) => setSectionDraft({ ...sectionDraft, initialTime: event.target.value })}
          />
          <Input
            type="number"
            placeholder="End"
            value={sectionDraft.endTime}
            onChange={(event) => setSectionDraft({ ...sectionDraft, endTime: event.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button className="h-auto min-h-10 py-2 text-xs leading-tight" onClick={onAddSection} disabled={!sectionDraftValid}>
            Create New Section
          </Button>
          <Button variant="secondary" onClick={onUpdateActiveSection} disabled={!sectionDraftValid || !activeSectionId}>
            Update
          </Button>
          <Button variant="danger" onClick={onDeleteActiveSection}>
            Delete
          </Button>
          <Button className="h-auto min-h-10 py-2 text-xs leading-tight" onClick={onExportSectionStats}>
            Export sections as CSV
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="primary" onClick={onSaveAnalysis}>
            <Save size={16} /> Save
          </Button>
          <Button variant="ghost" onClick={onExportHbValues}>
            <Download size={16} /> Export Hb Values
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
