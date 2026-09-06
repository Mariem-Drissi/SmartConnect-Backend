import { Controller,Get,Post,Patch,Delete,Body,Param,UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto,UpdateUserDto,CreatePermissionProfileDto } from './dto/user.dto';
import { JwtAuthGuard,RolesGuard,Roles } from '../auth/guards/index';
@Controller('users') @UseGuards(JwtAuthGuard,RolesGuard) @Roles('ADMIN')
export class UsersController {
  constructor(private u: UsersService) {}
  @Get() findAll() { return this.u.findAll(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.u.findOne(id); }
  @Post() create(@Body() dto: CreateUserDto) { return this.u.create(dto); }
  @Patch(':id') update(@Param('id') id: string,@Body() dto: UpdateUserDto) { return this.u.update(id,dto); }
  @Patch(':id/toggle-active') toggle(@Param('id') id: string) { return this.u.toggleActive(id); }
  @Post(':id/reset-password') reset(@Param('id') id: string) { return this.u.resetPassword(id); }
  @Get('profiles/all') getProfiles() { return this.u.getProfiles(); }
  @Post('profiles') createProfile(@Body() dto: CreatePermissionProfileDto) { return this.u.createProfile(dto); }
  @Patch('profiles/:id') updateProfile(@Param('id') id: string,@Body() dto: any) { return this.u.updateProfile(id,dto); }
  @Delete('profiles/:id') deleteProfile(@Param('id') id: string) { return this.u.deleteProfile(id); }
}
