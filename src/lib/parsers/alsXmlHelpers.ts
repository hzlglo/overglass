/**
 * ALS-specific XML helpers for automation envelope manipulation
 * Separated from gzipXmlHelpers to keep concerns focused
 */

import { getDirectChild, getDirectChildren, getViaPath } from './xmlUtils';

/**
 * Extract automation envelopes from ALS XML document
 */
export function extractAutomationEnvelopes(xmlDoc: Document): Array<{
  id: string;
  element: Element;
  events: Array<{ time: number; value: number }>;
}> {
  const envelopes: Array<{
    id: string;
    element: Element;
    events: Array<{ time: number; value: number }>;
  }> = [];

  const automationEnvelopes = xmlDoc.querySelectorAll('AutomationEnvelope');

  for (const envelope of automationEnvelopes) {
    // Try multiple ways to get the ID since ALS structure varies
    let automationId: string | null = null;

    // Method 1: Look for Id element with Value attribute
    const idElement = envelope.querySelector('Id');
    if (idElement) {
      automationId = idElement.getAttribute('Value') || idElement.textContent;
    }

    // Method 2: If no Id element, use the envelope index as ID
    if (!automationId) {
      automationId = `envelope_${envelopes.length}`;
      console.log(`No ID found for envelope, using generated ID: ${automationId}`);
    }

    // Extract existing events - ALS uses 'Automation > FloatEvent', not 'Events > FloatEvent'
    const events: Array<{ time: number; value: number }> = [];
    const eventElements = envelope.querySelectorAll('Automation FloatEvent');

    for (const eventElement of eventElements) {
      const time = parseFloat(eventElement.getAttribute('Time') || '0');
      const value = parseFloat(eventElement.getAttribute('Value') || '0');

      events.push({ time, value });
    }

    envelopes.push({
      id: automationId,
      element: envelope,
      events,
    });
  }

  return envelopes;
}

/**
 * Update automation events in an envelope element
 */
export function updateAutomationEvents(
  envelopeElement: Element,
  newEvents: Array<{ time: number; value: number }>,
): void {
  // Find the Automation element
  let automationElement = envelopeElement.querySelector('Automation');
  if (!automationElement) {
    automationElement = envelopeElement.ownerDocument!.createElement('Automation');
    envelopeElement.appendChild(automationElement);
  }

  // Find or create the Events element within Automation (preserve existing structure)
  let eventsElement = automationElement.querySelector('Events');
  if (!eventsElement) {
    eventsElement = automationElement.ownerDocument!.createElement('Events');
    // Insert Events as the first child, before any other elements like AutomationTransformViewState
    automationElement.insertBefore(eventsElement, automationElement.firstChild);
  }

  // Clear only the Events content, preserving other Automation children like AutomationTransformViewState
  eventsElement.innerHTML = '';

  // Sort events by time
  const sortedEvents = newEvents.sort((a, b) => a.time - b.time);

  // Add each event as a FloatEvent within Events
  for (const [index, event] of sortedEvents.entries()) {
    const eventElement = eventsElement.ownerDocument!.createElement('FloatEvent');
    eventElement.setAttribute('Id', (index + 1).toString()); // Use 1-indexed IDs
    eventElement.setAttribute('Time', String(event.time));
    eventElement.setAttribute('Value', String(event.value));

    eventsElement.appendChild(eventElement);
  }

  console.log(`Updated automation envelope with ${newEvents.length} events`);
}

/**
 * Find automation envelope by parameter path or ID
 */
export function findAutomationEnvelope(xmlDoc: Document, parameterPath: string): Element | null {
  const automationEnvelopes = xmlDoc.querySelectorAll('AutomationEnvelope');

  for (const envelope of automationEnvelopes) {
    // Check various ways the parameter might be referenced
    const idElement = envelope.querySelector('Id');
    if (idElement?.getAttribute('Value') === parameterPath) {
      return envelope;
    }

    // Also check EnvelopeTarget for parameter references
    const targetElement = envelope.querySelector('EnvelopeTarget');
    if (targetElement) {
      const pointeeIdElement = targetElement.querySelector('PointeeId');
      if (pointeeIdElement?.getAttribute('Value') === parameterPath) {
        return envelope;
      }

      const pathElement = targetElement.querySelector('Path');
      if (pathElement?.getAttribute('Value')?.includes(parameterPath)) {
        return envelope;
      }
    }
  }

  return null;
}

/**
 * Create a new automation envelope element
 */
export function createAutomationEnvelope(
  xmlDoc: Document,
  parameterId: string,
  parameterPath: string,
  events: Array<{ time: number; value: number }>,
): Element {
  const envelope = xmlDoc.createElement('AutomationEnvelope');

  // Add Id element
  const idElement = xmlDoc.createElement('Id');
  idElement.setAttribute('Value', parameterPath);
  envelope.appendChild(idElement);

  // Add EnvelopeTarget
  const targetElement = xmlDoc.createElement('EnvelopeTarget');
  const pointeeIdElement = xmlDoc.createElement('PointeeId');
  pointeeIdElement.setAttribute('Value', parameterId);
  targetElement.appendChild(pointeeIdElement);
  envelope.appendChild(targetElement);

  // Add automation events
  updateAutomationEvents(envelope, events);

  return envelope;
}

/**
 * Get or create an automation envelope for a parameter
 */
export function getOrCreateAutomationEnvelope(
  xmlDoc: Document,
  parameterId: string,
  parameterPath: string,
): Element {
  // Try to find existing envelope
  let envelope = findAutomationEnvelope(xmlDoc, parameterPath);

  if (!envelope) {
    // Create new envelope
    envelope = createAutomationEnvelope(xmlDoc, parameterId, parameterPath, []);

    // Find a good place to insert it (e.g., in a DeviceChain or at document level)
    const deviceChains = xmlDoc.querySelectorAll('DeviceChain');
    if (deviceChains.length > 0) {
      deviceChains[0].appendChild(envelope);
    } else {
      // Fallback: add to document root
      xmlDoc.documentElement.appendChild(envelope);
    }
  }

  return envelope;
}

/**
 * Find the next available AutomationEnvelope ID in the MidiTrack's AutomationEnvelopes.Envelopes
 */
export function getNextAutomationEnvelopeId(midiTrack: Element): number {
  const automationEnvelopes = getViaPath(midiTrack, ['AutomationEnvelopes', 'Envelopes']);
  if (!automationEnvelopes) {
    return 0;
  }

  const envelopes = getDirectChildren(automationEnvelopes, 'AutomationEnvelope');
  let maxId = -1;

  for (const envelope of envelopes) {
    const idAttr = envelope.getAttribute('Id');
    if (idAttr !== null) {
      const id = parseInt(idAttr, 10);
      if (!isNaN(id) && id > maxId) {
        maxId = id;
      }
    }
  }

  return maxId + 1;
}

/**
 * Create a new AutomationEnvelope element for a new parameter
 * This creates the structure needed when adding a parameter that wasn't in the original ALS
 *
 * @param xmlDoc - The XML document
 * @param envelopeId - The ID for the new envelope
 * @param pointeeId - The PointeeId that links this envelope to a PluginFloatParameter
 * @param events - Array of automation events
 * @returns The created AutomationEnvelope element
 */
export function createNewParameterAutomationEnvelope(
  xmlDoc: Document,
  envelopeId: number,
  pointeeId: string,
  events: Array<{ time: number; value: number }>,
): Element {
  const envelope = xmlDoc.createElement('AutomationEnvelope');
  envelope.setAttribute('Id', envelopeId.toString());

  // Add EnvelopeTarget with PointeeId
  const targetElement = xmlDoc.createElement('EnvelopeTarget');
  const pointeeIdElement = xmlDoc.createElement('PointeeId');
  pointeeIdElement.setAttribute('Value', pointeeId);
  targetElement.appendChild(pointeeIdElement);
  envelope.appendChild(targetElement);

  // Add Automation container
  const automationElement = xmlDoc.createElement('Automation');

  // Add Events container
  const eventsElement = xmlDoc.createElement('Events');
  for (const [index, event] of events.entries()) {
    const eventElement = xmlDoc.createElement('FloatEvent');
    eventElement.setAttribute('Id', index.toString());
    eventElement.setAttribute('Time', String(event.time));
    eventElement.setAttribute('Value', String(event.value));
    eventsElement.appendChild(eventElement);
  }
  automationElement.appendChild(eventsElement);

  // Add AutomationTransformViewState (required structure)
  const transformViewState = xmlDoc.createElement('AutomationTransformViewState');
  const isTransformPending = xmlDoc.createElement('IsTransformPending');
  isTransformPending.setAttribute('Value', 'false');
  transformViewState.appendChild(isTransformPending);
  const timeAndValueTransforms = xmlDoc.createElement('TimeAndValueTransforms');
  transformViewState.appendChild(timeAndValueTransforms);
  automationElement.appendChild(transformViewState);

  envelope.appendChild(automationElement);

  return envelope;
}

/**
 * Find a placeholder PluginFloatParameter (one with ParameterId="-1") within a DeviceChain
 * Returns the element and its parent ParameterList
 */
export function findPlaceholderPluginFloatParameter(
  deviceChain: Element,
): { element: Element; parameterList: Element } | null {
  // Path: DeviceChain > Devices > PluginDevice > ParameterList > PluginFloatParameter
  const pluginDevice = getViaPath(deviceChain, ['Devices', 'PluginDevice']);
  if (!pluginDevice) {
    return null;
  }

  const parameterList = getDirectChild(pluginDevice, 'ParameterList');
  if (!parameterList) {
    return null;
  }

  const pluginFloatParams = getDirectChildren(parameterList, 'PluginFloatParameter');

  for (const param of pluginFloatParams) {
    const parameterIdElement = getDirectChild(param, 'ParameterId');
    if (parameterIdElement?.getAttribute('Value') === '-1') {
      return { element: param, parameterList };
    }
  }

  return null;
}

/**
 * Update a PluginFloatParameter placeholder with actual parameter data
 */
export function updatePluginFloatParameter(
  pluginFloatParam: Element,
  parameterName: string,
  parameterId: string,
  visualIndex: number,
  manualValue: number,
): void {
  // Update ParameterName
  const parameterNameElement = getDirectChild(pluginFloatParam, 'ParameterName');
  if (parameterNameElement) {
    parameterNameElement.setAttribute('Value', parameterName);
  }

  // Update ParameterId
  const parameterIdElement = getDirectChild(pluginFloatParam, 'ParameterId');
  if (parameterIdElement) {
    parameterIdElement.setAttribute('Value', parameterId);
  }

  // Update VisualIndex
  const visualIndexElement = getDirectChild(pluginFloatParam, 'VisualIndex');
  if (visualIndexElement) {
    visualIndexElement.setAttribute('Value', visualIndex.toString());
  }

  // Update Manual value in ParameterValue
  const parameterValue = getDirectChild(pluginFloatParam, 'ParameterValue');
  if (parameterValue) {
    const manualElement = getDirectChild(parameterValue, 'Manual');
    if (manualElement) {
      manualElement.setAttribute('Value', manualValue.toString());
    }
  }
}

/**
 * Get the next available VisualIndex for PluginFloatParameter
 */
export function getNextVisualIndex(parameterList: Element): number {
  const pluginFloatParams = getDirectChildren(parameterList, 'PluginFloatParameter');
  let maxIndex = -1;

  for (const param of pluginFloatParams) {
    const visualIndexElement = getDirectChild(param, 'VisualIndex');
    if (visualIndexElement) {
      const index = parseInt(visualIndexElement.getAttribute('Value') || '-1', 10);
      // Ignore the special placeholder value 1073741823
      if (!isNaN(index) && index !== 1073741823 && index > maxIndex) {
        maxIndex = index;
      }
    }
  }

  return maxIndex + 1;
}
