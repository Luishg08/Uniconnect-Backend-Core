import { IsOptional, IsString, IsEnum, Matches } from 'class-validator';
import { EventType } from '../enums/event-type.enum';

export class EventFilters {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in ISO 8601 format (YYYY-MM-DD)',
  })
  date?: string;

  @IsOptional()
  @IsEnum(EventType, {
    message: 'type must be one of: CONFERENCIA, TALLER, SEMINARIO, COMPETENCIA, CULTURAL, DEPORTIVO',
  })
  type?: EventType;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate must be in ISO 8601 format (YYYY-MM-DD)',
  })
  startDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'endDate must be in ISO 8601 format (YYYY-MM-DD)',
  })
  endDate?: string;
}
