import { Module } from '@nestjs/common';
import { ClientScoresController } from './client-scores.controller';
import { ClientScoresService } from './client-scores.service';
@Module({ controllers:[ClientScoresController],providers:[ClientScoresService],exports:[ClientScoresService] })
export class ClientScoresModule {}
