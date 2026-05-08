# SiliconFeed на сервере: один раз настроить, дальше само

**Пошаговая инструкция с момента «Debian уже стоит в Proxmox»:** [PROXMOX_DEBIAN.md](./PROXMOX_DEBIAN.md).

Здесь только **backend-воркер** в Docker: RSS → очередь `jobs` → скрейп → рерайт → обложка → Supabase/R2 → Telegram / Google Indexing.  
Фронт (например Vercel) ходит в ту же Supabase; главная и лента обновляются за счёт короткого CDN-кеша (`s-maxage` порядка минуты), отдельный webhook для «подтянуть новость» не обязателен.

## Миграция 0017 (egress: рубрики и теги) — сделайте после `git pull`

Новый SQL: `backend/supabase/migrations/0017_listing_page_payload_rpcs.sql` — функции `rubric_page_payload` и `tag_page_payload`. Без них фронт на Vercel **сам откатится** на старый режим (тяжёлая выборка), но **лучше применить миграцию к проекту Supabase**.

**Вариант A — Supabase Dashboard**

1. Откройте [Supabase Dashboard](https://supabase.com/dashboard) → ваш проект → **SQL Editor**.
2. Создайте новый запрос, вставьте **весь** текст файла `0017_listing_page_payload_rpcs.sql` из репозитория.
3. Выполните (**Run**). Ошибок быть не должно; появятся функции `rubric_page_payload`, `tag_page_payload` и вспомогательные.

**Вариант B — Supabase CLI** (если проект уже связан с `supabase link`)

```bash
cd backend
npx supabase db push
```

**Проверка**

- В SQL Editor: `select public.rubric_page_payload('ai', 1, 15);` — должен вернуться `jsonb` с полями `total`, `rows`, `years`, `related_sources`.
- Сайт: откройте `/rubric/ai` и любой `/tag/...` — раздел и «Related tags» ведут себя как раньше; в **Usage → Egress** нагрузка должна снизиться при том же трафике.

---

## Что уже работает без вашего участия

| Что | Как |
|-----|-----|
| Подбор статей из RSS | Встроенный gatekeeper в `npm run worker`, по умолчанию раз в **30 минут** (`GATEKEEPER_INTERVAL_MS` не задавать и не ставить `0`). |
| Рерайт и публикация | Воркер опрашивает очередь каждые **10 с**, выполняет пайплайн до статуса `published`. |
| Повторный рерайт (audit) | Короткий текст относительно источника → job `refresh` → тот же воркер обновляет статью (тот же slug). |
| После падения / перезагрузки | В `docker-compose.yml` у сервиса `restart: unless-stopped` + unit `siliconfeed-docker.service` поднимает `docker compose up -d` при старте ОС. |

Не отключайте в `.env` встроенный gatekeeper (`GATEKEEPER_INTERVAL_MS=0`), если не запускаете RSS отдельным процессом.

## Один раз на Debian 12 (Proxmox VM)

1. Клонировать репозиторий, например в `/opt/siliconfeed`.
2. `cd backend && cp .env.example .env` — заполнить ключи и `PUBLIC_SITE_URL`.
3. Применить миграции Supabase (SQL Editor или `npm run db:push`), как в комментариях `.env.example`.
4. Запустить установку:

```bash
cd /opt/siliconfeed/backend/deploy
chmod +x install-debian-once.sh
./install-debian-once.sh
```

Если Docker ещё не установлен:

```bash
AUTO_INSTALL_DOCKER=1 ./install-debian-once.sh
```

Скрипт: ставит Docker (по желанию), делает первый `docker compose up -d --build`, регистрирует и включает `siliconfeed-docker.service`.

## Полезные команды

```bash
sudo systemctl status siliconfeed-docker.service
cd /path/to/backend && docker compose logs -f worker
docker compose -f /path/to/backend/docker-compose.yml restart worker
```

## Обновление кода воркера

Образ собирается локально из репозитория. После `git pull`:

```bash
cd /path/to/backend && docker compose up -d --build
```

Это единственная регулярная операция при изменении backend; при желании её можно повесить на cron или CI.

### Быстро выкатить доработку на сервер (Docker)

На **своём ПК**: закоммитьте и запушьте изменения в Git (`git push`).

На **VM** (путь как у вас в Proxmox, ниже — `/opt/siliconfeed`):

```bash
cd /opt/siliconfeed
git pull
cd backend
sudo docker compose up -d --build
```

Пересборка образа нужна, когда менялись `Dockerfile`, `package.json`, `package-lock.json` или код в `backend/src` (и всё, что копируется в образ). Если правили **только** `backend/.env`, достаточно пересоздать контейнер:

```bash
cd /opt/siliconfeed/backend
sudo docker compose up -d
```

Проверка логов:

```bash
sudo docker compose logs -f worker
```

Выход из потока логов: **Ctrl+C** (контейнер не останавливается).

## Включить службу Docker при загрузке ОС

Пакет `docker-ce` при установке через официальный репозиторий обычно уже делает `systemctl enable docker`. Проверка:

```bash
systemctl is-enabled docker
```

Если `disabled`: `sudo systemctl enable --now docker`.
