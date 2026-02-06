/**
 * App Root Component
 *
 * Responsibility: Configure provider hierarchy ONLY.
 * All configuration happens in bootstrap() (index.ts)
 * All logic happens in MainApp.tsx
 */

import React from "react";
import { AppProviders } from "./src/providers/AppProviders";
import { MainApp } from "./src/components/MainApp";

export default function App() {
  return (
    <AppProviders>
      <MainApp />
    </AppProviders>
  );
}
