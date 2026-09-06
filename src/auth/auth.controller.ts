import { Controller,Post,Get,Patch,Body,UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto,ChangePasswordDto,ForgotPasswordDto,ResetPasswordDto } from './dto/auth.dto';
import { JwtAuthGuard,CurrentUser } from './guards/index';
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}
  @Post('login') login(@Body() dto: LoginDto) { return this.auth.login(dto); }
  @Get('profile') @UseGuards(JwtAuthGuard) getProfile(@CurrentUser() u: any) { return this.auth.getProfile(u.id); }
  @Patch('change-password') @UseGuards(JwtAuthGuard) changePassword(@CurrentUser() u: any,@Body() dto: ChangePasswordDto) { return this.auth.changePassword(u.id,dto); }
  @Post('forgot-password') forgotPassword(@Body() dto: ForgotPasswordDto) { return this.auth.forgotPassword(dto); }
  @Post('reset-password') resetPassword(@Body() dto: ResetPasswordDto) { return this.auth.resetPassword(dto); }
}
