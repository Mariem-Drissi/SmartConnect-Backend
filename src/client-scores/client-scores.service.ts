import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class ClientScoresService {
  constructor(private prisma: PrismaService) {}
  async recalculate(clientId?: string) {
    const clients=await this.prisma.client.findMany({where:clientId?{id:clientId}:{},include:{orders:{where:{status:{not:'CANCELLED'}},orderBy:{createdAt:'desc'}}}});
    const results=[];
    for(const client of clients){
      const orders=client.orders;const now=new Date();
      const lastOrder=orders[0];const lastOrderDays=lastOrder?Math.floor((now.getTime()-lastOrder.createdAt.getTime())/86400000):null;
      const totalRevenue=orders.reduce((s,o)=>s+Number(o.totalAmount),0);
      const sixAgo=new Date(now.getTime()-180*86400000);const recentOrders=orders.filter(o=>o.createdAt>=sixAgo);
      const orderFrequency=recentOrders.length/6;const avgOrderValue=orders.length>0?totalRevenue/orders.length:0;
      let inactivityScore=0;
      if(lastOrderDays===null)inactivityScore=90;else if(lastOrderDays>90)inactivityScore=Math.min(100,lastOrderDays/2);else if(lastOrderDays>30)inactivityScore=lastOrderDays;else inactivityScore=Math.max(0,lastOrderDays-10);
      const potentialScore=Math.min(100,(orderFrequency*20)+(Math.log1p(avgOrderValue)*5)+(Math.log1p(totalRevenue)*3));
      const score=await this.prisma.clientScore.upsert({where:{clientId:client.id},update:{inactivityScore,potentialScore,lastOrderDays,orderFrequency,avgOrderValue,totalRevenue,calculatedAt:now},create:{clientId:client.id,inactivityScore,potentialScore,lastOrderDays,orderFrequency,avgOrderValue,totalRevenue}});
      results.push(score);
    }
    return{recalculated:results.length,results};
  }
  async findAll(sortBy: 'inactivity'|'potential'='inactivity') { return this.prisma.clientScore.findMany({include:{client:true},orderBy:sortBy==='inactivity'?{inactivityScore:'desc'}:{potentialScore:'desc'}}); }
  async getAtRisk(threshold=60) { return this.prisma.clientScore.findMany({where:{inactivityScore:{gte:threshold}},include:{client:true},orderBy:{inactivityScore:'desc'}}); }
}
