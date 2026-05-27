import { useState } from "react";
import { FileUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { HemoglobinSummaryStack } from "../../components/charts/HemoglobinSummaryStack";
import { VolumeSliceViewer } from "../../components/charts/VolumeSliceViewer";
import { buildMatlabHemoglobinPanels } from "../../lib/hemoglobinGraphing";
import { summarizeAverageHemoglobinMat } from "../../lib/inverseAnalysis";
import { parseNumericMatFile } from "../../lib/mat";
import { parseNifti, type NiftiImage } from "../../lib/nifti";

export function GraphingDevTool() {
  const [hemoglobinPanels, setHemoglobinPanels] = useState<ReturnType<typeof buildMatlabHemoglobinPanels> | null>(null);
  const [niftiImage, setNiftiImage] = useState<NiftiImage | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadHemoglobin(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    try {
      const matrices = parseNumericMatFile(await file.arrayBuffer());
      setHemoglobinPanels(buildMatlabHemoglobinPanels(summarizeAverageHemoglobinMat(matrices)));
    } catch (loadError) {
      setHemoglobinPanels(null);
      setError(loadError instanceof Error ? loadError.message : "Hemoglobin MAT import failed.");
    }
  }

  async function loadNifti(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    try {
      setNiftiImage(parseNifti(await file.arrayBuffer()));
    } catch (loadError) {
      setNiftiImage(null);
      setError(loadError instanceof Error ? loadError.message : "NIfTI import failed.");
    }
  }

  return (
    <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Inverse hemoglobin summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-50">
              <FileUp size={15} /> AverageHemoglobinScalpBrain.mat
              <input className="hidden" type="file" accept=".mat" onChange={(event) => void loadHemoglobin(event.target.files)} />
            </label>
            {hemoglobinPanels ? (
              <HemoglobinSummaryStack panels={hemoglobinPanels} />
            ) : (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Load the MATLAB summary file to render O2Hb, HHb, and HbT scalp/brain errorbar plots.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>MRI slice viewer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-50">
              <FileUp size={15} /> NIfTI
              <input className="hidden" type="file" accept=".nii" onChange={(event) => void loadNifti(event.target.files)} />
            </label>
            {niftiImage ? (
              <VolumeSliceViewer image={niftiImage} />
            ) : (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Load an MRI volume such as MPRAGE_R.nii to inspect axial, sagittal, or coronal slices.
              </div>
            )}
          </CardContent>
        </Card>
        {error && <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      </div>
    </div>
  );
}
