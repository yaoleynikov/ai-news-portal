# SiliconFeed: развёртывание воркера на Debian в Proxmox

Инструкция начинается с момента, когда **виртуальная машина с Debian уже создана в Proxmox** и вы можете в неё зайти (консоль Proxmox или SSH). Разворачивается только **backend-воркер** в Docker: RSS, очередь задач, рерайт, обложки, запись в Supabase и R2. Сайт (фронт) обычно живёт отдельно (например Vercel) и использует те же данные из Supabase.

---

## 1. Что проверить в Proxmox

- **ОС:** Debian 12 (bookworm) — то, под что заточены скрипты в `backend/deploy/`.
- **Ресурсы VM (ориентир):**  
  - RAM: не меньше **2 ГБ** на хосте (контейнеру воркера в `docker-compose.yml` отдан лимит **768 МБ**, плюс Docker и ОС). Комфортно **2–4 ГБ**.  
  - Диск: **20 ГБ+** (образ Node, слои Docker, кеш Hugging Face в volume).  
  - CPU: **1–2 vCPU** достаточно для одного воркера.
- **Сеть:** VM должна иметь выход в интернет (HTTPS к Supabase, OpenRouter, R2, RSS).

После установки Debian зайдите под обычным пользователем с `sudo` или под `root`.

---

## 2. Первичная настройка Debian

Обновите индекс пакетов и установите обновления безопасности:

```bash
sudo apt update
sudo apt upgrade -y
```

Поставьте инструменты, которые понадобятся для клонирования репозитория:

```bash
sudo apt install -y git ca-certificates curl
```

**SSH (если заходите с другой машины):** убедитесь, что служба SSH включена:

```bash
sudo systemctl enable --now ssh
```

Проверка IP VM: `ip a` или в веб-интерфейсе Proxmox → вкладка VM → Summary.

**Часовой пояс** (по желанию, для удобства чтения логов):

```bash
sudo timedatectl set-timezone Europe/Moscow
```

(Замените на свой регион при необходимости.)

---

## 3. Куда положить код

Рекомендуемый путь (предсказуемо для бэкапов и документации):

```bash
sudo mkdir -p /opt/siliconfeed
sudo chown "$USER:$USER" /opt/siliconfeed
cd /opt/siliconfeed
```

Клонируйте репозиторий (подставьте **ваш** URL — HTTPS или SSH):

```bash
git clone https://github.com/YOUR_ORG/SiliconFeed.git .
```

Если репозиторий приватный, настройте доступ по SSH-ключу или используйте токен с GitHub.

Проверка:

```bash
ls -la backend/docker-compose.yml backend/.env.example
```

---

## 4. Файл окружения `backend/.env`

Воркер читает секреты **только** из `backend/.env` (в образ Docker они не зашиваются).

```bash
cd /opt/siliconfeed/backend
cp .env.example .env
nano .env
```

Заполните как минимум (смысл полей подробно в комментариях внутри `.env.example`):

| Группа | Зачем |
|--------|--------|
| **Supabase** | `SUPABASE_URL`, сервисный ключ (`SUPABASE_SERVICE_ROLE_KEY` или `SUPABASE_KEY`), при необходимости `SUPABASE_ANON_KEY` |
| **Публичный URL сайта** | `PUBLIC_SITE_URL` — канонический адрес без слэша в конце (ссылки в Telegram, Google Indexing) |
| **OpenRouter** | `OPENROUTER_API_KEY`, при необходимости модель |
| **Hugging Face** | `HF_API_KEY` (обложки) |
| **Logo.dev** | публикуемый ключ `pk_…` |
| **Cloudflare R2** | endpoint/ключи, бакет, **публичный** URL бакета (`R2_PUBLIC_URL`) |
| **Telegram / Google** | по желанию: бот, канал, Indexing API |

**Важно для автоматики RSS:** не задавайте `GATEKEEPER_INTERVAL_MS=0`, если не запускаете отдельный процесс gatekeeper. Иначе новые статьи из RSS сами не попадут в очередь.

Сохраните файл. Права:

```bash
chmod 600 .env
```

---

## 5. Схема базы в Supabase (миграции)

Воркер ожидает таблицы, функции и политики из каталога `backend/supabase/migrations/`. Пока схема не применена, контейнер может стартовать, но операции с БД будут падать с ошибками.

**Вариант A — через SQL Editor в браузере (проще всего с VM)**

1. Откройте проект в [Supabase Dashboard](https://supabase.com/dashboard) → **SQL** → **New query**.
2. Откройте на своём ПК файл `backend/supabase/APPLY_IN_SQL_EDITOR.sql` из репозитория, скопируйте **весь** текст в запрос и выполните **Run**.  
   Либо следуйте комментариям в `.env.example`: напечатать только миграции командой `npm run db:print-migrations` (на машине, где есть Node) и вставить вывод в SQL Editor.

**Вариант B — Supabase CLI с этой же VM**

Нужны Node.js и CLI; описано в `.env.example` (`supabase link`, `npm run db:push`). Имеет смысл, если вы уже пользуетесь CLI.

Убедитесь, что в Dashboard видны таблицы вроде `articles`, `jobs` и что нет критичных ошибок после применения SQL.

---

## 6. Установка Docker и автозапуск воркера

Из каталога `backend` воркер поднимается через `docker compose`. Скрипт `install-debian-once.sh` делает три вещи: при необходимости ставит Docker, выполняет первый **`docker compose up -d --build`**, регистрирует unit **systemd** `siliconfeed-docker.service`, чтобы после **перезагрузки сервера** стек снова поднимался.

**Требование скрипта:** файл `backend/.env` уже существует и заполнен (п. 4).

```bash
cd /opt/siliconfeed/backend/deploy
chmod +x install-debian-once.sh
```

Если **Docker ещё не установлен** (рекомендуемый разовый сценарий):

```bash
AUTO_INSTALL_DOCKER=1 ./install-debian-once.sh
```

Если Docker уже стоит и работает `docker compose`:

```bash
./install-debian-once.sh
```

Скрипт использует `sudo` при необходимости. После успеха:

- контейнер `siliconfeed-worker` в статусе **Up**;
- `sudo systemctl enable siliconfeed-docker` уже выполнен — при boot сначала стартует Docker, затем unit поднимает `docker compose up -d`.

---

## 7. Проверка, что всё живое

Статус unit-файла:

```bash
sudo systemctl status siliconfeed-docker.service
```

Статус контейнера:

```bash
cd /opt/siliconfeed/backend
docker compose ps
docker compose logs -f worker
```

В логах в первые минуты ожидайте строки про встроенный gatekeeper (интервал в минутах) и опрос очереди. Ошибки авторизации Supabase или отсутствующие таблицы — повод вернуться к п. 4–5.

Проверка автозапуска Docker:

```bash
systemctl is-enabled docker
```

Если выведено `disabled`:

```bash
sudo systemctl enable --now docker
```

---

## 8. Что дальше происходит без вашего участия

- Раз в ~**30 минут** (по умолчанию) воркер подтягивает RSS и ставит новые URL в очередь `jobs`.
- Каждые ~**10 секунд** он забирает задачи, рерайтит, публикует в Supabase, грузит медиа в R2, при настройке — шлёт в Telegram и дергает Google Indexing.
- После **reboot** VM Proxmox контейнер снова запускается за счёт **Docker** (`restart: unless-stopped`) и **systemd**-юнита.

Фронт на Vercel с коротким кешем CDN подхватывает новые записи обычно в течение **примерно минуты** без отдельного webhook.

---

## 9. Обновление кода воркера

Когда вы выкатываете изменения backend в Git:

```bash
cd /opt/siliconfeed
git pull
cd backend
docker compose up -d --build
```

Пересобрать образ нужно именно после изменений в коде или `Dockerfile`; одна только смена `.env` часто достаточно:

```bash
docker compose up -d
```

(перечитает переменные при пересоздании контейнера).

---

## 10. Частые проблемы

| Симптом | Куда смотреть |
|---------|----------------|
| Контейнер постоянно перезапускается | `docker compose logs worker` — часто неверный ключ Supabase или не применены миграции |
| Нет новых статей из RSS | Не задан лимит/ленты в конфиге gatekeeper, или `GATEKEEPER_INTERVAL_MS=0`, или лимиты публикаций (`PUBLISH_LIMIT_*`) |
| «Нет места» на диске | `docker system df`, при необходимости `docker system prune` (осторожно с неиспользуемыми образами) |
| После reboot воркер не поднялся | `sudo systemctl status docker` и `siliconfeed-docker.service`; сеть `network-online` может задержать старт на секунды |

---

## 11. Резервное копирование (напоминание)

- **Критично на VM:** файл `backend/.env` (в Git не коммитится) — сохраните копию в менеджере паролей или зашифрованном хранилище.
- Данные статей и очереди — в **Supabase** (бэкапы по политике облака).
- Кеш HF в Docker **volume** `hf_cache` можно не бэкапить — при потере перекачается.

---

## Сводка команд «с нуля»

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git ca-certificates curl

sudo mkdir -p /opt/siliconfeed
sudo chown "$USER:$USER" /opt/siliconfeed
cd /opt/siliconfeed
git clone <URL_ВАШЕГО_РЕПО> .

cd backend
cp .env.example .env
nano .env
chmod 600 .env
```

Далее в Supabase — SQL из `supabase/APPLY_IN_SQL_EDITOR.sql` (или миграции через CLI). Затем:

```bash
cd /opt/siliconfeed/backend/deploy
chmod +x install-debian-once.sh
AUTO_INSTALL_DOCKER=1 ./install-debian-once.sh
```

После этого достаточно поддерживать актуальность Git и при необходимости пересобирать образ (п. 9).
