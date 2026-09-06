import { Controller,Get,Post,Patch,Delete,Body,Param,Query,UseGuards } from '@nestjs/common';
import { StockService } from './stock.service';
import { StockMovementDto,UpdateThresholdDto,AssignCommercialStockDto,CommercialStockMovementDto,UpdateCommercialThresholdDto } from './dto/stock.dto';
import { JwtAuthGuard,CurrentUser } from '../auth/guards/index';

@Controller('stock') @UseGuards(JwtAuthGuard)
export class StockController {
  constructor(private s: StockService) {}

  // ── Dépôt central (produits finis) ─────────────────────────────────
  @Get('products') getStocks() { return this.s.getAllProductStocks(); }
  @Get('products/alerts') getAlerts() { return this.s.getLowAlerts(); }
  @Get('products/movements') getMvs(@Query('stockId') id?:string) { return this.s.getMovements(id); }
  @Post('products/movement') addMv(@Body() dto:StockMovementDto,@CurrentUser() u:any) { return this.s.addMovement(dto,u.id); }
  @Patch('products/:id/threshold') updateThr(@Param('id') id:string,@Body() dto:UpdateThresholdDto) { return this.s.updateThreshold(id,dto); }
  @Delete('products/movements/:id') deleteMv(@Param('id') id:string) { return this.s.deleteMovement(id); }

  // ── Stock assigné au commercial connecté ("mon stock") ──────────────
  @Get('mine') getMine(@CurrentUser() u:any) { return this.s.getCommercialStocks(u.id); }
  @Get('mine/alerts') getMineAlerts(@CurrentUser() u:any) { return this.s.getCommercialStockAlerts(u.id); }
  @Get('mine/movements') getMineMovements(@CurrentUser() u:any) { return this.s.getCommercialMovements(undefined,u.id); }

  // ── Gestion du stock par commercial (admin / responsable commercial) ─
  @Get('commercial') getCommercialStocks(@Query('userId') userId?:string) { return this.s.getCommercialStocks(userId); }
  @Get('commercial/alerts') getCommercialAlerts(@Query('userId') userId?:string) { return this.s.getCommercialStockAlerts(userId); }
  @Get('commercial/movements') getCommercialMovements(@Query('commercialStockId') csId?:string,@Query('userId') userId?:string) { return this.s.getCommercialMovements(csId,userId); }
  @Post('commercial') assign(@Body() dto:AssignCommercialStockDto,@CurrentUser() u:any) { return this.s.assignToCommercial(dto,u.id); }
  @Post('commercial/movement') addCommercialMv(@Body() dto:CommercialStockMovementDto,@CurrentUser() u:any) { return this.s.addCommercialMovement(dto,u.id); }
  @Patch('commercial/:id/threshold') updateCommercialThr(@Param('id') id:string,@Body() dto:UpdateCommercialThresholdDto) { return this.s.updateCommercialThreshold(id,dto); }
  @Delete('commercial/:id') deleteCommercial(@Param('id') id:string) { return this.s.deleteCommercialStock(id); }
}
