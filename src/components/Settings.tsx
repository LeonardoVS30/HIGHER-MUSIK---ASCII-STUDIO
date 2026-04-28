import React from 'react';

export interface SettingsType {
  width: number;
  fps: number;
  contrast: number;
  invert: boolean;
  color: boolean;
}

interface SettingsProps {
  settings: SettingsType;
  onChange: (newSettings: SettingsType) => void;
  mediaType: 'image' | 'video' | 'gif' | null;
}

export function Settings({ settings, onChange, mediaType }: SettingsProps) {
  const update = (key: keyof SettingsType, value: any) => {
    onChange({ ...settings, [key]: value });
  };

  const OptionButton = ({ label, value, current, onClick }: { label: string | number, value: any, current: any, onClick: () => void }) => (
    <button
      onClick={onClick}
      className={`flex-1 border p-1.5 text-center text-[11px] transition-colors
        ${current === value ? 'border-[#111] bg-[#111] text-white' : 'border-[#ddd] bg-white text-[#111] hover:border-[#111]'}`}
    >
      {label}
    </button>
  );

  return (
    <aside className="border-r border-[#111] p-5 flex flex-col gap-6 overflow-y-auto bg-white min-w-[320px]">
      
      <div>
        <div className="flex justify-between items-end mb-2">
          <div className="text-[11px] lowercase text-[#666]">output resolution</div>
          <div className="text-[10px] tabular-nums font-mono">{settings.width} cols</div>
        </div>
        <input
          type="range"
          min="40"
          max="400"
          step="10"
          value={settings.width}
          onChange={(e) => update('width', parseInt(e.target.value))}
          className="editorial-slider"
        />
        <div className="text-[9px] text-[#888] mt-1 text-right lowercase">higher = clearer (but slower)</div>
      </div>

      <div>
        <div className="text-[11px] lowercase text-[#666] mb-2">frame rate (fps)</div>
        <div className="flex gap-2">
          <OptionButton label={12} value={12} current={settings.fps} onClick={() => update('fps', 12)} />
          <OptionButton label={24} value={24} current={settings.fps} onClick={() => update('fps', 24)} />
          <OptionButton label={30} value={30} current={settings.fps} onClick={() => update('fps', 30)} />
          <OptionButton label={60} value={60} current={settings.fps} onClick={() => update('fps', 60)} />
        </div>
      </div>

      <div>
        <div className="text-[11px] lowercase text-[#666] mb-2">contrast</div>
        <input
          type="range"
          min="-1"
          max="1"
          step="0.1"
          value={settings.contrast}
          onChange={(e) => update('contrast', parseFloat(e.target.value))}
          className="editorial-slider"
        />
      </div>

      <div className="flex justify-between items-center mt-2">
        <div className="text-[11px] lowercase text-[#666] m-0">invert colors</div>
        <button
          onClick={() => update('invert', !settings.invert)}
          className={`w-4 h-4 border border-[#111] transition-colors flex items-center justify-center
            ${settings.invert ? 'bg-[#111] text-white' : 'bg-white text-[#111]'}`}
        >
           {settings.invert && <div className="w-2 h-2 bg-white" />}
        </button>
      </div>

      <div className="flex justify-between items-center mt-2">
        <div className="text-[11px] lowercase text-[#666] m-0">original colors</div>
        <button
          onClick={() => update('color', !settings.color)}
          className={`w-4 h-4 border border-[#111] transition-colors flex items-center justify-center
            ${settings.color ? 'bg-[#111] text-white' : 'bg-white text-[#111]'}`}
        >
           {settings.color && <div className="w-2 h-2 bg-white" />}
        </button>
      </div>

    </aside>
  );
}
