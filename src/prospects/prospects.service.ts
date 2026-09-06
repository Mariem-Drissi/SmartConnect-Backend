import { Injectable,NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProspectDto,UpdateProspectDto,AddHistoryDto } from './dto/prospect.dto';
@Injectable()
export class ProspectsService {
  constructor(private prisma: PrismaService) {}
  async findAll(assignedUserId?: string,status?: string,search?: string) {
    return this.prisma.prospect.findMany({
      where:{...(assignedUserId&&{assignedUserId}),...(status&&{status:status as any}),...(search&&{OR:[{name:{contains:search,mode:'insensitive'}},{city:{contains:search,mode:'insensitive'}}]})},
      include:{assignedUser:{select:{firstName:true,lastName:true}},_count:{select:{history:true}}},
      orderBy:{createdAt:'desc'},
    });
  }
  async findOne(id: string) {
    const p=await this.prisma.prospect.findUnique({where:{id},include:{assignedUser:{select:{firstName:true,lastName:true}},history:{orderBy:{createdAt:'desc'}}}});
    if(!p) throw new NotFoundException('Prospect introuvable'); return p;
  }
  async create(dto: CreateProspectDto) { return this.prisma.prospect.create({data:dto as any,include:{assignedUser:{select:{firstName:true,lastName:true}}}}); }
  async update(id: string,dto: UpdateProspectDto) { await this.findOne(id); return this.prisma.prospect.update({where:{id},data:dto as any,include:{assignedUser:{select:{firstName:true,lastName:true}}}}); }
  async addHistory(id: string,dto: AddHistoryDto) { await this.findOne(id); return this.prisma.prospectHistory.create({data:{prospectId:id,action:dto.action,notes:dto.notes}}); }
  async remove(id: string) { await this.findOne(id); await this.prisma.prospectHistory.deleteMany({where:{prospectId:id}}); return this.prisma.prospect.delete({where:{id}}); }
  async convertToClient(id: string) {
    const prospect=await this.findOne(id);
    const client=await this.prisma.client.create({data:{name:prospect.name,email:prospect.email??undefined,phone:prospect.phone??undefined,address:prospect.address??undefined,city:prospect.city??undefined,region:prospect.region??undefined,latitude:prospect.latitude??undefined,longitude:prospect.longitude??undefined,assignedUserId:prospect.assignedUserId??undefined}});
    await this.prisma.prospect.update({where:{id},data:{status:'CONVERTED',convertedClientId:client.id}});
    await this.prisma.prospectHistory.create({data:{prospectId:id,action:'Converti en client',notes:`Client ID: ${client.id}`}});
    return {prospect:{...prospect,status:'CONVERTED'},client};
  }
  async getStats() {
    const byStatus=await this.prisma.prospect.groupBy({by:['status'],_count:true});
    const total=await this.prisma.prospect.count();
    return {total,byStatus};
  }
}
