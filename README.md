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

## Prisma
Модели пока не добавлены. Опиши их в `prisma/schema.prisma`, затем выполни:
```bash
npm run prisma:migrate -- --name init
```
