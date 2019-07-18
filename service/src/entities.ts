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
  checks: any
}
