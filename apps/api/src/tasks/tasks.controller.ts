import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksQuery } from './dto/list-tasks.query';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskRuleError } from './task-rule.error';
import { TasksService } from './tasks.service';

@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListTasksQuery) {
    return this.tasksService.findAll(user, query);
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateTaskDto) {
    try {
      return await this.tasksService.create(user, dto);
    } catch (err) {
      if (err instanceof TaskRuleError) {
        return { success: false, error: err.message };
      }
      throw err;
    }
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTaskDto) {
    return this.tasksService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.remove(user, id);
  }
}
