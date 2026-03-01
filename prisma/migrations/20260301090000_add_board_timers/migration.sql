-- Create enum for board timer status.
CREATE TYPE "TimerStatus" AS ENUM ('RUNNING', 'PAUSED');

-- Create table for board timers (one timer per board).
CREATE TABLE "board_timers" (
    "id" SERIAL NOT NULL,
    "boardId" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "TimerStatus" NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "remainingSeconds" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "board_timers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "board_timers_boardId_key" ON "board_timers"("boardId");
CREATE INDEX "board_timers_status_endsAt_idx" ON "board_timers"("status", "endsAt");

ALTER TABLE "board_timers" ADD CONSTRAINT "board_timers_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "retro_boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "board_timers" ADD CONSTRAINT "board_timers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
