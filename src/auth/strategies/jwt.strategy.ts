import { Injectable,UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt,Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private config: ConfigService,private prisma: PrismaService) {
    super({ jwtFromRequest:ExtractJwt.fromAuthHeaderAsBearerToken(),ignoreExpiration:false,secretOrKey:config.get<string>('JWT_SECRET') });
  }
  async validate(payload: {sub:string;email:string;role:string}) {
    const user=await this.prisma.user.findUnique({where:{id:payload.sub},include:{permissionProfile:true}});
    if(!user||!user.isActive) throw new UnauthorizedException('Compte inactif');
    return {id:user.id,email:user.email,role:user.role,firstName:user.firstName,lastName:user.lastName,permissions:user.permissionProfile?.permissions??null};
  }
}
