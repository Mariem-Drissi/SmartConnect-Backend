import { Injectable,NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StartVisitDto,CompleteVisitDto,UpdateVisitDto } from './dto/visit.dto';
const inc={client:true,user:{select:{id:true,firstName:true,lastName:true,role:true}},visitPlan:true};
@Injectable()
export class VisitsService {
  constructor(private prisma: PrismaService) {}
  async findAll(f?: {userId?:string;clientId?:string;status?:string;date?:string;visitPlanId?:string}) {
    return this.prisma.visit.findMany({where:{...(f?.userId&&{userId:f.userId}),...(f?.clientId&&{clientId:f.clientId}),...(f?.status&&{status:f.status as any}),...(f?.visitPlanId&&{visitPlanId:f.visitPlanId}),...(f?.date&&{scheduledAt:{gte:new Date(f.date+'T00:00:00Z'),lte:new Date(f.date+'T23:59:59Z')}})},include:inc,orderBy:[{visitPlanId:'asc'},{order:'asc'}]});
  }
  async findOne(id: string) { const v=await this.prisma.visit.findUnique({where:{id},include:inc}); if(!v) throw new NotFoundException('Visite introuvable'); return v; }
  async update(id: string,dto: UpdateVisitDto) { await this.findOne(id); return this.prisma.visit.update({where:{id},data:{...(dto.scheduledAt&&{scheduledAt:new Date(dto.scheduledAt)}),...(dto.nextAction!==undefined&&{nextAction:dto.nextAction}),...(dto.report!==undefined&&{report:dto.report})},include:inc}); }
  async start(id: string,dto: StartVisitDto) { return this.prisma.visit.update({where:{id},data:{status:'IN_PROGRESS',startedAt:new Date(),latitude:dto.latitude,longitude:dto.longitude},include:inc}); }
  async complete(id: string,dto: CompleteVisitDto) { return this.prisma.visit.update({where:{id},data:{status:'COMPLETED',completedAt:new Date(),report:dto.report,nextAction:dto.nextAction,orderCreated:dto.orderCreated??false,orderAmount:dto.orderAmount},include:inc}); }
  async cancel(id: string) { return this.prisma.visit.update({where:{id},data:{status:'CANCELLED'},include:inc}); }
  async delete(id: string) { await this.findOne(id); return this.prisma.visit.delete({where:{id}}); }
  async getStats(userId?: string) {
    const w=userId?{userId}:{};
    const [total,completed,cancelled,withOrder]=await Promise.all([this.prisma.visit.count({where:w}),this.prisma.visit.count({where:{...w,status:'COMPLETED'}}),this.prisma.visit.count({where:{...w,status:'CANCELLED'}}),this.prisma.visit.count({where:{...w,orderCreated:true}})]);
    return {total,completed,cancelled,withOrder,conversionRate:completed>0?Math.round((withOrder/completed)*100):0};
  }
}
