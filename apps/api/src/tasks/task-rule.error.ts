/** Raised when a task request is well-formed but violates a business rule. */
export class TaskRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaskRuleError';
  }
}
