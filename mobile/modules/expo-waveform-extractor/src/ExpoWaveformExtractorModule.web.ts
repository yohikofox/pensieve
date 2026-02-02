import { registerWebModule, NativeModule } from 'expo';

import { ChangeEventPayload } from './ExpoWaveformExtractor.types';

type ExpoWaveformExtractorModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
}

class ExpoWaveformExtractorModule extends NativeModule<ExpoWaveformExtractorModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
};

export default registerWebModule(ExpoWaveformExtractorModule, 'ExpoWaveformExtractorModule');
