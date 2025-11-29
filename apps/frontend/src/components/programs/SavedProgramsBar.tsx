import { useAppStore } from '@/store';
import { formatFrequency } from '@websdr-atlas/shared';

export function SavedProgramsBar() {
  const programs = useAppStore((state) => state.programs);
  const selectedStation = useAppStore((state) => state.selectedStation);
  const frequencyViewRange = useAppStore((state) => state.frequencyViewRange);
  const setSelectedFrequency = useAppStore((state) => state.setSelectedFrequency);

  if (!selectedStation || !frequencyViewRange) return null;

  // Filter programs for current station and visible range
  const visiblePrograms = programs.filter(
    (p) =>
      p.stationId === selectedStation.id &&
      p.frequencyHz >= frequencyViewRange.minHz &&
      p.frequencyHz <= frequencyViewRange.maxHz
  );

  if (visiblePrograms.length === 0) return null;

  const freqRange = frequencyViewRange.maxHz - frequencyViewRange.minHz;

  return (
    <div className="h-8 bg-atlas-surface relative overflow-hidden">
      {visiblePrograms.map((program) => {
        const position = ((program.frequencyHz - frequencyViewRange.minHz) / freqRange) * 100;

        return (
          <div
            key={program.id}
            className="absolute top-0 transform -translate-x-1/2 cursor-pointer group"
            style={{ left: `${position}%` }}
            onClick={() => setSelectedFrequency(program.frequencyHz)}
          >
            <div
              className="w-3 h-3 rounded-full border-2 border-white shadow"
              style={{ backgroundColor: program.colorHex }}
            />
            <div className="w-0.5 h-4 mx-auto" style={{ backgroundColor: program.colorHex }} />

            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <div className="bg-atlas-bg border border-atlas-border rounded px-2 py-1 text-xs text-atlas-text whitespace-nowrap">
                {program.name}
                <br />
                <span className="opacity-75">{formatFrequency(program.frequencyHz)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
