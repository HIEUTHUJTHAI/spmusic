export const EQ_FREQUENCIES = [80, 250, 1000, 4000, 12000];
export const EQ_PRESETS = {
  flat: { label: 'Phẳng', bands: [0, 0, 0, 0, 0] },
  bass: { label: 'Bass', bands: [5, 3, 0, -1, 0] },
  vocal: { label: 'Giọng hát', bands: [-2, -1, 3, 2, 0] },
  bright: { label: 'Sáng', bands: [-1, 0, 0, 3, 4] },
};

export const DEFAULT_AUDIO_SETTINGS = {
  automix: true, eqEnabled: false, eqBands: [0, 0, 0, 0, 0], eqPreset: 'flat',
  outputDeviceId: '', outputDeviceLabel: 'Mặc định hệ thống', version: 1,
};

export function readAudioSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('spmusic-audio-settings') || '{}');
    return {
      // Earlier builds defaulted AutoMix off. Turn it on once after this update,
      // then respect a user's explicit choice on later launches.
      automix: Number(saved.version || 0) < 1 ? true : saved.automix !== false,
      eqEnabled: saved.eqEnabled === true,
      eqPreset: EQ_PRESETS[saved.eqPreset] || saved.eqPreset === 'custom' ? saved.eqPreset : 'flat',
      eqBands: Array.isArray(saved.eqBands) && saved.eqBands.length === 5
        ? saved.eqBands.map((value) => Number.isFinite(value) ? Math.max(-12, Math.min(12, value)) : 0)
        : [...DEFAULT_AUDIO_SETTINGS.eqBands],
      outputDeviceId: typeof saved.outputDeviceId === 'string' ? saved.outputDeviceId : '',
      outputDeviceLabel: typeof saved.outputDeviceLabel === 'string' && saved.outputDeviceLabel
        ? saved.outputDeviceLabel : DEFAULT_AUDIO_SETTINGS.outputDeviceLabel,
      version: 1,
    };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS, eqBands: [...DEFAULT_AUDIO_SETTINGS.eqBands] };
  }
}
