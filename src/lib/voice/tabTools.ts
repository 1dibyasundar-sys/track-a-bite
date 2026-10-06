/**
 * Track-a-Bite — TAB Tool Execution & Action Handlers
 *
 * Defines controlled client-side actions TAB can invoke.
 * Never gives the AI unrestricted browser control.
 */

import { TABAction, TABActionType } from './types';

export interface TABToolDefinition {
  name: TABActionType;
  description: string;
  triggerPhrases: string[];
}

export const TAB_TOOLS: TABToolDefinition[] = [
  {
    name: 'OPEN_SCANNER',
    description: 'Open the main food and plate camera scanner',
    triggerPhrases: ['open scanner', 'start camera', 'scan food', 'take a picture of food'],
  },
  {
    name: 'OPEN_BARCODE_SCANNER',
    description: 'Open the barcode scanner for packaged foods',
    triggerPhrases: ['scan barcode', 'open barcode', 'scan package barcode'],
  },
  {
    name: 'OPEN_MEAL_SCANNER',
    description: 'Open the meal photo scanner',
    triggerPhrases: ['scan my plate', 'open meal camera', 'photo scanner'],
  },
  {
    name: 'SCAN_ANOTHER_PRODUCT',
    description: 'Reset current product and scan another item',
    triggerPhrases: ['scan another', 'scan another product', 'next product'],
  },
  {
    name: 'OPEN_HISTORY',
    description: 'Open the meal tracking history page',
    triggerPhrases: ['open history', 'show my meals', 'view history'],
  },
  {
    name: 'OPEN_PROFILE',
    description: 'Open user profile and nutrition goals',
    triggerPhrases: ['open profile', 'my profile', 'change my targets'],
  },
  {
    name: 'GET_NUTRITION_SUMMARY',
    description: 'Review nutrition summary and daily intake',
    triggerPhrases: ['show nutrition summary', 'how is my nutrition today', 'open dashboard'],
  },
  {
    name: 'START_REANALYSIS',
    description: 'Re-analyze meal or photo',
    triggerPhrases: ['re-analyze this', 'reanalyze meal', 'analyze again'],
  },
];

/**
 * Extracts action tags embedded in Gemini text output:
 * e.g. "I'll open the barcode scanner for you now! [ACTION:OPEN_BARCODE_SCANNER]"
 */
export function extractActionFromText(text: string): { cleanText: string; action?: TABAction } {
  const actionRegex = /\[ACTION:([A-Z_]+)(?::([^\]]+))?\]/i;
  const match = text.match(actionRegex);

  if (!match) {
    return { cleanText: text };
  }

  const rawActionType = match[1].toUpperCase() as TABActionType;
  const cleanText = text.replace(actionRegex, '').trim();

  const tool = TAB_TOOLS.find(t => t.name === rawActionType);
  if (!tool) {
    return { cleanText };
  }

  return {
    cleanText,
    action: {
      type: rawActionType,
      label: tool.description,
    },
  };
}
