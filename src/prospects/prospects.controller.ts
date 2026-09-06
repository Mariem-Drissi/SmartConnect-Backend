import { Controller,Get,Post,Patch,Delete,Body,Param,Query,UseGuards } from '@nestjs/common';
import { ProspectsService } from './prospects.service';
import { CreateProspectDto,UpdateProspectDto,AddHistoryDto } from './dto/prospect.dto';
import { JwtAuthGuard,CurrentUser } from '../auth/guards/index';
@Controller('prospects') @UseGuards(JwtAuthGuard)
export class ProspectsController {
  constructor(private p: ProspectsService) {}
  @Get() findAll(@CurrentUser() u:any,@Query('status') s?:string,@Query('search') search?:string) {
    const uid=u.role==='COMMERCIAL'?u.id:undefined;
    return this.p.findAll(uid,s,search);
  }
  @Get('stats') getStats() { return this.p.getStats(); }
  @Get(':id') findOne(@Param('id') id:string) { return this.p.findOne(id); }
  @Post() create(@Body() dto:CreateProspectDto) { return this.p.create(dto); }
  @Patch(':id') update(@Param('id') id:string,@Body() dto:UpdateProspectDto) { return this.p.update(id,dto); }
  @Post(':id/history') addHistory(@Param('id') id:string,@Body() dto:AddHistoryDto) { return this.p.addHistory(id,dto); }
  @Post(':id/convert') convertToClient(@Param('id') id:string) { return this.p.convertToClient(id); }
  @Delete(':id') remove(@Param('id') id:string) { return this.p.remove(id); }
}
