import { Controller,Get,Patch,Delete,Body,Param,Query,UseGuards } from '@nestjs/common';
import { VisitsService } from './visits.service';
import { StartVisitDto,CompleteVisitDto,UpdateVisitDto } from './dto/visit.dto';
import { JwtAuthGuard,RolesGuard,Roles,CurrentUser } from '../auth/guards/index';
@Controller('visits') @UseGuards(JwtAuthGuard)
export class VisitsController {
  constructor(private v: VisitsService) {}
  @Get() findAll(@Query('userId') uid?:string,@Query('clientId') cid?:string,@Query('status') s?:string,@Query('date') d?:string,@Query('visitPlanId') pid?:string) { return this.v.findAll({userId:uid,clientId:cid,status:s,date:d,visitPlanId:pid}); }
  @Get('my') getMy(@CurrentUser() u:any,@Query('date') d?:string) { return this.v.findAll({userId:u.id,date:d}); }
  @Get('stats') getStats(@CurrentUser() u:any,@Query('userId') uid?:string) { return this.v.getStats(['ADMIN','RESPONSABLE_COMMERCIAL'].includes(u.role)?uid:u.id); }
  @Get(':id') findOne(@Param('id') id:string) { return this.v.findOne(id); }
  // La création d'une visite se fait uniquement via l'assignation d'une tournée (POST /visit-plans ou /visit-plans/:id/visits)
  @Patch(':id') @UseGuards(RolesGuard) @Roles('ADMIN','RESPONSABLE_COMMERCIAL') update(@Param('id') id:string,@Body() dto:UpdateVisitDto) { return this.v.update(id,dto); }
  @Patch(':id/start') start(@Param('id') id:string,@Body() dto:StartVisitDto) { return this.v.start(id,dto); }
  @Patch(':id/complete') complete(@Param('id') id:string,@Body() dto:CompleteVisitDto) { return this.v.complete(id,dto); }
  @Patch(':id/cancel') cancel(@Param('id') id:string) { return this.v.cancel(id); }
  @Delete(':id') @UseGuards(RolesGuard) @Roles('ADMIN','RESPONSABLE_COMMERCIAL') delete(@Param('id') id:string) { return this.v.delete(id); }
}
