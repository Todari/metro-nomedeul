#!/bin/bash
set -e

# EC2 초기 환경 설정: Docker + Docker Compose + Git 설치
# 사용법: sudo bash scripts/setup-ec2.sh

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: root 권한이 필요합니다. sudo bash scripts/setup-ec2.sh"
  exit 1
fi

echo "=== EC2 환경 설정 ==="

# Docker 설치
if ! command -v docker &> /dev/null; then
  echo "[1/3] Docker 설치..."
  if command -v dnf &> /dev/null; then
    # Amazon Linux 2023
    dnf install -y docker
    systemctl enable docker
    systemctl start docker
    usermod -aG docker ec2-user
  elif command -v apt-get &> /dev/null; then
    # Ubuntu
    apt-get update -qq
    apt-get install -y ca-certificates curl
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update -qq
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    usermod -aG docker ubuntu
  fi
  echo "  Docker 설치 완료"
else
  echo "[1/3] Docker 이미 설치됨"
fi

# Docker Compose 확인
if ! docker compose version &> /dev/null; then
  echo "[2/3] Docker Compose 플러그인 설치..."
  if command -v dnf &> /dev/null; then
    dnf install -y docker-compose-plugin 2>/dev/null || \
      curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" -o /usr/local/bin/docker-compose && chmod +x /usr/local/bin/docker-compose
  fi
  echo "  Docker Compose 설치 완료"
else
  echo "[2/3] Docker Compose 이미 설치됨"
fi

# Git 확인
if ! command -v git &> /dev/null; then
  echo "[3/3] Git 설치..."
  if command -v dnf &> /dev/null; then
    dnf install -y git
  elif command -v apt-get &> /dev/null; then
    apt-get install -y git
  fi
else
  echo "[3/3] Git 이미 설치됨"
fi

echo ""
echo "=== EC2 환경 설정 완료 ==="
echo ""
echo "다음 단계:"
echo "  1. 프로젝트 클론:     git clone <repo-url> && cd metro-nomedeul"
echo "  2. 환경변수 설정:     cp .env.prod.example .env.prod && vi .env.prod"
echo "  3. SSL 초기 발급:     bash scripts/init-ssl.sh"
echo "  4. 배포:             bash scripts/deploy.sh"
echo ""
echo "NOTE: docker 명령어를 sudo 없이 쓰려면 재로그인이 필요합니다."
