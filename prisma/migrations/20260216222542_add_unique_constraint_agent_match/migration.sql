-- CreateIndex
CREATE UNIQUE INDEX "predictions_agent_id_match_id_key" ON "predictions"("agent_id", "match_id");
