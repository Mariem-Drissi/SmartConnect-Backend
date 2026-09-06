import { Injectable,NotFoundException,ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CreateUserDto,UpdateUserDto,CreatePermissionProfileDto } from './dto/user.dto';
import * as bcrypt from 'bcrypt';

const SEL={id:true,email:true,firstName:true,lastName:true,phone:true,zone:true,role:true,isActive:true,createdAt:true,permissionProfile:true};

function generatePassword(): string {
  const chars='ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
  let pwd='';
  for(let i=0;i<10;i++) pwd+=chars[Math.floor(Math.random()*chars.length)];
  return pwd;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService,private mail: MailService) {}

  async findAll() { return this.prisma.user.findMany({select:SEL,orderBy:{createdAt:'desc'}}); }
  async findOne(id: string) { const u=await this.prisma.user.findUnique({where:{id},select:SEL}); if(!u) throw new NotFoundException('Utilisateur introuvable'); return u; }

  async create(dto: CreateUserDto) {
    if(await this.prisma.user.findUnique({where:{email:dto.email}})) throw new ConflictException('Email déjà utilisé');
    const password=generatePassword();
    const user=await this.prisma.user.create({data:{...dto,password:await bcrypt.hash(password,10),role:dto.role??'COMMERCIAL'},select:SEL});
    // Send welcome email with credentials
    await this.mail.sendWelcomeEmail(dto.email,dto.firstName,password);
    return {user,message:'Compte créé. Les identifiants ont été envoyés par email.'};
  }

  async update(id: string,dto: UpdateUserDto) { await this.findOne(id); return this.prisma.user.update({where:{id},data:dto,select:SEL}); }
  async toggleActive(id: string) { const u=await this.findOne(id); return this.prisma.user.update({where:{id},data:{isActive:!u.isActive},select:SEL}); }
  async resetPassword(id: string) {
    const u=await this.prisma.user.findUnique({where:{id}});
    if(!u) throw new NotFoundException('Utilisateur introuvable');
    const password=generatePassword();
    await this.prisma.user.update({where:{id},data:{password:await bcrypt.hash(password,10)}});
    await this.mail.sendWelcomeEmail(u.email,u.firstName,password);
    return {message:'Nouveau mot de passe envoyé par email'};
  }
  async getProfiles() { return this.prisma.permissionProfile.findMany({include:{_count:{select:{users:true}}}}); }
  async createProfile(dto: CreatePermissionProfileDto) { return this.prisma.permissionProfile.create({data:dto}); }
  async updateProfile(id: string,dto: any) { return this.prisma.permissionProfile.update({where:{id},data:dto}); }
  async deleteProfile(id: string) { return this.prisma.permissionProfile.delete({where:{id}}); }
}
