import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  Min,
  IsDateString,
  ValidateNested,
  ArrayNotEmpty,
} from "class-validator";
import { Type } from "class-transformer";
export class OrderItemDto {
  @IsString() productId: string;
  @Type(() => Number) @IsNumber() @Min(1) quantity: number;
  @Type(() => Number) @IsNumber() @Min(0) unitPrice: number;
}
export class CreateOrderDto {
  @IsString() clientId: string;
  @IsDateString() @IsOptional() deliveryDate?: string;
  @IsString() @IsOptional() notes?: string;
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
export class UpdateOrderStatusDto {
  @IsString() status: string;
}
export class SignOrderDto {
  @IsString() signatureData: string;
}
