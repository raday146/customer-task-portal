-- CreateIndex
CREATE INDEX "Task_tenantId_assigneeId_idx" ON "Task"("tenantId", "assigneeId");

-- CreateIndex
CREATE INDEX "Task_tenantId_customerId_idx" ON "Task"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX "Task_tenantId_dueDate_idx" ON "Task"("tenantId", "dueDate");
