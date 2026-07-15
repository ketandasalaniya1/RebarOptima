import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Company } from './company.schema';

@Injectable()
export class CompaniesService {
  constructor(@InjectModel(Company.name) private companyModel: Model<Company>) {}

  async create(name: string, projectName?: string, location?: string): Promise<Company> {
    const newCompany = new this.companyModel({ name, projectName, location });
    return newCompany.save();
  }

  async findById(id: string): Promise<Company | null> {
    return this.companyModel.findById(id).exec();
  }
}
