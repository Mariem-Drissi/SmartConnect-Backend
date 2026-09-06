import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/guards/index';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'RESPONSABLE_COMMERCIAL')
export class AnalyticsController {
  constructor(private analytics: AnalyticsService) {}

  private parseSince(period?: string): Date | undefined {
    if (!period || period === 'all') return undefined;
    const days = { '30d': 30, '90d': 90, '6m': 180, '12m': 365 }[period] ?? 90;
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
  }

  @Get('by-commercial')
  byCommercial(@Query('period') period?: string) {
    return this.analytics.byCommercial(this.parseSince(period));
  }

  @Get('by-product')
  byProduct(@Query('period') period?: string) {
    return this.analytics.byProduct(this.parseSince(period));
  }

  @Get('by-category')
  byCategory(@Query('period') period?: string) {
    return this.analytics.byCategory(this.parseSince(period));
  }
}
