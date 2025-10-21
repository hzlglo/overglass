/**
 * Utility functions for working with XML DOM elements
 * These helpers provide safer, more predictable navigation through XML structures
 * compared to querySelector which can return unexpected descendants
 */

/**
 * Get direct child element by tag name (not descendants)
 */
export function getDirectChild(parent: Element, tagName: string): Element | null {
  for (let i = 0; i < parent.children.length; i++) {
    if (parent.children[i].tagName === tagName) {
      return parent.children[i];
    }
  }
  return null;
}

/**
 * Get all direct children with a specific tag name
 */
export function getDirectChildren(parent: Element, tagName: string): Element[] {
  const results: Element[] = [];
  for (let i = 0; i < parent.children.length; i++) {
    if (parent.children[i].tagName === tagName) {
      results.push(parent.children[i]);
    }
  }
  return results;
}

/**
 * Navigate through a path of direct children
 * Example: getViaPath(element, ['PluginDesc', 'Vst3PluginInfo', 'Name'])
 */
export function getViaPath(parent: Element, path: string[]): Element | null {
  let current: Element | null = parent;
  for (const tagName of path) {
    if (!current) return null;
    current = getDirectChild(current, tagName);
  }
  return current;
}
