CREATE TABLE "team_invites" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "boardId" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "acceptedCount" INTEGER NOT NULL DEFAULT 0,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "team_invites_code_key" ON "team_invites"("code");
CREATE UNIQUE INDEX "team_invites_boardId_key" ON "team_invites"("boardId");
CREATE INDEX "team_invites_teamId_idx" ON "team_invites"("teamId");
CREATE INDEX "team_invites_isActive_idx" ON "team_invites"("isActive");

ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "retro_boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
