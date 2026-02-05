/**
 * TabBarIcon Component
 *
 * Reusable tab bar icon with consistent styling
 * Uses Feather icons for minimalist, symbolic design
 */

import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../design-system/tokens';

interface TabBarIconProps {
  name: keyof typeof Feather.glyphMap;
  focused: boolean;
  color: string;
  size: number;
  badge?: number;
}

export function TabBarIcon({ name, focused, color, size, badge }: TabBarIconProps) {
  return (
    <View className="items-center justify-center">
      <Feather
        name={name}
        size={focused ? size + 2 : size}
        color={color}
      />
      {badge !== undefined && badge > 0 && (
        <View className="absolute -top-1 -right-2 min-w-[16px] h-4 bg-error-500 rounded-full items-center justify-center px-1">
          <Text className="text-[10px] font-bold text-white">
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * Symbolic icon mapping for common navigation tabs
 *
 * Design principles:
 * - Use outline icons for inactive, they feel lighter
 * - Icons should represent the ACTION or CONTENT, not literal objects
 * - Prefer universal, recognizable symbols
 */
export const TabIcons = {
  // Navigation tabs - symbolic representations
  news: 'rss' as const,              // RSS feed = news/updates
  captures: 'inbox' as const,        // Inbox = collected items
  capture: 'plus-circle' as const,   // Plus circle = create/add action
  actions: 'check-square' as const,  // Check square = todos/tasks
  projects: 'folder' as const,       // Folder = organized collections
  settings: 'sliders' as const,      // Sliders = adjustments/preferences

  // Alternative semantic icons
  home: 'home' as const,
  search: 'search' as const,
  profile: 'user' as const,
  notifications: 'bell' as const,
  favorites: 'heart' as const,
  history: 'clock' as const,
  folder: 'folder' as const,
  archive: 'archive' as const,

  // Action icons
  add: 'plus' as const,
  edit: 'edit-2' as const,
  delete: 'trash-2' as const,
  share: 'share' as const,
  download: 'download' as const,
  upload: 'upload' as const,

  // Media/capture types
  microphone: 'mic' as const,
  camera: 'camera' as const,
  image: 'image' as const,
  video: 'video' as const,
  document: 'file-text' as const,
  link: 'link-2' as const,
  clipboard: 'clipboard' as const,

  // Status icons
  check: 'check' as const,
  error: 'alert-circle' as const,
  warning: 'alert-triangle' as const,
  info: 'info' as const,

  // Navigation
  back: 'arrow-left' as const,
  forward: 'arrow-right' as const,
  close: 'x' as const,
  menu: 'menu' as const,
  more: 'more-horizontal' as const,
};
