import './InstrumentalButton.css';

export default function InstrumentalButton({ p }) {
  const state = p.instrumental;
  const label = state.job?.text || (state.enabled ? 'Trở về nhạc gốc' : 'Tách nhạc nền bằng AI');
  return <span className="instrumental-control">
    <button type="button" className={`instrumental-button ${state.enabled ? 'is-on' : ''}`}
      disabled={!p.track || Boolean(state.job)} onClick={state.toggle}
      aria-label={label} title={label} aria-pressed={state.enabled} aria-busy={Boolean(state.job)}>
      <svg width="25" height="25" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="m11 21 11-14a4 4 0 0 1 6 5L15 24l-5 3 1-6Z M21 9l5 5 M10 26l-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m8 3 1.5 4.5L14 9l-4.5 1.5L8 15l-1.5-4.5L2 9l4.5-1.5L8 3Zm17 17 1.2 3.8L30 25l-3.8 1.2L25 30l-1.2-3.8L20 25l3.8-1.2L25 20Z" fill="currentColor" />
      </svg>
    </button>
    {state.job && <span className="instrumental-status" role="status">{state.job.text}</span>}
  </span>;
}
