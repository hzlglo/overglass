import { describe, it, expect } from 'vitest';
import { runRoundTripTest, findParametersWithPoints } from './helpers/roundTripTestHelper';
import fs from 'fs/promises';

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
          const newValue = originalValue + 0.2;

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

    // Read and parse both XML files for content comparison
    const { gzipXmlHelpers } = await import('../lib/utils/gzipXmlHelpers');
    const originalXml = await gzipXmlHelpers.readGzipFile('./src/tests/test1.als');
    const editedXml = await gzipXmlHelpers.readGzipFile('./static/test1_xml_diff.als');
    const originalDoc = gzipXmlHelpers.parseXMLString(originalXml);
    const editedDoc = gzipXmlHelpers.parseXMLString(editedXml);

    // Write out the raw XML files for manual inspection
    await fs.writeFile('./test_output/xml_diff_original_raw.xml', originalXml, 'utf8');
    await fs.writeFile('./test_output/xml_diff_edited_raw.xml', editedXml, 'utf8');
    console.log(`📝 Wrote raw XML files to test_output/ for inspection`);

    // Function to recursively compare syntax trees and find content differences
    function compareXMLNodes(
      original: Element | Document,
      edited: Element | Document,
      path: string = '',
    ): string[] {
      const differences: string[] = [];

      // Get all child elements
      const originalElements = original.children ? Array.from(original.children) : [];
      const editedElements = edited.children ? Array.from(edited.children) : [];

      // Create maps by tag name to match equivalent elements
      const createElementMap = (elements: Element[]) => {
        const map = new Map<string, Element[]>();
        for (const element of elements) {
          const key = element.tagName;
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push(element);
        }
        return map;
      };

      const originalMap = createElementMap(originalElements);
      const editedMap = createElementMap(editedElements);
      const allTagNames = new Set([...originalMap.keys(), ...editedMap.keys()]);

      for (const tagName of allTagNames) {
        const originalOfType = originalMap.get(tagName) || [];
        const editedOfType = editedMap.get(tagName) || [];

        // Check for count changes
        if (originalOfType.length !== editedOfType.length) {
          differences.push(
            `${path}${tagName}: count changed from ${originalOfType.length} to ${editedOfType.length}`,
          );
        }

        // Compare elements of the same type
        const minLength = Math.min(originalOfType.length, editedOfType.length);
        for (let i = 0; i < minLength; i++) {
          const origElement = originalOfType[i];
          const editedElement = editedOfType[i];

          // Compare attributes
          const origAttrs = origElement.attributes;
          for (let j = 0; j < origAttrs.length; j++) {
            const origAttr = origAttrs[j];
            const editedAttr = editedElement.getAttribute(origAttr.name);

            if (editedAttr !== origAttr.value) {
              // Skip FloatEvent Id attributes (they're often regenerated)
              if (tagName === 'FloatEvent' && origAttr.name === 'Id') {
                continue;
              }

              // For FloatEvent Time and Value attributes, only report significant numerical differences
              if (
                tagName === 'FloatEvent' &&
                (origAttr.name === 'Time' || origAttr.name === 'Value')
              ) {
                const origNum = parseFloat(origAttr.value);
                const editedNum = parseFloat(editedAttr || '0');

                // Consider differences < 0.01 as equal (accounting for floating point precision)
                if (Math.abs(origNum - editedNum) < 0.01) {
                  continue;
                }
              }

              differences.push(
                `${path}${tagName}[${i}]@${origAttr.name}: "${origAttr.value}" → "${editedAttr}"`,
              );
            }
          }

          // Recursively compare child elements
          const childDiffs = compareXMLNodes(
            origElement,
            editedElement,
            `${path}${tagName}[${i}]/`,
          );
          differences.push(...childDiffs);
        }

        // Handle added elements
        if (editedOfType.length > originalOfType.length) {
          for (let i = originalOfType.length; i < editedOfType.length; i++) {
            const addedElement = editedOfType[i];
            let elementDesc = `${tagName}`;
            ['Id', 'Time', 'Value', 'PointeeId'].forEach((attr) => {
              const value = addedElement.getAttribute(attr);
              if (value) elementDesc += ` ${attr}="${value}"`;
            });
            differences.push(`${path}+${elementDesc}: added`);
          }
        }
      }

      return differences;
    }

    // Compare the XML syntax trees
    const contentDifferencesNew = compareXMLNodes(originalDoc, editedDoc);

    console.log(`📊 Found ${contentDifferencesNew.length} content (old to new) differences`);
    console.log(`🔍 First 10 content differences:`);
    contentDifferencesNew.slice(0, 10).forEach((diff, index) => {
      console.log(`  ${index + 1}: ${diff}`);
    });

    // Verify that we have changes (proving our edit worked) but not an unreasonable amount
    expect(contentDifferencesNew.length).toEqual(1);

    const contentDifferencesOld = compareXMLNodes(editedDoc, originalDoc);

    console.log(`📊 Found ${contentDifferencesOld.length} content (new to old) differences`);
    console.log(`🔍 First 10 content differences:`);
    contentDifferencesOld.slice(0, 10).forEach((diff, index) => {
      console.log(`  ${index + 1}: ${diff}`);
    });

    // Verify that we have changes (proving our edit worked) but not an unreasonable amount
    expect(contentDifferencesOld.length).toEqual(1);
  });
});
