import { useState, useRef } from "react";
import { uploadAPI } from "../services/api";
import { PageHeader } from "../components/common";
import {
  UploadCloud, FileSpreadsheet, CheckCircle, XCircle,
  AlertTriangle, Info, Loader2, ChevronDown, ChevronUp,
  Building2,
} from "lucide-react";
import { formatDate, cn } from "../utils/helpers";
import toast from "react-hot-toast";

function BatchResultPanel({ batch }) {
  const [expanded, setExpanded] = useState(false);
  const hasErrors   = batch.error_details?.errors?.length > 0;
  const hasWarnings = batch.error_details?.warnings?.length > 0;

  const statusCls = batch.status === "SUCCESS"
    ? "border-green-200 bg-green-50"
    : batch.status === "PARTIAL"
    ? "border-yellow-200 bg-yellow-50"
    : "border-red-200 bg-red-50";

  return (
    <div className={cn("border rounded-xl p-5", statusCls)}>
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          {batch.status === "SUCCESS"
            ? <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
            : batch.status === "PARTIAL"
            ? <AlertTriangle size={20} className="text-yellow-600 flex-shrink-0" />
            : <XCircle size={20} className="text-red-600 flex-shrink-0" />}
          <div>
            <p className="font-semibold text-gray-800 text-sm">{batch.filename}</p>
            <p className="text-xs text-gray-500 mt-0.5">Uploaded {formatDate(batch.created_at)}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="text-center"><p className="text-gray-400">Total</p><p className="font-bold text-gray-700 text-lg">{batch.total_records}</p></div>
          <div className="text-center"><p className="text-green-600">Processed</p><p className="font-bold text-green-700 text-lg">{batch.processed_records}</p></div>
          <div className="text-center">
            <p className="text-teal-600 flex items-center gap-1"><Building2 size={10} /> TPA Routed</p>
            <p className="font-bold text-teal-700 text-lg">{batch.tpa_routed || 0}</p>
          </div>
          <div className="text-center">
            <p className="text-rose-500 flex items-center gap-1"><AlertTriangle size={10} /> Flagged</p>
            <p className="font-bold text-rose-600 text-lg">{batch.flagged_records || 0}</p>
          </div>
          <div className="text-center"><p className="text-red-500">Failed</p><p className="font-bold text-red-600 text-lg">{batch.failed_records}</p></div>
        </div>
      </div>

      {/* TPA routing note */}
      {(batch.tpa_routed || 0) > 0 && (
        <div className="mt-3 flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
          <Building2 size={13} className="text-teal-600 flex-shrink-0" />
          <p className="text-xs text-teal-700">
            {batch.tpa_routed} TPA scheme{batch.tpa_routed > 1 ? "s" : ""} routed to TPA desk — excluded from automated renewal pipeline.
          </p>
        </div>
      )}

      {/* Discrepancy note */}
      {(batch.flagged_records || 0) > 0 && (
        <div className="mt-2 flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          <AlertTriangle size={13} className="text-rose-600 flex-shrink-0" />
          <p className="text-xs text-rose-700">
            {batch.flagged_records} scheme{batch.flagged_records > 1 ? "s have" : " has"} LR/COR discrepancy &gt;1% vs workbook values — routed to Underwriter acknowledgement queue.
          </p>
        </div>
      )}

      {(hasErrors || hasWarnings) && (
        <div className="mt-3">
          <button onClick={() => setExpanded(e => !e)}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {hasErrors ? `${batch.error_details.errors.length} error(s)` : ""}
            {hasErrors && hasWarnings ? " · " : ""}
            {hasWarnings ? `${batch.error_details.warnings.length} warning(s)` : ""}
          </button>
          {expanded && (
            <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
              {batch.error_details.errors?.map((e, i) => (
                <p key={i} className="text-xs text-red-600 bg-red-50/60 rounded px-2 py-1 font-mono">✕ {e}</p>
              ))}
              {batch.error_details.warnings?.map((w, i) => (
                <p key={i} className="text-xs text-yellow-700 bg-yellow-50/60 rounded px-2 py-1 font-mono">⚠ {w}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function UploadPage() {
  const [dragging,  setDragging]  = useState(false);
  const [file,      setFile]      = useState(null);
  const [progress,  setProgress]  = useState(0);
  const [uploading, setUploading] = useState(false);
  const [result,    setResult]    = useState(null);
  const [history,   setHistory]   = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const fileRef = useRef();

  const loadHistory = async () => {
    setHistLoading(true);
    try { const res = await uploadAPI.list(); setHistory(res.data); }
    catch {} finally { setHistLoading(false); }
  };

  useState(() => { loadHistory(); });

  const handleFile = (f) => {
    if (!f) return;
    if (!["xlsx","xls"].includes(f.name.split(".").pop().toLowerCase())) {
      toast.error("Only .xlsx and .xls files are accepted"); return;
    }
    setFile(f); setResult(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true); setProgress(0);
    try {
      const res = await uploadAPI.upload(file, e => {
        if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
      });
      setResult(res.data); setFile(null);
      toast.success(`Ingested ${res.data.processed_records} policies · ${res.data.tpa_routed || 0} TPA routed`);
      loadHistory();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Upload failed");
    } finally { setUploading(false); setProgress(0); }
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Excel Upload" subtitle="Ingest renewal data — Corporate, Retail, and TPA sheets" />

      {/* Format guide */}
      <div className="card border-brand-blue-100 bg-brand-blue-50">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-brand-blue rounded-lg flex-shrink-0 mt-0.5">
            <Info size={16} className="text-white" />
          </div>
          <div className="text-sm flex-1">
            <p className="font-semibold text-brand-blue mb-2">Excel Workbook Format</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {[
                { sheet: "Corporate", note: "Auto-rated through approval pipeline", cls: "bg-brand-blue text-white" },
                { sheet: "Retail",    note: "Auto-rated through approval pipeline", cls: "bg-blue-600 text-white" },
                { sheet: "TPA",       note: "Routed to TPA desk — excluded from automated pipeline", cls: "bg-teal-600 text-white" },
              ].map(({ sheet, note, cls }) => (
                <div key={sheet} className="bg-white/70 rounded-lg p-3">
                  <p className={cn("font-bold inline-block px-2 py-0.5 rounded text-xs mb-1", cls)}>{sheet}</p>
                  <p className="text-gray-500 text-xs">{note}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-brand-blue">
              <p className="font-semibold mb-1">Required columns (per sheet):</p>
              <p className="font-mono text-blue-700">
                policy_number · company · current_premium · total_claims · total_premium · end_date
              </p>
              <p className="font-semibold mt-2 mb-1">Optional (enrichment & discrepancy validation):</p>
              <p className="font-mono text-blue-700">
                scheme_ref · business_sector · no_of_lives · start_date · contact_email ·
                contact_name · phone · lr · cor · customised_benefit · anti_selection · adopted_enrollee_cohort
              </p>
              <p className="mt-2 text-blue-600 opacity-70">
                If <span className="font-mono">lr</span> or <span className="font-mono">cor</span> columns are present,
                system will compare them to computed values. Discrepancy &gt;1% flags the record for Underwriter review.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
        onClick={() => !file && fileRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer select-none",
          dragging ? "border-brand-blue bg-brand-blue-50 scale-[1.01]"
          : file    ? "border-green-400 bg-green-50 cursor-default"
          : "border-gray-200 hover:border-brand-blue hover:bg-gray-50"
        )}
      >
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
          onChange={e => handleFile(e.target.files[0])} />

        {file ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center">
              <FileSpreadsheet size={28} className="text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-800">{file.name}</p>
              <p className="text-xs text-gray-500 mt-1">{(file.size/1024/1024).toFixed(2)} MB · Ready to upload</p>
            </div>
            <div className="flex gap-3 mt-2">
              <button onClick={e => { e.stopPropagation(); handleUpload(); }} disabled={uploading}
                className="btn-primary">
                {uploading ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
                {uploading ? `Uploading ${progress}%...` : "Upload & Process"}
              </button>
              <button onClick={e => { e.stopPropagation(); setFile(null); }} disabled={uploading}
                className="btn-ghost">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-colors",
              dragging ? "bg-brand-blue" : "bg-gray-100")}>
              <UploadCloud size={28} className={dragging ? "text-white" : "text-gray-400"} />
            </div>
            <div>
              <p className="font-semibold text-gray-700">{dragging ? "Drop your file here" : "Drag & drop or click to upload"}</p>
              <p className="text-xs text-gray-400 mt-1">.xlsx or .xls · max 20 MB</p>
            </div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {uploading && (
        <div>
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
            <span>Processing workbook...</span><span>{progress}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-brand-blue rounded-full transition-all duration-300" style={{ width:`${progress}%` }} />
          </div>
        </div>
      )}

      {result && <BatchResultPanel batch={result} />}

      {/* History */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700">Upload History</h3>
          <button onClick={loadHistory} className="btn-ghost text-xs">
            {histLoading ? <Loader2 size={12} className="animate-spin" /> : "Refresh"}
          </button>
        </div>
        {history.length === 0
          ? <p className="text-xs text-gray-400 text-center py-6">No uploads yet</p>
          : <div className="space-y-3">{history.map(b => <BatchResultPanel key={b.id} batch={b} />)}</div>}
      </div>
    </div>
  );
}
