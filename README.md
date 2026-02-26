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
HTTP ручка `PATCH /retro/boards/:boardId/columns/reorder` перенесена в websocket event `board.columns.reorder`.

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
- event: `board.columns.reordered`
- payload: `{ boardId, columns }`

## Prisma
Модели пока не добавлены. Опиши их в `prisma/schema.prisma`, затем выполни:
```bash
npm run prisma:migrate -- --name init
```
