/**
 * Design System - Icon Definitions
 *
 * Centralized icon mapping using Feather Icons
 * https://feathericons.com/
 *
 * Design Principles:
 * 1. SYMBOLIC over literal - represent concepts, not objects
 * 2. MINIMALIST - simple line icons, consistent stroke weight
 * 3. UNIVERSAL - recognizable across cultures
 * 4. CONSISTENT - same icon = same meaning throughout app
 */

import { Feather } from '@expo/vector-icons';

export type IconName = keyof typeof Feather.glyphMap;

/**
 * Navigation icons
 */
export const NavigationIcons = {
  back: 'chevron-left' as IconName,
  forward: 'chevron-right' as IconName,
  up: 'chevron-up' as IconName,
  down: 'chevron-down' as IconName,
  close: 'x' as IconName,
  menu: 'menu' as IconName,
  more: 'more-horizontal' as IconName,
  moreVertical: 'more-vertical' as IconName,
} as const;

/**
 * Tab bar icons - symbolic representations
 */
export const TabBarIcons = {
  home: 'home' as IconName,
  captures: 'inbox' as IconName,        // Collected items
  capture: 'plus-circle' as IconName,   // Create action
  settings: 'sliders' as IconName,      // Adjustments
  profile: 'user' as IconName,
  search: 'search' as IconName,
} as const;

/**
 * Action icons - user interactions
 */
export const ActionIcons = {
  add: 'plus' as IconName,
  remove: 'minus' as IconName,
  edit: 'edit-2' as IconName,
  delete: 'trash-2' as IconName,
  save: 'check' as IconName,
  cancel: 'x' as IconName,
  share: 'share' as IconName,
  copy: 'copy' as IconName,
  download: 'download' as IconName,
  upload: 'upload' as IconName,
  refresh: 'refresh-cw' as IconName,
  filter: 'filter' as IconName,
  sort: 'bar-chart-2' as IconName,
  expand: 'maximize-2' as IconName,
  collapse: 'minimize-2' as IconName,
} as const;

/**
 * Capture type icons - media/content types
 */
export const CaptureIcons = {
  voice: 'mic' as IconName,             // Audio recording
  text: 'type' as IconName,             // Text input
  photo: 'aperture' as IconName,        // Photography
  video: 'film' as IconName,            // Video capture
  url: 'globe' as IconName,             // Web content
  document: 'file' as IconName,         // File/document
  clipboard: 'copy' as IconName,        // Paste content
} as const;

/**
 * Status icons - state indicators
 */
export const StatusIcons = {
  success: 'check-circle' as IconName,
  error: 'alert-circle' as IconName,
  warning: 'alert-triangle' as IconName,
  info: 'info' as IconName,
  pending: 'clock' as IconName,
  processing: 'loader' as IconName,
  offline: 'wifi-off' as IconName,
  online: 'wifi' as IconName,
} as const;

/**
 * Media control icons
 */
export const MediaIcons = {
  play: 'play' as IconName,
  pause: 'pause' as IconName,
  stop: 'square' as IconName,
  record: 'circle' as IconName,
  skipForward: 'skip-forward' as IconName,
  skipBack: 'skip-back' as IconName,
  volume: 'volume-2' as IconName,
  volumeMute: 'volume-x' as IconName,
} as const;

/**
 * Settings/preference icons
 */
export const SettingsIcons = {
  settings: 'settings' as IconName,
  sliders: 'sliders' as IconName,
  toggle: 'toggle-left' as IconName,
  toggleOn: 'toggle-right' as IconName,
  lock: 'lock' as IconName,
  unlock: 'unlock' as IconName,
  eye: 'eye' as IconName,
  eyeOff: 'eye-off' as IconName,
  bell: 'bell' as IconName,
  bellOff: 'bell-off' as IconName,
} as const;

/**
 * Communication icons
 */
export const CommunicationIcons = {
  mail: 'mail' as IconName,
  message: 'message-circle' as IconName,
  send: 'send' as IconName,
  phone: 'phone' as IconName,
  calendar: 'calendar' as IconName,
} as const;

/**
 * UI element icons
 */
export const UIIcons = {
  search: 'search' as IconName,
  star: 'star' as IconName,
  heart: 'heart' as IconName,
  bookmark: 'bookmark' as IconName,
  tag: 'tag' as IconName,
  link: 'link-2' as IconName,
  externalLink: 'external-link' as IconName,
  help: 'help-circle' as IconName,
} as const;

/**
 * All icons combined for easy access
 */
export const Icons = {
  ...NavigationIcons,
  ...TabBarIcons,
  ...ActionIcons,
  ...CaptureIcons,
  ...StatusIcons,
  ...MediaIcons,
  ...SettingsIcons,
  ...CommunicationIcons,
  ...UIIcons,
} as const;

/**
 * Default icon sizes (in pixels)
 */
export const IconSizes = {
  xs: 14,
  sm: 18,
  md: 22,
  lg: 28,
  xl: 36,
  xxl: 48,
} as const;

export type IconSize = keyof typeof IconSizes;
