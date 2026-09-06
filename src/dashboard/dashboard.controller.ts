import { Controller,Get,UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard,CurrentUser } from '../auth/guards/index';
@Controller('dashboard') @UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private d: DashboardService) {}
  @Get('kpis') getKpis(@CurrentUser() u:any) { return this.d.getKpis(u.id,u.role); }
}
