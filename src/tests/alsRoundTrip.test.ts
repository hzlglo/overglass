import { describe, it, expect } from 'vitest';
import {
  runRoundTripTest,
  findParametersWithPoints
} from './helpers/roundTripTestHelper';

describe('ALS Round-Trip Integration Test', () => {
  console.log('🚀 Starting ALS Round-Trip Integration Test');

  it('should add new automation points without creating duplicates', async () => {
    await runRoundTripTest('add_points', async (db) => {
      const parametersWithPoints = await findParametersWithPoints(db);

      // Add 2 points to first 3 parameters
      for (let i = 0; i < Math.min(3, parametersWithPoints.length); i++) {
        const { parameter } = parametersWithPoints[i];
        await db.automation.createAutomationPoint(parameter.id, 0.25, 0.6);
        await db.automation.createAutomationPoint(parameter.id, 0.75, 0.4);
        console.log(`✅ Added automation points to parameter ${parameter.parameterName}`);
      }
    });
    // All assertions are now handled in runRoundTripTest
  });

  it('should remove automation points without creating duplicates', async () => {
    await runRoundTripTest('remove_points', async (db) => {
      const parametersWithPoints = await findParametersWithPoints(db);

      // Remove first point from first 2 parameters
      for (let i = 0; i < Math.min(2, parametersWithPoints.length); i++) {
        const { parameter, points } = parametersWithPoints[i];
        if (points.length > 0) {
          await db.automation.removeAutomationPoint(parameter.id, points[0].timePosition);
          console.log(`✅ Removed automation point from parameter ${parameter.parameterName}`);
        }
      }
    });
  });

  it('should edit existing automation point values without creating duplicates', async () => {
    await runRoundTripTest('edit_existing_value', async (db) => {
      const parametersWithPoints = await findParametersWithPoints(db);
      expect(parametersWithPoints.length).toBeGreaterThan(0);

      // Edit first point of first 2 parameters
      for (let i = 0; i < Math.min(2, parametersWithPoints.length); i++) {
        const { parameter, points } = parametersWithPoints[i];
        if (points.length > 0) {
          const existingPoint = points[0];
          const originalValue = existingPoint.value;
          const newValue = originalValue === 0 ? 0.8 : 0.2;

          console.log(`🎯 Editing point: parameter="${parameter.parameterName}", time=${existingPoint.timePosition}, value=${originalValue} → ${newValue}`);

          // This should update the existing point, not create a new one
          await db.automation.updateAutomationPoint(existingPoint.id, parameter.id, existingPoint.timePosition, newValue);

          console.log(`✅ Edited point value for parameter ${parameter.parameterName}`);
        }
      }
    });
    // This test will fail until we fix the duplication bug - the assertion is now in runRoundTripTest
  });

  it('should preserve all original parameters during round-trip', async () => {
    await runRoundTripTest('preserve_parameters', async (db) => {
      // Don't make any changes - just test round-trip preservation
      const parametersWithPoints = await findParametersWithPoints(db);
      console.log(`📊 Found ${parametersWithPoints.length} parameters with points`);
    });
  });

  it.skip('custom test for debugging parameter duplication', async () => {
    // This test is skipped for now to focus on the failing tests above
    // The duplication issue will cause this test to fail until we fix the root cause
    console.log('🔍 DEBUGGING: This test is skipped until we fix the duplication issue');
  });
});