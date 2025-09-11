import { inflate } from 'pako';

export class ALSDebugger {
  static async debugALSFile(file: File) {
    console.log('=== ALS FILE DEBUGGING ===');
    console.log(`File: ${file.name}, Size: ${file.size} bytes`);

    try {
      // Read and decompress the file
      const buffer = await file.arrayBuffer();
      const decompressed = inflate(buffer, { to: 'string' });

      console.log(`Decompressed size: ${decompressed.length} characters`);

      // Parse XML
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(decompressed, 'text/xml');

      // Check for parsing errors
      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        console.error('XML Parse Error:', parseError.textContent);
        return;
      }

      console.log('✅ XML parsed successfully');

      // Debug basic structure
      const rootElement = xmlDoc.documentElement;
      console.log(`Root element: ${rootElement.tagName}`);

      // Look for Live Set info
      const liveSet = xmlDoc.querySelector('LiveSet');
      if (liveSet) {
        console.log('✅ Found LiveSet element');

        // Find all tracks
        const allTracks = liveSet.querySelectorAll('MidiTrack, AudioTrack');
        console.log(`Found ${allTracks.length} total tracks (MIDI + Audio)`);

        // List all track names and automation details
        allTracks.forEach((track, index) => {
          const userNameEl = track.querySelector('Name UserName');
          const effectiveNameEl = track.querySelector('Name EffectiveName');
          const userName = userNameEl?.getAttribute('Value') || userNameEl?.textContent || '';
          const effectiveName =
            effectiveNameEl?.getAttribute('Value') || effectiveNameEl?.textContent || '';

          console.log(`Track ${index + 1}:`);
          console.log(`  UserName: "${userName}"`);
          console.log(`  EffectiveName: "${effectiveName}"`);
          console.log(`  Type: ${track.tagName}`);

          // Check for automation in different locations
          const automationEnvelopes = track.querySelectorAll('AutomationEnvelope');
          const envelopes = track.querySelectorAll('Envelope');
          const floatEvents = track.querySelectorAll('FloatEvent');

          console.log(`  AutomationEnvelope elements: ${automationEnvelopes.length}`);
          console.log(`  Envelope elements: ${envelopes.length}`);
          console.log(`  FloatEvent elements: ${floatEvents.length}`);

          // Show first few automation envelope structures
          if (automationEnvelopes.length > 0) {
            console.log(`  First AutomationEnvelope structure:`);
            const firstEnv = automationEnvelopes[0];
            console.log(`    Tag: ${firstEnv.tagName}`);
            console.log(
              `    Children: ${Array.from(firstEnv.children)
                .map((c) => c.tagName)
                .join(', ')}`,
            );

            // Look for Target/Path info in both old and new formats
            const target = firstEnv.querySelector('Target');
            const envelopeTarget = firstEnv.querySelector('EnvelopeTarget');

            if (envelopeTarget) {
              const path = envelopeTarget.querySelector('Path');
              console.log(
                `    EnvelopeTarget Path: ${path?.getAttribute('Value') || path?.textContent || 'none'}`,
              );
            } else if (target) {
              const path = target.querySelector('Path');
              console.log(
                `    Target Path: ${path?.getAttribute('Value') || path?.textContent || 'none'}`,
              );
            }

            // Look for Events in different locations
            const directEvents = firstEnv.querySelectorAll('FloatEvent');
            const automationEvents = firstEnv.querySelectorAll('Automation FloatEvent');
            console.log(`    Direct FloatEvents in envelope: ${directEvents.length}`);
            console.log(`    Automation > FloatEvents in envelope: ${automationEvents.length}`);

            const events = automationEvents.length > 0 ? automationEvents : directEvents;
            if (events.length > 0) {
              const firstEvent = events[0];
              console.log(`    First event structure:`, firstEvent.tagName);
              console.log(
                `    First event children:`,
                Array.from(firstEvent.children).map((c) => c.tagName),
              );
              console.log(
                `    First event attributes:`,
                Object.fromEntries(Array.from(firstEvent.attributes).map((a) => [a.name, a.value])),
              );

              const timeEl = firstEvent.querySelector('Time');
              const valueEl = firstEvent.querySelector('Value');

              if (timeEl) {
                console.log(`    Time element:`, timeEl.outerHTML.substring(0, 100));
              }
              if (valueEl) {
                console.log(`    Value element:`, valueEl.outerHTML.substring(0, 100));
              }
            }
          }
        });

        // Look for specific Elektron-related strings in the entire document
        console.log('\n=== SEARCHING FOR ELEKTRON REFERENCES ===');
        const text = decompressed.toLowerCase();
        const elektron_keywords = ['digitakt', 'digitone', 'elektron', 'overbridge', 'ob '];

        elektron_keywords.forEach((keyword) => {
          if (text.includes(keyword)) {
            console.log(`✅ Found "${keyword}" in the document`);

            // Find context around the keyword
            const index = text.indexOf(keyword);
            const start = Math.max(0, index - 50);
            const end = Math.min(text.length, index + keyword.length + 50);
            const context = decompressed.substring(start, end);
            console.log(`  Context: ...${context}...`);
          } else {
            console.log(`❌ "${keyword}" not found`);
          }
        });
      } else {
        console.error('❌ No LiveSet element found');
      }
    } catch (error) {
      console.error('Error debugging ALS file:', error);
    }
  }

  static async exportXML(file: File): Promise<string | null> {
    try {
      const buffer = await file.arrayBuffer();
      const decompressed = inflate(buffer, { to: 'string' });
      return decompressed;
    } catch (error) {
      console.error('Error exporting XML:', error);
      return null;
    }
  }
}
