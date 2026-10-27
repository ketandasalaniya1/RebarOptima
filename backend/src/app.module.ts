import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CompaniesModule } from './companies/companies.module';
import { InventoryModule } from './inventory/inventory.module';
import { BatchesModule } from './batches/batches.module';
import { BbsModule } from './bbs/bbs.module';
import { ProjectsModule } from './projects/projects.module';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/rebar_optima'),
    AuthModule,
    UsersModule,
    CompaniesModule,
    InventoryModule,
    BatchesModule,
    BbsModule,
    ProjectsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}


