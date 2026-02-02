import * as React from 'react';

import { ExpoWaveformExtractorViewProps } from './ExpoWaveformExtractor.types';

export default function ExpoWaveformExtractorView(props: ExpoWaveformExtractorViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
