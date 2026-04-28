import React, { useEffect, useRef, useState } from 'react';
import { calculateAsciiDimensions, imageDataToAscii } from '../lib/ascii';
import { extractGifFrames, GifFrameData } from '../lib/gifProcessor';
import { SettingsType } from './Settings';
import { GIFEncoder } from 'gifenc';

interface AsciiRendererProps {
  mediaUrl: string | null;
  mediaType: 'image' | 'video' | 'gif' | null;
  settings: SettingsType;
  isPlaying: boolean;
  shouldStop: boolean;
  onProgress: (progress: number) => void;
  onEnded: () => void;
  asciiTextRef: React.MutableRefObject<string>; // For export/saving
  exportFormat: 'video' | 'gif' | null;
  onExportFinish: () => void;
}

export function AsciiRenderer({
  mediaUrl,
  mediaType,
  settings,
  isPlaying,
  shouldStop,
  onProgress,
  onEnded: onEndedProp,
  asciiTextRef,
  exportFormat,
  onExportFinish
}: AsciiRendererProps) {
  const preRef = useRef<HTMLPreElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const requestRef = useRef<number>();
  const lastDrawTime = useRef<number>(0);
  const gifTimeRef = useRef<number>(0);
  const lastTimestampRef = useRef<number>(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const gifEncoderRef = useRef<any>(null);

  const parsedGifFramesRef = useRef<GifFrameData[]>([]);
  const currentGifFrameRef = useRef<number>(0);
  const gifSourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const [gifLoaded, setGifLoaded] = useState(false);

  const drawAscii = (source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement, isVideo: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const sourceWidth = isVideo ? (source as HTMLVideoElement).videoWidth : ((source as HTMLImageElement).naturalWidth || source.width);
    const sourceHeight = isVideo ? (source as HTMLVideoElement).videoHeight : ((source as HTMLImageElement).naturalHeight || source.height);

    if (!sourceWidth || !sourceHeight) return;

    const dims = calculateAsciiDimensions(sourceWidth, sourceHeight, settings.width);
    
    // Resize canvas if needed
    if (canvas.width !== dims.width || canvas.height !== dims.height) {
      canvas.width = dims.width;
      canvas.height = dims.height;
    }

    // Always clear the canvas before drawing to prevent transparency ghosting
    ctx.clearRect(0, 0, dims.width, dims.height);
    ctx.drawImage(source, 0, 0, dims.width, dims.height);
    const imageData = ctx.getImageData(0, 0, dims.width, dims.height);
    const asciiStr = imageDataToAscii(imageData, undefined, settings.invert, settings.contrast);
    
    if (preRef.current) {
      preRef.current.textContent = asciiStr;
      asciiTextRef.current = asciiStr;
    }

    // EXPORT RENDERING
    if (exportFormat === 'video' || exportFormat === 'gif') {
      const expCanvas = exportCanvasRef.current;
      if (!expCanvas) return;
      const expCtx = expCanvas.getContext('2d');
      if (!expCtx) return;
      
      const bgColor = settings.invert ? '#ffffff' : '#000000';
      const textColor = settings.invert ? '#000000' : '#ffffff';

      expCtx.fillStyle = bgColor;
      expCtx.fillRect(0, 0, expCanvas.width, expCanvas.height);
      
      expCtx.font = '14px "IBM Plex Mono", "JetBrains Mono", monospace';
      expCtx.textBaseline = 'top';
      
      const lines = asciiStr.split('\n');

      if (settings.color) {
        // Draw text as a mask for color
        expCtx.fillStyle = settings.invert ? '#000000' : '#ffffff';
        lines.forEach((line, i) => {
          expCtx.fillText(line, 0, i * 14);
        });
        
        // Multiply or Screen from the pixel canvas over the text!
        expCtx.globalCompositeOperation = settings.invert ? 'screen' : 'multiply';
        // Source image (the tiny canvas `canvas`) must be drawn stretched
        expCtx.filter = 'saturate(1.5)';
        expCtx.drawImage(canvas, 0, 0, expCanvas.width, expCanvas.height);
        expCtx.globalCompositeOperation = 'source-over';
        expCtx.filter = 'none';

      } else {
        expCtx.fillStyle = textColor;
        lines.forEach((line, i) => {
          expCtx.fillText(line, 0, i * 14);
        });
      }

      if (exportFormat === 'gif' && gifEncoderRef.current) {
        const { data, width, height } = expCtx.getImageData(0, 0, expCanvas.width, expCanvas.height);
        const indexData = new Uint8Array(width * height);
        
        if (settings.color) {
          // 4x4x4 RGB Palette mapping for colored GIF export (64 colors for speed)
          const palette: [number, number, number][] = [];
          for (let r=0; r<4; r++) {
            for (let g=0; g<4; g++) {
              for (let b=0; b<4; b++) {
                palette.push([r*85, g*85, b*85]); 
              }
            }
          }
          for (let i = 0; i < data.length; i += 4) {
             const rIdx = Math.round(data[i] / 85);
             const gIdx = Math.round(data[i+1] / 85);
             const bIdx = Math.round(data[i+2] / 85);
             indexData[i / 4] = (rIdx * 16) + (gIdx * 4) + bIdx;
          }
          gifEncoderRef.current.writeFrame(indexData, width, height, { palette, delay: 1000 / settings.fps });
        } else {
          // 2-color mapping
          const thres = settings.invert ? 128 : 128;
          for (let i = 0; i < data.length; i += 4) {
             indexData[i / 4] = data[i] > thres ? 1 : 0;
          }
          gifEncoderRef.current.writeFrame(indexData, width, height, { 
             palette: [[0,0,0], [255,255,255]], 
             delay: 1000 / settings.fps 
          });
        }
      }
    }
  };

  const processFrame = (time: number) => {
    // Determine exact delta to maintain native GIF timing independent of requestAnimationFrame
    const delta = time - (lastTimestampRef.current || time);
    lastTimestampRef.current = time;

    // Throttle ASCII drawing/recording to requested FPS
    const frameInterval = 1000 / settings.fps;
    
    if (mediaType === 'video') {
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) {
        return;
      }
      if (time - lastDrawTime.current >= frameInterval) {
        drawAscii(videoRef.current, true);
        lastDrawTime.current = time;
        const progress = videoRef.current.currentTime / videoRef.current.duration;
        onProgress(progress || 0);
      }
    } else if (mediaType === 'gif') {
      const frames = parsedGifFramesRef.current;
      if (!frames.length || !gifLoaded || (!isPlaying && !exportFormat)) return;
      
      // Advance GIF accumulated time
      gifTimeRef.current += delta;
      
      let currentFrameIdx = currentGifFrameRef.current;
      let frameData = frames[currentFrameIdx];
      
      // Loop to advance frame if accumulated time has surpassed this frame's duration
      const currentDelay = frameData.delay || 100;
      if (gifTimeRef.current >= currentDelay) {
        gifTimeRef.current -= currentDelay;
        currentFrameIdx = (currentFrameIdx + 1) % frames.length;
        frameData = frames[currentFrameIdx];
        if (currentFrameIdx === 0) {
          handleVideoEnded(); // Looped / Finished
        }
      }
      
      if (currentGifFrameRef.current !== currentFrameIdx) {
        currentGifFrameRef.current = currentFrameIdx;
      }

      if (time - lastDrawTime.current >= frameInterval) {
        let gCanvas = gifSourceCanvasRef.current;
        if (!gCanvas) {
          gCanvas = document.createElement('canvas');
          gifSourceCanvasRef.current = gCanvas;
        }
        gCanvas.width = frameData.imageData.width;
        gCanvas.height = frameData.imageData.height;
        gCanvas.getContext('2d')!.putImageData(frameData.imageData, 0, 0);
        
        drawAscii(gCanvas, false);
        lastDrawTime.current = time;
        
        onProgress(currentFrameIdx / frames.length);
      }
    }

    requestRef.current = requestAnimationFrame(processFrame);
  };

  // Fetch and decode GIFs
  useEffect(() => {
    if (mediaType === 'gif' && mediaUrl) {
      let active = true;
      setGifLoaded(false);
      parsedGifFramesRef.current = [];
      currentGifFrameRef.current = 0;

      fetch(mediaUrl)
        .then(res => res.arrayBuffer())
        .then(buff => extractGifFrames(buff))
        .then(frames => {
          if (!active) return;
          parsedGifFramesRef.current = frames;
          setGifLoaded(true);
        })
        .catch(err => console.error("GIF parse error", err));

      return () => { active = false; };
    }
  }, [mediaUrl, mediaType]);

  // Start Export Routine
  useEffect(() => {
    if (!exportFormat) return;

    const sourceWidth = mediaType === 'video' ? videoRef.current?.videoWidth : (mediaType === 'gif' && parsedGifFramesRef.current[0]) ? parsedGifFramesRef.current[0].imageData.width : imageRef.current?.naturalWidth;
    const sourceHeight = mediaType === 'video' ? videoRef.current?.videoHeight : (mediaType === 'gif' && parsedGifFramesRef.current[0]) ? parsedGifFramesRef.current[0].imageData.height : imageRef.current?.naturalHeight;
    if (!sourceWidth || !sourceHeight) return;

    const dims = calculateAsciiDimensions(sourceWidth, sourceHeight, settings.width);
    const exportCanvas = exportCanvasRef.current;
    if (!exportCanvas) return;
    
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;
    
    // Calculate off-screen canvas size for full quality export
    ctx.font = '14px "IBM Plex Mono", "JetBrains Mono", monospace';
    const charWidth = ctx.measureText('M').width || 8.4;
    const charHeight = 14;

    exportCanvas.width = Math.ceil(dims.width * charWidth);
    exportCanvas.height = Math.ceil(dims.height * charHeight);

    if (exportFormat === 'video' && mediaType === 'video') {
      const stream = exportCanvas.captureStream(settings.fps);
      const mime = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      recordedChunksRef.current = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ascii_studio_export.${mime.includes('mp4') ? 'mp4' : 'webm'}`;
        a.click();
        URL.revokeObjectURL(url);
        onExportFinish();
      };
      
      mediaRecorderRef.current = recorder;
      recorder.start();
      
      videoRef.current!.currentTime = 0;
      videoRef.current!.play().catch(e => console.error("Export play block:", e));

    } else if (exportFormat === 'video' && mediaType === 'gif') {
      const stream = exportCanvas.captureStream(settings.fps);
      const mime = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ascii_studio_export.${mime.includes('mp4') ? 'mp4' : 'webm'}`;
        a.click();
        URL.revokeObjectURL(url);
        onExportFinish();
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      currentGifFrameRef.current = 0;
      gifTimeRef.current = 0;
      
    } else if (exportFormat === 'gif') {
      gifEncoderRef.current = new GIFEncoder();
      
      if (mediaType === 'image') {
        drawAscii(imageRef.current!, false); // draws frame to export canvas & adds to encoder
        gifEncoderRef.current.finish();
        
        const blob = new Blob([gifEncoderRef.current.bytes()], { type: "image/gif" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ascii_studio_export.gif`;
        a.click();
        URL.revokeObjectURL(url);
        onExportFinish();
      } else if (mediaType === 'video') {
        videoRef.current!.currentTime = 0;
        videoRef.current!.play().catch(e => console.error("Export gif play block:", e));
      } else if (mediaType === 'gif') {
        currentGifFrameRef.current = 0;
        gifTimeRef.current = 0;
      }
    }
  }, [exportFormat]);

  // Handle Play/Pause and Export ticking
  useEffect(() => {
    if (mediaType === 'video' && videoRef.current) {
      if (isPlaying || exportFormat) {
        lastTimestampRef.current = performance.now();
        videoRef.current.play().catch(e => console.error("Play error:", e));
        requestRef.current = requestAnimationFrame(processFrame);
      } else {
        videoRef.current.pause();
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
      }
    } else if (mediaType === 'gif' && gifLoaded) {
      if (isPlaying || exportFormat) {
        lastTimestampRef.current = performance.now();
        requestRef.current = requestAnimationFrame(processFrame);
      } else {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
      }
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, mediaType, gifLoaded, settings.fps, settings.width, settings.contrast, settings.invert, exportFormat]);

  // Handle Stop
  useEffect(() => {
    if (exportFormat) return; // don't stop during export
    
    if (shouldStop && mediaType === 'video' && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      onProgress(0);
      drawAscii(videoRef.current, true); // initial frame
    } else if (shouldStop && mediaType === 'gif' && gifLoaded) {
      currentGifFrameRef.current = 0;
      gifTimeRef.current = 0;
      onProgress(0);
      
      const frameData = parsedGifFramesRef.current[0];
      if (frameData) {
        let gCanvas = gifSourceCanvasRef.current;
        if (!gCanvas) { gCanvas = document.createElement('canvas'); gifSourceCanvasRef.current = gCanvas; }
        gCanvas.width = frameData.imageData.width;
        gCanvas.height = frameData.imageData.height;
        gCanvas.getContext('2d')!.putImageData(frameData.imageData, 0, 0);
        
        drawAscii(gCanvas, false); // initial frame
      }
    }
  }, [shouldStop, exportFormat, gifLoaded]);

  // Initial draw when settings or media change
  useEffect(() => {
    if (exportFormat) return;

    if (mediaType === 'image' && imageRef.current) {
      const img = imageRef.current;
      if (img.complete) {
        drawAscii(img, false);
      } else {
        img.onload = () => drawAscii(img, false);
      }
    } else if (mediaType === 'video' && videoRef.current) {
      const vid = videoRef.current;
      if (vid.readyState >= 2) {
        drawAscii(vid, true);
      } else {
        vid.onloadeddata = () => drawAscii(vid, true);
      }
    } else if (mediaType === 'gif' && gifLoaded && parsedGifFramesRef.current[0]) {
      const frameData = parsedGifFramesRef.current[currentGifFrameRef.current];
      let gCanvas = gifSourceCanvasRef.current;
      if (!gCanvas) { gCanvas = document.createElement('canvas'); gifSourceCanvasRef.current = gCanvas; }
      gCanvas.width = frameData.imageData.width;
      gCanvas.height = frameData.imageData.height;
      gCanvas.getContext('2d')!.putImageData(frameData.imageData, 0, 0);
      drawAscii(gCanvas, false);
    }
  }, [mediaUrl, mediaType, gifLoaded, settings.width, settings.contrast, settings.invert, exportFormat]);

  const handleVideoEnded = () => {
    if (exportFormat === 'video') {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    } else if (exportFormat === 'gif') {
      if (gifEncoderRef.current) {
        gifEncoderRef.current.finish();
        const blob = new Blob([gifEncoderRef.current.bytes()], { type: "image/gif" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ascii_studio_export.gif`;
        a.click();
        URL.revokeObjectURL(url);
        onExportFinish();
      }
    }
    onEndedProp();
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
  };

  if (!mediaUrl) return null;

  return (
    <div className={`flex items-center justify-center overflow-hidden w-full h-full min-h-[300px] relative transition-colors ${settings.invert ? 'bg-white text-black' : 'bg-black text-white'}`}>
      
      {/* Export Overlay */}
      {exportFormat && (
        <div className={`absolute inset-0 z-20 flex flex-col items-center justify-center ${settings.invert ? 'bg-white bg-opacity-80' : 'bg-black bg-opacity-80'}`}>
          <div className="border border-current p-4 animate-pulse">
            <span className="text-sm font-bold uppercase tracking-widest current-color">
              Exporting {exportFormat}... Please wait.
            </span>
          </div>
        </div>
      )}

      <div className="absolute inset-0 overflow-hidden flex items-center justify-center p-2">
        <div 
           className="flex items-center justify-center w-full h-full"
           style={{ containerType: 'size' }}
        >
          <div 
            className="relative"
            style={{ 
              transform: `scale(${Math.min(1.5, 100 / settings.width)})`,
              transformOrigin: 'center center'
            }}
          >
            <pre
              ref={preRef}
              className="whitespace-pre font-mono m-0"
              style={{ 
                userSelect: 'none',
                fontSize: '10px',
                lineHeight: '1.1',
                letterSpacing: '0px',
                // If colored and not inverted, text must be white for multiply to work
                // If inverted, text is normally black. But if colored, it must be black for screen to work.
                color: settings.color ? (settings.invert ? '#000' : '#fff') : undefined,
              }}
            >
              {/* Initial ascii will be injected directly into DOM */}
            </pre>
            
            {/* The magic Color overlay */}
            <canvas 
              ref={canvasRef} 
              className={`absolute inset-0 w-full h-full pointer-events-none ${settings.color ? 'opacity-100' : 'opacity-0'}`} 
              style={{ 
                mixBlendMode: settings.invert ? 'screen' : 'multiply',
                filter: 'saturate(1.5)',
                imageRendering: 'pixelated'
              }} 
            />
          </div>
        </div>
      </div>
      
      {/* Hidden processing elements */}
      <canvas ref={exportCanvasRef} className="hidden" />
      
      {mediaType === 'image' && (
        <img ref={imageRef} src={mediaUrl} className="hidden" alt="source" />
      )}
      {mediaType === 'video' && (
        <video 
          ref={videoRef} 
          src={mediaUrl} 
          className="hidden" 
          muted 
          playsInline 
          onEnded={handleVideoEnded}
        />
      )}
    </div>
  );
}
