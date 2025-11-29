import { useState, useCallback, useEffect } from 'react';
import { useAppStore } from '@/store';
import { formatFrequency, PROGRAM_COLORS, generateId } from '@websdr-atlas/shared';
import type { SavedProgram } from '@websdr-atlas/shared';

export function SavedProgramsList() {
  const programs = useAppStore((state) => state.programs);
  const selectedStation = useAppStore((state) => state.selectedStation);
  const selectedFrequencyHz = useAppStore((state) => state.selectedFrequencyHz);
  const setSelectedFrequency = useAppStore((state) => state.setSelectedFrequency);
  const addProgram = useAppStore((state) => state.addProgram);
  const deleteProgram = useAppStore((state) => state.deleteProgram);
  const isSaveDialogOpen = useAppStore((state) => state.isSaveDialogOpen);
  const setIsSaveDialogOpen = useAppStore((state) => state.setIsSaveDialogOpen);

  const [newProgramName, setNewProgramName] = useState('');
  const [newProgramColor, setNewProgramColor] = useState<string>(PROGRAM_COLORS[0]);

  // Reset form when dialog opens
  useEffect(() => {
    if (isSaveDialogOpen) {
      setNewProgramName('');
      setNewProgramColor(PROGRAM_COLORS[0]);
    }
  }, [isSaveDialogOpen]);

  const handleSaveProgram = useCallback(() => {
    if (!selectedStation || !selectedFrequencyHz || !newProgramName.trim()) return;

    const program: SavedProgram = {
      id: generateId(),
      stationId: selectedStation.id,
      frequencyHz: selectedFrequencyHz,
      name: newProgramName.trim(),
      colorHex: newProgramColor,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addProgram(program);
    setNewProgramName('');
    setIsSaveDialogOpen(false);
  }, [selectedStation, selectedFrequencyHz, newProgramName, newProgramColor, addProgram, setIsSaveDialogOpen]);

  // Filter programs for current station
  const currentStationPrograms = selectedStation
    ? programs.filter((p) => p.stationId === selectedStation.id)
    : [];

  return (
    <div className="bg-atlas-surface rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-atlas-text">Saved Programs</h3>
        <button
          onClick={() => setIsSaveDialogOpen(true)}
          disabled={!selectedStation || !selectedFrequencyHz}
          className="bg-atlas-accent hover:bg-atlas-accent-hover disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded text-white text-sm transition-colors"
        >
          + Save Current
        </button>
      </div>

      {currentStationPrograms.length === 0 ? (
        <p className="text-sm text-atlas-text opacity-50">
          {selectedStation
            ? 'No saved programs for this station'
            : 'Select a station to view saved programs'}
        </p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-auto">
          {currentStationPrograms.map((program) => (
            <div
              key={program.id}
              className="flex items-center justify-between p-2 bg-atlas-border/50 rounded cursor-pointer hover:bg-atlas-border"
              onClick={() => setSelectedFrequency(program.frequencyHz)}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: program.colorHex }}
                />
                <span className="text-atlas-text">{program.name}</span>
                <span className="text-xs text-atlas-text opacity-50">
                  {formatFrequency(program.frequencyHz)}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteProgram(program.id);
                }}
                className="text-red-400 hover:text-red-300 text-xs"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Save Program Dialog */}
      {isSaveDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-atlas-surface rounded-lg p-6 w-96">
            <h3 className="text-xl font-bold text-atlas-text mb-4">Save Program</h3>

            <div className="mb-4">
              <label className="block text-sm text-atlas-text mb-1">Name</label>
              <input
                type="text"
                value={newProgramName}
                onChange={(e) => setNewProgramName(e.target.value)}
                placeholder="e.g., 40m FT8 EU"
                className="w-full bg-atlas-bg border border-atlas-border rounded px-3 py-2 text-atlas-text"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newProgramName.trim()) {
                    handleSaveProgram();
                  } else if (e.key === 'Escape') {
                    setIsSaveDialogOpen(false);
                  }
                }}
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm text-atlas-text mb-1">Color</label>
              <div className="flex gap-2 flex-wrap">
                {PROGRAM_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewProgramColor(color)}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${
                      newProgramColor === color
                        ? 'border-white scale-110'
                        : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="mb-6 text-sm text-atlas-text opacity-75">
              Frequency: {selectedFrequencyHz ? formatFrequency(selectedFrequencyHz) : '--'}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsSaveDialogOpen(false)}
                className="px-4 py-2 rounded text-atlas-text hover:bg-atlas-border transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProgram}
                disabled={!newProgramName.trim()}
                className="bg-atlas-accent hover:bg-atlas-accent-hover disabled:opacity-50 px-4 py-2 rounded text-white transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
