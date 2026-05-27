import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileUp, FolderSearch, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { auditSourceFiles, formatBytes, type SourceAuditSummary } from "../../lib/sourceAudit";

function statusTone(status: string) {
  if (status === "complete") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "partial") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function StatusIcon({ status }: { status: string }) {
  if (status === "complete") return <CheckCircle2 size={16} />;
  if (status === "partial") return <AlertTriangle size={16} />;
  return <XCircle size={16} />;
}

function SourceAuditResults({ summary }: { summary: SourceAuditSummary }) {
  const docs = summary.categories.flatMap((category) =>
    category.present.filter((path) => /(^|\/)(readme(\.md)?|license(\.txt)?|manual\.pdf|windows\.pdf)$/i.test(path)).map((path) => ({ category: category.label, path })),
  );
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-medium text-slate-500">Files scanned</div>
          <div className="mt-1 text-xl font-semibold text-slate-950">{summary.fileCount}</div>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-medium text-slate-500">Total size</div>
          <div className="mt-1 text-xl font-semibold text-slate-950">{formatBytes(summary.totalBytes)}</div>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-medium text-slate-500">Expected files matched</div>
          <div className="mt-1 text-xl font-semibold text-slate-950">
            {summary.matchedExpectedCount}/{summary.expectedCount}
          </div>
        </div>
      </div>

      {summary.missingCritical.length > 0 && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle size={16} /> External test data is incomplete
          </div>
          <p className="mt-1 text-rose-700">
            The NIfTI, mesh, inverse-analysis, and hemoglobin graphing tests need the inverse imaging files currently referenced from the local Downloads folder.
          </p>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        {summary.categories.map((category) => (
          <Card key={category.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle>{category.label}</CardTitle>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${statusTone(category.status)}`}>
                  <StatusIcon status={category.status} /> {category.status}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-slate-600">{category.description}</p>
              <div className="text-slate-700">
                <span className="font-medium">{category.present.length}</span> of{" "}
                <span className="font-medium">{category.expected.length}</span> key files present
              </div>
              {category.missing.length > 0 && (
                <details className="rounded-md border border-slate-200 bg-white p-2" open={category.status === "missing"}>
                  <summary className="cursor-pointer text-xs font-semibold text-slate-700">Missing files</summary>
                  <ul className="mt-2 max-h-44 space-y-1 overflow-auto font-mono text-xs text-slate-600">
                    {category.missing.map((path) => (
                      <li key={path}>{path}</li>
                    ))}
                  </ul>
                </details>
              )}
              {category.extra.length > 0 && (
                <details className="rounded-md border border-slate-200 bg-white p-2">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-700">Additional files</summary>
                  <ul className="mt-2 max-h-32 space-y-1 overflow-auto font-mono text-xs text-slate-600">
                    {category.extra.slice(0, 40).map((path) => (
                      <li key={path}>{path}</li>
                    ))}
                  </ul>
                  {category.extra.length > 40 && <div className="mt-2 text-xs text-slate-500">+{category.extra.length - 40} more</div>}
                </details>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      {docs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Source documentation and licenses</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-slate-700">
              {docs.map((item) => (
                <li key={`${item.category}-${item.path}`} className="font-mono text-xs">
                  <span className="font-sans font-medium text-slate-900">{item.category}:</span> {item.path}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function SourceAuditPanel() {
  const [files, setFiles] = useState<File[]>([]);
  const summary = useMemo(() => (files.length > 0 ? auditSourceFiles(files) : null), [files]);

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Source audit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-50">
              <FolderSearch size={16} /> Choose source folder
              <input
                className="hidden"
                type="file"
                multiple
                onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                {...{ webkitdirectory: "", directory: "" }}
              />
            </label>
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-50">
              <FileUp size={16} /> Choose files
              <input className="hidden" type="file" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
            </label>
            {files.length > 0 && <span className="text-sm text-slate-600">{files.length} files ready for audit</span>}
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            Load the downloaded source bundle to verify that inverse imaging data, BRUNO upstream files, and BCMD reference materials are available before relying on the dev tools or parity tests.
          </div>
        </CardContent>
      </Card>

      {summary ? (
        <SourceAuditResults summary={summary} />
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-sm text-slate-500">No source folder selected.</CardContent>
        </Card>
      )}
    </div>
  );
}
