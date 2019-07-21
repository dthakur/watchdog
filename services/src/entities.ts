import { IsNotEmpty, Length, IsUrl } from 'class-validator';

export class CreateServiceDto {
  @IsNotEmpty()
  @Length(3, 50)
  name!: string;

  @IsNotEmpty()
  @IsUrl()
  url!: string;
}

export interface Service {
  id: string,
  name: string,
  url: string,
  createdAt: number,
  checksLatestMinute: number,
  checks: number[]  // > 0 = http status code, -1 = timeout, -2 = no value
}
