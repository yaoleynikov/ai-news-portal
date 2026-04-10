#!/usr/bin/env bash
# Одноразовая настройка на Debian 12+ (в т.ч. VM в Proxmox):
# Docker Engine, первый `docker compose up -d --build`, systemd — автозапуск после reboot.
#
# Требования: root или sudo; репозиторий уже склонирован; заполнен backend/.env
#
# Использование:
#   cd /opt/siliconfeed/backend/deploy   # или ваш путь
#   chmod +x install-debian-once.sh
#   ./install-debian-once.sh
#
# Неинтерактивно (скрипт сам поставит Docker из репозитория Docker):
#   AUTO_INSTALL_DOCKER=1 ./install-debian-once.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${BACKEND_DIR}/docker-compose.yml"
SERVICE_SRC="${SCRIPT_DIR}/siliconfeed-docker.service.in"
SERVICE_DST="/etc/systemd/system/siliconfeed-docker.service"

need_cmd() {
  command -v "$1" >/dev/null 2>&1
}

if [[ ! -f "${BACKEND_DIR}/.env" ]]; then
  echo "Нет файла ${BACKEND_DIR}/.env"
  echo "Скопируйте: cp ${BACKEND_DIR}/.env.example ${BACKEND_DIR}/.env и заполните ключи (Supabase, OpenRouter, R2, …)."
  exit 1
fi

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "Не найден ${COMPOSE_FILE}"
  exit 1
fi

SUDO=""
if [[ "$(id -u)" -ne 0 ]]; then
  if need_cmd sudo; then
    SUDO="sudo"
  else
    echo "Запустите от root или установите sudo."
    exit 1
  fi
fi

install_docker_debian() {
  echo "Установка Docker Engine (официальный репозиторий Docker для Debian)…"
  ${SUDO} apt-get update -qq
  ${SUDO} apt-get install -y ca-certificates curl
  ${SUDO} install -m 0755 -d /etc/apt/keyrings
  ${SUDO} curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
  ${SUDO} chmod a+r /etc/apt/keyrings/docker.asc
  # shellcheck disable=SC2312
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian ${VERSION_CODENAME} stable" \
    | ${SUDO} tee /etc/apt/sources.list.d/docker.list >/dev/null
  ${SUDO} apt-get update -qq
  ${SUDO} apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  ${SUDO} systemctl enable --now docker
  echo "Docker установлен и включён в автозагрузку."
}

if ! need_cmd docker; then
  if [[ "${AUTO_INSTALL_DOCKER:-}" == "1" ]]; then
    install_docker_debian
  else
    echo "Команда docker не найдена."
    echo "Поставьте Docker Engine (см. https://docs.docker.com/engine/install/debian/) или повторите с:"
    echo "  AUTO_INSTALL_DOCKER=1 $0"
    exit 1
  fi
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Нужен плагин «docker compose» (Docker Compose V2). Установите docker-compose-plugin."
  exit 1
fi

echo "Сборка образа и запуск воркера (первый раз)…"
(cd "${BACKEND_DIR}" && docker compose up -d --build)

export BACKEND_DIR
if ! need_cmd envsubst; then
  echo "Нужна утилита envsubst (пакет gettext-base), ставлю…"
  ${SUDO} apt-get update -qq
  ${SUDO} apt-get install -y gettext-base
fi

echo "Установка unit-файла systemd: ${SERVICE_DST}"
envsubst '${BACKEND_DIR}' < "${SERVICE_SRC}" | ${SUDO} tee "${SERVICE_DST}" >/dev/null

${SUDO} systemctl daemon-reload
${SUDO} systemctl enable siliconfeed-docker.service
${SUDO} systemctl start siliconfeed-docker.service

echo ""
echo "Готово."
echo "  Статус:  sudo systemctl status siliconfeed-docker.service"
echo "  Логи:    cd ${BACKEND_DIR} && docker compose logs -f worker"
echo "После перезагрузки сервера воркер поднимется сам (Docker + systemd)."
