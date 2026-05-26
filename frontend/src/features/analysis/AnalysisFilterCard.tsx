import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input, Label, Select } from "../../components/ui/field";
import type { AnalysisFilterMethod } from "../../lib/samples";

export type FilterOptions = {
  method: AnalysisFilterMethod;
  order: string;
  cutoff: string;
  passes: number;
};

type AnalysisFilterCardProps = {
  filterOptions: FilterOptions;
  setFilterOptions: (options: FilterOptions) => void;
};

export function AnalysisFilterCard({ filterOptions, setFilterOptions }: AnalysisFilterCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Analysis Filter</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Filter type</Label>
            <Select
              value={filterOptions.method}
              onChange={(event) =>
                setFilterOptions({ ...filterOptions, method: event.target.value as AnalysisFilterMethod })
              }
            >
              <option value="butterworth">Butterworth</option>
              <option value="kalman">Kalman</option>
            </Select>
          </div>
          <div>
            <Label>{filterOptions.method === "kalman" ? "Measurement noise" : "Filter order"}</Label>
            <Input value={filterOptions.order} onChange={(event) => setFilterOptions({ ...filterOptions, order: event.target.value })} />
          </div>
        </div>
        <div>
          <Label>{filterOptions.method === "kalman" ? "Process noise" : "Cutoff"}</Label>
          <Input value={filterOptions.cutoff} onChange={(event) => setFilterOptions({ ...filterOptions, cutoff: event.target.value })} />
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => setFilterOptions({ ...filterOptions, passes: filterOptions.passes + 1 })}>
            Apply filter
          </Button>
          <Button className="flex-1" variant="ghost" onClick={() => setFilterOptions({ ...filterOptions, passes: 0 })}>
            Reset
          </Button>
        </div>
        <div className="text-xs text-slate-500">
          Applied {filterOptions.passes} times. Butterworth uses order/cutoff; Kalman uses measurement/process noise.
        </div>
      </CardContent>
    </Card>
  );
}
