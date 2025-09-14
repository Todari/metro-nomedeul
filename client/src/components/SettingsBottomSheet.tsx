import { css } from "../../styled-system/css";
import { ScrollPicker } from "./ScrollPicker";
import { HorizontalScrollPicker } from "./HorizontalScrollPicker";

interface SettingsBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  tempo: number;
  beats: number;
  onTempoChange: (tempo: number) => void;
  onBeatsChange: (beats: number) => void;
  onTapTempo: () => void;
  onClearTap: () => void;
  tapCount: number;
}

export function SettingsBottomSheet(props: SettingsBottomSheetProps) {
  const { 
    isOpen, 
    onClose, 
    tempo, 
    beats, 
    onTempoChange, 
    onBeatsChange, 
    onTapTempo, 
    onClearTap, 
    tapCount 
  } = props;

  if (!isOpen) return null;

  return (
    <>
      {/* 오버레이 */}
      <div 
        className={css({
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          bg: 'black',
          opacity: 0.5,
          zIndex: 40
        })}
        onClick={onClose}
      />
      
      {/* 바텀시트 */}
      <div className={css({
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        bg: 'neutral.800',
        borderTop: '1px solid',
        borderColor: 'neutral.700',
        roundedTop: '2xl',
        p: 6,
        zIndex: 50,
        maxH: '80vh',
        overflow: 'auto'
      })}>
        {/* 헤더 */}
        <div className={css({ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          mb: 6
        })}>
          <h2 className={css({ 
            fontSize: 'xl', 
            fontWeight: 'bold', 
            color: 'white' 
          })}>
            메트로놈 설정
          </h2>
          <button
            className={css({
              p: 2,
              rounded: 'lg',
              bg: 'neutral.700',
              color: 'white',
              _hover: { bg: 'neutral.600' },
              _active: { bg: 'neutral.500' }
            })}
            onClick={onClose}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* 설정 컨트롤들 */}
        <div className={css({ display: 'grid', gap: 6 })}>
          {/* 탭 템포 버튼들 */}
          <div className={css({ display: 'flex', gap: 3, flexWrap: 'wrap' })}>
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
              탭 템포 ({tapCount})
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

          {/* 박자 설정 */}
          <div>
            <label className={css({ 
              fontWeight: 'medium', 
              display: 'grid', 
              gap: 3, 
              color: 'white',
              mb: 2
            })}>
              박자: {beats}
            </label>
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
          </div>

          {/* BPM 설정 */}
          <div>
            <label className={css({ 
              fontWeight: 'medium', 
              display: 'grid', 
              gap: 3, 
              color: 'white',
              mb: 2
            })}>
              BPM: {tempo}
            </label>
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
          </div>
        </div>
      </div>
    </>
  );
}
