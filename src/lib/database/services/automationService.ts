import type { AutomationPoint, ParameterStats } from '../schema';
import type { AutomationDatabase } from '../duckdb';
import SQL, { join, raw } from 'sql-template-tag';
import { max, min } from 'lodash';

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

    const existingPoints = await this.getAutomationPoints({ parameterId });

    // if there's only one point and it's at negative time, update it so that we
    // have a flat line at the beginning
    if (existingPoints.length === 1 && existingPoints[0].timePosition < 0) {
      await this.updateAutomationPoint(
        existingPoints[0].id,
        parameterId,
        existingPoints[0].timePosition,
        value,
      );
    }

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

    // if theres only two points (this one and the one at negative time)
    // update the one at negative time so that we have a flat line at the beginning
    const existingPoints = await this.getAutomationPoints({ parameterId });
    if (existingPoints.length === 2 && existingPoints[0].timePosition < 0) {
      await this.updateAutomationPoint(
        existingPoints[0].id,
        parameterId,
        existingPoints[0].timePosition,
        value,
      );
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
    direction = 'asc',
    limit,
  }: {
    parameterId?: string;
    parameterIds?: string[];
    startTime?: number;
    endTime?: number;
    direction?: 'asc' | 'desc';
    limit?: number;
  }): Promise<AutomationPoint[]> {
    let filters = [SQL`1 = 1`];
    if (parameterId) {
      filters.push(SQL`parameter_id = ${parameterId}`);
    }
    if (parameterIds) {
      filters.push(SQL`parameter_id IN (${join(parameterIds)})`);
    }
    if (startTime !== undefined) {
      filters.push(SQL`time_position >= ${startTime}`);
    }
    if (endTime !== undefined) {
      filters.push(SQL`time_position <= ${endTime}`);
    }
    let sql = SQL`
      SELECT id, parameter_id, time_position, value, curve_type, created_at, updated_at
      FROM automation_points
      WHERE ${join(filters, ' AND ')}
      ORDER BY time_position ${raw(direction)}
      ${limit ? SQL`LIMIT ${limit}` : SQL``}
    `;

    return this.db.run(sql.sql, sql.values);
  }

  /**
   * Get automation points for a parameter within a time range
   */
  async getAutomationPointsInRange(
    parameterId: string,
    startTime: number,
    endTime: number,
  ): Promise<AutomationPoint[]> {
    return this.getAutomationPoints({
      parameterId,
      startTime,
      endTime,
    });
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
    const a = new Date();

    // Process points in a transaction-like manner
    const results = await Promise.all(
      points.map(async (point) => {
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
        return result;
      }),
    );

    const b = new Date();
    console.log(
      `✅ Bulk processed ${points.length} automation points in ${b.getTime() - a.getTime()}ms`,
    );

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
    // Get automation points within the time range
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
    // Get automation points within the time range
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

  /**
   * Delete automation points by their IDs
   * @param pointIds - Array of automation point IDs to delete
   * @returns Number of points deleted
   */
  async deleteAutomationPoints(pointIds: string[]): Promise<number> {
    if (pointIds.length === 0) {
      return 0;
    }

    // Use parameterized query for safety
    const placeholders = pointIds.map(() => '?').join(',');
    const result = await this.db.run(
      `DELETE FROM automation_points WHERE id IN (${placeholders})`,
      pointIds,
    );

    console.log(`✅ Deleted ${pointIds.length} automation points`);
    return pointIds.length;
  }

  async getMaxTime(): Promise<number> {
    const result = await this.db.run(
      'SELECT MAX(time_position) as max_time FROM automation_points',
    );
    return result[0].maxTime + 5 * 60; // add 5 minutes to the max time
  }
  async simplifyAutomationPointsWithTolerance(
    pointIds: string[],
    tolerance: number,
  ): Promise<number> {
    const sql = SQL`
      WITH neighbors AS (
        SELECT
          id,
          parameter_id,
          time_position as ts,
          value as y,
          LAG(time_position) OVER parameter_timeseries AS ts_prev,
          LAG(value)  OVER parameter_timeseries AS y_prev,
          LEAD(time_position) OVER parameter_timeseries AS ts_next,
          LEAD(value) OVER parameter_timeseries AS y_next
        FROM automation_points
        WHERE id IN (${join(pointIds)})
        WINDOW
        parameter_timeseries AS (
            PARTITION BY parameter_id
            ORDER BY time_position ASC
        )
      ),

      distances AS (
        SELECT
          id,
          parameter_id,
          ts,
          y,
          CASE 
            WHEN ts_prev IS NULL OR ts_next IS NULL THEN NULL -- endpoints
            WHEN ts_next = ts_prev THEN 0
            -- perpendicular distance from point to line connecting the previous and next points
            ELSE
              ABS( (y_next - y_prev) * (ts - ts_prev)
                - (ts_next - ts_prev) * (y - y_prev) )
              / SQRT( (y_next - y_prev)*(y_next - y_prev)
                    + (ts_next - ts_prev)*(ts_next - ts_prev) )
          END AS deviation
        FROM neighbors
      )
      DELETE FROM automation_points where id IN (SELECT id FROM distances WHERE deviation < ${tolerance}) RETURNING id;
    `;
    const result = await this.db.run(sql.sql, sql.values);
    return result.length;
  }
  async simplifyAutomationPoints(pointIds: string[]): Promise<number> {
    let tolerance = 0.005;
    let deletedPoints = 0;
    for (let i = 0; i < 3; i++) {
      deletedPoints = await this.simplifyAutomationPointsWithTolerance(pointIds, tolerance);
      if (deletedPoints > 0) {
        break;
      }
      tolerance *= 2;
    }
    console.log(`✅ Simplified ${deletedPoints} automation points with tolerance ${tolerance}`);
    return deletedPoints;
  }
}
