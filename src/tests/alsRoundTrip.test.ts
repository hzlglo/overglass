import { describe, it, expect } from 'vitest';
import {
  runRoundTripTest,
  findParametersWithPoints,
  verifyXMLDifferences,
} from './helpers/roundTripTestHelper';
import { MuteTransitionService } from '../lib/database/services/muteTransitionService';

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
          await db.automation.deleteAutomationPoints([points[0].id]);
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

          console.log(
            `🎯 Editing point: parameter="${parameter.parameterName}", time=${existingPoint.timePosition}, value=${originalValue} → ${newValue}`,
          );

          // This should update the existing point, not create a new one
          await db.automation.updateAutomationPoint(
            existingPoint.id,
            parameter.id,
            existingPoint.timePosition,
            newValue,
          );

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

  it('should make minimal changes to XML structure (diff test)', async () => {
    // First, run the round trip test to generate the edited file
    await runRoundTripTest('xml_diff', async (db) => {
      // Make a minimal edit (edit one existing automation point value)
      const parametersWithPoints = await findParametersWithPoints(db);
      if (parametersWithPoints.length > 0) {
        const { parameter, points } = parametersWithPoints[0];
        if (points.length > 0) {
          const existingPoint = points[0];
          const originalValue = existingPoint.value;
          const newValue = originalValue >= 0.8 ? originalValue - 0.2 : originalValue + 0.2;

          await db.automation.updateAutomationPoint(
            existingPoint.id,
            parameter.id,
            existingPoint.timePosition,
            newValue,
          );

          console.log(
            `✅ Edited automation point value: ${parameter.parameterName} at time ${existingPoint.timePosition}: ${originalValue} → ${newValue}`,
          );
        }
      }
    });

    // Verify that only 1 change was made to the XML structure
    await verifyXMLDifferences('xml_diff', 1);
  });

  it('should make minimal changes when editing mute transitions', async () => {
    // First, run the round trip test to generate the edited file
    await runRoundTripTest('mute_edit', async (db) => {
      // Find mute transitions to edit
      const devices = await db.devices.getDevicesWithTracks();
      let editedTransition = false;

      for (const device of devices) {
        if (editedTransition) break;

        const tracks = await db.tracks.getTracksForDevice(device.id);
        for (const track of tracks) {
          if (editedTransition) break;

          const transitions = await db.muteTransitions.getMuteTransitionsForTrack(track.id);

          // Find a transition that's not at the beginning of time (which we can meaningfully edit)
          const editableTransition = transitions.find((t) => t.timePosition > -60000000);

          if (editableTransition) {
            const originalTime = editableTransition.timePosition;
            const newTime = originalTime + 1.0; // Move transition by 1 second

            // Get parameter name for logging
            const parameter = await db.tracks.getParameterById(editableTransition.muteParameterId);
            const parameterName = parameter?.parameterName || 'Unknown';

            // Move the mute transition by 1 second using the new API
            const allTrackTransitions = await db.muteTransitions.getMuteTransitionsForTrack(
              editableTransition.trackId,
            );
            const movedTransitions = MuteTransitionService.getMovedMuteTransitions(
              [editableTransition],
              allTrackTransitions,
              1.0,
            );
            if (movedTransitions.length > 0) {
              const actualNewTime = movedTransitions[0].timePosition;
              await db.muteTransitions.updateMuteTransitions([
                {
                  id: editableTransition.id,
                  timePosition: actualNewTime,
                },
              ]);

              console.log(
                `✅ Edited mute transition: ${parameterName} at time ${originalTime.toFixed(3)} → ${actualNewTime.toFixed(3)}`,
              );
            }

            editedTransition = true;
            break;
          }
        }
      }

      if (!editedTransition) {
        throw new Error('No editable mute transitions found for testing');
      }
    });

    // Verify that only 2 changes were made to the XML structure (mute transitions create 2 FloatEvents)
    await verifyXMLDifferences('mute_edit', 2);
  });

  it('should add new parameters and edit existing parameters in the same operation', async () => {
    await runRoundTripTest('add_and_edit_parameters', async (db) => {
      // Find parameters to work with
      const parametersWithPoints = await findParametersWithPoints(db);
      expect(parametersWithPoints.length).toBeGreaterThan(0);

      // Edit an existing parameter
      const { parameter: existingParam, points } = parametersWithPoints[0];
      if (points.length > 0) {
        const existingPoint = points[0];
        const originalValue = existingPoint.value;
        const newValue = originalValue === 0 ? 0.8 : 0.2;

        await db.automation.updateAutomationPoint(
          existingPoint.id,
          existingParam.id,
          existingPoint.timePosition,
          newValue,
        );

        console.log(
          `✅ Edited existing parameter "${existingParam.parameterName}": ${originalValue} → ${newValue}`,
        );
      }

      // Get the track for adding new parameters
      const track = await db.tracks.getTrackById(existingParam.trackId);
      expect(track).not.toBeNull();

      // Create two new parameters
      const newParam1 = {
        id: 'new-test-param-1',
        trackId: track!.id,
        parameterName: `T${track!.trackNumber} New Param 1`,
        vstParameterId: '888888881',
        originalPointeeId: '',
        isMute: false,
        createdAt: new Date(),
      };

      const newParam2 = {
        id: 'new-test-param-2',
        trackId: track!.id,
        parameterName: `T${track!.trackNumber} New Param 2`,
        vstParameterId: '888888882',
        originalPointeeId: '',
        isMute: false,
        createdAt: new Date(),
      };

      await db.tracks.createParameter(newParam1);
      await db.tracks.createParameter(newParam2);

      // Add automation points for the new parameters
      await db.automation.createAutomationPoint(newParam1.id, -63072000, 0.3);
      await db.automation.createAutomationPoint(newParam1.id, 5.0, 0.7);

      await db.automation.createAutomationPoint(newParam2.id, -63072000, 0.6);
      await db.automation.createAutomationPoint(newParam2.id, 10.0, 0.4);

      console.log(
        `✅ Created 2 new parameters: "${newParam1.parameterName}" and "${newParam2.parameterName}"`,
      );
    });
  });
});
