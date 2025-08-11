interface MetronomeControlsProps {
  isPlaying: boolean;
  tempo: number;
  beats: number;
  onStart: () => void;
  onStop: () => void;
  onTempoChange: (tempo: number) => void;
  onBeatsChange: (beats: number) => void;
}

export function MetronomeControls(props: MetronomeControlsProps) {
  const { isPlaying, tempo, beats, onStart, onStop, onTempoChange, onBeatsChange } = props;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {!isPlaying ? (
          <button onClick={onStart}>시작</button>
        ) : (
          <button onClick={onStop}>정지</button>
        )}
      </div>
      <div>
        <label>
          BPM: {tempo}
          <input
            aria-label="BPM"
            type="range"
            min={40}
            max={240}
            value={tempo}
            onChange={(e) => onTempoChange(Number(e.target.value))}
          />
        </label>
      </div>
      <div>
        <label>
          박자:
          <select aria-label="Beats" value={beats} onChange={(e) => onBeatsChange(Number(e.target.value))}>
            {Array.from({ length: 6 }, (_, i) => i + 2).map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}


