import { useCallback, useEffect, useRef, useState } from 'react';
export function usePlayer(tracks, onListen, notify) {
  const audio = useRef(null),
    wantPlay = useRef(false),
    listen = useRef(onListen),
    notice = useRef(notify),
    registered = useRef(null);
  listen.current = onListen;
  notice.current = notify;
  const [trackId, setTrackId] = useState(null),
    [playing, setPlaying] = useState(false),
    [time, setTime] = useState(0),
    [duration, setDuration] = useState(0),
    [volume, setVolume] = useState(0.75),
    [shuffle, setShuffle] = useState(false),
    [repeat, setRepeat] = useState('off'),
    [queue, setQueue] = useState([]);
  const track = tracks.find((t) => t.id === trackId) || null;
  const ids = (queue.length ? queue : tracks.map((t) => t.id)).filter((id) =>
    tracks.some((t) => t.id === id),
  );
  const play = useCallback(
    (t, list) => {
      if (!t) return;
      wantPlay.current = true;
      if (list?.length) setQueue(list.map((x) => x.id));
      if (t.id === trackId) {
        audio.current?.play().catch(() => notice.current('Không thể phát file nhạc này.'));
      } else setTrackId(t.id);
    },
    [trackId],
  );
  const toggle = () => {
    const el = audio.current;
    if (!el || !track) return;
    wantPlay.current = el.paused;
    if (el.paused) el.play().catch(() => notice.current('Không thể phát. Hãy kiểm tra file nhạc.'));
    else el.pause();
  };
  const seek = (seconds) => {
    if (audio.current && Number.isFinite(seconds)) {
      audio.current.currentTime = Math.min(Math.max(0, seconds), duration || track?.duration || 0);
      setTime(audio.current.currentTime);
    }
  };
  function next(manual = true) {
    if (!ids.length) return;
    const i = ids.indexOf(trackId);
    if (!manual && repeat === 'one') {
      seek(0);
      audio.current?.play().catch(() => notice.current('Không thể phát file này.'));
      return;
    }
    let id;
    if (shuffle && ids.length > 1) {
      const pool = ids.filter((x) => x !== trackId);
      id = pool[Math.floor(Math.random() * pool.length)];
    } else {
      id = ids[i + 1];
      if (!id && (manual || repeat === 'all')) id = ids[0];
    }
    if (!id) {
      wantPlay.current = false;
      setPlaying(false);
      return;
    }
    if (id === trackId) {
      seek(0);
      audio.current?.play().catch(() => notice.current('Không thể phát file này.'));
    } else {
      wantPlay.current = true;
      setTrackId(id);
    }
  }
  const previous = () => {
    if (time > 3) {
      seek(0);
      return;
    }
    const i = ids.indexOf(trackId);
    wantPlay.current = true;
    const id = ids[(i - 1 + ids.length) % ids.length] || trackId;
    if (id === trackId) {
      seek(0);
      audio.current?.play().catch(() => notice.current('Không thể phát file này.'));
    } else setTrackId(id);
  };
  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    registered.current = null;
    setTime(0);
    setDuration(0);
    if (track && wantPlay.current)
      el.play().catch(() => {
        setPlaying(false);
        notice.current('Trình duyệt chưa phát được file này. Bấm phát để thử lại.');
      });
  }, [track?.id, track?.audioUrl]);
  useEffect(() => {
    if (audio.current) audio.current.volume = volume;
  }, [volume]);
  useEffect(() => {
    if (!track && audio.current) {
      audio.current.pause();
      wantPlay.current = false;
      setPlaying(false);
    }
  }, [track]);
  const audioProps = {
    ref: audio,
    src: track?.audioUrl,
    preload: 'metadata',
    onTimeUpdate: (e) => setTime(e.currentTarget.currentTime),
    onLoadedMetadata: (e) =>
      setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0),
    onPlay: () => {
      setPlaying(true);
      if (registered.current !== trackId) {
        registered.current = trackId;
        listen.current(track);
      }
    },
    onPause: () => setPlaying(false),
    onEnded: () => next(false),
    onError: () => {
      if (track) {
        setPlaying(false);
        notice.current('Không thể đọc file nhạc. File có thể bị lỗi hoặc không còn tồn tại.');
      }
    },
  };
  return {
    track,
    trackId,
    playing,
    time,
    duration: duration || track?.duration || 0,
    volume,
    setVolume,
    shuffle,
    setShuffle,
    repeat,
    setRepeat,
    queue: ids,
    play,
    toggle,
    seek,
    next,
    previous,
    audioProps,
    stop: () => {
      wantPlay.current = false;
      audio.current?.pause();
    },
  };
}
