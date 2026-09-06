import { Injectable,CanActivate,ExecutionContext,ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { SetMetadata,createParamDecorator } from '@nestjs/common';
@Injectable() export class JwtAuthGuard extends AuthGuard('jwt') {}
export const ROLES_KEY='roles';
export const Roles=(...roles: string[])=>SetMetadata(ROLES_KEY,roles);
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const req=this.reflector.getAllAndOverride<string[]>(ROLES_KEY,[ctx.getHandler(),ctx.getClass()]);
    if(!req) return true;
    const {user}=ctx.switchToHttp().getRequest();
    if(!req.includes(user.role)) throw new ForbiddenException('Accès refusé');
    return true;
  }
}
export const CurrentUser=createParamDecorator((_:unknown,ctx:ExecutionContext)=>ctx.switchToHttp().getRequest().user);
