import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}
  async getKpis(userId?: string, role?: string) {
    const isAdmin=['ADMIN','RESPONSABLE_COMMERCIAL'].includes(role??'');
    const orderFilter=isAdmin?{status:{not:'CANCELLED' as any}}:{createdById:userId,status:{not:'CANCELLED' as any}};
    const [totalClients,activeClients,totalOrders,atRiskClients,productStocks,lowCommercialStocks,pendingVisits,prospects] = await Promise.all([
      this.prisma.client.count(),this.prisma.client.count({where:{isActive:true}}),
      this.prisma.saleOrder.count({where:orderFilter}),
      this.prisma.clientScore.count({where:{inactivityScore:{gte:60}}}),
      this.prisma.productStock.findMany({include:{product:true}}),
      this.prisma.commercialStock.findMany({where:isAdmin?{}:{userId}}),
      this.prisma.visit.count({where:{status:{in:['PLANNED','IN_PROGRESS']},...(!isAdmin&&{userId})}}),
      this.prisma.prospect.count({where:{status:{not:'CONVERTED'}}}),
    ]);
    const lowStockProducts=productStocks.filter(s=>s.quantity<=s.minThreshold).length;
    const lowCommercialStockCount=lowCommercialStocks.filter(s=>s.quantity<=s.minThreshold).length;
    const som=new Date(new Date().getFullYear(),new Date().getMonth(),1);
    const ordersThisMonth=await this.prisma.saleOrder.findMany({where:{...orderFilter,createdAt:{gte:som}}});
    const revenueThisMonth=ordersThisMonth.reduce((s,o)=>s+Number(o.totalAmount),0);
    const recentOrders=await this.prisma.saleOrder.findMany({where:orderFilter,take:5,orderBy:{createdAt:'desc'},include:{client:true}});
    const topClients=await this.prisma.saleOrder.groupBy({by:['clientId'],where:{status:{not:'CANCELLED'}},_sum:{totalAmount:true},orderBy:{_sum:{totalAmount:'desc'}},take:5});
    const topClientsWithData=await Promise.all(topClients.map(async tc=>({client:await this.prisma.client.findUnique({where:{id:tc.clientId}}),revenue:Number(tc._sum.totalAmount??0)})));
    const salesByMonth=await this.getSalesByMonth(isAdmin?undefined:userId);
    return {kpis:{totalClients,activeClients,totalOrders,revenueThisMonth,atRiskClients,lowStockProducts,lowCommercialStockCount,pendingVisits,prospects},recentOrders,topClients:topClientsWithData,salesByMonth};
  }
  async getSalesByMonth(userId?: string) {
    const months=[];const now=new Date();
    for(let i=5;i>=0;i--){
      const d=new Date(now.getFullYear(),now.getMonth()-i,1);
      const end=new Date(now.getFullYear(),now.getMonth()-i+1,0,23,59,59);
      const orders=await this.prisma.saleOrder.findMany({where:{createdAt:{gte:d,lte:end},status:{not:'CANCELLED'},...(userId&&{createdById:userId})}});
      months.push({month:d.toLocaleDateString('fr-FR',{month:'short'}),revenue:orders.reduce((s,o)=>s+Number(o.totalAmount),0),count:orders.length});
    }
    return months;
  }
}
