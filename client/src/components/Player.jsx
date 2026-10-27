import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Mic2,
  ListMusic,
  Heart,
  Music2,
} from 'lucide-react';
export const formatTime = (n) =>
  Number.isFinite(n)
    ? `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`
    : '0:00';
export default function Player({ p, onLyrics, lyricsOpen, onQueue, queueOpen, liked, onLike }) {
  return (
    <footer className="player" aria-label="Trình phát nhạc">
      <div className="now-playing">
        {p.track ? (
          <img src={p.track.coverUrl || '/covers/demo-blue.svg'} alt="" />
        ) : (
          <span className="empty-cover">
            <Music2 />
          </span>
        )}
        <div>
          <strong>{p.track?.title || 'Chọn một bài hát'}</strong>
          <span>{p.track?.artist || 'Không gian âm nhạc của bạn'}</span>
          {p.track?.isLossless && (
            <small
              className="lossless-badge"
              title={`${p.track.audioFormat} · ${p.track.bitDepth || '?'} bit · ${p.track.sampleRate / 1000} kHz`}
            >
              Lossless · {p.track.audioFormat}
            </small>
          )}
        </div>
        <button
          className={`icon-btn like-button ${liked ? 'is-on' : ''}`}
          onClick={onLike}
          disabled={!p.track}
          title="Yêu thích"
          aria-label="Yêu thích"
          aria-pressed={liked}
        >
          <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="playback">
        <div className="playback-buttons">
          <button
            className={`icon-btn ${p.shuffle ? 'is-on' : ''}`}
            onClick={() => p.setShuffle(!p.shuffle)}
            aria-label="Phát ngẫu nhiên"
            aria-pressed={p.shuffle}
          >
            <Shuffle size={17} />
          </button>
          <button
            className="icon-btn"
            onClick={p.previous}
            disabled={!p.track}
            aria-label="Bài trước"
          >
            <SkipBack size={19} fill="currentColor" />
          </button>
          <button
            className="main-play"
            onClick={p.toggle}
            disabled={!p.track}
            aria-label={p.playing ? 'Tạm dừng' : 'Phát nhạc'}
          >
            {p.playing ? (
              <Pause size={20} fill="currentColor" />
            ) : (
              <Play size={20} fill="currentColor" />
            )}
          </button>
          <button
            className="icon-btn"
            onClick={() => p.next()}
            disabled={!p.track}
            aria-label="Bài tiếp theo"
          >
            <SkipForward size={19} fill="currentColor" />
          </button>
          <button
            className={`icon-btn ${p.repeat !== 'off' ? 'is-on' : ''}`}
            onClick={() =>
              p.setRepeat(p.repeat === 'off' ? 'all' : p.repeat === 'all' ? 'one' : 'off')
            }
            aria-label={`Lặp lại: ${p.repeat === 'off' ? 'tắt' : p.repeat === 'one' ? 'một bài' : 'tất cả'}`}
            title="Đổi chế độ lặp lại"
          >
            {p.repeat === 'one' ? <Repeat1 size={17} /> : <Repeat size={17} />}
          </button>
        </div>
        <div className="progress">
          <span>{formatTime(p.time)}</span>
          <input
            aria-label="Tua nhạc"
            type="range"
            min="0"
            max={p.duration || 1}
            step="0.1"
            value={Math.min(p.time, p.duration || 1)}
            onChange={(e) => p.seek(Number(e.target.value))}
            style={{ '--range': `${p.duration ? (p.time / p.duration) * 100 : 0}%` }}
          />
          <span>{formatTime(p.duration)}</span>
        </div>
      </div>
      <div className="player-tools">
        <button
          className={`icon-btn ${lyricsOpen ? 'is-on' : ''}`}
          onClick={onLyrics}
          aria-label="Lời bài hát"
          title="Lời bài hát"
        >
          <Mic2 size={18} />
        </button>
        <button
          className={`icon-btn ${queueOpen ? 'is-on' : ''}`}
          onClick={onQueue}
          aria-label="Danh sách phát"
          title="Danh sách phát"
        >
          <ListMusic size={19} />
        </button>
        <span className="tool-separator" />
        <button
          className="icon-btn volume-icon"
          onClick={() => p.setVolume(p.volume ? 0 : 0.75)}
          aria-label={p.volume ? 'Tắt tiếng' : 'Bật tiếng'}
        >
          {p.volume ? <Volume2 size={19} /> : <VolumeX size={19} />}
        </button>
        <input
          className="volume"
          aria-label="Âm lượng"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={p.volume}
          onChange={(e) => p.setVolume(Number(e.target.value))}
          style={{ '--range': `${p.volume * 100}%` }}
        />
      </div>
    </footer>
  );
}
