import React from 'react';

interface ControlsProps {
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  progress: number; // 0 to 1
  mediaType: 'image' | 'video' | 'gif' | null;
}

export function Controls({ isPlaying, onPlay, onPause, onStop, progress, mediaType }: ControlsProps) {
  if (mediaType !== 'video' && mediaType !== 'gif') {
    return null;
  }

  const IconButton = ({ label, icon, onClick, active = false }: { label: string, icon: React.ReactNode, onClick: () => void, active?: boolean }) => (
    <button
      onClick={onClick}
      className={`border border-[#111] px-4 py-2 text-xs lowercase cursor-pointer transition-colors
        ${active ? 'bg-[#111] text-[#fff]' : 'bg-[#fff] text-[#111] hover:bg-[#111] hover:text-[#fff]'}`}
    >
      {icon} {label}
    </button>
  );

  return (
    <div className="p-4 border-t border-[#111] flex flex-wrap sm:flex-nowrap items-center gap-6 bg-white shrink-0">
      <div className="flex gap-2">
        <IconButton
          label="play"
          icon="▶"
          onClick={onPlay}
          active={isPlaying}
        />
        <IconButton
          label="pause"
          icon="⏸"
          onClick={onPause}
          active={!isPlaying && progress > 0 && progress < 1}
        />
        <IconButton
          label="stop"
          icon="⏹"
          onClick={onStop}
        />
      </div>
      
      <div className="h-1 bg-[#eee] flex-1 relative min-w-[200px]">
        <div 
          className="absolute top-0 left-0 h-full bg-[#111] transition-all duration-100 ease-linear"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}
