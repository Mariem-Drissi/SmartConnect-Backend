import { Injectable,UnauthorizedException,NotFoundException,BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { LoginDto,ChangePasswordDto,ForgotPasswordDto,ResetPasswordDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService,private jwt: JwtService,private mail: MailService) {}

  async login(dto: LoginDto) {
    const user=await this.prisma.user.findUnique({where:{email:dto.email},include:{permissionProfile:true}});
    if(!user||!user.isActive) throw new UnauthorizedException('Identifiants invalides ou compte inactif');
    if(!await bcrypt.compare(dto.password,user.password)) throw new UnauthorizedException('Identifiants invalides');
    const token=this.jwt.sign({sub:user.id,email:user.email,role:user.role});
    const {password,passwordResetToken,passwordResetExpires,...safe}=user;
    return {token,user:safe};
  }

  async getProfile(userId: string) {
    const u=await this.prisma.user.findUnique({where:{id:userId},include:{permissionProfile:true}});
    const {password,passwordResetToken,passwordResetExpires,...safe}=u;
    return safe;
  }

  async changePassword(userId: string,dto: ChangePasswordDto) {
    const u=await this.prisma.user.findUnique({where:{id:userId}});
    if(!await bcrypt.compare(dto.currentPassword,u.password)) throw new UnauthorizedException('Mot de passe actuel incorrect');
    await this.prisma.user.update({where:{id:userId},data:{password:await bcrypt.hash(dto.newPassword,10)}});
    return {message:'Mot de passe modifié avec succès'};
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user=await this.prisma.user.findUnique({where:{email:dto.email}});
    // Always return success to prevent user enumeration
    if(!user||!user.isActive) return {message:'Si cet email existe, un lien de réinitialisation a été envoyé.'};
    const token=uuidv4();
    const expires=new Date(Date.now()+60*60*1000); // 1 hour
    await this.prisma.user.update({where:{id:user.id},data:{passwordResetToken:token,passwordResetExpires:expires}});
    await this.mail.sendPasswordResetEmail(user.email,user.firstName,token);
    return {message:'Si cet email existe, un lien de réinitialisation a été envoyé.'};
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user=await this.prisma.user.findFirst({where:{passwordResetToken:dto.token,passwordResetExpires:{gt:new Date()}}});
    if(!user) throw new BadRequestException('Token invalide ou expiré');
    await this.prisma.user.update({where:{id:user.id},data:{password:await bcrypt.hash(dto.newPassword,10),passwordResetToken:null,passwordResetExpires:null}});
    return {message:'Mot de passe réinitialisé avec succès'};
  }
}
