import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ProductsService } from "./products.service";
import {
  CreateProductDto,
  UpdateProductDto,
  CreateCategoryDto,
} from "./dto/product.dto";
import { JwtAuthGuard, RolesGuard, Roles } from "../auth/guards/index";
@Controller("products")
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private p: ProductsService) {}
  @Get() findAll(
    @Query("active") a?: string,
    @Query("categoryId") cid?: string,
    @Query("archived") archived?: string,
  ) {
    return this.p.findAll(a === "true", cid, archived === "true");
  }
  @Get("categories") getCategories() {
    return this.p.getCategories();
  }
  @Get(":id") findOne(@Param("id") id: string) {
    return this.p.findOne(id);
  }
  @Post() @UseGuards(RolesGuard) @Roles("ADMIN") create(
    @Body() dto: CreateProductDto,
  ) {
    return this.p.create(dto);
  }
  @Patch(":id/archive") @UseGuards(RolesGuard) @Roles("ADMIN") archive(
    @Param("id") id: string,
  ) {
    return this.p.archive(id);
  }
  @Patch(":id/restore") @UseGuards(RolesGuard) @Roles("ADMIN") restore(
    @Param("id") id: string,
  ) {
    return this.p.restore(id);
  }
  @Patch(":id") @UseGuards(RolesGuard) @Roles("ADMIN") update(
    @Param("id") id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.p.update(id, dto);
  }
  @Delete(":id") @UseGuards(RolesGuard) @Roles("ADMIN") remove(
    @Param("id") id: string,
  ) {
    return this.p.remove(id);
  }
  @Post("categories") @UseGuards(RolesGuard) @Roles("ADMIN") createCategory(
    @Body() dto: CreateCategoryDto,
  ) {
    return this.p.createCategory(dto);
  }
  @Patch("categories/:id")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  updateCategory(
    @Param("id") id: string,
    @Body() dto: Partial<CreateCategoryDto>,
  ) {
    return this.p.updateCategory(id, dto);
  }
  @Delete("categories/:id")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  removeCategory(@Param("id") id: string) {
    return this.p.removeCategory(id);
  }
}
