import { FileAudio, Upload } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { Button } from '../../components/Button';
import { importFiles, type ImportResult } from '../../offline/store';

/** Import your own MP3 / M4A / AAC files (from Files on iPhone, or drag & drop on a computer). */
export function ImportSection() {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragging, setDragging] = useState(false);

  const run = async (files: File[]) => {
    if (!files.length) return;
    setResult(null);
    setBusy({ done: 0, total: files.length });
    const r = await importFiles(files, (done, total) => setBusy({ done, total }));
    setBusy(null);
    setResult(r);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void run([...e.dataTransfer.files]);
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center gap-4 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${dragging ? 'border-accent-ink bg-tint' : 'border-fg/20'}`}
      >
        <FileAudio className="size-10 text-fg-muted" aria-hidden />
        <div>
          <p className="font-bold">Add your own music</p>
          <p className="mt-1 text-sm text-fg-muted">
            MP3, M4A or AAC files. Title, artist, album and cover art are read from the file's tags. On iPhone, choose files
            from the Files app.
          </p>
        </div>
        <Button size="md" onClick={() => input.current?.click()} disabled={!!busy}>
          <Upload className="size-5" aria-hidden /> {busy ? `Importing ${busy.done} of ${busy.total}…` : 'Import music'}
        </Button>
        <input
          ref={input}
          type="file"
          multiple
          accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,.mp3,.m4a,.aac"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            void run([...(e.target.files ?? [])]);
            e.target.value = '';
          }}
        />
      </div>

      {result && (
        <div role="status" className="mt-4 rounded-md bg-elevated p-4 text-sm">
          <p className="font-bold">
            {result.imported} {result.imported === 1 ? 'file' : 'files'} imported. Find them under Downloaded.
          </p>
          {result.skipped.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-fg-muted">
              {result.skipped.map((s) => (
                <li key={s}>Skipped {s}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <p className="mt-4 text-xs text-fg-muted">Imported files stay on this device only. Only import music you have the right to use.</p>
    </div>
  );
}
