#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

if [ ! -f .env.prod ]; then
  echo "ERROR: .env.prod 파일이 없습니다."
  echo "  cp .env.prod.example .env.prod  후 값을 수정하세요."
  exit 1
fi

source .env.prod

echo "=== 메트로놈들 배포 시작 ==="

echo "[1/4] Docker 이미지 빌드..."
docker compose -f docker-compose.prod.yml build

echo "[2/4] DB 시작 및 마이그레이션..."
docker compose -f docker-compose.prod.yml up -d db
sleep 5

docker compose -f docker-compose.prod.yml run --rm server \
  npx prisma migrate deploy --schema ./prisma/schema.prisma

echo "[3/4] 서비스 시작..."
docker compose -f docker-compose.prod.yml up -d

echo "[4/4] 상태 확인..."
sleep 3
docker compose -f docker-compose.prod.yml ps

# 헬스체크
echo ""
echo "헬스체크..."
for i in 1 2 3; do
  if curl -sf "http://localhost:3000/health" > /dev/null 2>&1; then
    echo "  서버 헬스체크 OK"
    break
  fi
  if [ "$i" -eq 3 ]; then
    echo "  WARNING: 헬스체크 실패. 로그 확인: docker compose -f docker-compose.prod.yml logs server"
  fi
  sleep 2
done

echo ""
echo "=== 배포 완료 ==="
echo "  API: https://${DOMAIN}"
echo "  Health: https://${DOMAIN}/health"
