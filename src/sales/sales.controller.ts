import { Controller,Get,Post,Patch,Body,Param,Query,UseGuards } from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateOrderDto,UpdateOrderStatusDto,SignOrderDto } from './dto/sales.dto';
import { JwtAuthGuard,CurrentUser } from '../auth/guards/index';
@Controller('sales') @UseGuards(JwtAuthGuard)
export class SalesController {
  constructor(private s: SalesService) {}
  @Get('orders') getOrders(@CurrentUser() u:any,@Query('status') status?:string,@Query('clientId') cid?:string,@Query('createdById') createdById?:string) {
    const isManager=['ADMIN','RESPONSABLE_COMMERCIAL'].includes(u.role);
    const uid=isManager?createdById:u.id;
    return this.s.findAllOrders(status,cid,uid);
  }
  @Get('orders/stats') getStats(@CurrentUser() u:any,@Query('userId') userId?:string) {
    const isManager=['ADMIN','RESPONSABLE_COMMERCIAL'].includes(u.role);
    return this.s.getSalesStats(isManager?userId:u.id);
  }
  @Get('orders/:id') getOrder(@Param('id') id:string) { return this.s.findOneOrder(id); }
  @Post('orders') createOrder(@Body() dto:CreateOrderDto,@CurrentUser() u:any) { return this.s.createOrder(dto,u.id); }
  @Patch('orders/:id/status') updateStatus(@Param('id') id:string,@Body() dto:UpdateOrderStatusDto) { return this.s.updateStatus(id,dto); }
  @Patch('orders/:id/sign') signOrder(@Param('id') id:string,@Body() dto:SignOrderDto) { return this.s.signOrder(id,dto); }
}
