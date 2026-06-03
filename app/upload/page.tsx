'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

type UploadStep = 'idle' | 'uploading' | 'generating' | 'done' | 'error';
type CompanyStatus = 'queued' | 'website_fetch' | 'profile_gen' | 'done' | 'error';

interface CompanyRow {
  customer_id: number;
  company_name: string;
  status: CompanyStatus;
  website_found?: boolean;
  red?: number;
  amber?: number;
  green?: number;
  error?: string;
}

export default function UploadPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<UploadStep>('idle');
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [inserted, setInserted] = useState(0);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [error, setError] = useState('');

  const updateCompany = (id: number, patch: Partial<CompanyRow>) => {
    setCompanies(prev => prev.map(c => c.customer_id === id ? { ...c, ...patch } : c));
  };

  const handleFile = (f: File) => {
    if (!f.name.match(/\.xlsx?$/i)) {
      setError('Please upload an Excel file (.xlsx or .xls)');
      return;
    }
    setFile(f);
    setError('');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setStep('uploading');
    setCompanies([]);
    setError('');

    try {
      const fd = new FormData();
      fd.append('file', file);
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error ?? 'Upload failed');
      }
      const uploadData = await uploadRes.json();
      setInserted(uploadData.inserted);
      setStep('generating');

      const genRes = await fetch('/api/generate-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_ids: uploadData.customer_ids }),
      });

      if (!genRes.body) throw new Error('No response stream');

      const reader = genRes.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            switch (event.type) {
              case 'queued':
                setCompanies(prev => [...prev, {
                  customer_id: event.customer_id,
                  company_name: event.company_name,
                  status: 'queued',
                }]);
                break;
              case 'website_start':
                updateCompany(event.customer_id, { status: 'website_fetch' });
                break;
              case 'website_done':
              case 'website_skip':
                updateCompany(event.customer_id, {
                  status: 'profile_gen',
                  website_found: event.found ?? false,
                });
                break;
              case 'profile_start':
                updateCompany(event.customer_id, { status: 'profile_gen' });
                break;
              case 'done':
                updateCompany(event.customer_id, {
                  status: 'done',
                  red: event.red,
                  amber: event.amber,
                  green: event.green,
                });
                break;
              case 'error':
                updateCompany(event.customer_id, { status: 'error', error: event.error });
                break;
            }
          } catch { /* malformed line */ }
        }
      }

      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStep('error');
    }
  };

  const reset = () => {
    setStep('idle');
    setFile(null);
    setInserted(0);
    setCompanies([]);
    setError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Import customers</h1>
        <p className="text-gray-500 text-sm">
          Upload your customer spreadsheet. Light will research each company and generate an AI-drafted profile — you&apos;ll review them before flags go live.
        </p>
      </div>

      {/* Template download */}
      <div className="mb-6 bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-start gap-3">
        <div className="mt-0.5 w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-indigo-900">Start with the template</p>
          <p className="text-xs text-indigo-600 mt-0.5">Includes all required columns, an example row, and instructions.</p>
          <a href="/api/template" className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-indigo-700 hover:text-indigo-900">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download light_customers_template.xlsx
          </a>
        </div>
      </div>

      {step === 'idle' || step === 'error' ? (
        <>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
              dragOver ? 'border-indigo-400 bg-indigo-50' :
              file ? 'border-indigo-300 bg-indigo-50/50' :
              'border-gray-200 hover:border-indigo-200 hover:bg-gray-50'
            }`}
          >
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            {file ? (
              <div>
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="font-medium text-gray-900 text-sm">{file.name}</p>
                <p className="text-xs text-gray-400 mt-1">{(file.size / 1024).toFixed(0)} KB — click to choose a different file</p>
              </div>
            ) : (
              <div>
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <p className="font-medium text-gray-700 text-sm">Drop your spreadsheet here</p>
                <p className="text-xs text-gray-400 mt-1">or click to browse — .xlsx or .xls</p>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2.5">{error}</div>
          )}

          <div className="mt-5 bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Required columns</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              {[
                ['Company Name', 'Text'],
                ['Website', 'URL (optional, improves AI profile)'],
                ['Industry', 'e.g. Manufacturing'],
                ['Company Size', 'Headcount'],
                ['Key Stakeholders', 'Name (Role), ...'],
                ['Modules in Use', 'Comma-separated'],
                ['Contract Value', 'Annual $'],
                ['Renewal Date', 'YYYY-MM-DD'],
                ['Onboarding Status', 'Complete / In Progress'],
                ['Monthly Invoice Volume', 'Number'],
                ['Last Exec Contact Date', 'YYYY-MM-DD'],
                ['CSM Owner', 'Your name'],
              ].map(([col, hint]) => (
                <div key={col} className="flex items-baseline gap-2">
                  <span className="text-xs font-medium text-gray-700 w-40 shrink-0">{col}</span>
                  <span className="text-xs text-gray-400">{hint}</span>
                </div>
              ))}
            </div>
          </div>

          <button onClick={handleSubmit} disabled={!file}
            className="mt-5 w-full py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed">
            Import &amp; generate profiles
          </button>
        </>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {step === 'uploading' ? 'Uploading spreadsheet...' :
                   step === 'generating' ? `Researching & profiling ${inserted} account${inserted !== 1 ? 's' : ''}` :
                   step === 'done' ? `${inserted} account${inserted !== 1 ? 's' : ''} ready for review` :
                   'Something went wrong'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {step === 'generating' ? 'Claude is fetching each company\'s website and generating a profile' :
                   step === 'done' ? 'Profiles drafted — review and validate before flags go live' : ''}
                </p>
              </div>
              {(step === 'uploading' || step === 'generating') && (
                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              )}
              {step === 'done' && (
                <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
          </div>

          {/* Per-company rows */}
          {companies.length > 0 && (
            <div className="divide-y divide-gray-50">
              {companies.map(c => (
                <CompanyProgressRow key={c.customer_id} company={c} />
              ))}
            </div>
          )}

          {step === 'done' && (
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => router.push('/profiles')}
                className="flex-1 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
                Review &amp; validate profiles ({inserted})
              </button>
              <button onClick={reset}
                className="px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">
                Upload more
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CompanyProgressRow({ company: c }: { company: CompanyRow }) {
  const isDone = c.status === 'done';
  const isError = c.status === 'error';
  const isActive = c.status === 'website_fetch' || c.status === 'profile_gen';
  const isQueued = c.status === 'queued';

  return (
    <div className={`px-6 py-3.5 transition-colors ${isActive ? 'bg-indigo-50/50' : ''}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Status icon */}
          <div className="flex-shrink-0">
            {isDone && (
              <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            {isError && (
              <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            )}
            {isActive && (
              <div className="w-5 h-5 flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {isQueued && (
              <div className="w-5 h-5 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-gray-300" />
              </div>
            )}
          </div>

          {/* Company name + sub-status */}
          <div className="min-w-0">
            <p className={`text-sm font-medium truncate ${isQueued ? 'text-gray-400' : isError ? 'text-red-600' : 'text-gray-800'}`}>
              {c.company_name}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {c.status === 'queued' && 'Waiting...'}
              {c.status === 'website_fetch' && (
                <span className="text-indigo-500">Fetching website...</span>
              )}
              {c.status === 'profile_gen' && (
                <span className="text-indigo-500">
                  {c.website_found ? 'Website found · Generating profile with Claude...' : 'Generating profile with Claude...'}
                </span>
              )}
              {c.status === 'done' && (
                <span className="text-emerald-600">
                  Profile ready · {c.red! + c.amber! + c.green!} flags generated
                </span>
              )}
              {c.status === 'error' && (
                <span className="text-red-500">Failed — {c.error}</span>
              )}
            </p>
          </div>
        </div>

        {/* Flag pills */}
        {isDone && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {(c.red ?? 0) > 0 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                {c.red} red
              </span>
            )}
            {(c.amber ?? 0) > 0 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                {c.amber} amber
              </span>
            )}
            {(c.green ?? 0) > 0 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                {c.green} green
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
