import { Controller,Get,Post,Query,UseGuards } from '@nestjs/common';
import { ClientScoresService } from './client-scores.service';
import { JwtAuthGuard } from '../auth/guards/index';
@Controller('client-scores') @UseGuards(JwtAuthGuard)
export class ClientScoresController {
  constructor(private s: ClientScoresService) {}
  @Get() findAll(@Query('sortBy') sb?:'inactivity'|'potential') { return this.s.findAll(sb??'inactivity'); }
  @Get('at-risk') getAtRisk(@Query('threshold') t?:string) { return this.s.getAtRisk(t?Number(t):60); }
  @Post('recalculate') recalculate(@Query('clientId') id?:string) { return this.s.recalculate(id); }
}
