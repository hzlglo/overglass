import { ElektronNameMatcher } from '$lib/config/regex';
import type { AutomationDatabase } from '../duckdb';
import type { MidiMapping, Track } from '../schema';
import { v4 as uuidv4 } from 'uuid';

export async function createParameters(
  db: AutomationDatabase,
  parameters: MidiMapping[],
): Promise<void> {
  const tracks = await db.tracks.getAllTracks();
  const devices = await db.devices.getDevicesWithTracks();
  parameters.forEach(async (row) => {
    const device = devices.find((d) => d.deviceName === row.device);
    if (!device) {
      console.error('Could not find device', row.device);
      return;
    }
    const { isMute } = ElektronNameMatcher.parseMuteParameter(row.name);
    const trackNumber = ElektronNameMatcher.extractTrackNumber(row.name);
    if (!trackNumber) {
      console.error('Could not extract track number from parameter name', row.name);
      return;
    }
    let track: Track | null | undefined = tracks.find(
      (t) => t.deviceId === device.id && t.trackNumber === trackNumber,
    );
    if (!track) {
      if (!isMute) {
        console.error('Could not find track', row.device, trackNumber);
        return;
      }
      // we need to create a new track
      track = await db.tracks.createTrack({
        id: uuidv4(),
        deviceId: device.id,
        trackNumber,
        trackName: row.name,
        createdAt: new Date(),
      });
    }
    if (!track) {
      console.error('Could not create track', row.device, trackNumber);
      return;
    }
    db.tracks.createParameter({
      id: uuidv4(),
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
  });
}
