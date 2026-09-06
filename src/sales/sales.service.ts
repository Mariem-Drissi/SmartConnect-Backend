import { Injectable,NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { StockService } from '../stock/stock.service';
import { CreateOrderDto,UpdateOrderStatusDto,SignOrderDto } from './dto/sales.dto';
@Injectable()
export class SalesService {
  constructor(private prisma: PrismaService,private mail: MailService,private stock: StockService) {}
  async findAllOrders(status?: string,clientId?: string,createdById?: string) {
    return this.prisma.saleOrder.findMany({
      where:{...(status&&{status:status as any}),...(clientId&&{clientId}),...(createdById&&{createdById})},
      include:{client:true,items:{include:{product:true}},createdBy:{select:{firstName:true,lastName:true}}},
      orderBy:{createdAt:'desc'},
    });
  }
  async findOneOrder(id: string) {
    const o=await this.prisma.saleOrder.findUnique({where:{id},include:{client:true,items:{include:{product:{include:{category:true}}}},createdBy:{select:{firstName:true,lastName:true}}}});
    if(!o) throw new NotFoundException('Commande introuvable'); return o;
  }
  async createOrder(dto: CreateOrderDto,userId: string) {
    const user=await this.prisma.user.findUnique({where:{id:userId}});
    // Vente exécutée par un commercial terrain : le stock est décrémenté de son stock assigné (van/tournée)
    if(user?.role==='COMMERCIAL'){
      await this.stock.decrementForSale(userId,dto.items.map(i=>({productId:i.productId,quantity:i.quantity})));
    }
    const count=await this.prisma.saleOrder.count();
    const reference=`CMD-${new Date().getFullYear()}-${String(count+1).padStart(5,'0')}`;
    const totalAmount=dto.items.reduce((s,i)=>s+i.quantity*i.unitPrice,0);
    return this.prisma.saleOrder.create({data:{reference,clientId:dto.clientId,deliveryDate:dto.deliveryDate?new Date(dto.deliveryDate):null,notes:dto.notes,totalAmount,createdById:userId,items:{create:dto.items.map(i=>({productId:i.productId,quantity:i.quantity,unitPrice:i.unitPrice,subtotal:i.quantity*i.unitPrice}))}},include:{client:true,items:{include:{product:true}}}});
  }
  async updateStatus(id: string,dto: UpdateOrderStatusDto) { await this.findOneOrder(id); return this.prisma.saleOrder.update({where:{id},data:{status:dto.status as any}}); }
  async signOrder(id: string,dto: SignOrderDto) {
    const order=await this.findOneOrder(id);
    const updated=await this.prisma.saleOrder.update({where:{id},data:{signatureData:dto.signatureData,signedAt:new Date(),status:'SIGNED'},include:{client:true,items:{include:{product:true}}}});
    if(updated.client.email) {
      const invoiceHtml=this.generateInvoiceHtml(updated);
      await this.mail.sendInvoiceEmail(updated.client.email,updated.client.name,updated.reference,invoiceHtml);
    }
    return updated;
  }
  private generateInvoiceHtml(order: any): string {
    const items=order.items.map((i:any)=>`<tr><td style="padding:8px;border-bottom:1px solid #242B3D;color:#C4C9D6">${i.product.name}</td><td style="padding:8px;border-bottom:1px solid #242B3D;text-align:center;color:#C4C9D6">${i.quantity}</td><td style="padding:8px;border-bottom:1px solid #242B3D;text-align:right;color:#C4C9D6">${Number(i.unitPrice).toFixed(3)} TND</td><td style="padding:8px;border-bottom:1px solid #242B3D;text-align:right;color:#E7C27D;font-weight:bold">${Number(i.subtotal).toFixed(3)} TND</td></tr>`).join('');
    return `<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;background:#0F131B;color:#EEF0F5;padding:40px;border-radius:12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:32px"><div><h1 style="color:#E7C27D;margin:0">Gusto Club</h1><p style="color:#8991A6;margin:4px 0">Tunis, Tunisie</p></div><div style="text-align:right"><h2 style="color:#7FE0CB;margin:0">FACTURE</h2><p style="color:#C4C9D6;margin:4px 0">${order.reference}</p><p style="color:#8991A6;font-size:13px">${new Date(order.signedAt).toLocaleDateString('fr-FR')}</p></div></div><div style="background:#1B2130;border-radius:8px;padding:16px;margin-bottom:24px"><p style="margin:0;color:#8991A6;font-size:12px">CLIENT</p><p style="margin:4px 0;font-size:16px;font-weight:bold;color:#EEF0F5">${order.client.name}</p>${order.client.address?`<p style="margin:2px 0;color:#C4C9D6">${order.client.address}</p>`:''}</div><table style="width:100%;border-collapse:collapse"><thead><tr style="background:#242B3D"><th style="padding:10px;text-align:left;color:#8991A6;font-size:12px">PRODUIT</th><th style="padding:10px;text-align:center;color:#8991A6;font-size:12px">QTÉ</th><th style="padding:10px;text-align:right;color:#8991A6;font-size:12px">P.U.</th><th style="padding:10px;text-align:right;color:#8991A6;font-size:12px">TOTAL</th></tr></thead><tbody>${items}</tbody></table><div style="text-align:right;margin-top:16px;background:#1B2130;padding:16px;border-radius:8px"><p style="margin:0;font-size:20px;font-weight:bold;color:#E7C27D">TOTAL : ${Number(order.totalAmount).toFixed(3)} TND</p></div><div style="margin-top:32px;text-align:center;padding:16px;border:1px solid #242B3D;border-radius:8px"><p style="color:#8991A6;font-size:12px">Document signé électroniquement le ${new Date(order.signedAt).toLocaleDateString('fr-FR')} — SmartConnect Gusto Club</p></div></div>`;
  }
  async getSalesStats(createdById?: string) {
    const where=createdById?{createdById,status:{not:'CANCELLED' as any}}:{status:{not:'CANCELLED' as any}};
    const orders=await this.prisma.saleOrder.findMany({where,select:{totalAmount:true,status:true,createdAt:true}});
    const total=orders.reduce((s,o)=>s+Number(o.totalAmount),0);
    const byStatus=orders.reduce((acc,o)=>{acc[o.status]=(acc[o.status]??0)+1;return acc;},{} as any);

    // Historique 6 derniers mois (pour les courbes dashboard/performance)
    const months:{key:string;label:string}[]=[];
    const now=new Date();
    for(let i=5;i>=0;i--){
      const d=new Date(now.getFullYear(),now.getMonth()-i,1);
      months.push({key:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,label:d.toLocaleDateString('fr-FR',{month:'short'})});
    }
    const last6Months=months.map(m=>{
      const revenue=orders.filter(o=>{const k=`${o.createdAt.getFullYear()}-${String(o.createdAt.getMonth()+1).padStart(2,'0')}`;return k===m.key;}).reduce((s,o)=>s+Number(o.totalAmount),0);
      return {month:m.key,label:m.label,revenue:Math.round(revenue)};
    });

    return {total,count:orders.length,byStatus,totalRevenue:total,totalOrders:orders.length,last6Months};
  }
}
