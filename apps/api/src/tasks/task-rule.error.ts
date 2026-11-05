import { BadRequestException } from '@nestjs/common';

/** Raised when a task request is well-formed but violates a business rule. */
export class TaskRuleError extends BadRequestException {}
