import { v4 as uuidv4 } from 'uuid';
import type { MuteTransition } from '../schema';
import type { AutomationDatabase } from '../duckdb';
import SQL, { join } from 'sql-template-tag';
import { first, isEmpty } from 'lodash';

export class MuteTransitionService {
  constructor(private db: AutomationDatabase) {}

  /**
   * Add a mute transition, automatically determining state and maintaining the on/off pattern
   * This ensures we maintain alternating on/off states by adding a second transition if needed
   */
  async addMuteTransition(
    trackId: string,
    timePosition: number,
    muteParameterId: string,
  ): Promise<MuteTransition[]> {
    const existingTransitions = await this.getMuteTransitionsForTrack(trackId);

    // Find the state we should be at this time position
    const transitionsBefore = existingTransitions.filter((t) => t.timePosition < timePosition);
    const lastBefore =
      transitionsBefore.length > 0 ? transitionsBefore[transitionsBefore.length - 1] : null;

    // Determine what state we should transition to (opposite of current state)
    let currentState = false; // Default to unmuted if no previous transitions
    if (lastBefore) {
      currentState = lastBefore.isMuted;
    }
    const newState = !currentState;

    const transitionsAfter = existingTransitions.filter((t) => t.timePosition > timePosition);
    const nextAfter = transitionsAfter.length > 0 ? transitionsAfter[0] : null;

    const createdTransitions: MuteTransition[] = [];

    // Create the primary transition
    const primaryTransition = await this.createMuteTransition(
      trackId,
      timePosition,
      newState,
      muteParameterId,
    );
    createdTransitions.push(primaryTransition);

    // Check if we need to add a second transition to maintain the alternating pattern
    let needsSecondTransition = false;

    if (nextAfter) {
      // If there's a transition after, and it would create an invalid pattern (same state twice)
      if (nextAfter.isMuted === newState) {
        needsSecondTransition = true;
      }
    }

    if (needsSecondTransition) {
      // Calculate position for second transition
      const defaultGap = 5; // 5 seconds default gap
      let secondTransitionTime = timePosition + defaultGap;

      // If there's a next transition that's too close, place our second transition just before it
      if (nextAfter && nextAfter.timePosition < secondTransitionTime) {
        secondTransitionTime = Math.max(timePosition + 0.1, nextAfter.timePosition - 0.1);
      }

      const secondTransition = await this.createMuteTransition(
        trackId,
        secondTransitionTime,
        !newState, // Opposite of the primary transition
        muteParameterId,
      );
      createdTransitions.push(secondTransition);
    }

    return createdTransitions;
  }

  // ===== CLIP-BASED OPERATIONS =====

  /**
   * Derive clips (unmuted time spans) from mute transitions
   * Based on the logic from MuteClips.svelte lines 54-86
   */
  static deriveClipsFromTransitions(transitions: MuteTransition[]): Array<{
    start: number;
    end: number | null;
    startTransition: MuteTransition;
    endTransition?: MuteTransition;
  }> {
    const clips: Array<{
      start: number;
      end: number | null;
      startTransition: MuteTransition;
      endTransition?: MuteTransition;
    }> = [];
    const sortedTransitions = transitions.sort((a, b) => a.timePosition - b.timePosition);

    let clipStart: MuteTransition | null = null;

    for (const transition of sortedTransitions) {
      if (!clipStart) {
        if (!transition.isMuted) {
          clipStart = transition;
        }
        continue;
      } else {
        if (transition.isMuted) {
          clips.push({
            start: clipStart.timePosition,
            end: transition.timePosition,
            startTransition: clipStart,
            endTransition: transition,
          });
          clipStart = null;
        }
        continue;
      }
    }

    // If we're unmuted at the end, there's an infinite clip
    if (clipStart) {
      clips.push({
        start: clipStart.timePosition,
        end: null, // null means infinite/end of track
        startTransition: clipStart,
        endTransition: undefined,
      });
    }
    console.log('clips', clips);

    return clips;
  }

  /**
   * Delete mute transitions using smart clip-based logic
   */
  async deleteMuteTransitions(transitionIds: string[]): Promise<void> {
    if (transitionIds.length === 0) return;

    // Get all transitions to delete and group by track
    const transitionsByTrack = new Map<string, MuteTransition[]>();

    for (const id of transitionIds) {
      const transition = await this.getMuteTransition(id);
      if (transition) {
        if (!transitionsByTrack.has(transition.trackId)) {
          transitionsByTrack.set(transition.trackId, []);
        }
        transitionsByTrack.get(transition.trackId)!.push(transition);
      }
    }

    // Process each track separately
    for (const [trackId, transitionsToDelete] of transitionsByTrack) {
      const allTransitions = await this.getMuteTransitionsForTrack(trackId);
      const sortedAll = allTransitions.sort((a, b) => a.timePosition - b.timePosition);

      // Find negative-time transition (initial state)
      const negativeTransition = sortedAll.find((t) => t.timePosition < 0);
      const positiveTransitions = sortedAll.filter((t) => t.timePosition >= 0);

      // Check special cases
      const deletingIds = transitionsToDelete.map((t) => t.id);
      const firstPositive = positiveTransitions[0];
      const lastPositive = positiveTransitions[positiveTransitions.length - 1];

      const deletingFirstPositive = firstPositive && deletingIds.includes(firstPositive.id);
      const deletingLastPositive = lastPositive && deletingIds.includes(lastPositive.id);
      const deletingOnlyLast = deletingLastPositive && deletingIds.length === 1;

      if (deletingFirstPositive && negativeTransition) {
        // Delete first positive transition and toggle initial state
        await this.deleteMuteTransition(firstPositive.id);
        await this.updateMuteTransitionValues(
          negativeTransition.id,
          negativeTransition.timePosition,
          !negativeTransition.isMuted,
        );

        // Delete other selected transitions (except the first positive one we already handled)
        const remainingToDelete = transitionsToDelete.filter((t) => t.id !== firstPositive.id);
        for (const transition of remainingToDelete) {
          await this.deleteMuteTransition(transition.id);
        }
      } else if (deletingOnlyLast) {
        // Delete only the last transition
        await this.deleteMuteTransition(lastPositive.id);
      } else {
        // General case: delete entire clips
        // Find all clips that contain any of the transitions to delete
        const clips = MuteTransitionService.deriveClipsFromTransitions(allTransitions);
        const affectedClips = clips.filter((clip) =>
          transitionsToDelete.some(
            (t) =>
              t.timePosition >= clip.start && (clip.end === null || t.timePosition <= clip.end),
          ),
        );

        // Collect all transitions to delete from affected clips
        const transitionsToDeleteFromClips = new Set<string>();
        for (const clip of affectedClips) {
          transitionsToDeleteFromClips.add(clip.startTransition.id);
          if (clip.endTransition) {
            transitionsToDeleteFromClips.add(clip.endTransition.id);
          }
        }

        // Delete all transitions that are part of affected clips
        for (const transitionId of transitionsToDeleteFromClips) {
          await this.deleteMuteTransition(transitionId);
        }
      }
    }
  }

  /**
   * Merge multiple clips into one by combining their mute transitions
   */
  async mergeMuteTransitionClips(transitionIds: string[]): Promise<void> {
    if (transitionIds.length === 0) return;

    // Group transitions by track
    const transitionsByTrack = new Map<string, MuteTransition[]>();

    for (const id of transitionIds) {
      const transition = await this.getMuteTransition(id);
      if (transition) {
        if (!transitionsByTrack.has(transition.trackId)) {
          transitionsByTrack.set(transition.trackId, []);
        }
        transitionsByTrack.get(transition.trackId)!.push(transition);
      }
    }

    // Process each track separately
    for (const [trackId, selectedTransitions] of transitionsByTrack) {
      const allTransitions = await this.getMuteTransitionsForTrack(trackId);
      const clips = MuteTransitionService.deriveClipsFromTransitions(allTransitions);

      // Find all clips that contain any of the selected transitions
      const affectedClips = clips.filter((clip) =>
        selectedTransitions.some(
          (t) => t.timePosition >= clip.start && (clip.end === null || t.timePosition <= clip.end),
        ),
      );

      if (affectedClips.length <= 1) return; // Nothing to merge

      // Find the earliest start and latest end from affected clips
      const earliestStart = Math.min(...affectedClips.map((c) => c.start));
      const latestEnd = Math.max(...affectedClips.map((c) => c.end || Infinity));
      const hasInfiniteClip = affectedClips.some((c) => c.end === null);

      // Find ALL clips that fall between the earliest start and latest end
      // This includes clips that might be completely between the selected transitions
      const clipsToMerge = clips.filter((clip) => {
        if (clip.end === null) {
          // Infinite clip: merge if it starts before or at the latest end
          return clip.start <= latestEnd;
        } else {
          // Finite clip: merge if it overlaps or is between the range
          return clip.start <= latestEnd && clip.end >= earliestStart;
        }
      });

      // Delete all transitions from clips to merge
      const transitionsToDelete = [];
      for (const clip of clipsToMerge) {
        transitionsToDelete.push(clip.startTransition);
        if (clip.endTransition) {
          transitionsToDelete.push(clip.endTransition);
        }
      }

      for (const transition of transitionsToDelete) {
        await this.deleteMuteTransition(transition.id);
      }

      // Create new merged clip
      const muteParameterId = selectedTransitions[0].muteParameterId;

      // Create start transition (unmuted)
      await this.createMuteTransition(trackId, earliestStart, false, muteParameterId);

      // Create end transition (muted) only if not infinite
      if (!hasInfiniteClip && latestEnd !== Infinity) {
        await this.createMuteTransition(trackId, latestEnd, true, muteParameterId);
      }
    }
  }

  /**
   * Calculate moved positions for transitions with collision detection (pure function)
   * Returns the transitions with updated times, but doesn't save them
   */
  static getMovedMuteTransitions(
    selectedTransitions: MuteTransition[],
    allTrackTransitions: MuteTransition[],
    deltaTime: number,
  ): MuteTransition[] {
    if (selectedTransitions.length === 0) return [];

    // If deltaTime is 0, return the original transitions unchanged
    if (deltaTime === 0) {
      return selectedTransitions.map((transition) => ({
        ...transition,
      }));
    }

    const sortedAll = allTrackTransitions.sort((a, b) => a.timePosition - b.timePosition);
    const movingIds = selectedTransitions.map((t) => t.id);

    let minAllowedDelta = deltaTime;

    for (const transition of selectedTransitions) {
      const newTime = transition.timePosition + deltaTime;

      // Never move before 0
      if (newTime < 0) {
        const maxDelta = -transition.timePosition;
        minAllowedDelta = Math.min(minAllowedDelta, maxDelta);
        continue;
      }

      // Find neighbors that aren't also moving
      const staticNeighbors = sortedAll.filter((t) => !movingIds.includes(t.id));

      // Check collision with next neighbor
      const nextNeighbor = staticNeighbors.find((t) => t.timePosition > transition.timePosition);
      if (nextNeighbor && newTime >= nextNeighbor.timePosition) {
        const maxDelta = nextNeighbor.timePosition - transition.timePosition - 0.001;
        minAllowedDelta = Math.min(minAllowedDelta, maxDelta);
      }

      // Check collision with previous neighbor
      const prevNeighbor = [...staticNeighbors]
        .reverse()
        .find((t) => t.timePosition < transition.timePosition);
      if (prevNeighbor && newTime <= prevNeighbor.timePosition) {
        const maxDelta = prevNeighbor.timePosition - transition.timePosition + 0.001;
        minAllowedDelta = Math.max(minAllowedDelta, maxDelta);
      }
    }

    // Apply the constrained delta to all transitions
    const actualDelta = Math.max(
      -Math.abs(minAllowedDelta),
      Math.min(Math.abs(minAllowedDelta), deltaTime),
    );

    return selectedTransitions.map((transition) => ({
      ...transition,
      timePosition: Math.max(0, transition.timePosition + actualDelta),
    }));
  }

  /**
   * Update mute transitions with new time positions (simple update without logic)
   */
  async updateMuteTransitions(updates: Array<{ id: string; timePosition: number }>): Promise<void> {
    for (const update of updates) {
      await this.updateMuteTransitionTime(update.id, update.timePosition);
    }
  }

  /**
   * Add a new clip at the specified timestamp
   * Logic depends on whether adding in muted or unmuted space
   */
  async addMuteTransitionClip(trackId: string, timePosition: number): Promise<MuteTransition[]> {
    const allTransitions = await this.getMuteTransitionsForTrack(trackId);
    if (isEmpty(allTransitions)) {
      throw new Error('cannot make a clip without any existing transitions');
    }
    const muteParameterId = allTransitions[0].muteParameterId;
    const clips = MuteTransitionService.deriveClipsFromTransitions(allTransitions);

    // Check if we're adding inside an existing clip
    const existingClip = clips.find(
      (clip) => timePosition >= clip.start && (clip.end === null || timePosition <= clip.end),
    );

    const createdTransitions: MuteTransition[] = [];

    console.log('existingClip', existingClip);

    if (existingClip) {
      // Adding muted time inside an existing clip - split the clip
      if (existingClip.end === null) {
        // Adding at the end of an infinite clip
        const endTransition = await this.createMuteTransition(
          trackId,
          timePosition,
          true,
          muteParameterId,
        );
        createdTransitions.push(endTransition);
      } else {
        // Adding in the middle of a finite clip - create end and start
        const endCurrentClip = await this.createMuteTransition(
          trackId,
          timePosition,
          true,
          muteParameterId,
        );
        const startNewClip = await this.createMuteTransition(
          trackId,
          Math.min(timePosition + 2, existingClip.end - 0.001),
          false,
          muteParameterId,
        );
        createdTransitions.push(endCurrentClip, startNewClip);
      }
    } else {
      // Adding unmuted time in muted space
      const sortedTransitions = allTransitions.sort((a, b) => a.timePosition - b.timePosition);
      const positiveTransitions = sortedTransitions.filter((t) => t.timePosition >= 0);

      if (positiveTransitions.length === 0 || timePosition < positiveTransitions[0].timePosition) {
        // Adding at the beginning - toggle initial state and add transitions
        const negativeTransition = sortedTransitions.find((t) => t.timePosition < 0);
        if (negativeTransition) {
          await this.updateMuteTransitionValues(
            negativeTransition.id,
            negativeTransition.timePosition,
            !negativeTransition.isMuted,
          );
        }

        // If there are no positive transitions, we need to create both start and end of clip
        if (positiveTransitions.length === 0) {
          const startTransition = await this.createMuteTransition(
            trackId,
            timePosition,
            false,
            muteParameterId,
          );
          const endTransition = await this.createMuteTransition(
            trackId,
            timePosition + 2,
            true,
            muteParameterId,
          );
          createdTransitions.push(startTransition, endTransition);
        } else {
          // If there are positive transitions, just add one transition that inverts from the initial state
          const newTransition = await this.createMuteTransition(
            trackId,
            timePosition,
            !negativeTransition?.isMuted || true,
            muteParameterId,
          );
          createdTransitions.push(newTransition);
        }
      } else {
        // Find next transition to ensure we don't overlap
        const nextTransition = positiveTransitions.find((t) => t.timePosition > timePosition);

        if (nextTransition) {
          // Adding in middle of muted space - create start and end of new clip
          const maxEndTime = nextTransition.timePosition - 0.001;
          const endTime = Math.min(timePosition + 2, maxEndTime);

          const startTransition = await this.createMuteTransition(
            trackId,
            timePosition,
            false,
            muteParameterId,
          );
          const endTransition = await this.createMuteTransition(
            trackId,
            endTime,
            true,
            muteParameterId,
          );
          createdTransitions.push(startTransition, endTransition);
        } else {
          // Adding at end of song - only create start transition to invert ending state
          const startTransition = await this.createMuteTransition(
            trackId,
            timePosition,
            false,
            muteParameterId,
          );
          createdTransitions.push(startTransition);
        }
      }
    }

    return createdTransitions;
  }

  // ===== END CLIP-BASED OPERATIONS =====

  async getAll(): Promise<MuteTransition[]> {
    const sqlTemplate = SQL`
      SELECT id, track_id, time_position, is_muted, mute_parameter_id, created_at, updated_at
      FROM mute_transitions
      ORDER BY time_position ASC
    `;
    return await this.db.run(sqlTemplate.sql, sqlTemplate.values);
  }

  /**
   * Get all mute transitions for a track
   */
  async getMuteTransitionsForTrack(trackId: string): Promise<MuteTransition[]> {
    const sqlTemplate = SQL`
      SELECT id, track_id, time_position, is_muted, mute_parameter_id, created_at, updated_at
      FROM mute_transitions
      WHERE track_id = ${trackId}
      ORDER BY time_position ASC
    `;
    const result = await this.db.run(sqlTemplate.sql, sqlTemplate.values);

    return result.map((row: any) => ({
      id: row.id,
      trackId: row.trackId,
      timePosition: row.timePosition,
      isMuted: row.isMuted,
      muteParameterId: row.muteParameterId,
      createdAt: new Date(row.createdAt),
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : undefined,
    }));
  }

  /**
   * Delete a mute transition
   */
  async deleteMuteTransition(transitionId: string): Promise<void> {
    const sqlTemplate = SQL`
      DELETE FROM mute_transitions WHERE id = ${transitionId}
    `;
    const result = await this.db.run(sqlTemplate.sql, sqlTemplate.values);

    if (result.changes === 0) {
      throw new Error(`Mute transition with id ${transitionId} not found`);
    }
  }

  /**
   * Get a specific mute transition by ID
   */
  async getMuteTransition(transitionId: string): Promise<MuteTransition | null> {
    const sqlTemplate = SQL`
      SELECT id, track_id, time_position, is_muted, mute_parameter_id, created_at, updated_at
      FROM mute_transitions
      WHERE id = ${transitionId}
    `;
    const result = await this.db.run(sqlTemplate.sql, sqlTemplate.values);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      id: row.id,
      trackId: row.trackId,
      timePosition: row.timePosition,
      isMuted: row.isMuted,
      muteParameterId: row.muteParameterId,
      createdAt: new Date(row.createdAt),
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : undefined,
    };
  }

  /**
   * Get all mute transitions for a device
   */
  async getMuteTransitionsForDevice(
    deviceId: string,
  ): Promise<(MuteTransition & { trackName: string })[]> {
    const sqlTemplate = SQL`
      SELECT
        mt.id,
        mt.track_id,
        mt.time_position,
        mt.is_muted,
        mt.mute_parameter_id,
        mt.created_at,
        mt.updated_at,
        t.track_name
      FROM mute_transitions mt
      JOIN tracks t ON mt.track_id = t.id
      WHERE t.device_id = ${deviceId}
      ORDER BY t.track_number ASC, mt.time_position ASC
    `;
    const result = await this.db.run(sqlTemplate.sql, sqlTemplate.values);

    return result.map((row: any) => ({
      id: row.id,
      trackId: row.trackId,
      timePosition: row.timePosition,
      isMuted: row.isMuted,
      muteParameterId: row.muteParameterId,
      createdAt: new Date(row.createdAt),
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : undefined,
      trackName: row.trackName,
    }));
  }

  // Private helper methods

  /**
   * Create a new mute transition for a track (private - use addMuteTransition instead)
   */
  private async createMuteTransition(
    trackId: string,
    timePosition: number,
    isMuted: boolean,
    muteParameterId: string,
  ): Promise<MuteTransition> {
    // Check if track exists
    const track = await this.db.run('SELECT id, track_name FROM tracks WHERE id = ?', [trackId]);
    if (track.length === 0) {
      throw new Error(`Track with id ${trackId} not found`);
    }

    // Check if mute parameter exists
    const parameter = await this.db.run(
      'SELECT id FROM parameters WHERE id = ? AND is_mute = true',
      [muteParameterId],
    );
    if (parameter.length === 0) {
      throw new Error(`Mute parameter with id ${muteParameterId} not found`);
    }

    const newTransition: MuteTransition = {
      id: uuidv4(),
      trackId,
      timePosition,
      isMuted,
      muteParameterId,
      createdAt: new Date(),
    };

    const insertTemplate = SQL`
      INSERT INTO mute_transitions (id, track_id, time_position, is_muted, mute_parameter_id, created_at)
      VALUES (${newTransition.id}, ${newTransition.trackId}, ${newTransition.timePosition},
              ${newTransition.isMuted}, ${newTransition.muteParameterId}, ${newTransition.createdAt})
    `;
    await this.db.run(insertTemplate.sql, insertTemplate.values);

    return newTransition;
  }

  /**
   * Update a mute transition's time position (private)
   */
  private async updateMuteTransitionTime(
    transitionId: string,
    newTimePosition: number,
  ): Promise<void> {
    const sqlTemplate = SQL`
      UPDATE mute_transitions
      SET time_position = ${newTimePosition}, updated_at = ${new Date()}
      WHERE id = ${transitionId}
    `;
    const result = await this.db.run(sqlTemplate.sql, sqlTemplate.values);

    if (result.changes === 0) {
      throw new Error(`Mute transition with id ${transitionId} not found`);
    }
  }

  /**
   * Update a mute transition's time position and mute state (private)
   */
  private async updateMuteTransitionValues(
    transitionId: string,
    newTimePosition: number,
    newIsMuted: boolean,
  ): Promise<void> {
    const sqlTemplate = SQL`
      UPDATE mute_transitions
      SET time_position = ${newTimePosition}, is_muted = ${newIsMuted}, updated_at = ${new Date()}
      WHERE id = ${transitionId}
    `;
    const result = await this.db.run(sqlTemplate.sql, sqlTemplate.values);

    if (result.changes === 0) {
      throw new Error(`Mute transition with id ${transitionId} not found`);
    }
  }

  /**
   * Deduplicate transitions to maintain alternating pattern, prioritizing edited transitions
   */
  private deduplicateTransitions(
    transitions: MuteTransition[],
    priorityIds: string[],
  ): MuteTransition[] {
    const result: MuteTransition[] = [];
    let lastState: boolean | null = null;

    for (const transition of transitions) {
      const isPriority = priorityIds.includes(transition.id);

      if (lastState === null || transition.isMuted !== lastState) {
        // This transition is valid (alternates state)
        result.push(transition);
        lastState = transition.isMuted;
      } else if (isPriority) {
        // This is a priority transition but would create invalid pattern
        // Keep it but remove the previous transition
        if (result.length > 0) {
          result.pop();
        }
        result.push(transition);
        lastState = transition.isMuted;
      }
      // Otherwise, skip this transition (it would create invalid pattern and is not priority)
    }

    return result;
  }
}
