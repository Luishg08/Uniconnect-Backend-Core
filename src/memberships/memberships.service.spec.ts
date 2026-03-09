import { Test, TestingModule } from '@nestjs/testing';
import { MembershipsService } from './memberships.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MembershipsService', () => {
  let service: MembershipsService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembershipsService,
        {
          provide: PrismaService,
          useValue: {
            membership: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<MembershipsService>(MembershipsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a membership', async () => {
      const createMembershipDto = {
        id_user: 1,
        id_group: 1,
        is_admin: false,
      };

      jest.spyOn(prismaService.membership, 'create').mockResolvedValue({
        id_membership: 1,
        ...createMembershipDto,
        joined_at: new Date(),
      });

      const result = await service.create(createMembershipDto);
      expect(result).toBeDefined();
      expect(prismaService.membership.create).toHaveBeenCalled();
    });
  });

  describe('findByUser', () => {
    it('should find all memberships of a user', async () => {
      jest.spyOn(prismaService.membership, 'findMany').mockResolvedValue([]);

      const result = await service.findByUser(1);
      expect(Array.isArray(result)).toBe(true);
      expect(prismaService.membership.findMany).toHaveBeenCalledWith({
        where: { id_user: 1 },
        include: { group: true, user: true },
      });
    });
  });

  describe('findByGroup', () => {
    it('should find all memberships of a group', async () => {
      jest.spyOn(prismaService.membership, 'findMany').mockResolvedValue([]);

      const result = await service.findByGroup(1);
      expect(Array.isArray(result)).toBe(true);
      expect(prismaService.membership.findMany).toHaveBeenCalledWith({
        where: { id_group: 1 },
        include: { user: true },
      });
    });
  });
});
