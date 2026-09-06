import { IsString,IsNumber,IsEnum,IsOptional,Min } from 'class-validator';
import { StockMovementType } from '@prisma/client';

// Stock produit fini — dépôt central
export class StockMovementDto { @IsString() stockId: string; @IsEnum(StockMovementType) type: StockMovementType; @IsNumber() @Min(1) quantity: number; @IsString() @IsOptional() reason?: string; @IsString() @IsOptional() reference?: string; }
export class UpdateThresholdDto { @IsNumber() @Min(0) minThreshold: number; }

// Stock assigné par commercial (van/tournée)
export class AssignCommercialStockDto { @IsString() userId: string; @IsString() productId: string; @IsNumber() @Min(1) quantity: number; @IsNumber() @IsOptional() @Min(0) minThreshold?: number; }
export class CommercialStockMovementDto { @IsString() commercialStockId: string; @IsEnum(StockMovementType) type: StockMovementType; @IsNumber() @Min(1) quantity: number; @IsString() @IsOptional() reason?: string; }
export class UpdateCommercialThresholdDto { @IsNumber() @Min(0) minThreshold: number; }
