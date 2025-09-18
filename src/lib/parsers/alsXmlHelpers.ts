/**
 * ALS-specific XML helpers for automation envelope manipulation
 * Separated from gzipXmlHelpers to keep concerns focused
 */

/**
 * Extract automation envelopes from ALS XML document
 */
export function extractAutomationEnvelopes(xmlDoc: Document): Array<{
  id: string;
  element: Element;
  events: Array<{ time: number; value: number; curveType?: string }>;
}> {
  const envelopes: Array<{
    id: string;
    element: Element;
    events: Array<{ time: number; value: number; curveType?: string }>;
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
    const events: Array<{ time: number; value: number; curveType?: string }> = [];
    const eventElements = envelope.querySelectorAll('Automation FloatEvent');

    for (const eventElement of eventElements) {
      const time = parseFloat(eventElement.getAttribute('Time') || '0');
      const value = parseFloat(eventElement.getAttribute('Value') || '0');
      const curveType = eventElement.getAttribute('CurveType') || 'linear';

      events.push({ time, value, curveType });
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
  newEvents: Array<{ time: number; value: number; curveType?: string }>,
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
    // Only add CurveType if it's not the default 'linear' to match original ALS format
    if (event.curveType && event.curveType !== 'linear') {
      eventElement.setAttribute('CurveType', event.curveType);
    }

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
  events: Array<{ time: number; value: number; curveType?: string }>,
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
