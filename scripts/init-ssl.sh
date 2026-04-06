#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

if [ ! -f .env.prod ]; then
  echo "ERROR: .env.prod 파일이 없습니다."
  exit 1
fi

source .env.prod

DOMAIN="${DOMAIN:?DOMAIN 환경변수를 설정하세요}"
EMAIL="${CERTBOT_EMAIL:?CERTBOT_EMAIL 환경변수를 설정하세요}"

echo "=== SSL 인증서 발급 (Let's Encrypt) ==="
echo "도메인: $DOMAIN"
echo "이메일: $EMAIL"
echo ""

echo "[1/4] 초기 Nginx 설정 적용 (HTTP only)..."
cp nginx/nginx.init.conf nginx/nginx.conf.bak
cp nginx/nginx.init.conf nginx/nginx.conf

echo "[2/4] 서비스 시작 (HTTP mode)..."
docker compose -f docker-compose.prod.yml up -d db
sleep 5
docker compose -f docker-compose.prod.yml up -d nginx server

echo "[3/4] Certbot으로 인증서 발급..."
sleep 3
docker compose -f docker-compose.prod.yml run --rm certbot \
  certonly --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

echo "[4/4] HTTPS Nginx 설정으로 전환..."
mv nginx/nginx.conf.bak nginx/nginx.conf
docker compose -f docker-compose.prod.yml restart nginx

echo ""
echo "=== SSL 설정 완료 ==="
echo "  https://$DOMAIN 으로 접속 가능합니다."
echo ""
echo "인증서 자동 갱신은 certbot 컨테이너가 처리합니다."
