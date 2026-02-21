/**
 * Tab Screens Registry
 *
 * Centralized configuration for all tab navigation screens.
 * Each screen owns its icon, labels, and navigation options.
 *
 * Benefits:
 * - Colocation: Screen metadata lives with screen exports
 * - Scalability: Add/remove screens by modifying this registry
 * - Type-safety: TypeScript ensures all configs are valid
 * - DRY: No repetitive tab rendering code in MainNavigator
 */

import { ComponentType } from "react";
import { BottomTabNavigationOptions } from "@react-navigation/bottom-tabs";
import { type LayoutConfig, type TabScreenName } from "./registry-layout";
export type { LayoutConfig, TabScreenName } from "./registry-layout";
import { NewsScreen } from "./news/NewsScreen";
import { CapturesStackNavigator } from "../navigation/CapturesStackNavigator";
import { CaptureScreen } from "./capture/CaptureScreen";
import { ActionsScreen } from "./actions/ActionsScreen";
import { ProjectsScreen } from "./projects/ProjectsScreen";
import { SettingsStackNavigator } from "../navigation/SettingsStackNavigator";
import { TabIcons } from "../navigation/components";

/**
 * Tab Screen Configuration Interface
 */
export interface TabScreenConfig {
  /** Screen component to render */
  component: ComponentType<any>;

  /** Icon name - Feather icon name (e.g., 'rss', 'inbox') */
  icon: (typeof TabIcons)[keyof typeof TabIcons];

  /** Badge count (optional, for dynamic badges like Actions) */
  badge?: number;

  /** Additional navigation options */
  options?: Partial<BottomTabNavigationOptions>;

  /** Layout configuration for StandardLayout wrapper */
  layout?: LayoutConfig;

  /** i18n translation keys */
  i18n: {
    /** Header title (optional if headerShown: false) */
    title?: string;
    /** Tab bar label */
    tabLabel: string;
    /** Accessibility label for VoiceOver/TalkBack */
    accessibilityLabel: string;
    /** Accessibility label with count (optional, for badges) */
    accessibilityLabelWithCount?: string;
  };
}

/**
 * Tab Screens Registry
 *
 * Order matters - screens are rendered in this order
 */
export const tabScreens = {
  News: {
    component: NewsScreen,
    icon: "rss",
    layout: {
      // Header is shown by tab navigator, no need for SafeAreaView
      useSafeArea: false,
    },
    i18n: {
      title: "navigation.headers.news",
      tabLabel: "navigation.tabs.news",
      accessibilityLabel: "navigation.accessibility.news.label",
    },
  },

  Captures: {
    component: CapturesStackNavigator,
    icon: "inbox",
    options: {
      headerShown: true, // Stack navigator handles its own headers
    },
    layout: {
      useSafeArea: false,
    },
    i18n: {
      tabLabel: "navigation.tabs.captures",
      accessibilityLabel: "navigation.accessibility.captures.label",
    },
  },

  Capture: {
    component: CaptureScreen,
    icon: "plus-circle",
    layout: {
      // Header is shown by tab navigator, no need for SafeAreaView
      useSafeArea: false,
    },
    i18n: {
      title: "navigation.headers.capture",
      tabLabel: "navigation.tabs.capture",
      accessibilityLabel: "navigation.accessibility.capture.label",
    },
  },

  Actions: {
    component: ActionsScreen,
    icon: "check-square",
    layout: {
      // Header is shown by tab navigator, no need for SafeAreaView
      useSafeArea: false,
    },
    // Badge is set dynamically in MainNavigator via useActiveTodoCount hook
    i18n: {
      title: "navigation.headers.actions",
      tabLabel: "navigation.tabs.actions",
      accessibilityLabel: "navigation.accessibility.actions.label",
      accessibilityLabelWithCount:
        "navigation.accessibility.actions.labelWithCount",
    },
  },

  Projects: {
    component: ProjectsScreen,
    icon: "folder",
    layout: {
      // Header is shown by tab navigator, no need for SafeAreaView
      useSafeArea: false,
    },
    i18n: {
      title: "navigation.headers.projects",
      tabLabel: "navigation.tabs.projects",
      accessibilityLabel: "navigation.accessibility.projects.label",
    },
  },

  Settings: {
    component: SettingsStackNavigator,
    icon: "sliders",
    options: {
      headerShown: true, // Show Tab Navigator header for root screen
    },
    layout: {
      useSafeArea: false,
    },
    i18n: {
      title: "navigation.headers.settings",
      tabLabel: "navigation.tabs.settings",
      accessibilityLabel: "navigation.accessibility.settings.label",
    },
  },
} as const;

