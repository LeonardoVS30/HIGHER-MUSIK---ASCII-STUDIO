import React, { useCallback, useState } from 'react';

interface FileDropzoneProps {
  onFileSelect: (file: File) => void;
}

export function FileDropzone({ onFileSelect }: FileDropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  }, []);

  const processFile = (file: File) => {
    const validTypes = [
      'video/mp4', 'video/webm', 'video/quicktime',
      'image/jpeg', 'image/png', 'image/gif', 'image/webp'
    ];
    
    if (!validTypes.includes(file.type)) {
      setError(`error: format '${file.type}' not supported`);
      return;
    }
    
    setError(null);
    onFileSelect(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleChange = function(e: React.ChangeEvent<HTMLInputElement>) {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="w-full shrink-0">
      <label
        htmlFor="file-upload"
        className={`relative flex items-center justify-center w-full h-[100px] border-b border-[#111] bg-[#fafafa] cursor-pointer transition-colors duration-200
          ${isDragActive ? 'bg-[#eee]' : 'hover:bg-[#f5f5f5]'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="absolute top-[12px] left-[12px] right-[12px] bottom-[12px] border border-dashed border-[#ccc] pointer-events-none" />
        
        <div className="flex flex-col items-center justify-center z-10">
          <span className="text-[13px] text-[#888]">
            drag & drop your file here / <span className="underline text-[#111]">select file</span>
          </span>
          {error && <span className="mt-1 text-xs text-red-600">{error}</span>}
        </div>
        <input
          id="file-upload"
          type="file"
          className="hidden"
          accept="video/mp4,video/webm,video/quicktime,image/jpeg,image/png,image/gif,image/webp"
          onChange={handleChange}
        />
      </label>
    </div>
  );
}
