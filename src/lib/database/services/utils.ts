import { ElektronNameMatcher } from '$lib/config/regex';
import { ALSParser } from '$lib/parsers/alsParser';
import type { AutomationDatabase } from '../duckdb';
import type { MidiMapping, Parameter, Track } from '../schema';
import { v4 as uuidv4 } from 'uuid';

export async function createParameters(
  db: AutomationDatabase,
  parameters: MidiMapping[],
): Promise<Parameter[]> {
  const tracks = await db.tracks.getAllTracks();
  const devices = await db.devices.getDevicesWithTracks();
  const existingParameters = await db.tracks.getAllParameters();
  const newParameters: Parameter[] = [];
  for (const row of parameters) {
    const existingParameter = existingParameters.find((p) => p.vstParameterId === row.paramId);
    if (existingParameter) {
      console.log('Parameter already exists', row.paramId, existingParameter.parameterName);
      newParameters.push(existingParameter);
      continue;
    }
    const device = devices.find((d) => d.deviceName === row.device);
    if (!device) {
      console.error('Could not find device', row.device);
      continue;
    }
    const { isMute } = ElektronNameMatcher.parseMuteParameter(row.name);
    const trackNumber = ElektronNameMatcher.extractTrackNumber(row.name);
    if (!trackNumber) {
      console.error('Could not extract track number from parameter name', row.name);
      continue;
    }
    let track: Track | null | undefined = tracks.find(
      (t) => t.deviceId === device.id && t.trackNumber === trackNumber,
    );
    if (!track) {
      if (!isMute) {
        console.error('Could not find track', row.device, trackNumber);
        continue;
      }
      // we need to create a new track
      track = await db.tracks.createTrack({
        id: ALSParser.generateId('track', row.name),
        deviceId: device.id,
        trackNumber,
        trackName: row.name,
        createdAt: new Date(),
      });
    }
    if (!track) {
      console.error('Could not create track', row.device, trackNumber);
      continue;
    }
    const newParameter = await db.tracks.createParameter({
      id: ALSParser.generateId('parameter', row.name),
      trackId: track.id, // Foreign key to tracks
      parameterName: row.name, // e.g., "Filter Cutoff", "Volume"
      parameterPath: `${device.deviceName}/${row.name}`, // Full automation target path from ALS
      vstParameterId: row.paramId, // Parameter ID defined by the VST
      // Original PointeeId from ALS XML, which corresponds to AutomationEnvelope.
      // Null if the parameter was added in Overglass
      originalPointeeId: null,
      isMute: isMute, // Whether this parameter is a mute parameter
      createdAt: new Date(),
    });
    if (newParameter) {
      newParameters.push(newParameter);
    }
    // Create a negative-time automation point
    if (!isMute && newParameter) {
      await db.automation.createAutomationPoint(newParameter.id, -63072000, 0.0);
    }
  }
  return newParameters;
}
