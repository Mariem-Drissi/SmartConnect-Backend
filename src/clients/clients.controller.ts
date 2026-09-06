import { Controller,Get,Post,Patch,Delete,Body,Param,Query,UseGuards } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto,UpdateClientDto } from './dto/client.dto';
import { JwtAuthGuard,CurrentUser } from '../auth/guards/index';
@Controller('clients') @UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(private c: ClientsService) {}
  @Get() findAll(@CurrentUser() u:any,@Query('region') region?:string,@Query('clientType') ct?:string,@Query('search') s?:string) {
    const uid=u.role==='COMMERCIAL'?u.id:undefined;
    return this.c.findAll(uid,region,ct,s);
  }
  @Get('stats') getStats() { return this.c.getStats(); }
  @Get(':id') findOne(@Param('id') id:string) { return this.c.findOne(id); }
  @Post() create(@Body() dto:CreateClientDto,@CurrentUser() u:any) {
    // Un commercial qui crée un client se l'assigne automatiquement (sinon le client resterait invisible dans sa propre liste)
    if(u.role==='COMMERCIAL'&&!dto.assignedUserId) dto.assignedUserId=u.id;
    return this.c.create(dto);
  }
  @Patch(':id') update(@Param('id') id:string,@Body() dto:UpdateClientDto) { return this.c.update(id,dto); }
  @Delete(':id') remove(@Param('id') id:string) { return this.c.remove(id); }
}
