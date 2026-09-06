import { Module } from '@nestjs/common';
import { VisitPlansController } from './visit-plans.controller';
import { VisitPlansService } from './visit-plans.service';
@Module({ controllers:[VisitPlansController],providers:[VisitPlansService],exports:[VisitPlansService] })
export class VisitPlansModule {}
