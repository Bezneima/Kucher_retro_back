# 1win Retro Back Starter

Чистая backend-заготовка на стеке:
- NestJS
- Prisma
- PostgreSQL (Docker)
- Swagger

## Быстрый старт

1. Установить зависимости:
```bash
npm install
```

2. Создать `.env` из шаблона:
```bash
cp .env.example .env
```

3. Поднять PostgreSQL:
```bash
docker compose up -d
```

4. Сгенерировать Prisma Client:
```bash
npm run prisma:generate
```

5. Запустить приложение:
```bash
npm run start:dev
```

## URL
- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/docs`
- Health check: `http://localhost:3000/health`

## Google OAuth Env
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI` (backend callback, например `http://localhost:3000/auth/google/callback`)
- `FRONTEND_URL` (например `http://localhost:5173`)
- `GOOGLE_OAUTH_SCOPES` (default: `openid email profile`)
- `GOOGLE_OAUTH_STATE_TTL_SEC` (default: `300`)
- `GOOGLE_EXCHANGE_TOKEN_TTL_SEC` (default: `60`)

## Google OAuth API
- `GET /auth/google/start?returnTo=/teams`
  - Генерирует одноразовый `state` (TTL + one-time-use) и делает redirect на Google consent screen.
- `GET /auth/google/callback?code=...&state=...`
  - Валидирует `state`, обменивает `code`, валидирует Google `id_token`, логинит/создает/линкует пользователя.
  - Генерирует одноразовый `exchangeToken` (TTL + one-time-use) и делает redirect на:
    - `${FRONTEND_URL}/auth/google/callback?exchangeToken=...&returnTo=...`
- `POST /auth/google/exchange`
  - Body: `{ \"exchangeToken\": \"...\" }`
  - Response: `{ \"accessToken\": \"...\", \"refreshToken\": \"...\" }`
  - Повторный/просроченный `exchangeToken` -> `401` с `{ \"message\": \"Invalid or expired exchange token\" }`

## Manual Google OAuth Checklist
- `/auth` -> Google -> возврат на `/teams`.
- Invite flow после Google логина работает.
- Повторный `POST /auth/google/exchange` с тем же `exchangeToken` падает.
- `POST /auth/refresh` после Google логина работает.

## WebSocket Bootstrap
- Namespace: `ws://localhost:3000/ws` (Socket.IO)
- Auth: передай `accessToken` в `auth.token`
- При успешном подключении сервер отправляет built-in событие `message` со строкой `hello world`

Пример клиента:
```ts
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/ws', {
  auth: {
    token: accessToken, // raw JWT без Bearer
  },
});

socket.on('connect', () => {
  console.log('connected', socket.id);
});

socket.on('message', (payload) => {
  console.log('message:', payload); // hello world
});

socket.on('connect_error', (error) => {
  console.error('connect_error:', error.message); // Unauthorized
});
```

### Rename board via socket
HTTP ручка `PATCH /retro/boards/:boardId/name` перенесена в websocket event `board.rename`.

Перед получением realtime-обновлений подключи сокет к комнате доски:
```ts
socket.emit('board.join', { boardId: 1 }, (response) => {
  console.log('joined board room:', response);
});
```

Клиент:
```ts
socket.emit('board.rename', { boardId: 1, name: 'Sprint 13 Retro' }, (response) => {
  console.log('renamed board:', response);
});
```

Payload:
- `boardId`: number (>= 1)
- `name`: non-empty string

Broadcast для других пользователей в этой доске:
- event: `board.renamed`
- payload: обновленный объект доски

### Reorder board columns via socket
HTTP ручка `PATCH /retro/boards/:boardId/columns/reorder` и socket event `board.columns.reorder`
используют одинаковую бизнес-логику перестановки колонок.

Клиент:
```ts
socket.emit(
  'board.columns.reorder',
  { boardId: 1, oldIndex: 0, newIndex: 2 },
  (response) => {
    console.log('reordered columns:', response);
  },
);
```

Payload:
- `boardId`: number (>= 1)
- `oldIndex`: number (>= 0)
- `newIndex`: number (>= 0)

Broadcast для других пользователей в этой доске:
- canonical event: `retro.board.columns.reordered`
- payload: `{ boardId, columns }`
- compatibility event: `board.columns.reordered` (тот же payload)

### Sync item positions realtime payload
Для ручки `PATCH /retro/boards/:boardId/items/positions` сервер шлет событие:
- event: `retro.board.items.positions.synced`
- payload:

```ts
{
  boardId: number;
  updated: number;
  changedColumnIds: number[];
  columns: RetroColumnResponseDto[];
}
```

`changes` в HTTP body поддерживает поле `newGroupId?: number | null`.
Если `newGroupId` передан, карточка переносится в указанную группу (группа должна принадлежать `newColumnId`).

`columns` содержит полные измененные колонки (с карточками и группами).  
Если в одном батче затронуто больше двух колонок, в payload приходят все измененные колонки.

### Sync group positions via socket
HTTP ручка `PATCH /retro/boards/:boardId/groups/positions` и socket event `board.groups.positions.sync`
используют одинаковую бизнес-логику перемещения групп между колонками.

Клиент:
```ts
socket.emit(
  'board.groups.positions.sync',
  { boardId: 1, changes: [{ groupId: 5, newColumnId: 7, newOrderIndex: 0 }] },
  (response) => {
    console.log('synced group positions:', response);
  },
);
```

Broadcast для других пользователей в этой доске:
- canonical event: `retro.board.groups.positions.synced`
- compatibility event: `board.groups.positions.synced`
- payload: `{ boardId, updated, changedColumnIds, columns }`

### Group API
- `POST /retro/columns/:columnId/groups`
- `PATCH /retro/groups/:groupId/name`
- `PATCH /retro/groups/:groupId/color`
- `PATCH /retro/groups/:groupId/description`
- `DELETE /retro/groups/:groupId`
