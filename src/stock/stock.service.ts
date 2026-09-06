import { Injectable,NotFoundException,BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { StockMovementDto,UpdateThresholdDto,AssignCommercialStockDto,CommercialStockMovementDto,UpdateCommercialThresholdDto } from './dto/stock.dto';

@Injectable()
export class StockService {
  constructor(private prisma: PrismaService, private mail: MailService) {}

  // ── Dépôt central (produits finis) ─────────────────────────────────
  async getAllProductStocks() { return this.prisma.productStock.findMany({include:{product:{include:{category:true}}},orderBy:{product:{name:'asc'}}}); }
  async getLowAlerts() { return (await this.prisma.productStock.findMany({include:{product:{include:{category:true}}}})).filter(s=>s.quantity<=s.minThreshold); }
  async addMovement(dto: StockMovementDto,userId: string) {
    const stock=await this.prisma.productStock.findUnique({where:{id:dto.stockId}});
    if(!stock) throw new NotFoundException('Stock introuvable');
    if(dto.type==='OUT'&&stock.quantity<dto.quantity) throw new BadRequestException('Stock insuffisant');
    const nq=dto.type==='IN'?stock.quantity+dto.quantity:dto.type==='OUT'?stock.quantity-dto.quantity:dto.quantity;
    const [mv]=await this.prisma.$transaction([this.prisma.stockMovement.create({data:{stockId:dto.stockId,type:dto.type,quantity:dto.quantity,reason:dto.reason,reference:dto.reference,performedBy:userId}}),this.prisma.productStock.update({where:{id:dto.stockId},data:{quantity:nq}})]);
    return mv;
  }
  async getMovements(stockId?: string) { return this.prisma.stockMovement.findMany({where:stockId?{stockId}:{},include:{user:{select:{firstName:true,lastName:true}},stock:{include:{product:true}}},orderBy:{createdAt:'desc'},take:100}); }
  async updateThreshold(stockId: string,dto: UpdateThresholdDto) { return this.prisma.productStock.update({where:{id:stockId},data:{minThreshold:dto.minThreshold}}); }
  async deleteMovement(id:string){ return this.prisma.stockMovement.delete({where:{id}}); }

  // ── Stock assigné à chaque commercial (van / tournée) ───────────────
  async getCommercialStocks(userId?: string) {
    return this.prisma.commercialStock.findMany({where:userId?{userId}:{},include:{product:{include:{category:true}}},orderBy:{product:{name:'asc'}}});
  }
  async getCommercialStockAlerts(userId?: string) {
    const stocks=await this.prisma.commercialStock.findMany({where:userId?{userId}:{},include:{product:true,user:{select:{firstName:true,lastName:true,id:true}}}});
    return stocks.filter(s=>s.quantity<=s.minThreshold);
  }
  /** Assigner (créer ou réapprovisionner) du stock à un commercial — décrémente le dépôt central si suffisant. */
  async assignToCommercial(dto: AssignCommercialStockDto, performedBy: string) {
    const product=await this.prisma.product.findUnique({where:{id:dto.productId}});
    if(!product) throw new NotFoundException('Produit introuvable');
    const depot=await this.prisma.productStock.findUnique({where:{productId:dto.productId}});
    if(depot){
      if(depot.quantity<dto.quantity) throw new BadRequestException('Stock dépôt insuffisant pour cette allocation');
      await this.prisma.productStock.update({where:{id:depot.id},data:{quantity:depot.quantity-dto.quantity}});
    }
    const existing=await this.prisma.commercialStock.findUnique({where:{userId_productId:{userId:dto.userId,productId:dto.productId}}});
    let commercialStock;
    if(existing){
      commercialStock=await this.prisma.commercialStock.update({where:{id:existing.id},data:{quantity:existing.quantity+dto.quantity,...(dto.minThreshold!=null&&{minThreshold:dto.minThreshold})}});
    }else{
      commercialStock=await this.prisma.commercialStock.create({data:{userId:dto.userId,productId:dto.productId,quantity:dto.quantity,minThreshold:dto.minThreshold??10}});
    }
    await this.prisma.commercialStockMovement.create({data:{commercialStockId:commercialStock.id,type:'IN',quantity:dto.quantity,reason:'Allocation dépôt → commercial',performedBy}});
    return commercialStock;
  }
  async addCommercialMovement(dto: CommercialStockMovementDto, performedBy: string) {
    const cs=await this.prisma.commercialStock.findUnique({where:{id:dto.commercialStockId}});
    if(!cs) throw new NotFoundException('Stock commercial introuvable');
    if(dto.type==='OUT'&&cs.quantity<dto.quantity) throw new BadRequestException('Stock du commercial insuffisant');
    const nq=dto.type==='IN'?cs.quantity+dto.quantity:dto.type==='OUT'?cs.quantity-dto.quantity:dto.quantity;
    const [mv]=await this.prisma.$transaction([
      this.prisma.commercialStockMovement.create({data:{commercialStockId:dto.commercialStockId,type:dto.type,quantity:dto.quantity,reason:dto.reason,performedBy}}),
      this.prisma.commercialStock.update({where:{id:dto.commercialStockId},data:{quantity:nq}}),
    ]);
    await this.checkLowStockAndAlert(dto.commercialStockId);
    return mv;
  }
  async updateCommercialThreshold(id: string, dto: UpdateCommercialThresholdDto) { return this.prisma.commercialStock.update({where:{id},data:{minThreshold:dto.minThreshold}}); }
  async deleteCommercialStock(id: string) { return this.prisma.commercialStock.delete({where:{id}}); }
  async getCommercialMovements(commercialStockId?: string, userId?: string) {
    return this.prisma.commercialStockMovement.findMany({
      where:{...(commercialStockId&&{commercialStockId}),...(userId&&{commercialStock:{userId}})},
      include:{user:{select:{firstName:true,lastName:true}},commercialStock:{include:{product:true}}},
      orderBy:{createdAt:'desc'},take:100,
    });
  }

  /** Décrémente le stock du commercial suite à une vente exécutée. Appelé par SalesService à la création de la commande. */
  async decrementForSale(userId: string, items: {productId:string;quantity:number}[]) {
    for(const item of items){
      const cs=await this.prisma.commercialStock.findUnique({where:{userId_productId:{userId,productId:item.productId}}});
      if(!cs) throw new BadRequestException(`Aucun stock assigné pour ce produit — contactez votre responsable`);
      if(cs.quantity<item.quantity) throw new BadRequestException(`Stock insuffisant (${cs.quantity} disponible)`);
      const nq=cs.quantity-item.quantity;
      await this.prisma.$transaction([
        this.prisma.commercialStockMovement.create({data:{commercialStockId:cs.id,type:'OUT',quantity:item.quantity,reason:'Vente exécutée',performedBy:userId}}),
        this.prisma.commercialStock.update({where:{id:cs.id},data:{quantity:nq}}),
      ]);
      await this.checkLowStockAndAlert(cs.id);
    }
  }

  /** Alerte le commercial + son responsable commercial quand le stock passe sous le seuil. */
  private async checkLowStockAndAlert(commercialStockId: string) {
    const cs=await this.prisma.commercialStock.findUnique({where:{id:commercialStockId},include:{product:true,user:true}});
    if(!cs || cs.quantity>cs.minThreshold) return;
    const managers=await this.prisma.user.findMany({where:{role:{in:['ADMIN','RESPONSABLE_COMMERCIAL']},isActive:true}});
    const recipients=[cs.user.email,...managers.map(m=>m.email)];
    try{
      await this.mail.sendStockAlert(recipients,{
        commercialName:`${cs.user.firstName} ${cs.user.lastName}`,
        productName:cs.product.name,
        quantity:cs.quantity,
        minThreshold:cs.minThreshold,
      });
    }catch(e){ /* l'échec d'envoi mail ne doit pas bloquer la vente */ console.warn('stock alert mail failed',e); }
  }
}
