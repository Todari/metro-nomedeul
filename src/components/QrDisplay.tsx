import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { http } from '../utils/http';
import { CONFIG } from '../apis/config';

interface QrResponse {
  joinUrl: string;
}

interface QrDisplayProps {
  uuid: string;
}

export function QrDisplay({ uuid }: QrDisplayProps) {
  const url = useMemo(() => `${CONFIG.API_URL}/room/${uuid}/qr`, [uuid]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['room', uuid, 'qr'],
    queryFn: async () => await http.get<QrResponse>(url),
    staleTime: 60_000,
  });

  const joinUrl = data?.joinUrl ?? '';

  // Google Chart API로 간단히 QR 이미지 생성 (의존성 최소화)
  const qrImgSrc = useMemo(() => {
    if (!joinUrl) return '';
    const encoded = encodeURIComponent(joinUrl);
    return `https://chart.googleapis.com/chart?cht=qr&chs=300x300&chld=L|0&chl=${encoded}`;
  }, [joinUrl]);

  useEffect(() => {
    // no-op: 추후 클라이언트 사이드 QR 렌더러로 대체 가능
  }, [joinUrl]);

  if (isLoading) return <div>QR 로딩 중…</div>;
  if (isError || !joinUrl) return <div>QR 로드 실패</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <img src={qrImgSrc} width={240} height={240} alt="방 입장 QR" />
      <div style={{ fontSize: 12, wordBreak: 'break-all' }}>{joinUrl}</div>
    </div>
  );
}


