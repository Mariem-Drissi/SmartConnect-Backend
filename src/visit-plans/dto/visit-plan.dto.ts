import { IsString,IsOptional,IsDateString,IsArray,ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AssignClientDto {
  @IsString() clientId: string;
  @IsDateString() @IsOptional() scheduledAt?: string;
}

// Assignation : l'admin/responsable commercial assigne une liste de clients à visiter à un commercial — crée la tournée ET les visites associées
export class CreateVisitPlanDto {
  @IsString() userId: string;
  @IsDateString() date: string;
  @IsString() @IsOptional() title?: string;
  @IsString() @IsOptional() notes?: string;
  @IsArray() @ValidateNested({each:true}) @Type(()=>AssignClientDto) clients: AssignClientDto[];
}

export class UpdateVisitPlanDto {
  @IsString() @IsOptional() userId?: string;
  @IsDateString() @IsOptional() date?: string;
  @IsString() @IsOptional() title?: string;
  @IsString() @IsOptional() notes?: string;
}

export class UpdatePlanStatusDto { @IsString() status: string; }

// Ajouter un client à visiter dans une tournée déjà existante
export class AddVisitDto {
  @IsString() clientId: string;
  @IsDateString() @IsOptional() scheduledAt?: string;
}
