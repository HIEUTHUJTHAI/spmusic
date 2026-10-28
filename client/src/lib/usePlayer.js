import { useEffect, useRef, useState } from 'react';
import { DEFAULT_AUDIO_SETTINGS, EQ_FREQUENCIES, EQ_PRESETS, readAudioSettings } from './audioSettings';

export function usePlayer(tracks, onListen, notify) {
  const first = useRef(null);
  const second = useRef(null);
  const media = [first, second];
  const graph = useRef(null);
  const active = useRef(0);
  const fading = useRef(null);
  const wantPlay = useRef(false);
  const listened = useRef(null);
  const listen = useRef(onListen);
  const notice = useRef(notify);
  listen.current = onListen;
  notice.current = notify;

  const [sources, setSources] = useState([null, null]);
  const [trackId, setTrackId] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.75);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('off');
  const [queue, setQueue] = useState([]);
  const [settings, setSettings] = useState(readAudioSettings);
  const track = tracks.find((item) => item.id === trackId) || null;
  const ids = (queue.length ? queue : tracks.map((item) => item.id))
    .filter((id) => tracks.some((item) => item.id === id));

  function ensureGraph() {
    if (graph.current) return graph.current;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext || !media.every((item) => item.current)) return null;
    let context;
    try {
      context = new AudioContext();
      const analysers = media.map(() => context.createAnalyser());
      const gains = media.map(() => context.createGain());
      const filters = EQ_FREQUENCIES.map((frequency, index) => {
        const filter = context.createBiquadFilter();
        filter.type = index === 0 ? 'lowshelf' : index === 4 ? 'highshelf' : 'peaking';
        filter.frequency.value = frequency;
        if (filter.type === 'peaking') filter.Q.value = 1;
        return filter;
      });
      const preamp = context.createGain();
      const master = context.createGain();
      media.forEach((item, slot) => {
        analysers[slot].fftSize = 512;
        context.createMediaElementSource(item.current).connect(analysers[slot]);
        analysers[slot].connect(gains[slot]);
        gains[slot].connect(filters[0]);
        item.current.volume = 1;
      });
      filters.forEach((filter, index) => filter.connect(filters[index + 1] || preamp));
      preamp.connect(master).connect(context.destination);
      gains.forEach((gain, slot) => { gain.gain.value = slot === active.current ? 1 : 0; });
      master.gain.value = volume;
      graph.current = { context, analysers, gains, filters, preamp, master };
      return graph.current;
    } catch {
      context?.close().catch(() => {});
      notice.current('Thiết bị này chưa hỗ trợ xử lý âm thanh nâng cao.');
      return null;
    }
  }

  function applyEq(value = settings) {
    if (!graph.current) return;
    const bands = value.eqEnabled ? value.eqBands : DEFAULT_AUDIO_SETTINGS.eqBands;
    graph.current.filters.forEach((filter, index) => {
      filter.gain.setTargetAtTime(bands[index], graph.current.context.currentTime, 0.015);
    });
    const boost = Math.max(0, ...bands);
    graph.current.preamp.gain.setTargetAtTime(
      boost ? 0.9 * 10 ** (-boost / 20) : 1, graph.current.context.currentTime, 0.015);
  }

  function resumeGraph() {
    if (settings.eqEnabled || settings.automix)
      ensureGraph()?.context.resume().catch(() => {});
  }

  function cancelFade() {
    const state = fading.current;
    if (!state) return;
    clearTimeout(state.timer);
    fading.current = null;
    const discard = state.started ? state.from : state.to;
    media[discard].current?.pause();
    if (graph.current) {
      const { context, gains } = graph.current;
      gains.forEach((gain, slot) => {
        gain.gain.cancelScheduledValues(context.currentTime);
        gain.gain.value = slot === active.current ? 1 : 0;
      });
    }
    setSources((current) => current.map((id, slot) => slot === discard ? null : id));
  }

  function findNext(manual) {
    if (!ids.length) return null;
    if (!manual && repeat === 'one') return trackId;
    if (shuffle && ids.length > 1) {
      const candidates = ids.filter((id) => id !== trackId);
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
    const index = ids.indexOf(trackId);
    return ids[index + 1] || (manual || repeat === 'all' ? ids[0] : null);
  }

  function switchTo(id) {
    if (!id) return;
    resumeGraph();
    cancelFade();
    wantPlay.current = true;
    setTime(0);
    setDuration(0);
    if (id === trackId) {
      const el = media[active.current].current;
      if (el) {
        el.currentTime = 0;
        el.play().catch(() => notice.current('Không thể phát file này.'));
      }
      return;
    }
    setSources((current) => current.map((value, slot) => slot === active.current ? id : value));
    setTrackId(id);
  }

  function startMix(id, seconds) {
    if (!id || id === trackId || fading.current || !playing) return false;
    const current = ensureGraph();
    if (!current || media[active.current].current?.paused) return false;
    applyEq();
    current.context.resume().catch(() => {});
    const from = active.current;
    const to = 1 - from;
    fading.current = { from, to, id, seconds, started: false, timer: null };
    current.gains[to].gain.value = 0;
    setSources((value) => value.map((source, slot) => slot === to ? id : source));
    return true;
  }

  function finishMix(state) {
    if (fading.current !== state) return;
    media[state.from].current?.pause();
    graph.current.gains[state.from].gain.value = 0;
    graph.current.gains[state.to].gain.value = 1;
    fading.current = null;
    setSources((value) => value.map((source, slot) => slot === state.from ? null : source));
  }

  function beginFade(state) {
    if (fading.current !== state || state.started) return;
    state.started = true;
    const outgoingElement = media[state.from].current;
    if (Number.isFinite(outgoingElement?.duration))
      state.seconds = Math.min(state.seconds,
        Math.max(0.2, outgoingElement.duration - outgoingElement.currentTime - 0.1));
    const { context, gains } = graph.current;
    const now = context.currentTime;
    const steps = 32;
    const outgoing = Float32Array.from({ length: steps }, (_, index) =>
      Math.cos((index / (steps - 1)) * Math.PI / 2));
    const incoming = Float32Array.from({ length: steps }, (_, index) =>
      Math.sin((index / (steps - 1)) * Math.PI / 2));
    gains[state.from].gain.cancelScheduledValues(now);
    gains[state.to].gain.cancelScheduledValues(now);
    gains[state.from].gain.setValueCurveAtTime(outgoing, now, state.seconds);
    gains[state.to].gain.setValueCurveAtTime(incoming, now, state.seconds);
    active.current = state.to;
    setTrackId(state.id);
    setTime(0);
    const incomingDuration = media[state.to].current?.duration;
    setDuration(Number.isFinite(incomingDuration) ? incomingDuration : 0);
    state.timer = setTimeout(() => finishMix(state), state.seconds * 1000 + 100);
  }

  function play(item, list) {
    if (!item) return;
    resumeGraph();
    if (list?.length) setQueue(list.map((entry) => entry.id));
    wantPlay.current = true;
    if (item.id === trackId)
      media[active.current].current?.play().catch(() => notice.current('Không thể phát file nhạc này.'));
    else switchTo(item.id);
  }
  function toggle() {
    const el = media[active.current].current;
    if (!el || !track) return;
    resumeGraph();
    wantPlay.current = el.paused;
    if (el.paused) el.play().catch(() => notice.current('Không thể phát. Hãy kiểm tra file nhạc.'));
    else {
      cancelFade();
      el.pause();
    }
  }
  function seek(seconds) {
    const el = media[active.current].current;
    if (!el || !Number.isFinite(seconds)) return;
    cancelFade();
    el.currentTime = Math.min(Math.max(0, seconds), duration || track?.duration || 0);
    setTime(el.currentTime);
  }
  function next(manual = true) {
    const id = findNext(manual);
    if (!id) {
      wantPlay.current = false;
      setPlaying(false);
      return;
    }
    if (settings.automix && id !== trackId && startMix(id, manual ? 2 : 5)) return;
    switchTo(id);
  }
  function previous() {
    if (time > 3) return seek(0);
    const index = ids.indexOf(trackId);
    switchTo(ids[(index - 1 + ids.length) % ids.length] || trackId);
  }

  useEffect(() => {
    localStorage.setItem('spmusic-audio-settings', JSON.stringify(settings));
    if (settings.eqEnabled || settings.automix) ensureGraph();
    applyEq(settings);
  }, [settings]);
  useEffect(() => {
    const pending = fading.current;
    if (!pending || sources[pending.to] !== pending.id) return;
    const el = media[pending.to].current;
    el?.play().catch(() => {
      if (fading.current === pending) {
        cancelFade();
        notice.current('Không thể chuyển mượt sang bài tiếp theo.');
      }
    });
  }, [sources]);
  useEffect(() => {
    const el = media[active.current].current;
    if (track && el && wantPlay.current)
      el.play().catch(() => {
        setPlaying(false);
        notice.current('Trình duyệt chưa phát được file này. Bấm phát để thử lại.');
      });
  }, [trackId, track?.audioUrl]);
  useEffect(() => {
    if (graph.current) graph.current.master.gain.value = volume;
    else media.forEach((item) => { if (item.current) item.current.volume = volume; });
  }, [volume]);
  useEffect(() => {
    if (!track) {
      media.forEach((item) => item.current?.pause());
      wantPlay.current = false;
      setPlaying(false);
    }
  }, [track]);
  useEffect(() => () => {
    clearTimeout(fading.current?.timer);
    graph.current?.context.close().catch(() => {});
  }, []);

  function propsFor(slot) {
    const source = tracks.find((item) => item.id === sources[slot]);
    return {
      ref: media[slot],
      src: source?.audioUrl,
      preload: slot === active.current ? 'metadata' : 'auto',
      onTimeUpdate: (event) => {
        if (slot !== active.current) return;
        const el = event.currentTarget;
        setTime(el.currentTime);
        if (!settings.automix || fading.current || !playing || repeat === 'one' ||
          !Number.isFinite(el.duration) || el.duration < 12) return;
        const remaining = el.duration - el.currentTime;
        if (remaining > 9 || remaining <= 0) return;
        let quiet = false;
        const analyser = graph.current?.analysers[slot];
        if (analyser) {
          const samples = new Uint8Array(analyser.fftSize);
          analyser.getByteTimeDomainData(samples);
          const rms = Math.sqrt(samples.reduce((sum, sample) =>
            sum + ((sample - 128) / 128) ** 2, 0) / samples.length);
          quiet = rms < 0.025;
        }
        if (remaining <= 5 || quiet) {
          const id = findNext(false);
          if (id && id !== trackId) startMix(id, Math.min(5, Math.max(1, remaining - 0.2)));
        }
      },
      onLoadedMetadata: (event) => {
        if (slot === active.current)
          setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0);
      },
      onPlay: () => {
        resumeGraph();
        if (fading.current?.to === slot) beginFade(fading.current);
        if (slot !== active.current) return;
        setPlaying(true);
        const id = sources[slot];
        if (listened.current !== id) {
          listened.current = id;
          listen.current(tracks.find((item) => item.id === id));
        }
      },
      onPause: () => { if (slot === active.current) setPlaying(false); },
      onEnded: () => { if (slot === active.current) next(false); },
      onError: () => {
        if (fading.current?.to === slot && !fading.current.started) {
          cancelFade();
          return;
        }
        if (slot === active.current && source) {
          setPlaying(false);
          notice.current('Không thể đọc file nhạc. File có thể bị lỗi hoặc không còn tồn tại.');
        }
      },
    };
  }

  return {
    track, trackId, playing, time, duration: duration || track?.duration || 0,
    volume, setVolume, shuffle, setShuffle, repeat, setRepeat,
    automix: settings.automix,
    setAutomix: (enabled) => {
      if (enabled && !ensureGraph()) return;
      if (enabled) graph.current.context.resume().catch(() => {});
      setSettings((value) => ({ ...value, automix: Boolean(enabled) }));
    },
    eqEnabled: settings.eqEnabled,
    setEqEnabled: (enabled) => {
      if (enabled && !ensureGraph()) return;
      if (enabled) graph.current.context.resume().catch(() => {});
      setSettings((value) => ({ ...value, eqEnabled: Boolean(enabled) }));
    },
    eqBands: settings.eqBands,
    eqPreset: settings.eqPreset,
    setEqBand: (index, gain) => setSettings((value) => ({
      ...value, eqPreset: 'custom',
      eqBands: value.eqBands.map((old, position) => position === index ? Math.max(-12, Math.min(12, gain)) : old),
    })),
    setEqPreset: (preset) => {
      if (EQ_PRESETS[preset]) setSettings((value) => ({
        ...value, eqPreset: preset, eqBands: [...EQ_PRESETS[preset].bands],
      }));
    },
    queue: ids,
    setQueueOrder: (orderedIds, expectedIds) => setQueue((value) => {
      if (expectedIds && (value.length !== expectedIds.length ||
          value.some((id, index) => id !== expectedIds[index]))) return value;
      return orderedIds;
    }),
    play, toggle, seek, next, previous,
    audioProps: [propsFor(0), propsFor(1)],
    stop: () => {
      wantPlay.current = false;
      cancelFade();
      media.forEach((item) => item.current?.pause());
    },
  };
}
