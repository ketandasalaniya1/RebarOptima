import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ProjectsService } from './projects.service';
import { Project } from './project.schema';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let mockProjectModel: any;

  beforeEach(async () => {
    mockProjectModel = jest.fn().mockImplementation((dto) => ({
      ...dto,
      save: jest.fn().mockResolvedValue({ _id: 'proj_123', ...dto }),
    }));

    mockProjectModel.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          { _id: 'proj_1', name: 'Project Alpha', status: 'active' },
        ]),
      }),
    });

    mockProjectModel.findOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        _id: 'proj_1',
        companyId: 'comp_1',
        name: 'Project Alpha',
        status: 'active',
        geofences: [],
        assignedPartnerAdminIds: [],
        save: jest.fn().mockImplementation(function () { return Promise.resolve(this); }),
      }),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: getModelToken(Project.name),
          useValue: mockProjectModel,
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  describe('Project Creation & Validation', () => {
    const validDto = {
      name: 'Skyline Heights',
      address: 'S.G. Highway, Bodakdev',
      pincode: '380054',
      location: { latitude: 23.0338, longitude: 72.585 },
      projectType: 'Residential',
    };

    it('should create project with valid fields for Admin', async () => {
      const user = { _id: 'usr_admin', role: 'ADMIN' };
      const created = await service.create('comp_1', validDto, user);
      expect(created).toBeDefined();
      expect(created.name).toBe('Skyline Heights');
    });

    it('should deny project creation if user is PROJECT_PARTNER_ADMIN', async () => {
      const user = { _id: 'usr_partner', role: 'PROJECT_PARTNER_ADMIN' };
      await expect(service.create('comp_1', validDto, user)).rejects.toThrow(ForbiddenException);
    });

    it('should reject invalid Indian pincode (less than 6 digits)', async () => {
      const user = { _id: 'usr_admin', role: 'ADMIN' };
      const invalid = { ...validDto, pincode: '38005' };
      await expect(service.create('comp_1', invalid, user)).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid Indian pincode starting with 0', async () => {
      const user = { _id: 'usr_admin', role: 'ADMIN' };
      const invalid = { ...validDto, pincode: '080054' };
      await expect(service.create('comp_1', invalid, user)).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid coordinates (latitude > 90)', async () => {
      const user = { _id: 'usr_admin', role: 'ADMIN' };
      const invalid = { ...validDto, location: { latitude: 120, longitude: 72 } };
      await expect(service.create('comp_1', invalid, user)).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid project type', async () => {
      const user = { _id: 'usr_admin', role: 'ADMIN' };
      const invalid = { ...validDto, projectType: 'SpaceStation' };
      await expect(service.create('comp_1', invalid, user)).rejects.toThrow(BadRequestException);
    });
  });

  describe('Geofence Configuration Validation', () => {
    it('should reject circular geofence with non-positive radius', async () => {
      const user = { _id: 'usr_admin', role: 'ADMIN' };
      const invalidGf: any = [{
        name: 'Main Perimeter',
        boundaryType: 'circle',
        center: { latitude: 23.03, longitude: 72.58 },
        radius: -10,
      }];
      await expect(service.updateGeofences('proj_1', 'comp_1', invalidGf, user)).rejects.toThrow(BadRequestException);
    });

    it('should reject circular geofence with radius exceeding reasonable limit (50000m)', async () => {
      const user = { _id: 'usr_admin', role: 'ADMIN' };
      const invalidGf: any = [{
        name: 'Main Perimeter',
        boundaryType: 'circle',
        center: { latitude: 23.03, longitude: 72.58 },
        radius: 60000,
      }];
      await expect(service.updateGeofences('proj_1', 'comp_1', invalidGf, user)).rejects.toThrow(BadRequestException);
    });

    it('should reject polygon geofence with fewer than 3 points', async () => {
      const user = { _id: 'usr_admin', role: 'ADMIN' };
      const invalidGf: any = [{
        name: 'Site Polygon',
        boundaryType: 'polygon',
        coordinates: [
          [72.58, 23.03],
          [72.59, 23.04],
        ],
      }];
      await expect(service.updateGeofences('proj_1', 'comp_1', invalidGf, user)).rejects.toThrow(BadRequestException);
    });

    it('should accept valid circular and polygon geofences', async () => {
      const user = { _id: 'usr_admin', role: 'ADMIN' };
      const validGfs: any = [
        {
          name: 'Site Circle',
          boundaryType: 'circle',
          center: { latitude: 23.03, longitude: 72.58 },
          radius: 250,
          isActive: true,
        },
        {
          name: 'Site Polygon',
          boundaryType: 'polygon',
          coordinates: [
            [72.58, 23.03],
            [72.59, 23.04],
            [72.57, 23.05],
          ],
          isActive: true,
        },
      ];
      const updated = await service.updateGeofences('proj_1', 'comp_1', validGfs, user);
      expect(updated.geofences.length).toBe(2);
    });
  });

  describe('Project Partner Admin Isolation', () => {
    it('should deny Project Partner Admin from accessing an unassigned project', async () => {
      const partnerUser = {
        _id: 'usr_partner',
        role: 'PROJECT_PARTNER_ADMIN',
        assignedProjects: ['proj_other_999'],
      };
      await expect(service.findOne('proj_1', 'comp_1', partnerUser)).rejects.toThrow(ForbiddenException);
    });

    it('should allow Project Partner Admin to access assigned project', async () => {
      const partnerUser = {
        _id: 'usr_partner',
        role: 'PROJECT_PARTNER_ADMIN',
        assignedProjects: ['proj_1'],
      };
      const proj = await service.findOne('proj_1', 'comp_1', partnerUser);
      expect(proj).toBeDefined();
      expect(proj.name).toBe('Project Alpha');
    });
  });
});
