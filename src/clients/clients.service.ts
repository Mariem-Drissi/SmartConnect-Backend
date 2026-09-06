import { Injectable,NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto,UpdateClientDto } from './dto/client.dto';
@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}
  async findAll(assignedUserId?: string,region?: string,clientType?: string,search?: string) {
    return this.prisma.client.findMany({
      where:{
        ...(assignedUserId&&{assignedUserId}),
        ...(region&&{region}),
        ...(clientType&&{clientType:clientType as any}),
        ...(search&&{OR:[{name:{contains:search,mode:'insensitive'}},{city:{contains:search,mode:'insensitive'}},{email:{contains:search,mode:'insensitive'}}]}),
      },
      include:{commercial:{select:{firstName:true,lastName:true}},_count:{select:{orders:true,visits:true}},clientScore:true},
      orderBy:{name:'asc'},
    });
  }
  async findOne(id: string) {
    const c=await this.prisma.client.findUnique({where:{id},include:{commercial:{select:{id:true,firstName:true,lastName:true}},orders:{take:10,orderBy:{createdAt:'desc'},include:{items:{include:{product:true}}}},visits:{take:5,orderBy:{scheduledAt:'desc'}},clientScore:true,aiInsights:{take:5,orderBy:{createdAt:'desc'}}}});
    if(!c) throw new NotFoundException('Client introuvable'); return c;
  }
  async create(dto: CreateClientDto) { return this.prisma.client.create({data:dto as any,include:{commercial:{select:{firstName:true,lastName:true}}}}); }
  async update(id: string,dto: UpdateClientDto) { await this.findOne(id); return this.prisma.client.update({where:{id},data:dto as any,include:{commercial:{select:{firstName:true,lastName:true}}}}); }
  async remove(id: string) {
    await this.findOne(id);
    const [orders,visits]=await Promise.all([this.prisma.saleOrder.count({where:{clientId:id}}),this.prisma.visit.count({where:{clientId:id}})]);
    if(orders>0||visits>0){
      // Historique existant : on désactive plutôt que de supprimer pour préserver l'intégrité des données
      return this.prisma.client.update({where:{id},data:{isActive:false}});
    }
    return this.prisma.client.delete({where:{id}});
  }
  async getStats() {
    const [total,active,byType,byRegion]=await Promise.all([
      this.prisma.client.count(),this.prisma.client.count({where:{isActive:true}}),
      this.prisma.client.groupBy({by:['clientType'],_count:true}),
      this.prisma.client.groupBy({by:['region'],_count:true,where:{region:{not:null}}}),
    ]);
    return {total,active,byType,byRegion};
  }
}
