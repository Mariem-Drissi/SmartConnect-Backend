import { IsEmail,IsString,MinLength,IsEnum,IsOptional,IsBoolean,IsUUID } from 'class-validator';
import { SystemRole } from '@prisma/client';
export class CreateUserDto {
  @IsEmail() email: string;
  @IsString() @MinLength(2) firstName: string;
  @IsString() @MinLength(2) lastName: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() zone?: string;
  @IsEnum(SystemRole) @IsOptional() role?: SystemRole;
  @IsUUID() @IsOptional() permissionProfileId?: string;
}
export class UpdateUserDto {
  @IsString() @IsOptional() firstName?: string;
  @IsString() @IsOptional() lastName?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() zone?: string;
  @IsEnum(SystemRole) @IsOptional() role?: SystemRole;
  @IsBoolean() @IsOptional() isActive?: boolean;
  @IsUUID() @IsOptional() permissionProfileId?: string;
}
export class CreatePermissionProfileDto {
  @IsString() @MinLength(2) name: string;
  @IsString() @IsOptional() description?: string;
  permissions: Record<string,string[]>;
}
