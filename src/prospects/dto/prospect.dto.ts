import { IsString,IsOptional,IsNumber,IsEnum,IsEmail } from 'class-validator';
import { ProspectStatus } from '@prisma/client';
export class CreateProspectDto {
  @IsString() name: string;
  @IsEmail() @IsOptional() email?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() address?: string;
  @IsString() @IsOptional() city?: string;
  @IsString() @IsOptional() region?: string;
  @IsNumber() @IsOptional() latitude?: number;
  @IsNumber() @IsOptional() longitude?: number;
  @IsNumber() @IsOptional() potentialValue?: number;
  @IsString() @IsOptional() source?: string;
  @IsString() @IsOptional() notes?: string;
  @IsString() @IsOptional() assignedUserId?: string;
}
export class UpdateProspectDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() city?: string;
  @IsEnum(ProspectStatus) @IsOptional() status?: ProspectStatus;
  @IsNumber() @IsOptional() potentialValue?: number;
  @IsString() @IsOptional() notes?: string;
  @IsString() @IsOptional() lostReason?: string;
  @IsString() @IsOptional() assignedUserId?: string;
}
export class AddHistoryDto { @IsString() action: string; @IsString() @IsOptional() notes?: string; }
