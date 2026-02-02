import { requireNativeView } from 'expo';
import * as React from 'react';

import { ExpoWaveformExtractorViewProps } from './ExpoWaveformExtractor.types';

const NativeView: React.ComponentType<ExpoWaveformExtractorViewProps> =
  requireNativeView('ExpoWaveformExtractor');

export default function ExpoWaveformExtractorView(props: ExpoWaveformExtractorViewProps) {
  return <NativeView {...props} />;
}
