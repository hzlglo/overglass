import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { AutomationDatabase } from '../lib/database/duckdb';
import { NativeDuckDBAdapter } from '../lib/database/adapters/native';
import { ALSParser } from '../lib/parsers/alsParser';

describe('ALS Structure Verification', () => {
  let db: AutomationDatabase;
  let parser: ALSParser;

  beforeAll(async () => {
    // Initialize database with test data
    const adapter = new NativeDuckDBAdapter();
    db = new AutomationDatabase(adapter);
    await db.initialize();
    
    parser = new ALSParser();
    
    // Load test ALS data
    const buffer = readFileSync('./src/tests/test1.als');
    const testFile = {
      name: 'test.als',
      size: buffer.length,
      type: 'application/octet-stream',
      arrayBuffer: async () =>
        buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    } as File;
    
    const parsedData = await parser.parseALSFile(testFile);
    await db.loadALSData(parsedData);
  });

  afterAll(async () => {
    await db.close();
  });

  it('should have exactly 1 Elektron device', async () => {
    const devices = await db.devices.getDevicesWithTracks();
    
    console.log('Devices found:', devices);
    
    expect(devices).toHaveLength(1);
    expect(devices[0].deviceName).toBe('Digitakt II');
    expect(devices[0].deviceType).toBe('elektron');
  });

  it('should have exactly 3 tracks (T1, T3, T6)', async () => {
    const devices = await db.devices.getDevicesWithTracks();
    const device = devices[0];
    
    const tracks = await db.tracks.getTracksForDevice(device.id);
    
    console.log('Tracks found:', tracks);
    console.log('Device ID used:', device.id);
    
    expect(tracks).toHaveLength(3);
    
    // Check track numbers
    const trackNumbers = tracks.map(t => t.trackNumber).sort();
    expect(trackNumbers).toEqual([1, 3, 6]);
    
    // Verify track names contain the expected track numbers
    tracks.forEach(track => {
      expect(track.trackName).toMatch(/Track [136]/);
    });
  });

  it('should have correct parameter counts per track', async () => {
    const devices = await db.devices.getDevicesWithTracks();
    const device = devices[0];
    const tracks = await db.tracks.getTracksForDevice(device.id);
    
    // Sort tracks by track number for consistent testing
    const sortedTracks = tracks.sort((a, b) => a.trackNumber - b.trackNumber);
    
    // T1 should have just the Mute parameter
    const t1 = sortedTracks.find(t => t.trackNumber === 1);
    expect(t1).toBeDefined();
    const t1Params = await db.tracks.getParametersForTrack(t1!.id);
    console.log('T1 parameters:', t1Params.map(p => p.parameterName));
    expect(t1Params).toHaveLength(1);
    expect(t1Params[0].parameterName).toMatch(/mute/i);
    
    // T3 should have 2 automated parameters
    const t3 = sortedTracks.find(t => t.trackNumber === 3);
    expect(t3).toBeDefined();
    const t3Params = await db.tracks.getParametersForTrack(t3!.id);
    console.log('T3 parameters:', t3Params.map(p => p.parameterName));
    expect(t3Params).toHaveLength(2);
    
    // T6 should have 3 automated parameters
    const t6 = sortedTracks.find(t => t.trackNumber === 6);
    expect(t6).toBeDefined();
    const t6Params = await db.tracks.getParametersForTrack(t6!.id);
    console.log('T6 parameters:', t6Params.map(p => p.parameterName));
    expect(t6Params).toHaveLength(3);
  });

  it('should have automation points for all parameters', async () => {
    const devices = await db.devices.getDevicesWithTracks();
    const device = devices[0];
    const tracks = await db.tracks.getTracksForDevice(device.id);
    
    let totalAutomationPoints = 0;
    
    for (const track of tracks) {
      const parameters = await db.tracks.getParametersForTrack(track.id);
      
      for (const param of parameters) {
        const points = await db.automation.getAutomationPoints(param.id);
        totalAutomationPoints += points.length;
        
        console.log(`Track ${track.trackNumber} - ${param.parameterName}: ${points.length} points`);
        
        // Each parameter should have at least some automation points
        expect(points.length).toBeGreaterThan(0);
      }
    }
    
    console.log(`Total automation points: ${totalAutomationPoints}`);
    expect(totalAutomationPoints).toBeGreaterThan(300); // Should have several hundred points
  });

  it('should debug track loading process', async () => {
    const devices = await db.devices.getDevicesWithTracks();
    console.log('=== DEBUG: Device count and structure ===');
    devices.forEach((device, index) => {
      console.log(`Device ${index}: ${device.deviceName} (${device.trackCount} tracks, ${device.parameterCount} parameters)`);
    });
    
    if (devices.length > 0) {
      const id = devices[0].id;
      console.log('=== DEBUG: Using device ID:', id);
      
      // Check tracks with basic info (avoiding BigInt serialization)
      const tracks = await db.tracks.getTracksForDevice(id);
      console.log('=== DEBUG: Track summary ===');
      tracks.forEach(track => {
        console.log(`  Track ${track.trackNumber}: ${track.trackName} (${track.parameterCount} params, ${track.automationPointCount} points)`);
      });
      
      expect(tracks).toHaveLength(3);
      expect(tracks.map(t => t.trackNumber).sort()).toEqual([1, 3, 6]);
    }
  });
});