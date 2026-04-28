import React, { useState, useRef, useEffect } from 'react';
import { FileDropzone } from './components/FileDropzone';
import { Settings, SettingsType } from './components/Settings';
import { Controls } from './components/Controls';
import { AsciiRenderer } from './components/AsciiRenderer';
import { ExportPanel } from './components/ExportPanel';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'gif' | null>(null);

  const [settings, setSettings] = useState<SettingsType>({
    width: 120,
    fps: 15,
    contrast: 0,
    invert: false,
    color: false,
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [shouldStop, setShouldStop] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportFormat, setExportFormat] = useState<'video' | 'gif' | null>(null);
  
  const asciiTextRef = useRef<string>("");

  const handleFileSelect = (newFile: File) => {
    if (mediaUrl) {
      URL.revokeObjectURL(mediaUrl);
    }
    setFile(newFile);
    setMediaUrl(URL.createObjectURL(newFile));
    setMediaType(newFile.type === 'image/gif' ? 'gif' : newFile.type.startsWith('video/') ? 'video' : 'image');
    setIsPlaying(false);
    setProgress(0);
    setShouldStop(true);
    setExportFormat(null);
    setTimeout(() => setShouldStop(false), 50);
  };

  const handleExportTxt = () => {
    if (!asciiTextRef.current) return;
    const blob = new Blob([asciiTextRef.current], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ascii_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportVideo = () => {
    setExportFormat('video');
  };

  const handleExportGif = () => {
    setExportFormat('gif');
  };

  // Cleanup object urls on unmount
  useEffect(() => {
    return () => {
      if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    };
  }, [mediaUrl]);

  return (
    <div className="w-[1120px] max-w-full h-[830px] max-h-full mx-auto flex flex-col border border-[#111] bg-white overflow-hidden text-[#111] font-mono shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#111] flex justify-between font-bold uppercase tracking-[0.1em] text-sm shrink-0">
        <span>ascii studio</span>
        <span>v1.0</span>
      </div>

      <FileDropzone onFileSelect={handleFileSelect} />

      {file && (
        <>
        <div className="flex-1 grid grid-cols-1 md:grid-cols-[320px_1fr] overflow-hidden min-h-0">
          <Settings settings={settings} onChange={setSettings} mediaType={mediaType} />
          
          <AsciiRenderer
            mediaUrl={mediaUrl}
            mediaType={mediaType}
            settings={settings}
            isPlaying={isPlaying}
            shouldStop={shouldStop}
            onProgress={setProgress}
            onEnded={() => setIsPlaying(false)}
            asciiTextRef={asciiTextRef}
            exportFormat={exportFormat}
            onExportFinish={() => setExportFormat(null)}
          />
        </div>
        
        <Controls 
          isPlaying={isPlaying}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onStop={() => setShouldStop(true)}
          progress={progress}
          mediaType={mediaType}
        />

        <ExportPanel 
          onExportTxt={handleExportTxt}
          onExportVideo={handleExportVideo}
          onExportGif={handleExportGif}
          mediaType={mediaType}
          isExporting={exportFormat !== null}
        />
        </>
      )}
    </div>
  );
}
