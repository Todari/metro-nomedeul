import { css } from "../../styled-system/css";
import { ScrollPicker } from "./ScrollPicker";
import { HorizontalScrollPicker } from "./HorizontalScrollPicker";

interface MetronomeControlsProps {
  isPlaying: boolean;
  tempo: number;
  beats: number;
  onStart: () => void;
  onStop: () => void;
  onTempoChange: (tempo: number) => void;
  onBeatsChange: (beats: number) => void;
  onTapTempo: () => void;
  onClearTap: () => void;
  tapCount: number;
}

export function MetronomeControls(props: MetronomeControlsProps) {
  const { isPlaying, tempo, beats, onStart, onStop, onTempoChange, onBeatsChange, onTapTempo, onClearTap, tapCount } = props;

  return (
    <div className={css({ display: 'grid', gap: 6, p: 6, bg: 'neutral.800', rounded: 'xl', border: '1px solid', borderColor: 'neutral.700', shadow: 'lg' })}>
      <div className={css({ display: 'flex', gap: 3, flexWrap: 'wrap' })}>
        {!isPlaying ? (
          <button className={css({ px: 4, py: 3, rounded: 'lg', bg: 'orange.600', color: 'white', _hover: { bg: 'orange.700' }, _active: { bg: 'orange.800' }, fontWeight: 'medium' })} onClick={onStart}>시작</button>
        ) : (
          <button className={css({ px: 4, py: 3, rounded: 'lg', bg: 'red.600', color: 'white', _hover: { bg: 'red.700' }, _active: { bg: 'red.800' }, fontWeight: 'medium' })} onClick={onStop}>정지</button>
        )}
        <button 
          className={css({ 
            px: 4, 
            py: 3, 
            rounded: 'lg', 
            bg: 'neutral.600', 
            color: 'white', 
            _hover: { bg: 'neutral.700' }, 
            _active: { bg: 'neutral.800' },
            fontSize: 'sm',
            fontWeight: 'medium'
          })} 
          onClick={onTapTempo}
        >
          Tab ({tapCount})
        </button>
        {tapCount > 0 && (
          <button 
            className={css({ 
              px: 3, 
              py: 3, 
              rounded: 'lg', 
              bg: 'neutral.500', 
              color: 'white', 
              _hover: { bg: 'neutral.600' }, 
              _active: { bg: 'neutral.700' },
              fontSize: 'xs',
              fontWeight: 'medium'
            })} 
            onClick={onClearTap}
          >
            초기화
          </button>
        )}
      </div>
      <div>
        <label className={css({ fontWeight: 'medium', display: 'grid', gap: 3, color: 'white' })}>
          박자: {beats}
          <HorizontalScrollPicker
            min={2}
            max={8}
            value={beats}
            onChange={onBeatsChange}
            step={1}
            width={280}
            itemWidth={40}
            className={css({ 
              border: '1px solid', 
              borderColor: 'neutral.600', 
              borderRadius: 'lg',
              bg: 'neutral.700',
              w: 'full'
            })}
          />
        </label>
      </div>
      <div>
        <label className={css({ fontWeight: 'medium', display: 'grid', gap: 3, color: 'white' })}>
          BPM: {tempo}
          <ScrollPicker
            min={40}
            max={240}
            value={tempo}
            onChange={onTempoChange}
            step={1}
            height={280}
            itemHeight={40}
            className={css({ 
              border: '1px solid', 
              borderColor: 'neutral.600', 
              borderRadius: 'lg',
              bg: 'neutral.700'
            })}
          />
        </label>
      </div>
    </div>
  );
}