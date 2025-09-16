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
    const idElement = envelope.querySelector('Id');
    if (!idElement) continue;

    const automationId = idElement.getAttribute('Value');
    if (!automationId) continue;

    // Extract existing events
    const events: Array<{ time: number; value: number; curveType?: string }> = [];
    const eventElements = envelope.querySelectorAll('Events > FloatEvent');

    for (const eventElement of eventElements) {
      const time = parseFloat(eventElement.getAttribute('Time') || '0');
      const value = parseFloat(eventElement.getAttribute('Value') || '0');
      const curveType = eventElement.getAttribute('CurveType') || 'linear';

      events.push({ time, value, curveType });
    }

    envelopes.push({
      id: automationId,
      element: envelope,
      events
    });
  }

  return envelopes;
}

/**
 * Update automation events in an envelope element
 */
export function updateAutomationEvents(
  envelopeElement: Element,
  newEvents: Array<{ time: number; value: number; curveType?: string }>
): void {
  // Find or create Events element
  let eventsElement = envelopeElement.querySelector('Events');
  if (!eventsElement) {
    eventsElement = envelopeElement.ownerDocument!.createElement('Events');
    envelopeElement.appendChild(eventsElement);
  }

  // Clear existing events
  eventsElement.innerHTML = '';

  // Sort events by time
  const sortedEvents = newEvents.sort((a, b) => a.time - b.time);

  // Add each event as a FloatEvent
  for (const event of sortedEvents) {
    const eventElement = eventsElement.ownerDocument!.createElement('FloatEvent');
    eventElement.setAttribute('Id', String(Math.floor(event.time * 1000))); // Use time * 1000 as ID
    eventElement.setAttribute('Time', String(event.time));
    eventElement.setAttribute('Value', String(event.value));
    eventElement.setAttribute('CurveType', event.curveType || 'linear');

    eventsElement.appendChild(eventElement);
  }

  console.log(`Updated automation envelope with ${newEvents.length} events`);
}

/**
 * Find automation envelope by parameter path or ID
 */
export function findAutomationEnvelope(
  xmlDoc: Document,
  parameterPath: string
): Element | null {
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
  events: Array<{ time: number; value: number; curveType?: string }>
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
  parameterPath: string
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