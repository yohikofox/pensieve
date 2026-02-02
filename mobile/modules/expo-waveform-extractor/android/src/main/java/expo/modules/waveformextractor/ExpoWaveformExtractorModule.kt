package expo.modules.waveformextractor

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise

class ExpoWaveformExtractorModule : Module() {
  private val extractors = mutableMapOf<String, WaveformExtractor>()

  override fun definition() = ModuleDefinition {
    Name("ExpoWaveformExtractorModule")

    Events("onCurrentExtractedWaveformData")

    AsyncFunction("extractWaveform") { audioUri: String, samplesPerPixel: Int, playerKey: String, promise: Promise ->
      try {
        android.util.Log.d("WaveformExtractor", "🎵 Starting extraction: $audioUri, samples: $samplesPerPixel")

        val extractor = WaveformExtractor(
          path = audioUri,
          expectedPoints = samplesPerPixel,
          key = playerKey,
          extractorCallBack = object : ExtractorCallBack {
            override fun onProgress(value: Float) {
              android.util.Log.d("WaveformExtractor", "📊 Progress: ${(value * 100).toInt()}%")
            }

            override fun onReject(error: String?, message: String?) {
              android.util.Log.e("WaveformExtractor", "❌ Error: $error - $message")
              promise.reject("EXTRACTION_ERROR", "$error: $message", null)
              extractors.remove(playerKey)
            }

            override fun onResolve(value: MutableList<MutableList<Float>>) {
              android.util.Log.d("WaveformExtractor", "✅ Extraction complete! Samples: ${if (value.isNotEmpty()) value[0].size else 0}")
              val result = if (value.isNotEmpty()) value[0] else emptyList<Float>()
              promise.resolve(result)
              extractors.remove(playerKey)
            }

            override fun onForceStop() {
              android.util.Log.d("WaveformExtractor", "⏹️ Extraction stopped")
              extractors.remove(playerKey)
            }
          }
        )

        extractors[playerKey] = extractor
        extractor.startDecode()
        android.util.Log.d("WaveformExtractor", "🚀 Decoder started")
      } catch (e: Exception) {
        android.util.Log.e("WaveformExtractor", "💥 Init error: ${e.message}")
        promise.reject("INIT_ERROR", "Failed to initialize extractor: ${e.message}", e)
      }
    }

    AsyncFunction("cancelExtraction") { playerKey: String ->
      extractors[playerKey]?.forceStop()
      extractors.remove(playerKey)
    }

    OnDestroy {
      extractors.values.forEach { it.forceStop() }
      extractors.clear()
    }
  }
}
