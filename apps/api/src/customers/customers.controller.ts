import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types';
import { CustomersService } from './customers.service';
import { ListCustomersQuery } from './dto/list-customers.query';

@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListCustomersQuery) {
    return this.customersService.findAll(user.tenantId, query);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const customer = await this.customersService.findOne(id);
    const neighbours = await this.customersService.findNeighbours(user.tenantId, customer.name);
    return { ...customer, ...neighbours };
  }

  @Get(':id/tasks')
  tasks(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.findTasks(user.tenantId, id);
  }
}
