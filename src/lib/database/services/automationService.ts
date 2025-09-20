import type { AutomationPoint, ParameterStats } from '../schema';
import type { AutomationDatabase } from '../duckdb';

export class AutomationService {
  constructor(private db: AutomationDatabase) {}

  /**
   * Create a new automation point for a parameter
   * @param parameterId - The parameter to create point for
   * @param timePosition - Time position in beats/seconds
   * @param value - Automation value (0.0 to 1.0)
   * @returns The created automation point
   */
  async createAutomationPoint(
    parameterId: string,
    timePosition: number,
    value: number,
  ): Promise<AutomationPoint> {
    // Validate inputs
    if (value < 0 || value > 1) {
      throw new Error('Automation value must be between 0.0 and 1.0');
    }

    // Check if parameter exists
    const parameter = await this.db.run('SELECT id, parameter_name FROM parameters WHERE id = ?', [
      parameterId,
    ]);

    if (parameter.length === 0) {
      throw new Error(`Parameter ${parameterId} not found`);
    }

    const pointId = Math.random().toString(36).substring(2, 15);
    const now = new Date();

    const pointData = {
      id: pointId,
      parameterId,
      timePosition,
      value,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.insertRecord('automation_points', pointData);

    console.log(
      `✅ Created automation point at time ${timePosition} for parameter ${parameter[0].parameterName}`,
    );

    return pointData;
  }

  /**
   * Update an existing automation point
   * @param id - The id of the automation point to update
   * @param parameterId - The parameter to update point for
   * @param timePosition - Time position in beats/seconds
   * @param value - Automation value (0.0 to 1.0)
   * @returns The updated automation point
   */
  async updateAutomationPoint(
    id: string,
    parameterId: string,
    timePosition: number,
    value: number,
  ): Promise<AutomationPoint> {
    // Validate inputs
    if (value < 0 || value > 1) {
      throw new Error('Automation value must be between 0.0 and 1.0');
    }

    // Check if parameter exists
    const parameter = await this.db.run('SELECT id, parameter_name FROM parameters WHERE id = ?', [
      parameterId,
    ]);

    if (parameter.length === 0) {
      throw new Error(`Parameter ${parameterId} not found`);
    }

    // Check if automation point exists
    const existingPoint = await this.db.run(
      'SELECT id, created_at FROM automation_points WHERE id = ?',
      [id],
    );

    if (existingPoint.length === 0) {
      throw new Error(`Automation point with id ${id} not found`);
    }

    const updatedAt = new Date();

    await this.db.run(
      `
      UPDATE automation_points
      SET parameter_id = ?, time_position = ?, value = ?, updated_at = ?
      WHERE id = ?
    `,
      [parameterId, timePosition, value, updatedAt, id],
    );

    console.log(
      `✅ Updated automation point ${id} to time ${timePosition} for parameter ${parameter[0].parameterName}`,
    );

    return {
      id,
      parameterId,
      timePosition,
      value,
      createdAt: existingPoint[0].createdAt,
      updatedAt,
    };
  }

  /**
   * Remove an automation point at a specific time
   * @param parameterId - The parameter to edit
   * @param timePosition - Time position to remove point from
   * @returns true if a point was removed
   */
  async removeAutomationPoint(parameterId: string, timePosition: number): Promise<boolean> {
    // First check if the point exists
    const existingPoints = await this.db.run(
      'SELECT COUNT(*) as count FROM automation_points WHERE parameter_id = ? AND time_position = ?',
      [parameterId, timePosition],
    );

    const pointExisted = existingPoints[0].count > 0;

    if (pointExisted) {
      // Delete the point
      await this.db.run(
        'DELETE FROM automation_points WHERE parameter_id = ? AND time_position = ?',
        [parameterId, timePosition],
      );

      console.log(
        `✅ Removed automation point at time ${timePosition} for parameter ${parameterId}`,
      );
      return true;
    } else {
      return false;
    }
  }

  /**
   * Get automation points for a parameter with optional time filtering
   * @param parameterId - The parameter to query
   * @param startTime - Optional start time (inclusive)
   * @param endTime - Optional end time (inclusive)
   * @param fullDetails - Whether to return full AutomationPoint objects (default) or just basic data
   * @returns Array of automation points
   */
  async getAutomationPoints({
    parameterId,
    parameterIds,
    startTime,
    endTime,
  }: {
    parameterId?: string;
    parameterIds?: string[];
    startTime?: number;
    endTime?: number;
  }): Promise<AutomationPoint[]> {
    let sql = `
      SELECT id, parameter_id, time_position, value, curve_type, created_at, updated_at
      FROM automation_points
      WHERE ${parameterId ? 'parameter_id = ?' : '1'}
    `;
    const params: any[] = parameterId ? [parameterId] : [];
    if (parameterIds) {
      sql += ` AND parameter_id IN (${Array(parameterIds.length).fill('?').join(',')})`;
      params.push(...parameterIds);
    }

    if (startTime !== undefined) {
      sql += ' AND time_position >= ?';
      params.push(startTime);
    }
    if (endTime !== undefined) {
      sql += ' AND time_position <= ?';
      params.push(endTime);
    }

    sql += ' ORDER BY time_position';

    return await this.db.run(sql, params);
  }

  /**
   * Get automation points for a parameter within a time range (alias for backwards compatibility)
   */
  async getAutomationPointsInRange(
    parameterId: string,
    startTime: number,
    endTime: number,
  ): Promise<AutomationPoint[]> {
    return (await this.getAutomationPoints({
      parameterId,
      startTime,
      endTime,
    })) as AutomationPoint[];
  }

  /**
   * Bulk create or update multiple automation points for efficient editing
   * @param points - Array of automation points (with or without ids)
   * @returns Array of created/updated automation points
   */
  async bulkSetAutomationPoints(
    points: Array<
      Partial<AutomationPoint> & { parameterId: string; timePosition: number; value: number }
    >,
  ): Promise<AutomationPoint[]> {
    console.log(`🔍 Bulk setting ${points.length} automation points`, points);
    const results: AutomationPoint[] = [];

    // Process points in a transaction-like manner
    for (const point of points) {
      let result: AutomationPoint;

      if (point.id) {
        // Update existing point
        result = await this.updateAutomationPoint(
          point.id,
          point.parameterId,
          point.timePosition,
          point.value,
        );
      } else {
        // Create new point
        result = await this.createAutomationPoint(
          point.parameterId,
          point.timePosition,
          point.value,
        );
      }

      results.push(result);
    }

    console.log(`✅ Bulk processed ${points.length} automation points`);
    return results;
  }

  /**
   * Compute parameter statistics on-the-fly
   */
  async getParameterStats(parameterId: string): Promise<ParameterStats> {
    const result = await this.db.run(
      `
      SELECT 
        parameter_id as id,
        MIN(value) as min_value,
        MAX(value) as max_value,
        MIN(time_position) as min_time,
        MAX(time_position) as max_time,
        COUNT(*) as point_count
      FROM automation_points
      WHERE parameter_id = ?
      GROUP BY parameter_id
    `,
      [parameterId],
    );

    if (result.length === 0) {
      return {
        id: parameterId,
        minValue: 0,
        maxValue: 1,
        minTime: 0,
        maxTime: 0,
        pointCount: 0,
      };
    }

    return result[0] as ParameterStats;
  }

  /**
   * Move automation points for a specific parameter within a time range
   * @param parameterId - The parameter to move automation for
   * @param startTime - Start of the time range to move
   * @param endTime - End of the time range to move
   * @param timeOffset - How much to offset the time positions
   * @returns Number of automation points moved
   */
  async moveParameterAutomation(
    parameterId: string,
    startTime: number,
    endTime: number,
    timeOffset: number,
  ): Promise<number> {
    // Get automation points within the clip time range
    const pointsInRange = await this.getAutomationPointsInRange(parameterId, startTime, endTime);

    if (pointsInRange.length === 0) {
      return 0;
    }

    // Update each point's time position
    for (const point of pointsInRange) {
      const newTimePosition = point.timePosition + timeOffset;

      // Remove old point
      await this.db.run('DELETE FROM automation_points WHERE id = ?', [point.id]);

      // Create new point at offset position
      const newPointId = Math.random().toString(36).substring(2, 15);
      await this.db.insertRecord('automation_points', {
        id: newPointId,
        parameterId,
        timePosition: newTimePosition,
        value: point.value,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    console.log(
      `    📊 Moved ${pointsInRange.length} automation points for parameter ${parameterId}`,
    );
    return pointsInRange.length;
  }

  /**
   * Copy automation points for a specific parameter within a time range
   * @param parameterId - The parameter to copy automation for
   * @param startTime - Start of the time range to copy
   * @param endTime - End of the time range to copy
   * @param timeOffset - How much to offset the copied time positions
   * @returns Number of automation points copied
   */
  async copyParameterAutomation(
    parameterId: string,
    startTime: number,
    endTime: number,
    timeOffset: number,
  ): Promise<number> {
    // Get automation points within the clip time range
    const pointsInRange = await this.getAutomationPointsInRange(parameterId, startTime, endTime);

    if (pointsInRange.length === 0) {
      return 0;
    }

    // Create new points at offset positions
    for (const point of pointsInRange) {
      const newTimePosition = point.timePosition + timeOffset;
      const newPointId = Math.random().toString(36).substring(2, 15);

      await this.db.insertRecord('automation_points', {
        id: newPointId,
        parameterId,
        timePosition: newTimePosition,
        value: point.value,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    console.log(
      `    📋 Copied ${pointsInRange.length} automation points for parameter ${parameterId}`,
    );
    return pointsInRange.length;
  }

  async getMaxTime(): Promise<number> {
    const result = await this.db.run(
      'SELECT MAX(time_position) as max_time FROM automation_points',
    );
    return result[0].maxTime + 5 * 60; // add 5 minutes to the max time
  }
}
