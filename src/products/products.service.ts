import { Injectable,NotFoundException,ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto,UpdateProductDto,CreateCategoryDto } from './dto/product.dto';
@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}
  async findAll(onlyActive=false,categoryId?: string) { return this.prisma.product.findMany({where:{...(onlyActive&&{isActive:true}),...(categoryId&&{categoryId})},include:{stock:true,category:true},orderBy:{name:'asc'}}); }
  async findOne(id: string) { const p=await this.prisma.product.findUnique({where:{id},include:{stock:true,category:true}}); if(!p) throw new NotFoundException('Produit introuvable'); return p; }
  async create(dto: CreateProductDto) { if(await this.prisma.product.findUnique({where:{sku:dto.sku}})) throw new ConflictException('SKU déjà existant'); const p=await this.prisma.product.create({data:dto as any}); await this.prisma.productStock.create({data:{productId:p.id,quantity:0,minThreshold:50}}); return this.findOne(p.id); }
  async update(id: string,dto: UpdateProductDto) { await this.findOne(id); return this.prisma.product.update({where:{id},data:dto as any,include:{stock:true,category:true}}); }
  async remove(id: string) {
    await this.findOne(id);
    const orderItems=await this.prisma.saleOrderItem.count({where:{productId:id}});
    if(orderItems>0){
      // Produit déjà utilisé dans des commandes : on désactive plutôt que de supprimer pour préserver l'historique
      return this.prisma.product.update({where:{id},data:{isActive:false}});
    }
    await this.prisma.commercialStock.deleteMany({where:{productId:id}});
    await this.prisma.productStock.deleteMany({where:{productId:id}});
    return this.prisma.product.delete({where:{id}});
  }
  async getCategories() { return this.prisma.productCategory.findMany({include:{_count:{select:{products:true}}}}); }
  async createCategory(dto: CreateCategoryDto) { return this.prisma.productCategory.create({data:dto}); }
  async updateCategory(id: string,dto: Partial<CreateCategoryDto>) { return this.prisma.productCategory.update({where:{id},data:dto}); }
  async removeCategory(id: string) {
    const count=await this.prisma.product.count({where:{categoryId:id}});
    if(count>0) throw new ConflictException('Catégorie utilisée par des produits — réassignez-les avant de supprimer');
    return this.prisma.productCategory.delete({where:{id}});
  }
}
