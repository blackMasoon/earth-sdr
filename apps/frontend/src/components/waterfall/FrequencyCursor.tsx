import { useCallback, useEffect } from 'react';
import { useAppStore } from '@/store';
import { formatFrequency, FREQUENCY_STEPS } from '@websdr-atlas/shared';

export function FrequencyCursor() {
  const frequencyViewRange = useAppStore((state) => state.frequencyViewRange);
  const selectedFrequencyHz = useAppStore((state) => state.selectedFrequencyHz);
  const setSelectedFrequency = useAppStore((state) => state.setSelectedFrequency);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!frequencyViewRange || !selectedFrequencyHz) return;

      let step = FREQUENCY_STEPS.normal;
      if (e.shiftKey) {
        step = FREQUENCY_STEPS.coarse;
      }

      let newFreq = selectedFrequencyHz;

      switch (e.key) {
        case 'ArrowLeft':
          newFreq -= step;
          e.preventDefault();
          break;
        case 'ArrowRight':
          newFreq += step;
          e.preventDefault();
          break;
        default:
          return;
      }

      // Clamp to range
      newFreq = Math.max(frequencyViewRange.minHz, Math.min(frequencyViewRange.maxHz, newFreq));
      setSelectedFrequency(newFreq);
    },
    [frequencyViewRange, selectedFrequencyHz, setSelectedFrequency]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!frequencyViewRange) return null;

  return (
    <div className="bg-atlas-surface rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-atlas-text opacity-75">
            Current Frequency
          </h3>
          <p className="text-2xl font-mono text-atlas-text">
            {selectedFrequencyHz
              ? formatFrequency(selectedFrequencyHz)
              : '-- MHz'}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              if (selectedFrequencyHz) {
                setSelectedFrequency(selectedFrequencyHz - FREQUENCY_STEPS.coarse);
              }
            }}
            className="bg-atlas-border hover:bg-atlas-accent px-3 py-1 rounded text-atlas-text transition-colors"
            disabled={!selectedFrequencyHz}
          >
            ◀◀
          </button>
          <button
            onClick={() => {
              if (selectedFrequencyHz) {
                setSelectedFrequency(selectedFrequencyHz - FREQUENCY_STEPS.normal);
              }
            }}
            className="bg-atlas-border hover:bg-atlas-accent px-3 py-1 rounded text-atlas-text transition-colors"
            disabled={!selectedFrequencyHz}
          >
            ◀
          </button>
          <button
            onClick={() => {
              if (selectedFrequencyHz) {
                setSelectedFrequency(selectedFrequencyHz + FREQUENCY_STEPS.normal);
              }
            }}
            className="bg-atlas-border hover:bg-atlas-accent px-3 py-1 rounded text-atlas-text transition-colors"
            disabled={!selectedFrequencyHz}
          >
            ▶
          </button>
          <button
            onClick={() => {
              if (selectedFrequencyHz) {
                setSelectedFrequency(selectedFrequencyHz + FREQUENCY_STEPS.coarse);
              }
            }}
            className="bg-atlas-border hover:bg-atlas-accent px-3 py-1 rounded text-atlas-text transition-colors"
            disabled={!selectedFrequencyHz}
          >
            ▶▶
          </button>
        </div>
      </div>

      <div className="mt-2 text-xs text-atlas-text opacity-50">
        <p>
          Range: {formatFrequency(frequencyViewRange.minHz)} -{' '}
          {formatFrequency(frequencyViewRange.maxHz)}
        </p>
        <p>Use ← → keys to tune (Shift for larger steps)</p>
      </div>
    </div>
  );
}
