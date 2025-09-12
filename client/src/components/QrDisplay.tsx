import { useEffect, useMemo, useState } from 'react';
import { css } from "../../styled-system/css";
import QRCode from 'qrcode';

interface QrDisplayProps {
  uuid: string;
}

export function QrDisplay({ uuid }: QrDisplayProps) {
  const joinUrl = useMemo(() => new URL(`/room/${uuid}`, window.location.origin).toString(), [uuid]);
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    async function generate() {
      try {
        const url = await QRCode.toDataURL(joinUrl, { width: 300, margin: 1 });
        if (!cancelled) setDataUrl(url);
      } catch {
        if (!cancelled) setDataUrl('');
      }
    }
    generate();
    return () => { cancelled = true; };
  }, [joinUrl]);

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 })}>
      {dataUrl ? (
        <img className={css({ rounded: 'xl', border: '2px solid', borderColor: 'neutral.600', shadow: 'lg' })} src={dataUrl} width={240} height={240} alt="방 입장 QR" />
      ) : (
        <div className={css({ w: '240px', h: '240px', rounded: 'xl', border: '2px solid', borderColor: 'neutral.600', bg: 'neutral.700' })} />
      )}
      <div className={css({ fontSize: 'sm', wordBreak: 'break-all', color: 'neutral.300', textAlign: 'center' })}>{joinUrl}</div>
    </div>
  );
}


