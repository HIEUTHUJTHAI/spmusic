export const EQ_FREQUENCIES = [80, 250, 1000, 4000, 12000];
export const EQ_PRESETS = {
  flat: { label: 'Phẳng', bands: [0, 0, 0, 0, 0] },
  bass: { label: 'Bass', bands: [5, 3, 0, -1, 0] },
  vocal: { label: 'Giọng hát', bands: [-2, -1, 3, 2, 0] },
  bright: { label: 'Sáng', bands: [-1, 0, 0, 3, 4] },
};

export const DEFAULT_AUDIO_SETTINGS = {
  automix: false, eqEnabled: false, eqBands: [0, 0, 0, 0, 0], eqPreset: 'flat',
};

export function readAudioSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('spmusic-audio-settings') || '{}');
    return {
      automix: saved.automix === true,
      eqEnabled: saved.eqEnabled === true,
      eqPreset: EQ_PRESETS[saved.eqPreset] || saved.eqPreset === 'custom' ? saved.eqPreset : 'flat',
      eqBands: Array.isArray(saved.eqBands) && saved.eqBands.length === 5
        ? saved.eqBands.map((value) => Number.isFinite(value) ? Math.max(-12, Math.min(12, value)) : 0)
        : [...DEFAULT_AUDIO_SETTINGS.eqBands],
    };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS, eqBands: [...DEFAULT_AUDIO_SETTINGS.eqBands] };
  }
}
