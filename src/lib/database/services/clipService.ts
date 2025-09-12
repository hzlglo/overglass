import type { ComputedClip } from '../schema';
import type { AutomationDatabase } from '../duckdb';

export class ClipService {
  constructor(private db: AutomationDatabase) {}

  /**
   * Compute clips from mute automation data for a track
   */
  async getClipsForTrack(trackId: string): Promise<ComputedClip[]> {
    // Find the mute parameter for this track
    const muteParameters = await this.db.run(`
      SELECT id, parameter_name
      FROM parameters
      WHERE track_id = ? AND LOWER(parameter_name) LIKE '%mute%'
    `, [trackId]);

    if (muteParameters.length === 0) {
      // No mute parameter found, check track's default mute state
      const trackInfo = await this.db.run(`
        SELECT track_number, is_muted
        FROM tracks
        WHERE id = ?
      `, [trackId]);

      const isDefaultMuted = trackInfo[0]?.isMuted || false;
      
      return [{
        trackId,
        trackNumber: trackInfo[0]?.trackNumber || 0,
        startTime: 0,
        endTime: Number.MAX_VALUE,
        duration: Number.MAX_VALUE,
        isActive: !isDefaultMuted // inverted because clip is active when NOT muted
      }];
    }

    // Get automation points for the mute parameter
    const muteParameterId = muteParameters[0].id;
    const mutePoints = await this.db.run(`
      SELECT time_position, value
      FROM automation_points
      WHERE parameter_id = ?
      ORDER BY time_position
    `, [muteParameterId]);

    if (mutePoints.length === 0) {
      // No mute automation, check track's default mute state
      const trackInfo = await this.db.run(`
        SELECT track_number, is_muted
        FROM tracks
        WHERE id = ?
      `, [trackId]);

      const isDefaultMuted = trackInfo[0]?.isMuted || false;
      
      return [{
        trackId,
        trackNumber: trackInfo[0]?.trackNumber || 0,
        startTime: 0,
        endTime: Number.MAX_VALUE,
        duration: Number.MAX_VALUE,
        isActive: !isDefaultMuted
      }];
    }

    // Parse mute automation to find clips (unmuted segments)
    const clips: ComputedClip[] = [];
    let currentClipStart: number | null = null;
    let lastTime = 0;
    let lastMuteState = mutePoints[0]?.value > 0.5; // Assume >0.5 means muted

    // Get track number for the clips
    const trackInfo = await this.db.run(`
      SELECT track_number FROM tracks WHERE id = ?
    `, [trackId]);
    const trackNumber = trackInfo[0]?.trackNumber || 0;

    // If track starts unmuted, start first clip
    if (!lastMuteState) {
      currentClipStart = lastTime;
    }

    for (const point of mutePoints) {
      const currentMuteState = point.value > 0.5;

      // State change detected
      if (currentMuteState !== lastMuteState) {
        if (lastMuteState && !currentMuteState) {
          // Transition from muted to unmuted - start new clip
          currentClipStart = point.timePosition;
        } else if (!lastMuteState && currentMuteState) {
          // Transition from unmuted to muted - end current clip
          if (currentClipStart !== null) {
            clips.push({
              trackId,
              trackNumber,
              startTime: currentClipStart,
              endTime: point.timePosition,
              duration: point.timePosition - currentClipStart,
              isActive: true
            });
            currentClipStart = null;
          }
        }
      }

      lastMuteState = currentMuteState;
      lastTime = point.timePosition;
    }

    // Handle final clip that extends to the end
    if (currentClipStart !== null && !lastMuteState) {
      clips.push({
        trackId,
        trackNumber,
        startTime: currentClipStart,
        endTime: lastTime + 1000, // Extend slightly beyond last point
        duration: (lastTime + 1000) - currentClipStart,
        isActive: true
      });
    }

    return clips;
  }

  /**
   * Get all clips for all tracks in a device
   */
  async getClipsForDevice(deviceId: string): Promise<ComputedClip[]> {
    const tracks = await this.db.run(`
      SELECT id FROM tracks WHERE device_id = ?
    `, [deviceId]);

    const allClips: ComputedClip[] = [];
    
    for (const track of tracks) {
      const clips = await this.getClipsForTrack(track.id);
      allClips.push(...clips);
    }

    return allClips.sort((a, b) => a.trackNumber - b.trackNumber || a.startTime - b.startTime);
  }

  /**
   * Move a clip (unmuted time window) to a new position
   * @param trackId - The track containing the clip
   * @param clipStartTime - Original start time of the clip
   * @param clipEndTime - Original end time of the clip
   * @param newStartTime - New start time for the clip
   * @param lockAutomation - Whether to move automation data with the clip
   * @returns Success status and details
   */
  async moveClip(
    trackId: string,
    clipStartTime: number,
    clipEndTime: number,
    newStartTime: number,
    lockAutomation: boolean = true
  ): Promise<{ success: boolean; movedParameters: string[]; message: string }> {
    const clipDuration = clipEndTime - clipStartTime;
    const newEndTime = newStartTime + clipDuration;
    const timeOffset = newStartTime - clipStartTime;

    console.log(`🎬 Moving clip from ${clipStartTime}-${clipEndTime} to ${newStartTime}-${newEndTime} (offset: ${timeOffset})`);

    // Get all parameters for this track
    const parameters = await this.db.devices.getParametersForTrack(trackId);
    const movedParameters: string[] = [];

    if (!lockAutomation) {
      console.log(`⚠️  Automation locking disabled - only updating mute automation`);
      // Only move mute automation to preserve clip boundaries
      const muteParameters = parameters.filter(p => 
        p.parameterName.toLowerCase().includes('mute')
      );
      
      for (const param of muteParameters) {
        await this.db.automation.moveParameterAutomation(param.id, clipStartTime, clipEndTime, timeOffset);
        movedParameters.push(param.parameterName);
      }
    } else {
      console.log(`🔒 Automation locking enabled - moving all automation within clip`);
      // Move all automation data within the clip
      for (const param of parameters) {
        const moved = await this.db.automation.moveParameterAutomation(param.id, clipStartTime, clipEndTime, timeOffset);
        if (moved > 0) {
          movedParameters.push(param.parameterName);
        }
      }
    }

    const message = `Moved clip by ${timeOffset} beats. Updated automation for ${movedParameters.length} parameters: ${movedParameters.join(', ')}`;
    console.log(`✅ ${message}`);

    return {
      success: true,
      movedParameters,
      message
    };
  }

  /**
   * Copy a clip to a new position (instead of moving)
   * @param trackId - The track containing the clip
   * @param clipStartTime - Original start time of the clip
   * @param clipEndTime - Original end time of the clip
   * @param newStartTime - New start time for the copied clip
   * @param copyAutomation - Whether to copy automation data with the clip
   * @returns Success status and details
   */
  async copyClip(
    trackId: string,
    clipStartTime: number,
    clipEndTime: number,
    newStartTime: number,
    copyAutomation: boolean = true
  ): Promise<{ success: boolean; copiedParameters: string[]; message: string }> {
    const clipDuration = clipEndTime - clipStartTime;
    const newEndTime = newStartTime + clipDuration;
    const timeOffset = newStartTime - clipStartTime;

    console.log(`📋 Copying clip from ${clipStartTime}-${clipEndTime} to ${newStartTime}-${newEndTime}`);

    // Get all parameters for this track
    const parameters = await this.db.devices.getParametersForTrack(trackId);
    const copiedParameters: string[] = [];

    if (copyAutomation) {
      // Copy all automation data within the clip
      for (const param of parameters) {
        const copied = await this.db.automation.copyParameterAutomation(param.id, clipStartTime, clipEndTime, timeOffset);
        if (copied > 0) {
          copiedParameters.push(param.parameterName);
        }
      }
    }

    const message = `Copied clip to ${newStartTime}. Duplicated automation for ${copiedParameters.length} parameters: ${copiedParameters.join(', ')}`;
    console.log(`✅ ${message}`);

    return {
      success: true,
      copiedParameters,
      message
    };
  }
}