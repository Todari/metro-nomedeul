import { css } from "../../styled-system/css";
import { ScrollPicker } from "./ScrollPicker";
import { HorizontalScrollPicker } from "./HorizontalScrollPicker";
import { Button } from "./Button";

interface SettingsBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  tempo: number;
  beats: number;
  isPlaying: boolean;
  onTempoChange: (tempo: number) => void;
  onBeatsChange: (beats: number) => void;
  onTapTempo: () => void;
  onStopForSettings?: () => void;
}

export function SettingsBottomSheet(props: SettingsBottomSheetProps) {
  const { 
    isOpen, 
    onClose, 
    tempo, 
    beats, 
    isPlaying,
    onTempoChange, 
    onBeatsChange, 
    onTapTempo, 
    onStopForSettings
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
          <Button
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
          </Button>
        </div>

        {/* 재생 중 경고 메시지 */}
        {isPlaying && (
          <div className={css({
            p: 4,
            bg: 'orange.900',
            border: '1px solid',
            borderColor: 'orange.700',
            rounded: 'lg',
            mb: 4
          })}>
            <div className={css({
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              mb: 3
            })}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 9V13M12 17H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div className={css({
                fontWeight: 'medium',
                color: 'orange.200'
              })}>
                재생 중에는 설정을 변경할 수 없습니다
              </div>
            </div>
            <div className={css({
              fontSize: 'sm',
              color: 'orange.300',
              mb: 3
            })}>
              설정을 변경하려면 메트로놈을 정지해주세요.
            </div>
            {onStopForSettings && (
              <Button
                className={css({
                  px: 4,
                  py: 2,
                  rounded: 'lg',
                  bg: 'orange.600',
                  color: 'white',
                  _hover: { bg: 'orange.700' },
                  _active: { bg: 'orange.800' }
                })}
                onClick={() => {
                  onStopForSettings();
                  onClose();
                }}
              >
                메트로놈 정지하고 설정 변경
              </Button>
            )}
          </div>
        )}

        {/* 설정 컨트롤들 */}
        <div className={css({ 
          display: 'grid', 
          gap: 6,
          opacity: isPlaying ? 0.5 : 1,
          pointerEvents: isPlaying ? 'none' : 'auto'
        })}>

          {/* 탭 템포 버튼들 */}
          <div className={css({ display: 'flex', gap: 3, flexWrap: 'wrap' })}>
            <Button 
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
              Tab
            </Button>
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
