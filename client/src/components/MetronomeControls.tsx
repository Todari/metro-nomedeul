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
    <div className={css({ display: 'grid', gap: 4, p: 4, bg: 'white', rounded: 'xl', border: '1px solid', borderColor: 'gray.300', shadow: 'sm' })}>
      <div className={css({ display: 'flex', gap: 2, flexWrap: 'wrap' })}>
        {!isPlaying ? (
          <button className={css({ px: 3, py: 2, rounded: 'md', bg: 'green.600', color: 'white', _hover: { bg: 'green.700' }, _active: { bg: 'green.800' } })} onClick={onStart}>시작</button>
        ) : (
          <button className={css({ px: 3, py: 2, rounded: 'md', bg: 'red.600', color: 'white', _hover: { bg: 'red.700' }, _active: { bg: 'red.800' } })} onClick={onStop}>정지</button>
        )}
        <button 
          className={css({ 
            px: 3, 
            py: 2, 
            rounded: 'md', 
            bg: 'blue.600', 
            color: 'white', 
            _hover: { bg: 'blue.700' }, 
            _active: { bg: 'blue.800' },
            fontSize: 'sm'
          })} 
          onClick={onTapTempo}
        >
          Tab ({tapCount})
        </button>
        {tapCount > 0 && (
          <button 
            className={css({ 
              px: 2, 
              py: 2, 
              rounded: 'md', 
              bg: 'gray.500', 
              color: 'white', 
              _hover: { bg: 'gray.600' }, 
              _active: { bg: 'gray.700' },
              fontSize: 'xs'
            })} 
            onClick={onClearTap}
          >
            초기화
          </button>
        )}
      </div>
      <div>
        <label className={css({ fontWeight: 'medium', display: 'grid', gap: 2 })}>
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
              borderColor: 'gray.200', 
              borderRadius: 'md',
              bg: 'gray.50'
            })}
          />
        </label>
      </div>
      <div>
        <label className={css({ fontWeight: 'medium', display: 'grid', gap: 2 })}>
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
              borderColor: 'gray.200', 
              borderRadius: 'md',
              bg: 'gray.50',
              w: 'full'
            })}
          />
        </label>
      </div>
    </div>
  );
}