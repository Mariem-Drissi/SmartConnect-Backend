import { Injectable,NotFoundException,BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVisitPlanDto,UpdateVisitPlanDto,AddVisitDto } from './dto/visit-plan.dto';
import { nearestNeighbourTSP,GeoPoint } from './tsp.algorithm';

const inc={user:{select:{id:true,firstName:true,lastName:true}},visits:{include:{client:true},orderBy:{order:'asc' as const}}};

@Injectable()
export class VisitPlansService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId?: string,date?: string) {
    return this.prisma.visitPlan.findMany({where:{...(userId&&{userId}),...(date&&{date:{gte:new Date(date+'T00:00:00Z'),lte:new Date(date+'T23:59:59Z')}})},include:inc,orderBy:{date:'desc'}});
  }

  async findOne(id: string) {
    const p=await this.prisma.visitPlan.findUnique({where:{id},include:inc});
    if(!p) throw new NotFoundException('Tournée introuvable');
    return p;
  }

  /** Assignation par l'admin/responsable commercial : crée la tournée ET une visite (PLANNED) pour chaque client assigné. */
  async create(dto: CreateVisitPlanDto) {
    if(!dto.clients?.length) throw new BadRequestException('Au moins un client doit être assigné à la tournée');
    return this.prisma.visitPlan.create({
      data:{
        userId:dto.userId,date:new Date(dto.date),title:dto.title,notes:dto.notes,
        visits:{create:dto.clients.map((c,i)=>({clientId:c.clientId,userId:dto.userId,order:i+1,scheduledAt:c.scheduledAt?new Date(c.scheduledAt):new Date(dto.date)}))},
      },
      include:inc,
    });
  }

  async update(id: string,dto: UpdateVisitPlanDto) {
    await this.findOne(id);
    return this.prisma.visitPlan.update({
      where:{id},
      data:{...(dto.userId&&{userId:dto.userId}),...(dto.date&&{date:new Date(dto.date)}),...(dto.title!==undefined&&{title:dto.title}),...(dto.notes!==undefined&&{notes:dto.notes})},
      include:inc,
    });
  }

  async updateStatus(id: string,status: string) { await this.findOne(id); return this.prisma.visitPlan.update({where:{id},data:{status:status as any},include:inc}); }

  /** Supprime la tournée et toutes ses visites (cascade). */
  async delete(id: string) { await this.findOne(id); return this.prisma.visitPlan.delete({where:{id}}); }

  /** Ajoute un client à visiter dans une tournée existante. */
  async addVisit(planId: string,dto: AddVisitDto) {
    const plan=await this.findOne(planId);
    const maxOrder=Math.max(0,...plan.visits.map((v:any)=>v.order));
    return this.prisma.visit.create({data:{clientId:dto.clientId,userId:plan.userId,visitPlanId:planId,order:maxOrder+1,scheduledAt:dto.scheduledAt?new Date(dto.scheduledAt):plan.date,status:'PLANNED'},include:{client:true}});
  }

  /** Retire un client (une visite) de la tournée. */
  async removeVisit(planId: string,visitId: string) {
    const visit=await this.prisma.visit.findUnique({where:{id:visitId}});
    if(!visit||visit.visitPlanId!==planId) throw new NotFoundException('Visite introuvable dans cette tournée');
    return this.prisma.visit.delete({where:{id:visitId}});
  }

  /** Optimisation TSP — recalcule l'ordre de passage optimal (distance minimale) à partir des coordonnées GPS des clients. */
  async optimize(id: string) {
    const plan=await this.findOne(id);
    const visitsWithGps=(plan.visits as any[]).filter(v=>v.client.latitude!=null&&v.client.longitude!=null);
    if(visitsWithGps.length<2) throw new BadRequestException('Au moins 2 clients avec coordonnées GPS requis pour optimiser');
    const points:GeoPoint[]=visitsWithGps.map(v=>({id:v.id,latitude:v.client.latitude,longitude:v.client.longitude,name:v.client.name}));
    const result=nearestNeighbourTSP(points);
    await this.prisma.$transaction([
      ...result.orderedPoints.map((pt,i)=>{
        const leg=result.legs.find(l=>l.to===pt.id);
        return this.prisma.visit.update({where:{id:pt.id},data:{order:i+1,distanceKm:leg?.distanceKm??0}});
      }),
      this.prisma.visitPlan.update({where:{id},data:{isOptimized:true,totalDistance:result.totalDistanceKm}}),
    ]);
    return {...(await this.findOne(id)),tspResult:result};
  }
}
