'use client';

import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ToastProvider';

interface FileStatus {
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  message?: string;
}

export default function UploadPage() {
  const [items, setItems] = useState<FileStatus[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    setItems((prev) => [
      ...prev,
      ...arr.map((f) => ({ file: f, status: 'pending' as const })),
    ]);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const upload = async () => {
    const pending = items.filter((i) => i.status === 'pending');
    if (pending.length === 0) return;

    setUploading(true);

    // Upload in batches of 5
    const BATCH = 5;
    for (let i = 0; i < pending.length; i += BATCH) {
      const batch = pending.slice(i, i + BATCH);

      // Mark as uploading
      setItems((prev) =>
        prev.map((item) =>
          batch.find((b) => b.file === item.file)
            ? { ...item, status: 'uploading' }
            : item
        )
      );

      const formData = new FormData();
      batch.forEach((item) => formData.append('photos', item.file));

      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();

        setItems((prev) =>
          prev.map((item) => {
            const batchItem = batch.find((b) => b.file === item.file);
            if (!batchItem) return item;
            const err = data.errors?.find((e: { name: string }) => e.name === item.file.name);
            return {
              ...item,
              status: err ? 'error' : 'done',
              message: err?.error,
            };
          })
        );

        const failed = data.errors as { name: string; error: string }[] | undefined;
        if (failed?.length) {
          const first = failed[0];
          const extra = failed.length > 1 ? ` (and ${failed.length - 1} more)` : '';
          showToast(`Upload error — ${first.name}: ${first.error}${extra}`);
        }
      } catch {
        setItems((prev) =>
          prev.map((item) =>
            batch.find((b) => b.file === item.file)
              ? { ...item, status: 'error', message: 'Upload failed' }
              : item
          )
        );
        showToast('Upload failed: could not reach the server.');
      }
    }

    setUploading(false);
  };

  const pendingCount = items.filter((i) => i.status === 'pending').length;
  const doneCount = items.filter((i) => i.status === 'done').length;

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-header__title">Upload Photos</h1>
        <p className="page-header__subtitle">
          Photos are automatically tagged with AI and grouped by location
        </p>
      </div>

      <div
        className={`upload-zone ${dragging ? 'upload-zone--dragging' : ''} ${uploading ? 'upload-zone--uploading' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <div className="upload-zone__icon">&#128444;</div>
        <div className="upload-zone__title">
          {dragging ? 'Drop to add photos' : 'Click or drag photos here'}
        </div>
        <div className="upload-zone__hint">JPEG, PNG, WebP, GIF supported</div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="upload-zone__input"
          onChange={handleChange}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {items.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '20px 0 12px' }}>
            <span style={{ fontSize: '0.875rem', color: '#888' }}>
              {items.length} file{items.length !== 1 ? 's' : ''} selected
              {doneCount > 0 && ` · ${doneCount} uploaded`}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {doneCount > 0 && (
                <Link href="/photos" style={{ fontSize: '0.875rem', color: '#6366f1' }}>
                  View photos
                </Link>
              )}
              {pendingCount > 0 && !uploading && (
                <button
                  onClick={upload}
                  style={{
                    padding: '8px 18px',
                    background: '#6366f1',
                    color: 'white',
                    borderRadius: 6,
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                >
                  Upload {pendingCount} photo{pendingCount !== 1 ? 's' : ''}
                </button>
              )}
              {uploading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#888', fontSize: '0.875rem' }}>
                  <div className="spinner" />
                  Uploading...
                </div>
              )}
            </div>
          </div>

          <div className="upload-list">
            {items.map((item, idx) => (
              <div key={idx} className="upload-list__item">
                <span className="upload-list__name">{item.file.name}</span>
                <span className={`upload-list__status upload-list__status--${item.status}`}>
                  {item.status === 'pending' && 'Ready'}
                  {item.status === 'uploading' && 'Uploading...'}
                  {item.status === 'done' && '✓ Done'}
                  {item.status === 'error' && `Error: ${item.message || 'failed'}`}
                </span>
                {item.status === 'pending' && (
                  <button
                    onClick={() => removeItem(idx)}
                    style={{ fontSize: '0.75rem', color: '#555', marginLeft: 4 }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
