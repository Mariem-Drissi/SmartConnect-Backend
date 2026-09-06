import { IsString,IsOptional,IsDateString,IsNumber,IsBoolean } from 'class-validator';
export class StartVisitDto { @IsNumber() @IsOptional() latitude?: number; @IsNumber() @IsOptional() longitude?: number; }
export class CompleteVisitDto { @IsString() report: string; @IsString() @IsOptional() nextAction?: string; @IsBoolean() @IsOptional() orderCreated?: boolean; @IsNumber() @IsOptional() orderAmount?: number; }
export class UpdateVisitDto { @IsDateString() @IsOptional() scheduledAt?: string; @IsString() @IsOptional() nextAction?: string; @IsString() @IsOptional() report?: string; }
