/**
 * Holds the active scan context for the Legal Metrology AI assistant.
 * Allows seamless conversation persistence when transitioning from ResultScreen
 * or opening the Assistant from bottom tabs.
 */

let activeScanContext: any = null;

export const setChatScanContext = (data: any) => {
  activeScanContext = data;
};

export const getChatScanContext = (): any => {
  return activeScanContext;
};

export const clearChatScanContext = () => {
  activeScanContext = null;
};
