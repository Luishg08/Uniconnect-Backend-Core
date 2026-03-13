import { IsInt, Min, Max } from 'class-validator';

export class PaginationParams {
  @IsInt()
  @Min(1)
  page: number;

  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number;
}
