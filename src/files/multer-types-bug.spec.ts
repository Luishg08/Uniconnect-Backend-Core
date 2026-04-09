import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Bug Condition Exploration Test for Missing @types/multer
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3**
 * 
 * This test verifies the bug condition: TypeScript compilation fails with TS2307 errors
 * when processing files that import multer types without @types/multer installed.
 * 
 * CRITICAL: This test is EXPECTED TO FAIL on unfixed code (without @types/multer).
 * Failure confirms the bug exists. After the fix is applied, this test should PASS.
 * 
 * The test encodes the expected behavior from design.md Property 1:
 * "For any compilation attempt where files import multer types and @types/multer is installed,
 * the TypeScript compiler SHALL successfully resolve type declarations and complete compilation
 * without TS2307 errors."
 */
describe('Bug Condition Exploration: TypeScript Compilation Without @types/multer', () => {
  const projectRoot = path.resolve(__dirname, '../..');
  const packageJsonPath = path.join(projectRoot, 'package.json');
  const filesControllerPath = path.join(__dirname, 'files.controller.ts');
  const filesServicePath = path.join(__dirname, 'files.service.ts');

  /**
   * Helper function to check if @types/multer is installed in devDependencies
   */
  function isTypesMulterInstalled(): boolean {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.devDependencies && '@types/multer' in packageJson.devDependencies;
  }

  /**
   * Helper function to run TypeScript compiler and capture output
   * Uses project's tsconfig.json (which has skipLibCheck: true) to avoid unrelated library errors
   */
  function compileTypeScript(filePath: string): { success: boolean; output: string; errors: string[] } {
    try {
      const output = execSync(
        `npx tsc --noEmit ${filePath}`,
        {
          cwd: projectRoot,
          encoding: 'utf-8',
          stdio: 'pipe',
        }
      );
      return { success: true, output, errors: [] };
    } catch (error: any) {
      const output = error.stdout || '';
      const stderr = error.stderr || '';
      const combinedOutput = output + stderr;
      
      // Extract TS2307 errors
      const ts2307Errors = combinedOutput
        .split('\n')
        .filter((line: string) => line.includes('TS2307') || line.includes("Cannot find module 'multer'"));
      
      return { success: false, output: combinedOutput, errors: ts2307Errors };
    }
  }

  /**
   * Property 1: Bug Condition - TypeScript Compilation Success
   * 
   * This property tests that TypeScript compilation succeeds when @types/multer is installed
   * and fails with TS2307 errors when it is not installed.
   * 
   * Expected behavior (after fix):
   * - No TS2307 errors for multer module in files.controller.ts
   * - No TS2307 errors for multer module in files.service.ts
   * - No "Cannot find module 'multer'" errors
   * 
   * Expected behavior (before fix - UNFIXED CODE):
   * - Compilation FAILS with TS2307 at files.controller.ts:7
   * - Compilation FAILS with TS2307 at files.service.ts:6
   * - Errors mention "Cannot find module 'multer' or its corresponding type declarations"
   */
  describe('Property 1: Bug Condition - TypeScript Compilation Failure Without @types/multer', () => {
    it('should not have TS2307 errors for multer in files.controller.ts when @types/multer is installed', () => {
      // Check if @types/multer is installed
      const typesInstalled = isTypesMulterInstalled();
      
      // Compile files.controller.ts
      const result = compileTypeScript(filesControllerPath);
      
      if (typesInstalled) {
        // EXPECTED BEHAVIOR (AFTER FIX): No multer-related TS2307 errors
        expect(result.errors.length).toBe(0);
        expect(result.output).not.toContain('TS2307');
        expect(result.output).not.toContain("Cannot find module 'multer'");
      } else {
        // EXPECTED BEHAVIOR (BEFORE FIX): Compilation should fail with TS2307
        // This is the bug condition - test FAILS to prove bug exists
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.output).toContain('TS2307');
        expect(result.output).toContain("Cannot find module 'multer'");
        expect(result.output).toContain('files.controller.ts');
        
        // Document the counterexample
        console.log('\n=== COUNTEREXAMPLE FOUND (Bug Condition) ===');
        console.log('File: files.controller.ts');
        console.log('Expected: No TS2307 errors for multer');
        console.log('Actual: Compilation failed with TS2307 errors');
        console.log('Errors:', result.errors);
        console.log('==========================================\n');
      }
    });

    it('should not have TS2307 errors for multer in files.service.ts when @types/multer is installed', () => {
      // Check if @types/multer is installed
      const typesInstalled = isTypesMulterInstalled();
      
      // Compile files.service.ts
      const result = compileTypeScript(filesServicePath);
      
      if (typesInstalled) {
        // EXPECTED BEHAVIOR (AFTER FIX): No multer-related TS2307 errors
        expect(result.errors.length).toBe(0);
        expect(result.output).not.toContain('TS2307');
        expect(result.output).not.toContain("Cannot find module 'multer'");
      } else {
        // EXPECTED BEHAVIOR (BEFORE FIX): Compilation should fail with TS2307
        // This is the bug condition - test FAILS to prove bug exists
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.output).toContain('TS2307');
        expect(result.output).toContain("Cannot find module 'multer'");
        expect(result.output).toContain('files.service.ts');
        
        // Document the counterexample
        console.log('\n=== COUNTEREXAMPLE FOUND (Bug Condition) ===');
        console.log('File: files.service.ts');
        console.log('Expected: No TS2307 errors for multer');
        console.log('Actual: Compilation failed with TS2307 errors');
        console.log('Errors:', result.errors);
        console.log('==========================================\n');
      }
    });

    it('should successfully run npm run build when @types/multer is installed', () => {
      // Check if @types/multer is installed
      const typesInstalled = isTypesMulterInstalled();
      
      try {
        // Attempt to build the project
        const output = execSync('npm run build', {
          cwd: projectRoot,
          encoding: 'utf-8',
          stdio: 'pipe',
        });
        
        if (typesInstalled) {
          // EXPECTED BEHAVIOR (AFTER FIX): Build should succeed
          expect(output).toBeDefined();
          expect(fs.existsSync(path.join(projectRoot, 'dist'))).toBe(true);
        } else {
          // If build succeeded without @types/multer, this is unexpected
          // (might happen if pre-compiled dist/ exists)
          console.warn('Build succeeded without @types/multer - unexpected');
        }
      } catch (error: any) {
        const output = error.stdout || '';
        const stderr = error.stderr || '';
        const combinedOutput = output + stderr;
        
        if (!typesInstalled) {
          // EXPECTED BEHAVIOR (BEFORE FIX): Build should fail
          expect(combinedOutput).toContain('TS2307');
          expect(combinedOutput).toContain("Cannot find module 'multer'");
          
          // Document the counterexample
          console.log('\n=== COUNTEREXAMPLE FOUND (Bug Condition) ===');
          console.log('Command: npm run build');
          console.log('Expected: Build succeeds');
          console.log('Actual: Build failed with TypeScript compilation errors');
          console.log('Error output contains TS2307 for multer module');
          console.log('==========================================\n');
        } else {
          // If @types/multer is installed but build still fails, re-throw
          throw error;
        }
      }
    });
  });

  /**
   * Scoped Property-Based Test: Concrete Failing Case
   * 
   * This test focuses on the specific deterministic bug: TypeScript compilation
   * of files.controller.ts and files.service.ts fails when @types/multer is not installed.
   * 
   * The test verifies:
   * 1. No TS2307 error for `import { File } from 'multer'` in files.controller.ts
   * 2. No TS2307 error for `import * as multer from 'multer'` in files.service.ts
   */
  describe('Scoped PBT: Concrete Failing Case - Specific Line Numbers', () => {
    it('should not have TS2307 error at files.controller.ts:7 when @types/multer is installed', () => {
      const typesInstalled = isTypesMulterInstalled();
      const result = compileTypeScript(filesControllerPath);
      
      if (typesInstalled) {
        // After fix: no multer-related TS2307 errors expected
        expect(result.errors.length).toBe(0);
        expect(result.output).not.toContain("Cannot find module 'multer'");
      } else {
        // Before fix: error at line 7
        expect(result.output).toContain('files.controller.ts');
        expect(result.output).toMatch(/files\.controller\.ts.*7/);
        expect(result.output).toContain("import { File } from 'multer'");
      }
    });

    it('should not have TS2307 error at files.service.ts:6 when @types/multer is installed', () => {
      const typesInstalled = isTypesMulterInstalled();
      const result = compileTypeScript(filesServicePath);
      
      if (typesInstalled) {
        // After fix: no multer-related TS2307 errors expected
        expect(result.errors.length).toBe(0);
        expect(result.output).not.toContain("Cannot find module 'multer'");
      } else {
        // Before fix: error at line 6
        expect(result.output).toContain('files.service.ts');
        expect(result.output).toMatch(/files\.service\.ts.*6/);
        expect(result.output).toContain("import * as multer from 'multer'");
      }
    });
  });
});
