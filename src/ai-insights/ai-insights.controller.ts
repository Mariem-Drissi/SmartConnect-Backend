import { Controller,Get,Post,Patch,Delete,Param,Query,UseGuards } from '@nestjs/common';
import { AiInsightsService } from './ai-insights.service';
import { JwtAuthGuard,CurrentUser } from '../auth/guards/index';
@Controller('ai-insights') @UseGuards(JwtAuthGuard)
export class AiInsightsController {
  constructor(private ai: AiInsightsService) {}
  @Get() getInsights(@Query('clientId') cid?:string) { return this.ai.getInsights(cid); }
  @Get('unread-count') getUnreadCount() { return this.ai.getUnreadCount(); }
  @Get('recommendations') getRecommendations(@CurrentUser() u: any) {
    const commercialId = ['ADMIN','RESPONSABLE_COMMERCIAL'].includes(u.role) ? undefined : u.id;
    return this.ai.getRecommendations(commercialId);
  }
  @Patch(':id/read') markRead(@Param('id') id:string) { return this.ai.markRead(id); }
  @Delete(':id') remove(@Param('id') id:string) { return this.ai.remove(id); }
  @Post('analyze') triggerAnalysis(@Query('clientId') cid?:string) { return this.ai.triggerAnalysis(cid); }
}
