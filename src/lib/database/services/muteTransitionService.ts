import { v4 as uuidv4 } from 'uuid';
import type { MuteTransition } from '../schema';
import type { AutomationDatabase } from '../duckdb';
import SQL, { join } from 'sql-template-tag';

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
    const transitionsBefore = existingTransitions.filter(t => t.timePosition < timePosition);
    const lastBefore = transitionsBefore.length > 0 ? transitionsBefore[transitionsBefore.length - 1] : null;

    // Determine what state we should transition to (opposite of current state)
    let currentState = false; // Default to unmuted if no previous transitions
    if (lastBefore) {
      currentState = lastBefore.isMuted;
    }
    const newState = !currentState;

    const transitionsAfter = existingTransitions.filter(t => t.timePosition > timePosition);
    const nextAfter = transitionsAfter.length > 0 ? transitionsAfter[0] : null;

    const createdTransitions: MuteTransition[] = [];

    // Create the primary transition
    const primaryTransition = await this.createMuteTransition(trackId, timePosition, newState, muteParameterId);
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
        muteParameterId
      );
      createdTransitions.push(secondTransition);
    }

    return createdTransitions;
  }

  /**
   * Move mute transitions by a delta time, maintaining the alternating on/off pattern
   * Prioritizes keeping the edited transitions and removes conflicting ones
   */
  async moveMuteTransitions(transitionIds: string[], deltaTime: number): Promise<void> {
    if (transitionIds.length === 0) return;

    // Get all transitions to move
    const transitionsToMove: MuteTransition[] = [];
    for (const id of transitionIds) {
      const transition = await this.getMuteTransition(id);
      if (transition) {
        transitionsToMove.push(transition);
      }
    }

    if (transitionsToMove.length === 0) return;

    // Assume all transitions are from the same track (validate this)
    const trackId = transitionsToMove[0].trackId;
    if (!transitionsToMove.every(t => t.trackId === trackId)) {
      throw new Error('All transitions must be from the same track');
    }

    // Get all existing transitions for the track
    const allTransitions = await this.getMuteTransitionsForTrack(trackId);

    // Create the moved versions
    const movedTransitions = transitionsToMove.map(t => ({
      ...t,
      timePosition: t.timePosition + deltaTime,
    }));

    // Get transitions that are NOT being moved
    const staticTransitions = allTransitions.filter(t => !transitionIds.includes(t.id));

    // Combine static and moved transitions, sort by time
    const combinedTransitions = [...staticTransitions, ...movedTransitions]
      .sort((a, b) => a.timePosition - b.timePosition);

    // Deduplicate to maintain alternating pattern, prioritizing moved transitions
    const deduplicatedTransitions = this.deduplicateTransitions(combinedTransitions, transitionIds);

    // Find transitions that need to be deleted (were in original but not in deduplicated)
    const transitionsToDelete = allTransitions.filter(t =>
      !deduplicatedTransitions.some(dt => dt.id === t.id)
    );

    // Delete conflicting transitions
    for (const transition of transitionsToDelete) {
      await this.deleteMuteTransition(transition.id);
    }

    // Update moved transitions that survived deduplication
    for (const transition of movedTransitions) {
      if (deduplicatedTransitions.some(dt => dt.id === transition.id)) {
        await this.updateMuteTransitionTime(transition.id, transition.timePosition);
      }
    }
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
  async getMuteTransitionsForDevice(deviceId: string): Promise<(MuteTransition & { trackName: string })[]> {
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
    const parameter = await this.db.run('SELECT id FROM parameters WHERE id = ? AND is_mute = true', [
      muteParameterId,
    ]);
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
  private async updateMuteTransitionTime(transitionId: string, newTimePosition: number): Promise<void> {
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
   * Deduplicate transitions to maintain alternating pattern, prioritizing edited transitions
   */
  private deduplicateTransitions(
    transitions: MuteTransition[],
    priorityIds: string[]
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