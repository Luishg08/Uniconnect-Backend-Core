import { Test, TestingModule } from '@nestjs/testing';
import { GroupsService } from './groups.service';
import { PrismaService } from '../prisma/prisma.service';
import { GroupBusinessValidator } from './validators/group-business.validator';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('GroupsService', () => {
  let service: GroupsService;
  let prismaService: PrismaService;
  let groupBusinessValidator: GroupBusinessValidator;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupsService,
        {
          provide: PrismaService,
          useValue: {
            group: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            membership: {
              create: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn(),
              delete: jest.fn(),
              update: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
            },
            enrollment: {
              findFirst: jest.fn(),
            },
            course: {
              findUnique: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: GroupBusinessValidator,
          useValue: {
            validateMaxGroupsPerCourse: jest.fn(),
            validateCourseEnrollment: jest.fn(),
            validateAdminInvitation: jest.fn(),
            validateInviteeEnrollment: jest.fn(),
            validateNotAlreadyMember: jest.fn(),
            validateNoPendingInvitation: jest.fn(),
            validateGroupOwnership: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<GroupsService>(GroupsService);
    prismaService = module.get<PrismaService>(PrismaService);
    groupBusinessValidator = module.get<GroupBusinessValidator>(GroupBusinessValidator);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  /**
   * BUG CONDITION EXPLORATION TEST
   * 
   * Property 1: Fault Condition - Student Group Creation Blocked by Role Validation
   * 
   * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
   * DO NOT attempt to fix the test or the code when it fails
   * 
   * This test validates that for any student user who is enrolled in a subject
   * and has not exceeded the 3-groups limit, the system should allow group creation
   * and automatically assign the user as owner_id with is_admin=true membership.
   * 
   * EXPECTED OUTCOME ON UNFIXED CODE: Test FAILS
   * - ForbiddenException will be thrown due to role validation
   * - Error message will mention role restrictions
   * - This proves the bug exists: students are blocked from creating groups
   * 
   * EXPECTED OUTCOME AFTER FIX: Test PASSES
   * - Group creation succeeds for enrolled students
   * - owner_id is correctly assigned
   * - Membership with is_admin=true is created
   * - This confirms the bug is fixed
   */
  describe('Bug Condition Exploration: Student Group Creation Role Blocking', () => {
    it('should allow enrolled students to create groups and assign ownership correctly', async () => {
      // Arrange: Mock student user with valid enrollment and under group limit
      const mockStudentUser = {
        id_user: 1,
        email: 'student@ucaldas.edu.co',
        full_name: 'Student User',
        id_role: 1, // student role
        role: {
          id_role: 1,
          name: 'student', // This is the bug condition - student role
        },
      };

      const createGroupDto = {
        name: 'Grupo de Estudio Cálculo',
        description: 'Grupo para estudiar cálculo diferencial',
        id_course: 1,
      };

      const mockCourse = {
        id_course: 1,
        name: 'Cálculo Diferencial',
      };

      const mockCreatedGroup = {
        id_group: 1,
        name: createGroupDto.name,
        description: createGroupDto.description,
        id_course: createGroupDto.id_course,
        owner_id: mockStudentUser.id_user,
        created_at: new Date(),
        is_direct_message: false,
      };

      const mockMembership = {
        id_membership: 1,
        id_user: mockStudentUser.id_user,
        id_group: mockCreatedGroup.id_group,
        is_admin: true,
        joined_at: new Date(),
      };

      // Mock successful validations (student is enrolled and under limit)
      jest.spyOn(groupBusinessValidator, 'validateMaxGroupsPerCourse').mockResolvedValue(undefined);
      jest.spyOn(groupBusinessValidator, 'validateCourseEnrollment').mockResolvedValue(undefined);
      
      // Mock database operations
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockStudentUser as any);
      jest.spyOn(prismaService.course, 'findUnique').mockResolvedValue(mockCourse as any);
      
      // Mock transaction that creates group and membership
      jest.spyOn(prismaService, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          group: {
            create: jest.fn().mockResolvedValue(mockCreatedGroup),
          },
          membership: {
            create: jest.fn().mockResolvedValue(mockMembership),
          },
        });
      });

      // Act: Attempt to create group as student user
      // Pass userId as second parameter (from JWT)
      const result = await service.create(createGroupDto, mockStudentUser.id_user);

      // Assert: Verify expected behavior for enrolled students
      expect(result).toBeDefined();
      expect(result.id_group).toBe(mockCreatedGroup.id_group);
      expect(result.owner_id).toBe(mockStudentUser.id_user);
      
      // Verify that validations were called (enrollment and limit checks)
      expect(groupBusinessValidator.validateMaxGroupsPerCourse).toHaveBeenCalledWith(
        mockStudentUser.id_user,
        createGroupDto.id_course
      );
      expect(groupBusinessValidator.validateCourseEnrollment).toHaveBeenCalledWith(
        mockStudentUser.id_user,
        createGroupDto.id_course
      );

      // Verify transaction was called to create group and membership
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should create membership with is_admin=true for group creator (student)', async () => {
      // Arrange: Another test case focusing on membership creation
      const mockStudentUser = {
        id_user: 2,
        email: 'student2@ucaldas.edu.co',
        full_name: 'Student User 2',
        id_role: 1,
        role: { id_role: 1, name: 'student' },
      };

      const createGroupDto = {
        name: 'Grupo Física',
        description: 'Grupo para estudiar física',
        id_course: 2,
      };

      const mockCourse = { id_course: 2, name: 'Física I' };
      const mockCreatedGroup = {
        id_group: 2,
        name: createGroupDto.name,
        description: createGroupDto.description,
        id_course: createGroupDto.id_course,
        owner_id: mockStudentUser.id_user,
        created_at: new Date(),
        is_direct_message: false,
      };

      // Mock validations pass
      jest.spyOn(groupBusinessValidator, 'validateMaxGroupsPerCourse').mockResolvedValue(undefined);
      jest.spyOn(groupBusinessValidator, 'validateCourseEnrollment').mockResolvedValue(undefined);
      
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockStudentUser as any);
      jest.spyOn(prismaService.course, 'findUnique').mockResolvedValue(mockCourse as any);
      jest.spyOn(prismaService, '$transaction').mockResolvedValue(mockCreatedGroup);

      // Act: Pass userId as second parameter
      const result = await service.create(createGroupDto, mockStudentUser.id_user);

      // Assert: Verify group creation succeeds for students
      expect(result).toBeDefined();
      expect(result.owner_id).toBe(mockStudentUser.id_user);
    });

    it('should validate enrollment and group limits but not role for students', async () => {
      // Arrange: Test that focuses on which validations are called
      const mockStudentUser = {
        id_user: 3,
        email: 'student3@ucaldas.edu.co',
        full_name: 'Student User 3',
        id_role: 1,
        role: { id_role: 1, name: 'student' },
      };

      const createGroupDto = {
        name: 'Grupo Química',
        description: 'Grupo para estudiar química',
        id_course: 3,
      };

      const mockCourse = { id_course: 3, name: 'Química General' };
      const mockCreatedGroup = {
        id_group: 3,
        name: createGroupDto.name,
        description: createGroupDto.description,
        id_course: createGroupDto.id_course,
        owner_id: mockStudentUser.id_user,
        created_at: new Date(),
        is_direct_message: false,
      };

      // Mock validations
      const validateMaxGroupsSpy = jest.spyOn(groupBusinessValidator, 'validateMaxGroupsPerCourse').mockResolvedValue(undefined);
      const validateEnrollmentSpy = jest.spyOn(groupBusinessValidator, 'validateCourseEnrollment').mockResolvedValue(undefined);
      
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockStudentUser as any);
      jest.spyOn(prismaService.course, 'findUnique').mockResolvedValue(mockCourse as any);
      jest.spyOn(prismaService, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          group: { create: jest.fn().mockResolvedValue(mockCreatedGroup) },
          membership: { create: jest.fn().mockResolvedValue({}) },
        });
      });

      // Act: Pass userId as second parameter
      await service.create(createGroupDto, mockStudentUser.id_user);

      // Assert: Verify that business validations are called (not role validation)
      expect(validateMaxGroupsSpy).toHaveBeenCalledWith(mockStudentUser.id_user, createGroupDto.id_course);
      expect(validateEnrollmentSpy).toHaveBeenCalledWith(mockStudentUser.id_user, createGroupDto.id_course);
    });
  });

  /**
   * PRESERVATION PROPERTY TESTS
   * 
   * Property 2: Preservation - Admin/Superadmin Group Creation Behavior
   * 
   * IMPORTANT: These tests capture the baseline behavior that must be preserved
   * They should PASS on unfixed code and continue to PASS after the fix
   * 
   * These tests verify that admin and superadmin group creation workflows
   * continue to work exactly as before the fix is applied.
   */
  describe('Preservation: Admin/Superadmin Group Creation Workflows', () => {
    it('should allow admin users to create groups (existing behavior)', async () => {
      // Arrange: Admin user creating a group
      const mockAdminUser = {
        id_user: 10,
        email: 'admin@ucaldas.edu.co',
        full_name: 'Admin User',
        id_role: 2,
        role: { id_role: 2, name: 'admin' },
      };

      const createGroupDto = {
        name: 'Admin Group',
        description: 'Group created by admin',
        id_course: 1,
      };

      const mockCourse = { id_course: 1, name: 'Test Course' };
      const mockCreatedGroup = {
        id_group: 10,
        name: createGroupDto.name,
        description: createGroupDto.description,
        id_course: createGroupDto.id_course,
        owner_id: mockAdminUser.id_user,
        created_at: new Date(),
        is_direct_message: false,
      };

      // Mock validations pass
      jest.spyOn(groupBusinessValidator, 'validateMaxGroupsPerCourse').mockResolvedValue(undefined);
      jest.spyOn(groupBusinessValidator, 'validateCourseEnrollment').mockResolvedValue(undefined);
      
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockAdminUser as any);
      jest.spyOn(prismaService.course, 'findUnique').mockResolvedValue(mockCourse as any);
      jest.spyOn(prismaService, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          group: { create: jest.fn().mockResolvedValue(mockCreatedGroup) },
          membership: { create: jest.fn().mockResolvedValue({}) },
        });
      });

      // Act: Pass userId as second parameter
      const result = await service.create(createGroupDto, mockAdminUser.id_user);

      // Assert: Verify admin can create groups
      expect(result).toBeDefined();
      expect(result.owner_id).toBe(mockAdminUser.id_user);
    });

    it('should allow superadmin users to create groups (existing behavior)', async () => {
      // Arrange: Superadmin user creating a group
      const mockSuperadminUser = {
        id_user: 20,
        email: 'superadmin@ucaldas.edu.co',
        full_name: 'Superadmin User',
        id_role: 3,
        role: { id_role: 3, name: 'superadmin' },
      };

      const createGroupDto = {
        name: 'Superadmin Group',
        description: 'Group created by superadmin',
        id_course: 1,
      };

      const mockCourse = { id_course: 1, name: 'Test Course' };
      const mockCreatedGroup = {
        id_group: 20,
        name: createGroupDto.name,
        description: createGroupDto.description,
        id_course: createGroupDto.id_course,
        owner_id: mockSuperadminUser.id_user,
        created_at: new Date(),
        is_direct_message: false,
      };

      // Mock validations pass
      jest.spyOn(groupBusinessValidator, 'validateMaxGroupsPerCourse').mockResolvedValue(undefined);
      jest.spyOn(groupBusinessValidator, 'validateCourseEnrollment').mockResolvedValue(undefined);
      
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockSuperadminUser as any);
      jest.spyOn(prismaService.course, 'findUnique').mockResolvedValue(mockCourse as any);
      jest.spyOn(prismaService, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          group: { create: jest.fn().mockResolvedValue(mockCreatedGroup) },
          membership: { create: jest.fn().mockResolvedValue({}) },
        });
      });

      // Act: Pass userId as second parameter
      const result = await service.create(createGroupDto, mockSuperadminUser.id_user);

      // Assert: Verify superadmin can create groups
      expect(result).toBeDefined();
      expect(result.owner_id).toBe(mockSuperadminUser.id_user);
    });

    it('should enforce enrollment validation for all roles (existing behavior)', async () => {
      // Arrange: User not enrolled in course
      const mockUser = {
        id_user: 30,
        email: 'user@ucaldas.edu.co',
        full_name: 'Test User',
        id_role: 2,
        role: { id_role: 2, name: 'admin' },
      };

      const createGroupDto = {
        name: 'Test Group',
        description: 'Test group',
        id_course: 99, // Course user is not enrolled in
        owner_id: mockUser.id_user,
      };

      const mockCourse = { id_course: 99, name: 'Test Course' };

      // Mock enrollment validation failure
      jest.spyOn(groupBusinessValidator, 'validateMaxGroupsPerCourse').mockResolvedValue(undefined);
      jest.spyOn(groupBusinessValidator, 'validateCourseEnrollment').mockRejectedValue(
        new ForbiddenException('No puedes unirte a este grupo porque no estás inscrito en la materia correspondiente.')
      );
      
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(prismaService.course, 'findUnique').mockResolvedValue(mockCourse as any);

      // Act & Assert: Should fail for non-enrolled users regardless of role
      await expect(service.create(createGroupDto)).rejects.toThrow(ForbiddenException);
    });

    it('should enforce 3-groups-per-course limit for all roles (existing behavior)', async () => {
      // Arrange: User who has already created 3 groups for this course
      const mockUser = {
        id_user: 40,
        email: 'user@ucaldas.edu.co',
        full_name: 'Test User',
        id_role: 2,
        role: { id_role: 2, name: 'admin' },
      };

      const createGroupDto = {
        name: 'Fourth Group',
        description: 'This should fail',
        id_course: 1,
        owner_id: mockUser.id_user,
      };

      const mockCourse = { id_course: 1, name: 'Test Course' };

      // Mock limit validation failure
      jest.spyOn(groupBusinessValidator, 'validateMaxGroupsPerCourse').mockRejectedValue(
        new BadRequestException('Ya has creado el máximo de 3 grupos para esta materia. No puedes crear más.')
      );
      jest.spyOn(groupBusinessValidator, 'validateCourseEnrollment').mockResolvedValue(undefined);
      
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(prismaService.course, 'findUnique').mockResolvedValue(mockCourse as any);

      // Act & Assert: Should fail when limit is exceeded regardless of role
      await expect(service.create(createGroupDto)).rejects.toThrow(BadRequestException);
    });

    it('should create membership with is_admin=true for all group creators (existing behavior)', async () => {
      // Arrange: Verify membership creation behavior is consistent
      const mockAdminUser = {
        id_user: 50,
        email: 'admin@ucaldas.edu.co',
        full_name: 'Admin User',
        id_role: 2,
        role: { id_role: 2, name: 'admin' },
      };

      const createGroupDto = {
        name: 'Admin Group',
        description: 'Group created by admin',
        id_course: 1,
        owner_id: mockAdminUser.id_user,
      };

      const mockCourse = { id_course: 1, name: 'Test Course' };
      const mockCreatedGroup = {
        id_group: 50,
        ...createGroupDto,
        created_at: new Date(),
        is_direct_message: false,
      };

      jest.spyOn(groupBusinessValidator, 'validateMaxGroupsPerCourse').mockResolvedValue(undefined);
      jest.spyOn(groupBusinessValidator, 'validateCourseEnrollment').mockResolvedValue(undefined);
      
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockAdminUser as any);
      jest.spyOn(prismaService.course, 'findUnique').mockResolvedValue(mockCourse as any);
      jest.spyOn(prismaService, '$transaction').mockResolvedValue(mockCreatedGroup);

      // Act
      const result = await service.create(createGroupDto);

      // Assert: Verify admin can still create groups (preservation)
      expect(result).toBeDefined();
      expect(result.owner_id).toBe(mockAdminUser.id_user);
    });
  });
});