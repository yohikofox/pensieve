import Accelerate
import AVFoundation
import ExpoModulesCore

public typealias FloatChannelData = [[Float]]

public class WaveformExtractor {
  public private(set) var audioFile: AVAudioFile?
  private var resolve: @convention(block) (Any?) -> Void
  private var reject: @convention(block) (String, String, Error?) -> Void
  weak var module: ExpoWaveformExtractorModule?
  private var waveformData = Array<Float>()
  var progress: Float = 0.0
  var channelCount: Int = 1
  private var currentProgress: Float = 0.0
  private let playerKey: String

  private var _abortGetWaveformData: Bool = false

  public var abortGetWaveformData: Bool {
    get { _abortGetWaveformData }
    set { _abortGetWaveformData = newValue }
  }

  init(
    url: URL,
    module: ExpoWaveformExtractorModule,
    playerKey: String,
    resolve: @escaping @convention(block) (Any?) -> Void,
    reject: @escaping @convention(block) (String, String, Error?) -> Void
  ) throws {
    self.audioFile = try AVAudioFile(forReading: url)
    self.module = module
    self.playerKey = playerKey
    self.resolve = resolve
    self.reject = reject
  }

  deinit {
    audioFile = nil
  }

  public func extractWaveform(
    samplesPerPixel: Int?,
    offset: Int? = 0,
    length: UInt? = nil,
    playerKey: String
  ) -> FloatChannelData? {
    guard let audioFile = audioFile else { return nil }

    let samplesPerPixel = max(1, samplesPerPixel ?? 100)

    let currentFrame = audioFile.framePosition

    let totalFrameCount = AVAudioFrameCount(audioFile.length)
    var framesPerBuffer: AVAudioFrameCount = totalFrameCount / AVAudioFrameCount(samplesPerPixel)

    guard let rmsBuffer = AVAudioPCMBuffer(
      pcmFormat: audioFile.processingFormat,
      frameCapacity: AVAudioFrameCount(framesPerBuffer)
    ) else { return nil }

    channelCount = Int(audioFile.processingFormat.channelCount)
    var data = Array(repeating: [Float](repeating: 0, count: samplesPerPixel), count: channelCount)

    var start: Int
    if let offset = offset, offset >= 0 {
      start = offset
    } else {
      start = Int(currentFrame / Int64(framesPerBuffer))
      if let offset = offset, offset < 0 {
        start += offset
      }

      if start < 0 {
        start = 0
      }
    }

    var startFrame: AVAudioFramePosition = offset == nil ? currentFrame : Int64(start * Int(framesPerBuffer))

    var end = samplesPerPixel
    if let length = length {
      end = start + Int(length)
    }

    if end > samplesPerPixel {
      end = samplesPerPixel
    }

    if start > end {
      reject("INVALID_RANGE", "offset is larger than total length. Please select less number of samples", nil)
      return nil
    }

    for i in start..<end {
      if abortGetWaveformData {
        audioFile.framePosition = currentFrame
        abortGetWaveformData = false
        return nil
      }

      do {
        audioFile.framePosition = startFrame
        try audioFile.read(into: rmsBuffer, frameCount: framesPerBuffer)
      } catch {
        reject("READ_ERROR", "Couldn't read into buffer: \(error.localizedDescription)", error)
        return nil
      }

      guard let floatData = rmsBuffer.floatChannelData else { return nil }

      for channel in 0..<channelCount {
        var rms: Float = 0.0
        vDSP_rmsqv(floatData[channel], 1, &rms, vDSP_Length(rmsBuffer.frameLength))
        data[channel][i] = rms
      }

      currentProgress += 1
      progress = currentProgress / Float(samplesPerPixel)

      // Send progress event
      let meanData = getChannelMean(data: data)
      module?.sendEvent(
        name: "onCurrentExtractedWaveformData",
        body: [
          "waveformData": meanData,
          "progress": progress,
          "playerKey": playerKey
        ]
      )

      startFrame += AVAudioFramePosition(framesPerBuffer)

      if startFrame + AVAudioFramePosition(framesPerBuffer) > totalFrameCount {
        framesPerBuffer = totalFrameCount - AVAudioFrameCount(startFrame)
        if framesPerBuffer <= 0 { break }
      }
    }

    audioFile.framePosition = currentFrame

    return data
  }

  func getChannelMean(data: FloatChannelData) -> [Float] {
    waveformData.removeAll()

    if channelCount == 2 && !data[0].isEmpty && !data[1].isEmpty {
      for (ele1, ele2) in zip(data[0], data[1]) {
        waveformData.append((ele1 + ele2) / 2)
      }
    } else if !data[0].isEmpty {
      waveformData = data[0]
    } else if channelCount > 1 && !data[1].isEmpty {
      waveformData = data[1]
    } else {
      reject("NO_CHANNELS", "Cannot get waveform mean. All audio channels are null", nil)
    }

    return waveformData
  }

  public func cancel() {
    abortGetWaveformData = true
  }
}
