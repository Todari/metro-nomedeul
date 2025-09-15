import { css } from "../../styled-system/css";
import { Button } from "./Button";
import { QrDisplay } from "./QrDisplay";

interface ShareBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  uuid?: string;
  onCopied?: () => void;
}

export function ShareBottomSheet(props: ShareBottomSheetProps) {
  const { isOpen, onClose, uuid, onCopied } = props;
  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      onCopied?.();
    } catch {
      onCopied?.();
    }
  };

  return (
    <div>
      {/* overlay */}
      <div className={css({ position: 'fixed', inset: 0, bg: 'black/60', zIndex: 40 })} onClick={onClose} />
      {/* sheet */}
      <div className={css({ position: 'fixed', insetX: 0, bottom: 0, bg: 'neutral.800', borderTop: '1px solid', borderColor: 'neutral.700', roundedTop: '2xl', p: 6, zIndex: 50 })}>
        {/* header */}
        <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 })}>
          <div className={css({ fontWeight: 'bold', color: 'white', fontSize: 'lg' })}>공유</div>
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

        {uuid && (
          <div className={css({ display: 'flex', justifyContent: 'center', mb: 4 })}>
            <QrDisplay uuid={uuid} />
          </div>
        )}

        <div className={css({ display: 'flex', justifyContent: 'center' })}>
          <button
            className={css({ px: 4, py: 3, rounded: 'lg', bg: 'neutral.600', color: 'white', _hover: { bg: 'neutral.700' }, _active: { bg: 'neutral.800' } })}
            onClick={handleCopy}
          >
            링크 복사하기
          </button>
        </div>
      </div>
    </div>
  );
}


