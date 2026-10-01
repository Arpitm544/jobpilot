'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Search,
  FileCheck,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { api } from '@/lib/api';

const MAX_SIZE_MB = 5;
const MAX_BYTES = MAX_SIZE_MB * 1024 * 1024;

const STATUS_ICONS = {
  queued: ClockIcon,
  extracting_text: FileText,
  analyzing: Search,
  validating: ShieldCheck,
  ready: CheckCircle2,
  failed: AlertCircle,
};

function ClockIcon(props) {
  return <RefreshCw className="animate-spin" {...props} />;
}

export default function ResumeUploader({
  onUploadSuccess,
  onSkipToManual,
  sampleResumeText = '',
}) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [statusData, setStatusData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isCached, setIsCached] = useState(false);
  const [currentResumeId, setCurrentResumeId] = useState(null);
  const fileInputRef = useRef(null);
  const pollIntervalRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  const validateClientFile = (file) => {
    setErrorMessage('');
    if (!file) return false;

    if (file.size > MAX_BYTES) {
      setErrorMessage(`File is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Maximum allowed size is ${MAX_SIZE_MB} MB.`);
      return false;
    }

    const name = file.name.toLowerCase();
    const validExtensions = ['.pdf', '.docx', '.txt'];
    const hasValidExt = validExtensions.some((ext) => name.endsWith(ext));

    if (!hasValidExt) {
      setErrorMessage('Unsupported file format. Please upload a PDF or DOCX file (or TXT).');
      return false;
    }

    return true;
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && validateClientFile(file)) {
      setSelectedFile(file);
      startUpload(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && validateClientFile(file)) {
      setSelectedFile(file);
      startUpload(file);
    }
  };

  const startUpload = async (file) => {
    setErrorMessage('');
    setUploading(true);
    setStatusData({
      status: 'queued',
      step_message: 'Uploading securely...',
      progress_percent: 15,
    });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await api.post('/resumes/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const data = res.data;
      setIsCached(data.is_cached || false);
      setCurrentResumeId(data.resume_id);

      if (data.is_cached && data.status === 'ready') {
        setStatusData({
          status: 'ready',
          step_message: 'Retrieved from cache instantly!',
          progress_percent: 100,
        });
        setUploading(false);
        if (onUploadSuccess) {
          onUploadSuccess({
            resumeId: data.resume_id,
            isCached: true,
            filename: data.filename,
          });
        }
        return;
      }

      setUploading(false);
      setPolling(true);
      startPolling(data.resume_id);
    } catch (err) {
      setUploading(false);
      setPolling(false);
      const detail = err.response?.data?.detail || 'Failed to upload resume. Please try again.';
      setErrorMessage(detail);
      setStatusData({
        status: 'failed',
        step_message: 'Upload failed',
        progress_percent: 0,
      });
    }
  };

  const startPolling = (resumeId) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    const poll = async () => {
      try {
        const res = await api.get(`/resumes/${resumeId}/status`);
        const status = res.data;
        setStatusData(status);

        if (status.status === 'ready') {
          clearInterval(pollIntervalRef.current);
          setPolling(false);
          if (onUploadSuccess) {
            onUploadSuccess({
              resumeId: status.id,
              isCached: false,
              filename: selectedFile?.name,
            });
          }
        } else if (status.status === 'failed') {
          clearInterval(pollIntervalRef.current);
          setPolling(false);
          setErrorMessage(status.error_message || 'Resume parsing failed. Please verify the document or fill manually.');
        }
      } catch (err) {
        // If 401 or network glitch, retry a few times
        console.warn('Status poll warning:', err);
      }
    };

    poll();
    pollIntervalRef.current = setInterval(poll, 850);
  };

  const handleLoadSample = async () => {
    if (!sampleResumeText) return;
    const blob = new Blob([sampleResumeText], { type: 'text/plain' });
    const sampleFile = new File([blob], 'alex_mercer_sample_resume.txt', { type: 'text/plain' });
    setSelectedFile(sampleFile);
    startUpload(sampleFile);
  };

  const handleReset = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setSelectedFile(null);
    setUploading(false);
    setPolling(false);
    setStatusData(null);
    setErrorMessage('');
    setIsCached(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRetryParsing = async () => {
    if (!currentResumeId) return;
    setErrorMessage('');
    setUploading(false);
    setPolling(true);
    setStatusData({
      status: 'queued',
      step_message: 'Retrying parsing pipeline...',
      progress_percent: 15,
    });
    try {
      await api.post(`/resumes/${currentResumeId}/retry`);
      startPolling(currentResumeId);
    } catch (err) {
      setPolling(false);
      const detail = err.response?.data?.detail || 'Failed to retry parsing. Please try uploading again.';
      setErrorMessage(detail);
      setStatusData({
        status: 'failed',
        step_message: 'Retry failed',
        progress_percent: 0,
      });
    }
  };

  const isProcessing = uploading || polling;
  const isReady = statusData?.status === 'ready';
  const isFailed = statusData?.status === 'failed' || Boolean(errorMessage);

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        className="hidden"
      />

      {/* Main Upload / Progress Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        {/* Glow Accent */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {!isProcessing && !isReady ? (
          /* Dropzone State */
          <div>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 group ${
                dragOver
                  ? 'border-indigo-400 bg-indigo-950/30 scale-[1.01]'
                  : 'border-slate-700/80 hover:border-indigo-500/70 hover:bg-slate-800/40 bg-slate-950/40'
              }`}
            >
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:bg-indigo-500/20 transition-all duration-200">
                <UploadCloud className="w-8 h-8" />
              </div>

              <h3 className="text-lg font-semibold text-slate-100 mb-1">
                Drag and drop your resume here
              </h3>
              <p className="text-sm text-slate-400 mb-4">
                or <span className="text-indigo-400 underline underline-offset-2 font-medium">browse your files</span> from your computer
              </p>

              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/70 border border-slate-700 text-xs text-slate-400">
                <span>PDF or DOCX</span>
                <span>•</span>
                <span>Max 5 MB</span>
                <span>•</span>
                <span>MIME & signature verified</span>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mt-4 p-3.5 bg-red-950/40 border border-red-800/60 rounded-xl flex items-start gap-3 text-red-200 text-sm animate-in fade-in duration-200">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium">Upload Notice</p>
                  <p className="text-xs text-red-300/90 mt-0.5">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Sample Resume and Manual Fallback */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800/80 text-xs">
              {sampleResumeText && process.env.NODE_ENV === 'development' && (
                <button
                  type="button"
                  onClick={handleLoadSample}
                  className="inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Try with Sample Resume (Alex Mercer)
                </button>
              )}

              {onSkipToManual && (
                <button
                  type="button"
                  onClick={onSkipToManual}
                  className="text-slate-400 hover:text-slate-200 transition-colors ml-auto"
                >
                  Skip & fill profile manually →
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Processing / Progress State */
          <div className="py-4">
            {/* Header info */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center text-slate-300">
                  <FileText className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-200 truncate max-w-[260px]">
                    {selectedFile?.name || 'resume.pdf'}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {formatFileSize(selectedFile?.size)} • {isCached ? 'Cached' : 'Analyzing'}
                  </p>
                </div>
              </div>

              {isCached && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                  <Zap className="w-3 h-3" />
                  Instant Cache
                </span>
              )}
            </div>

            {/* Animated Progress Bar */}
            <div className="mb-6">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="font-medium text-slate-300">
                  {statusData?.step_message || 'Processing resume...'}
                </span>
                <span className="font-mono text-indigo-400 font-semibold">
                  {statusData?.progress_percent || (uploading ? 15 : 50)}%
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isFailed
                      ? 'bg-red-500'
                      : isReady
                      ? 'bg-emerald-500'
                      : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 animate-pulse'
                  }`}
                  style={{ width: `${statusData?.progress_percent || 15}%` }}
                />
              </div>
            </div>

            {/* Stepper Details */}
            <div className="grid grid-cols-3 gap-2 py-3 px-3 bg-slate-950/50 border border-slate-800 rounded-xl mb-6 text-xs">
              <div className={`flex items-center gap-2 ${statusData?.progress_percent >= 35 ? 'text-indigo-300' : 'text-slate-500'}`}>
                {statusData?.progress_percent >= 35 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                )}
                <span>Text Extract</span>
              </div>

              <div className={`flex items-center gap-2 ${statusData?.progress_percent >= 65 ? 'text-indigo-300' : 'text-slate-500'}`}>
                {statusData?.progress_percent >= 65 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : statusData?.progress_percent >= 35 ? (
                  <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-slate-700 shrink-0" />
                )}
                <span>AI Structuring</span>
              </div>

              <div className={`flex items-center gap-2 ${statusData?.progress_percent >= 90 ? 'text-indigo-300' : 'text-slate-500'}`}>
                {statusData?.progress_percent >= 90 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : statusData?.progress_percent >= 65 ? (
                  <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-slate-700 shrink-0" />
                )}
                <span>Zero-Hallucination</span>
              </div>
            </div>

            {/* Failure state */}
            {isFailed && (
              <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-xl text-red-200 text-xs mb-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-sm">Resume Processing Failed</p>
                  <p className="mt-1 text-red-300/90">{errorMessage || statusData?.error_message}</p>
                  <div className="mt-3 flex items-center gap-3">
                    {currentResumeId && (
                      <button
                        type="button"
                        onClick={handleRetryParsing}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Retry parsing
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleReset}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium transition-colors"
                    >
                      Try another resume
                    </button>
                    {onSkipToManual && (
                      <button
                        type="button"
                        onClick={onSkipToManual}
                        className="text-red-300 hover:text-white underline underline-offset-2"
                      >
                        Fill manually instead
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Ready State */}
            {isReady && (
              <div className="p-4 bg-emerald-950/30 border border-emerald-800/50 rounded-xl text-emerald-200 text-xs mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm text-emerald-100">Resume Ready for Review!</p>
                    <p className="text-emerald-300/80">Extracted and verified your master profile details.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Reset / Re-upload Option */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs text-slate-400">
              <button
                type="button"
                onClick={handleReset}
                className="hover:text-slate-200 transition-colors"
              >
                ← Upload a different file
              </button>

              {onSkipToManual && !isReady && (
                <button
                  type="button"
                  onClick={onSkipToManual}
                  className="hover:text-slate-200 transition-colors"
                >
                  Continue manually →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
