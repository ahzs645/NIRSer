import { Calculator, Download } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import type { BrunoResult } from "../../lib/bruno";
import { brunoResultCsv } from "../../lib/brunoExporters";
import { downloadText, formatNumber } from "../../lib/utils";

export function BrunoResultCard({ result }: { result: BrunoResult | null }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Result</CardTitle>
        <Calculator size={16} className="text-slate-500" />
      </CardHeader>
      <CardContent className="space-y-3">
        {result ? (
          <>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md bg-teal-50 p-3">
                <div className="text-xs text-teal-700">StO2</div>
                <div className="text-xl font-semibold text-teal-900">{formatNumber(result.sto2)}%</div>
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <div className="text-xs text-slate-500">Score</div>
                <div className="text-xl font-semibold">{result.score.toExponential(3)}</div>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              {Object.entries(result.coefficients).map(([key, value]) => (
                <div key={key} className="border-b border-slate-100 pb-1">
                  <dt className="text-xs text-slate-500">{key}</dt>
                  <dd className="font-mono">{Number(value).toPrecision(6)}</dd>
                </div>
              ))}
              <div className="border-b border-slate-100 pb-1">
                <dt className="text-xs text-slate-500">sumResidual</dt>
                <dd className="font-mono">{result.sumResidual.toExponential(4)}</dd>
              </div>
              <div className="border-b border-slate-100 pb-1">
                <dt className="text-xs text-slate-500">sumNormResidual</dt>
                <dd className="font-mono">{result.sumNormalizedResidual.toExponential(4)}</dd>
              </div>
            </dl>
            <Button className="w-full" onClick={() => downloadText("bruno-fit-result.csv", brunoResultCsv(result))}>
              <Download size={16} /> Export result CSV
            </Button>
          </>
        ) : (
          <p className="text-sm text-slate-500">Run a fit to calculate StO2, coefficients, residuals, and score.</p>
        )}
      </CardContent>
    </Card>
  );
}
