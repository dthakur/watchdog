import { Controller, Post, Body, Get, Delete, Param } from '@nestjs/common';
import Repository from '../repository';
import { CreateServiceDto } from '../entities';

@Controller('services')
export default class ServicesController {
  constructor(private readonly repo: Repository) {}

  @Get()
  get() {
    return this.repo.getAll();
  }

  @Post()
  add(@Body() createServiceDto: CreateServiceDto) {
    return this.repo.add(createServiceDto);
  }

  @Delete(':id')
  remove(@Param() params: any) {
    return this.repo.delete(params.id);
  }
}
