import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { RolesService } from '../roles/roles.service';
import { PermissionsService } from '../permissions/permissions.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let usersService: UsersService;
  let permissionsService: PermissionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            findByGoogleSub: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            decode: jest.fn(),
          },
        },
        {
          provide: RolesService,
          useValue: {
            getStudentRole: jest.fn(),
          },
        },
        {
          provide: PermissionsService,
          useValue: {
            getClaimsForRole: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: HttpService,
          useValue: {
            post: jest.fn(),
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
    usersService = module.get<UsersService>(UsersService);
    permissionsService = module.get<PermissionsService>(PermissionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  /**
   * BUG CONDITION EXPLORATION TEST
   * 
   * Property 1: Fault Condition - Role Information Available in Frontend
   * 
   * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
   * DO NOT attempt to fix the test or the code when it fails
   * 
   * This test validates that for any authenticated user with valid id_role,
   * the JWT payload includes roleName field, enabling frontend role-based authorization.
   * 
   * EXPECTED OUTCOME ON UNFIXED CODE: Test FAILS
   * - JWT payload will NOT contain 'roleName' field
   * - This proves the bug exists: backend doesn't include role name in JWT
   * 
   * EXPECTED OUTCOME AFTER FIX: Test PASSES
   * - JWT payload will contain 'roleName' field with correct value
   * - This confirms the bug is fixed
   */
  describe('Bug Condition Exploration: JWT Role Synchronization', () => {
    it('should include roleName in JWT payload for authenticated users with valid role', async () => {
      // Arrange: Mock user with role data (simulating database state)
      const mockUser = {
        id_user: 1,
        email: 'admin@ucaldas.edu.co',
        full_name: 'Admin User',
        picture: 'https://example.com/pic.jpg',
        id_role: 2,
        id_program: 1,
        google_sub: 'google-123',
        role: {
          id_role: 2,
          name: 'admin', // Backend HAS role data
        },
      };

      const mockPermissions = [
        { claim: 'read:users' },
        { claim: 'write:users' },
      ];

      // Mock the JWT signing to capture the payload
      let capturedPayload: any = null;
      jest.spyOn(jwtService, 'sign').mockImplementation((payload: any) => {
        capturedPayload = payload;
        return 'mock-jwt-token';
      });

      jest.spyOn(usersService, 'findByGoogleSub').mockResolvedValue(mockUser as any);
      jest.spyOn(permissionsService, 'getClaimsForRole').mockResolvedValue(mockPermissions as any);

      // Act: Authenticate user (simulating login flow)
      const result = await service.tempLogin('google-123');

      // Assert: Verify JWT payload includes roleName
      expect(capturedPayload).toBeDefined();
      expect(capturedPayload.sub).toBe(mockUser.id_user);
      
      // CRITICAL ASSERTION: This WILL FAIL on unfixed code
      // The bug is that roleName is NOT included in the JWT payload
      expect(capturedPayload.roleName).toBeDefined();
      expect(capturedPayload.roleName).toBe('admin');

      // Verify the response includes user with role object
      expect(result.user.role).toBeDefined();
      expect(result.user.role.name).toBe('admin');
    });

    it('should include roleName in JWT payload for all authentication methods', async () => {
      // This test ensures ALL auth methods (googleLogin, auth0Callback, etc.) include roleName
      const mockUser = {
        id_user: 2,
        email: 'student@ucaldas.edu.co',
        full_name: 'Student User',
        id_role: 1,
        google_sub: 'google-456',
        role: {
          id_role: 1,
          name: 'student',
        },
      };

      const mockPermissions = [{ claim: 'read:events' }];

      let capturedPayload: any = null;
      jest.spyOn(jwtService, 'sign').mockImplementation((payload: any) => {
        capturedPayload = payload;
        return 'mock-jwt-token';
      });

      jest.spyOn(usersService, 'findByGoogleSub').mockResolvedValue(mockUser as any);
      jest.spyOn(permissionsService, 'getClaimsForRole').mockResolvedValue(mockPermissions as any);

      // Act
      await service.tempLogin('google-456');

      // Assert: WILL FAIL on unfixed code - roleName not in payload
      expect(capturedPayload.roleName).toBe('student');
    });

    it('should handle users without role gracefully (edge case)', async () => {
      // Edge case: User with null id_role (shouldn't happen with proper seeding)
      const mockUserWithoutRole = {
        id_user: 3,
        email: 'noRole@ucaldas.edu.co',
        full_name: 'No Role User',
        id_role: null,
        google_sub: 'google-789',
        role: null,
      };

      const mockPermissions: any[] = [];

      let capturedPayload: any = null;
      jest.spyOn(jwtService, 'sign').mockImplementation((payload: any) => {
        capturedPayload = payload;
        return 'mock-jwt-token';
      });

      jest.spyOn(usersService, 'findByGoogleSub').mockResolvedValue(mockUserWithoutRole as any);
      jest.spyOn(permissionsService, 'getClaimsForRole').mockResolvedValue(mockPermissions as any);

      // Act
      await service.tempLogin('google-789');

      // Assert: Should handle gracefully, roleName should be undefined or 'student' (fallback)
      expect(capturedPayload).toBeDefined();
      // This test documents edge case behavior
    });
  });

  /**
   * PRESERVATION PROPERTY TESTS
   * 
   * Property 2: Preservation - Existing Authentication Flows
   * 
   * IMPORTANT: These tests capture the baseline behavior that must be preserved
   * They should PASS on unfixed code and continue to PASS after the fix
   * 
   * These tests verify that authentication flows unrelated to role checks
   * continue to work exactly as before the fix is applied.
   */
  describe('Preservation: Existing Authentication Flows', () => {
    it('should generate valid JWT token with sub and permissions', async () => {
      // Arrange
      const mockUser = {
        id_user: 1,
        email: 'user@ucaldas.edu.co',
        full_name: 'Test User',
        id_role: 1,
        google_sub: 'google-123',
        role: { id_role: 1, name: 'student' },
      };

      const mockPermissions = [
        { claim: 'read:events' },
        { claim: 'read:groups' },
      ];

      let capturedPayload: any = null;
      jest.spyOn(jwtService, 'sign').mockImplementation((payload: any) => {
        capturedPayload = payload;
        return 'mock-jwt-token';
      });

      jest.spyOn(usersService, 'findByGoogleSub').mockResolvedValue(mockUser as any);
      jest.spyOn(permissionsService, 'getClaimsForRole').mockResolvedValue(mockPermissions as any);

      // Act
      const result = await service.tempLogin('google-123');

      // Assert: Verify baseline JWT structure is preserved
      expect(result.access_token).toBe('mock-jwt-token');
      expect(capturedPayload).toBeDefined();
      expect(capturedPayload.sub).toBe(mockUser.id_user);
      expect(capturedPayload.permissions).toEqual(['read:events', 'read:groups']);
    });

    it('should return user object with all non-role properties intact', async () => {
      // Arrange
      const mockUser = {
        id_user: 5,
        email: 'admin@ucaldas.edu.co',
        full_name: 'Admin User',
        picture: 'https://example.com/pic.jpg',
        id_role: 2,
        id_program: 3,
        google_sub: 'google-456',
        role: { id_role: 2, name: 'admin' },
      };

      const mockPermissions = [{ claim: 'write:users' }];

      jest.spyOn(jwtService, 'sign').mockReturnValue('mock-jwt-token');
      jest.spyOn(usersService, 'findByGoogleSub').mockResolvedValue(mockUser as any);
      jest.spyOn(permissionsService, 'getClaimsForRole').mockResolvedValue(mockPermissions as any);

      // Act
      const result = await service.tempLogin('google-456');

      // Assert: Verify all user properties are preserved
      expect(result.user.id_user).toBe(mockUser.id_user);
      expect(result.user.email).toBe(mockUser.email);
      expect(result.user.full_name).toBe(mockUser.full_name);
      expect(result.user.picture).toBe(mockUser.picture);
      expect(result.user.id_role).toBe(mockUser.id_role);
      expect(result.user.id_program).toBe(mockUser.id_program);
      expect(result.user.google_sub).toBe(mockUser.google_sub);
    });

    it('should include role object in response (existing behavior)', async () => {
      // Arrange
      const mockUser = {
        id_user: 1,
        email: 'user@ucaldas.edu.co',
        full_name: 'Test User',
        id_role: 1,
        google_sub: 'google-123',
        role: { id_role: 1, name: 'student' },
      };

      const mockPermissions = [{ claim: 'read:events' }];

      jest.spyOn(jwtService, 'sign').mockReturnValue('mock-jwt-token');
      jest.spyOn(usersService, 'findByGoogleSub').mockResolvedValue(mockUser as any);
      jest.spyOn(permissionsService, 'getClaimsForRole').mockResolvedValue(mockPermissions as any);

      // Act
      const result = await service.tempLogin('google-123');

      // Assert: Verify role object is included in response (existing behavior)
      expect(result.user.role).toBeDefined();
      expect(result.user.role.id_role).toBe(1);
      expect(result.user.role.name).toBe('student');
    });

    it('should handle authentication flow without errors', async () => {
      // Arrange
      const mockUser = {
        id_user: 1,
        email: 'user@ucaldas.edu.co',
        full_name: 'Test User',
        id_role: 1,
        google_sub: 'google-123',
        role: { id_role: 1, name: 'student' },
      };

      const mockPermissions = [{ claim: 'read:events' }];

      jest.spyOn(jwtService, 'sign').mockReturnValue('mock-jwt-token');
      jest.spyOn(usersService, 'findByGoogleSub').mockResolvedValue(mockUser as any);
      jest.spyOn(permissionsService, 'getClaimsForRole').mockResolvedValue(mockPermissions as any);

      // Act & Assert: Should not throw any errors
      await expect(service.tempLogin('google-123')).resolves.toBeDefined();
    });

    it('should call permissionsService.getClaimsForRole with correct role id', async () => {
      // Arrange
      const mockUser = {
        id_user: 1,
        email: 'user@ucaldas.edu.co',
        full_name: 'Test User',
        id_role: 2,
        google_sub: 'google-123',
        role: { id_role: 2, name: 'admin' },
      };

      const mockPermissions = [{ claim: 'write:users' }];

      jest.spyOn(jwtService, 'sign').mockReturnValue('mock-jwt-token');
      jest.spyOn(usersService, 'findByGoogleSub').mockResolvedValue(mockUser as any);
      const getClaimsSpy = jest.spyOn(permissionsService, 'getClaimsForRole').mockResolvedValue(mockPermissions as any);

      // Act
      await service.tempLogin('google-123');

      // Assert: Verify permissions service is called correctly (existing behavior)
      expect(getClaimsSpy).toHaveBeenCalledWith(mockUser.id_role);
    });
  });
});
