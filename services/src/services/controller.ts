import { Controller, Post, Body, Get, Delete, Param, Query } from '@nestjs/common';
import Repository from '../repository';
import { CreateServiceDto } from '../entities';
import { IsNumber, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

class GetAllQuery {
  @Transform(x => parseInt(x))
  @IsNumber()
  @Min(0)
  @Max(2)
  days!: number;
}

@Controller('services')
export default class ServicesController {
  constructor(private readonly repo: Repository) {}

  @Get()
  get(@Query() query: GetAllQuery) {
    return this.repo.getAll(query.days);
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
