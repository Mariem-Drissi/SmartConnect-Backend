import { IsString,IsOptional,IsNumber,IsEnum,IsEmail,IsBoolean } from 'class-validator';
import { ClientType } from '@prisma/client';
export class CreateClientDto {
  @IsString() name: string;
  @IsEmail() @IsOptional() email?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() address?: string;
  @IsString() @IsOptional() city?: string;
  @IsString() @IsOptional() region?: string;
  @IsString() @IsOptional() postalCode?: string;
  @IsNumber() @IsOptional() latitude?: number;
  @IsNumber() @IsOptional() longitude?: number;
  @IsEnum(ClientType) @IsOptional() clientType?: ClientType;
  @IsString() @IsOptional() taxId?: string;
  @IsString() @IsOptional() assignedUserId?: string;
  @IsString() @IsOptional() notes?: string;
}
export class UpdateClientDto {
  @IsString() @IsOptional() name?: string;
  @IsEmail() @IsOptional() email?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() address?: string;
  @IsString() @IsOptional() city?: string;
  @IsString() @IsOptional() region?: string;
  @IsNumber() @IsOptional() latitude?: number;
  @IsNumber() @IsOptional() longitude?: number;
  @IsEnum(ClientType) @IsOptional() clientType?: ClientType;
  @IsString() @IsOptional() taxId?: string;
  @IsString() @IsOptional() assignedUserId?: string;
  @IsBoolean() @IsOptional() isActive?: boolean;
  @IsString() @IsOptional() notes?: string;
}
