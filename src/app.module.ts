import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { ProspectsModule } from './prospects/prospects.module';
import { ProductsModule } from './products/products.module';
import { StockModule } from './stock/stock.module';
import { SalesModule } from './sales/sales.module';
import { VisitsModule } from './visits/visits.module';
import { VisitPlansModule } from './visit-plans/visit-plans.module';
import { ClientScoresModule } from './client-scores/client-scores.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AiInsightsModule } from './ai-insights/ai-insights.module';
import { AnalyticsModule } from './analytics/analytics.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule, MailModule, AuthModule, UsersModule, ClientsModule,
    ProspectsModule, ProductsModule, StockModule, SalesModule,
    VisitsModule, VisitPlansModule, ClientScoresModule, DashboardModule, AiInsightsModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
