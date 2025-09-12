#!/usr/bin/env node
/**
 * Explore ALS structure to understand automation envelope relationships
 */

import * as fs from 'fs';
import * as zlib from 'zlib';
import { DOMParser } from 'xmldom';

function exploreALS() {
  const filePath = "./src/tests/test1.als";
  console.log(`🔍 Loading ALS file: ${filePath}`);
  
  // Read and decompress the ALS file
  const compressedData = fs.readFileSync(filePath);
  const decompressedData = zlib.gunzipSync(compressedData);
  
  // Parse XML
  const parser = new DOMParser();
  const doc = parser.parseFromString(decompressedData.toString(), 'text/xml');
  const root = doc.documentElement;
  
  console.log(`✅ Loaded successfully. Root element: ${root.tagName}`);

  // Navigate to LiveSet > Tracks > MidiTrack
  const liveSet = getFirstChildByTag(root, 'LiveSet');
  if (!liveSet) {
    console.log("❌ No LiveSet found");
    return;
  }
  
  const tracks = getFirstChildByTag(liveSet, 'Tracks');
  if (!tracks) {
    console.log("❌ No Tracks found");
    return;
  }
  
  const midiTracks = getChildrenByTag(tracks, 'MidiTrack');
  console.log(`📁 Found ${midiTracks.length} MidiTrack(s)`);
  
  if (midiTracks.length === 0) {
    console.log("❌ No MidiTrack found");
    return;
  }
  
  const midiTrack = midiTracks[0];
  console.log(`\n🎛️  Exploring first MidiTrack:`);
  
  // Look for track name
  const name = getFirstChildByTag(midiTrack, 'Name');
  if (name) {
    const effectiveName = getFirstChildByTag(name, 'EffectiveName');
    if (effectiveName && effectiveName.hasAttribute('Value')) {
      console.log(`  Track name: "${effectiveName.getAttribute('Value')}"`);
    }
  }
  
  // Search for AutomationEnvelope elements anywhere in the document
  console.log(`\n🔍 Searching for AutomationEnvelope elements globally:`);
  const allEnvelopes = findAllElementsByTag(root, 'AutomationEnvelope');
  console.log(`  Found ${allEnvelopes.length} AutomationEnvelope elements in entire document`);
  
  if (allEnvelopes.length === 0) {
    console.log("❌ No AutomationEnvelope elements found anywhere");
    return;
  }
  
  // Show first few envelopes and their structure
  for (let i = 0; i < Math.min(allEnvelopes.length, 6); i++) {
    const envelope = allEnvelopes[i];
    console.log(`  Envelope ${i}:`);
    
    const target = getFirstChildByTag(envelope, 'EnvelopeTarget');
    if (target) {
      console.log(`    EnvelopeTarget found`);
      // Show all attributes
      if (target.attributes) {
        for (let j = 0; j < target.attributes.length; j++) {
          const attr = target.attributes[j];
          console.log(`      ${attr.name}="${attr.value}"`);
        }
      }
      
      // Look for Path element
      const pathElement = getFirstChildByTag(target, 'Path');
      if (pathElement && pathElement.hasAttribute('Value')) {
        const path = pathElement.getAttribute('Value');
        console.log(`      Path="${path}"`);
      }
    } else {
      console.log(`    No EnvelopeTarget found`);
      
      // Show all child elements
      const children = [];
      for (let k = 0; k < envelope.childNodes.length; k++) {
        const node = envelope.childNodes[k];
        if (node.nodeType === 1) {
          children.push((node as Element).tagName);
        }
      }
      console.log(`    Children: ${children.join(', ')}`);
    }
  }
  
  const envelopes = allEnvelopes;
  
  // Explore DeviceChain and PluginFloatParameters
  console.log(`\n🔌 Exploring DeviceChain for PluginFloatParameters:`);
  const deviceChain = getFirstChildByTag(midiTrack, 'DeviceChain');
  if (!deviceChain) {
    console.log("❌ No DeviceChain found");
    return;
  }
  
  const innerDeviceChain = getFirstChildByTag(deviceChain, 'DeviceChain');
  if (!innerDeviceChain) {
    console.log("❌ No inner DeviceChain found");
    return;
  }
  
  const devices = getFirstChildByTag(innerDeviceChain, 'Devices');
  if (!devices) {
    console.log("❌ No Devices found");
    return;
  }
  
  const pluginDevices = getChildrenByTag(devices, 'PluginDevice');
  console.log(`  Found ${pluginDevices.length} PluginDevice(s)`);
  
  if (pluginDevices.length === 0) {
    console.log("❌ No PluginDevice found");
    return;
  }
  
  const pluginDevice = pluginDevices[0];
  
  // Show plugin info
  const pluginDesc = getFirstChildByTag(pluginDevice, 'PluginDesc');
  if (pluginDesc) {
    const pluginName = getFirstChildByTag(pluginDesc, 'Name');
    if (pluginName && pluginName.hasAttribute('Value')) {
      console.log(`  Plugin: "${pluginName.getAttribute('Value')}"`);
    }
  }
  
  const parameterList = getFirstChildByTag(pluginDevice, 'ParameterList');
  if (!parameterList) {
    console.log("❌ No ParameterList found");
    return;
  }
  
  const pluginFloatParams = getChildrenByTag(parameterList, 'PluginFloatParameter');
  console.log(`  Found ${pluginFloatParams.length} PluginFloatParameter(s)`);
  
  // Build mapping of ParameterId to ParameterName
  const paramMapping: Record<string, string> = {};
  
  console.log(`\n📋 Parameter ID to Name mapping:`);
  for (let i = 0; i < pluginFloatParams.length; i++) {
    const param = pluginFloatParams[i];
    const paramId = param.getAttribute('Id');
    
    const parameterName = getFirstChildByTag(param, 'ParameterName');
    const paramName = parameterName?.getAttribute('Value') || `Param ${i + 1}`;
    
    if (paramId) {
      paramMapping[paramId] = paramName;
      console.log(`  ID ${paramId}: "${paramName}"`);
    }
  }
  
  // Match automation envelopes with parameter names
  console.log(`\n🎯 Matching AutomationEnvelopes with Parameter Names:`);
  let matchedCount = 0;
  
  for (let i = 0; i < envelopes.length; i++) {
    const envelope = envelopes[i];
    const target = getFirstChildByTag(envelope, 'EnvelopeTarget');
    
    if (target && target.hasAttribute('PointeeId')) {
      const pointeeId = target.getAttribute('PointeeId');
      const paramName = paramMapping[pointeeId || ''];
      
      if (paramName) {
        console.log(`  ✅ Envelope ${i}: PointeeId="${pointeeId}" → "${paramName}"`);
        matchedCount++;
      } else {
        console.log(`  ❌ Envelope ${i}: PointeeId="${pointeeId}" → NOT FOUND`);
      }
    } else {
      console.log(`  ❌ Envelope ${i}: No PointeeId`);
    }
  }
  
  console.log(`\n📊 Summary: ${matchedCount}/${envelopes.length} envelopes successfully matched`);
}

function getFirstChildByTag(element: Element, tagName: string): Element | null {
  for (let i = 0; i < element.childNodes.length; i++) {
    const node = element.childNodes[i];
    if (node.nodeType === 1 && (node as Element).tagName === tagName) {
      return node as Element;
    }
  }
  return null;
}

function getChildrenByTag(element: Element, tagName: string): Element[] {
  const children: Element[] = [];
  for (let i = 0; i < element.childNodes.length; i++) {
    const node = element.childNodes[i];
    if (node.nodeType === 1 && (node as Element).tagName === tagName) {
      children.push(node as Element);
    }
  }
  return children;
}

function findAllElementsByTag(element: Element, tagName: string): Element[] {
  const results: Element[] = [];
  
  if (element.tagName === tagName) {
    results.push(element);
  }
  
  for (let i = 0; i < element.childNodes.length; i++) {
    const node = element.childNodes[i];
    if (node.nodeType === 1) {
      const childResults = findAllElementsByTag(node as Element, tagName);
      results.push(...childResults);
    }
  }
  
  return results;
}

// Run the exploration
exploreALS();