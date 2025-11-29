import { useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store';
import { clamp, formatFrequency } from '@websdr-atlas/shared';

/**
 * WaterfallView component
 * 
 * MVP implementation with test noise generator.
 * Supports zoom and pan via scroll wheel and keyboard.
 * TODO: Replace with real WebSDR data stream integration.
 */
export function WaterfallView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const imageDataRef = useRef<ImageData | null>(null);

  const frequencyViewRange = useAppStore((state) => state.frequencyViewRange);
  const selectedFrequencyHz = useAppStore((state) => state.selectedFrequencyHz);
  const setSelectedFrequency = useAppStore((state) => state.setSelectedFrequency);
  const zoomLevel = useAppStore((state) => state.zoomLevel);
  const zoomIn = useAppStore((state) => state.zoomIn);
  const zoomOut = useAppStore((state) => state.zoomOut);
  const panLeft = useAppStore((state) => state.panLeft);
  const panRight = useAppStore((state) => state.panRight);
  const resetZoom = useAppStore((state) => state.resetZoom);

  // Color palette for waterfall (intensity to color)
  const getColor = useCallback((intensity: number): [number, number, number] => {
    // Clamp intensity to 0-1
    intensity = clamp(intensity, 0, 1);

    // Dark blue -> Blue -> Cyan -> Yellow -> Red -> White
    if (intensity < 0.2) {
      const t = intensity / 0.2;
      return [0, 0, Math.floor(50 + 150 * t)];
    } else if (intensity < 0.4) {
      const t = (intensity - 0.2) / 0.2;
      return [0, Math.floor(200 * t), 200];
    } else if (intensity < 0.6) {
      const t = (intensity - 0.4) / 0.2;
      return [Math.floor(255 * t), 200, Math.floor(200 * (1 - t))];
    } else if (intensity < 0.8) {
      const t = (intensity - 0.6) / 0.2;
      return [255, Math.floor(200 * (1 - t)), 0];
    } else {
      const t = (intensity - 0.8) / 0.2;
      return [255, Math.floor(255 * t), Math.floor(255 * t)];
    }
  }, []);

  // Generate test noise line
  const generateNoiseLine = useCallback(
    (width: number): number[] => {
      const line: number[] = [];
      const baseNoise = Math.random() * 0.2;

      for (let i = 0; i < width; i++) {
        // Base noise floor
        let value = baseNoise + Math.random() * 0.1;

        // Add some "signals" at random positions
        const signalPositions = [0.15, 0.25, 0.4, 0.6, 0.75, 0.85];
        for (const pos of signalPositions) {
          const dist = Math.abs(i / width - pos);
          if (dist < 0.02) {
            value += (0.5 + Math.random() * 0.5) * (1 - dist / 0.02);
          }
        }

        line.push(clamp(value, 0, 1));
      }

      return line;
    },
    []
  );

  // Render waterfall
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      imageDataRef.current = ctx.createImageData(canvas.width, canvas.height);
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    // Throttle frame rate for performance (target ~30 FPS)
    let lastFrameTime = 0;
    const targetFrameInterval = 1000 / 30;

    // Animation loop
    const render = (currentTime: number) => {
      // Throttle to target frame rate
      if (currentTime - lastFrameTime < targetFrameInterval) {
        animationRef.current = requestAnimationFrame(render);
        return;
      }
      lastFrameTime = currentTime;

      if (!imageDataRef.current) return;

      const imageData = imageDataRef.current;
      const width = canvas.width;
      const height = canvas.height;

      // Shift existing data down using copyWithin for better performance
      // Copy rows from top to bottom (each row is width * 4 bytes for RGBA)
      const bytesPerRow = width * 4;
      const totalBytes = height * bytesPerRow;
      
      // Shift all data down by one row
      imageData.data.copyWithin(bytesPerRow, 0, totalBytes - bytesPerRow);

      // Generate new line at top
      const newLine = generateNoiseLine(width);
      for (let x = 0; x < width; x++) {
        const [r, g, b] = getColor(newLine[x]);
        const idx = x * 4;
        imageData.data[idx] = r;
        imageData.data[idx + 1] = g;
        imageData.data[idx + 2] = b;
        imageData.data[idx + 3] = 255;
      }

      ctx.putImageData(imageData, 0, 0);

      // Draw frequency cursor if selected
      if (selectedFrequencyHz && frequencyViewRange) {
        const freqRange = frequencyViewRange.maxHz - frequencyViewRange.minHz;
        const cursorX =
          ((selectedFrequencyHz - frequencyViewRange.minHz) / freqRange) * width;

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(cursorX, 0);
        ctx.lineTo(cursorX, height);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', updateSize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [getColor, generateNoiseLine, selectedFrequencyHz, frequencyViewRange]);

  // Handle click to set frequency
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!frequencyViewRange) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = x / rect.width;

      const freq =
        frequencyViewRange.minHz +
        ratio * (frequencyViewRange.maxHz - frequencyViewRange.minHz);

      setSelectedFrequency(Math.round(freq));
    },
    [frequencyViewRange, setSelectedFrequency]
  );

  // Handle mouse wheel for zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      if (!frequencyViewRange) return;
      
      e.preventDefault();
      
      if (e.ctrlKey || e.metaKey) {
        // Zoom with Ctrl/Cmd + scroll
        if (e.deltaY < 0) {
          zoomIn();
        } else {
          zoomOut();
        }
      } else {
        // Pan with regular scroll (scroll down/right = pan right to higher frequencies)
        if (e.deltaY > 0 || e.deltaX > 0) {
          panRight();
        } else {
          panLeft();
        }
      }
    },
    [frequencyViewRange, zoomIn, zoomOut, panLeft, panRight]
  );

  // Keyboard shortcuts for zoom/pan
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!frequencyViewRange) return;
      
      // Ignore if user is typing in an input field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      
      switch (e.key) {
        case '+':
        case '=':
          e.preventDefault();
          zoomIn();
          break;
        case '-':
          e.preventDefault();
          zoomOut();
          break;
        case '0':
          e.preventDefault();
          resetZoom();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [frequencyViewRange, zoomIn, zoomOut, resetZoom]);

  return (
    <div ref={containerRef} className="h-full w-full relative">
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        onWheel={handleWheel}
        className="waterfall-canvas cursor-crosshair"
        style={{ width: '100%', height: '100%' }}
      />

      {/* Zoom controls overlay */}
      {frequencyViewRange && (
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          <button
            onClick={zoomIn}
            className="bg-atlas-surface/80 hover:bg-atlas-border text-atlas-text w-8 h-8 rounded flex items-center justify-center text-lg"
            title="Zoom In (+)"
          >
            +
          </button>
          <button
            onClick={zoomOut}
            className="bg-atlas-surface/80 hover:bg-atlas-border text-atlas-text w-8 h-8 rounded flex items-center justify-center text-lg"
            title="Zoom Out (-)"
          >
            −
          </button>
          <button
            onClick={resetZoom}
            className="bg-atlas-surface/80 hover:bg-atlas-border text-atlas-text w-8 h-8 rounded flex items-center justify-center text-xs"
            title="Reset Zoom (0)"
          >
            1:1
          </button>
        </div>
      )}

      {/* Zoom level indicator */}
      {frequencyViewRange && zoomLevel > 1 && (
        <div className="absolute top-2 left-2 bg-atlas-surface/80 text-atlas-text text-xs px-2 py-1 rounded">
          {zoomLevel.toFixed(1)}x zoom
        </div>
      )}

      {/* Frequency scale */}
      {frequencyViewRange && (
        <div className="absolute bottom-0 left-0 right-0 h-5 bg-atlas-surface/80 flex justify-between px-2 text-xs text-atlas-text">
          <span>{formatFrequency(frequencyViewRange.minHz)}</span>
          <span>{formatFrequency((frequencyViewRange.minHz + frequencyViewRange.maxHz) / 2)}</span>
          <span>{formatFrequency(frequencyViewRange.maxHz)}</span>
        </div>
      )}

      {/* Placeholder message if no station selected */}
      {!frequencyViewRange && (
        <div className="absolute inset-0 flex items-center justify-center bg-atlas-bg/80">
          <p className="text-atlas-text text-center">
            Select a station to view waterfall
            <br />
            <span className="text-sm opacity-50">
              (MVP: Using test noise generator)
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
