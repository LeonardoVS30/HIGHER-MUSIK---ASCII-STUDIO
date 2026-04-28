import React from 'react';

interface ExportPanelProps {
  onExportTxt: () => void;
  onExportVideo: () => void;
  onExportGif: () => void;
  mediaType: 'image' | 'video' | 'gif' | null;
  isExporting: boolean;
}

export function ExportPanel({ onExportTxt, onExportVideo, onExportGif, mediaType, isExporting }: ExportPanelProps) {
  const ExportBtn = ({ label, onClick, disabled }: { label: string, onClick: () => void, disabled?: boolean }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`border border-[#111] px-4 py-2 text-xs lowercase transition-colors 
        ${disabled ? 'bg-[#eee] text-[#888] cursor-not-allowed opacity-50 border-[#ccc]' : 'bg-[#fff] cursor-pointer hover:bg-[#111] hover:text-[#fff] text-[#111]'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="border-t border-[#111] py-3 px-4 flex justify-end gap-3 bg-white shrink-0">
      <ExportBtn label="export .txt" onClick={onExportTxt} disabled={isExporting} />
      {(mediaType === 'video' || mediaType === 'gif') && (
        <ExportBtn label="export .mp4" onClick={onExportVideo} disabled={isExporting} />
      )}
      <ExportBtn label="export .gif" onClick={onExportGif} disabled={isExporting} />
    </div>
  );
}
