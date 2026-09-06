import { Controller,Get,Post,Patch,Delete,Body,Param,Query,UseGuards } from '@nestjs/common';
import { VisitPlansService } from './visit-plans.service';
import { CreateVisitPlanDto,UpdateVisitPlanDto,UpdatePlanStatusDto,AddVisitDto } from './dto/visit-plan.dto';
import { JwtAuthGuard,RolesGuard,Roles,CurrentUser } from '../auth/guards/index';

@Controller('visit-plans') @UseGuards(JwtAuthGuard)
export class VisitPlansController {
  constructor(private p: VisitPlansService) {}

  @Get() findAll(@CurrentUser() u:any,@Query('userId') uid?:string,@Query('date') d?:string) {
    return this.p.findAll(['ADMIN','RESPONSABLE_COMMERCIAL'].includes(u.role)?uid:u.id,d);
  }
  @Get(':id') findOne(@Param('id') id:string) { return this.p.findOne(id); }

  // Assignation de clients à un commercial = création de la tournée (admin / responsable commercial uniquement)
  @Post() @UseGuards(RolesGuard) @Roles('ADMIN','RESPONSABLE_COMMERCIAL') create(@Body() dto:CreateVisitPlanDto) { return this.p.create(dto); }

  @Patch(':id') @UseGuards(RolesGuard) @Roles('ADMIN','RESPONSABLE_COMMERCIAL') update(@Param('id') id:string,@Body() dto:UpdateVisitPlanDto) { return this.p.update(id,dto); }
  @Patch(':id/status') updateStatus(@Param('id') id:string,@Body() dto:UpdatePlanStatusDto) { return this.p.updateStatus(id,dto.status); }
  @Delete(':id') @UseGuards(RolesGuard) @Roles('ADMIN','RESPONSABLE_COMMERCIAL') delete(@Param('id') id:string) { return this.p.delete(id); }

  // Gestion des visites au sein d'une tournée
  @Post(':id/visits') @UseGuards(RolesGuard) @Roles('ADMIN','RESPONSABLE_COMMERCIAL') addVisit(@Param('id') id:string,@Body() dto:AddVisitDto) { return this.p.addVisit(id,dto); }
  @Delete(':id/visits/:visitId') @UseGuards(RolesGuard) @Roles('ADMIN','RESPONSABLE_COMMERCIAL') removeVisit(@Param('id') id:string,@Param('visitId') visitId:string) { return this.p.removeVisit(id,visitId); }

  @Post(':id/optimize') optimize(@Param('id') id:string) { return this.p.optimize(id); }
}
