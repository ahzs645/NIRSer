import { Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Label } from "../../components/ui/field";

export type BrunoInputMode = "slope" | "attenuation";

type Props = {
  inputMode: BrunoInputMode;
  setInputMode: (mode: BrunoInputMode) => void;
  slopeText: string;
  setSlopeText: (text: string) => void;
  attenuationText: string;
  setAttenuationText: (text: string) => void;
  extinctionText: string;
  setExtinctionText: (text: string) => void;
  onImportMat: (files: FileList | null) => void;
  onImportSlope: (files: FileList | null) => void;
  onImportExtinction: (files: FileList | null) => void;
  children?: React.ReactNode;
};

function ImportButton({ label, accept, onChange }: { label: string; accept: string; onChange: (files: FileList | null) => void }) {
  return (
    <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-50">
      <Upload size={15} /> {label}
      <input className="hidden" type="file" accept={accept} onChange={(event) => onChange(event.target.files)} />
    </label>
  );
}

export function BrunoInputCard({
  inputMode,
  setInputMode,
  slopeText,
  setSlopeText,
  attenuationText,
  setAttenuationText,
  extinctionText,
  setExtinctionText,
  onImportMat,
  onImportSlope,
  onImportExtinction,
  children,
}: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>BRUNO Input Tables</CardTitle>
        <div className="flex gap-2">
          <ImportButton label="MAT" accept=".mat" onChange={onImportMat} />
          <ImportButton label="Slope" accept=".csv,.txt,.tsv" onChange={onImportSlope} />
          <ImportButton label="Extinction" accept=".csv,.txt,.tsv" onChange={onImportExtinction} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="inline-flex rounded-md border border-slate-200 bg-white p-1">
          <button type="button" className={`rounded px-3 py-1.5 text-sm ${inputMode === "slope" ? "bg-teal-700 text-white" : "text-slate-700 hover:bg-slate-50"}`} onClick={() => setInputMode("slope")}>Slope</button>
          <button type="button" className={`rounded px-3 py-1.5 text-sm ${inputMode === "attenuation" ? "bg-teal-700 text-white" : "text-slate-700 hover:bg-slate-50"}`} onClick={() => setInputMode("attenuation")}>Attenuation</button>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {inputMode === "slope" ? (
            <label className="space-y-2">
              <Label>Slope table: wavelength, slope</Label>
              <textarea className="min-h-96 w-full rounded-md border border-slate-200 p-3 font-mono text-xs outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" value={slopeText} onChange={(event) => setSlopeText(event.target.value)} />
            </label>
          ) : (
            <label className="space-y-2">
              <Label>Attenuation table: wavelength, distance columns</Label>
              <textarea className="min-h-96 w-full rounded-md border border-slate-200 p-3 font-mono text-xs outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" value={attenuationText} onChange={(event) => setAttenuationText(event.target.value)} placeholder={"0,30,25,20,15\n704,1.335,0.980,0.538,0.044"} />
            </label>
          )}
          <label className="space-y-2">
            <Label>Extinction table: wavelength, HHb, HbO2, water</Label>
            <textarea className="min-h-96 w-full rounded-md border border-slate-200 p-3 font-mono text-xs outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" value={extinctionText} onChange={(event) => setExtinctionText(event.target.value)} />
          </label>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
