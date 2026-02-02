import ExpoModulesCore

public class ExpoWaveformExtractorModule: Module {
  private var extractors: [String: WaveformExtractor] = [:]

  public func definition() -> ModuleDefinition {
    Name("ExpoWaveformExtractorModule")

    Events("onCurrentExtractedWaveformData")

    AsyncFunction("extractWaveform") { (audioUri: String, samplesPerPixel: Int, playerKey: String, promise: Promise) in
      guard let url = URL(string: audioUri) else {
        promise.reject("INVALID_URI", "Invalid audio URI: \(audioUri)")
        return
      }

      // Convert file:// URI to path
      let fileURL: URL
      if url.scheme == "file" {
        fileURL = url
      } else {
        fileURL = URL(fileURLWithPath: audioUri)
      }

      do {
        let extractor = try WaveformExtractor(
          url: fileURL,
          module: self,
          playerKey: playerKey,
          resolve: promise.resolve,
          reject: promise.reject
        )

        self.extractors[playerKey] = extractor

        // Extract waveform asynchronously
        DispatchQueue.global(qos: .userInitiated).async {
          let data = extractor.extractWaveform(
            samplesPerPixel: samplesPerPixel,
            playerKey: playerKey
          )

          if let waveformData = data {
            // Get channel mean (mono or stereo averaged)
            let meanData = extractor.getChannelMean(data: waveformData)
            promise.resolve(meanData)
          } else {
            promise.reject("EXTRACTION_FAILED", "Failed to extract waveform data")
          }

          self.extractors.removeValue(forKey: playerKey)
        }
      } catch {
        promise.reject("INIT_ERROR", "Failed to initialize extractor: \(error.localizedDescription)")
      }
    }

    AsyncFunction("cancelExtraction") { (playerKey: String) in
      self.extractors[playerKey]?.cancel()
      self.extractors.removeValue(forKey: playerKey)
    }

    OnDestroy {
      self.extractors.values.forEach { $0.cancel() }
      self.extractors.removeAll()
    }
  }

  func sendEvent(name: String, body: Any?) {
    sendEvent(name, body)
  }
}
