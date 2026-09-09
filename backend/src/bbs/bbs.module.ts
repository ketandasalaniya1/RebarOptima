import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BbsController } from './bbs.controller';
import { BbsService } from './bbs.service';
import { BbsCalculationService } from './bbs-calculation.service';

import { Project, ProjectSchema } from './schemas/project.schema';
import { BlockWing, BlockWingSchema } from './schemas/block-wing.schema';
import { LevelFloor, LevelFloorSchema } from './schemas/level-floor.schema';
import { ShapeRegister, ShapeRegisterSchema } from './schemas/shape-register.schema';
import { ElementTemplate, ElementTemplateSchema } from './schemas/element-template.schema';
import { StructuralMember, StructuralMemberSchema } from './schemas/structural-member.schema';
import { RebarItem, RebarItemSchema } from './schemas/rebar-item.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Project.name, schema: ProjectSchema },
      { name: BlockWing.name, schema: BlockWingSchema },
      { name: LevelFloor.name, schema: LevelFloorSchema },
      { name: ShapeRegister.name, schema: ShapeRegisterSchema },
      { name: ElementTemplate.name, schema: ElementTemplateSchema },
      { name: StructuralMember.name, schema: StructuralMemberSchema },
      { name: RebarItem.name, schema: RebarItemSchema },
    ]),
  ],
  controllers: [BbsController],
  providers: [BbsService, BbsCalculationService],
  exports: [BbsService, BbsCalculationService],
})
export class BbsModule {}
