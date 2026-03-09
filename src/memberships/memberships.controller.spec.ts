import { Test, TestingModule } from '@nestjs/testing';
import { MembershipsController } from './memberships.controller';
import { MembershipsService } from './memberships.service';

describe('MembershipsController', () => {
  let controller: MembershipsController;
  let service: MembershipsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MembershipsController],
      providers: [
        {
          provide: MembershipsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            findByUser: jest.fn(),
            findByGroup: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            toggleAdmin: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<MembershipsController>(MembershipsController);
    service = module.get<MembershipsService>(MembershipsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a membership', async () => {
      const createMembershipDto = {
        id_user: 1,
        id_group: 1,
        is_admin: false,
      };

      jest.spyOn(service, 'create').mockResolvedValue({
        id_membership: 1,
        ...createMembershipDto,
        joined_at: new Date(),
        user: null,
        group: null,
      });

      const result = await controller.create(createMembershipDto);
      expect(result).toBeDefined();
      expect(service.create).toHaveBeenCalledWith(createMembershipDto);
    });
  });

  describe('findAll', () => {
    it('should return an array of memberships', async () => {
      jest.spyOn(service, 'findAll').mockResolvedValue([]);

      const result = await controller.findAll();
      expect(Array.isArray(result)).toBe(true);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findByUser', () => {
    it('should return memberships of a user', async () => {
      jest.spyOn(service, 'findByUser').mockResolvedValue([]);

      const result = await controller.findByUser(1);
      expect(Array.isArray(result)).toBe(true);
      expect(service.findByUser).toHaveBeenCalledWith(1);
    });
  });
});
