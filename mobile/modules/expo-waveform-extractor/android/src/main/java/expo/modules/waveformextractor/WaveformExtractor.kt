package expo.modules.waveformextractor

import android.media.AudioFormat
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import android.os.Build
import java.nio.ByteBuffer
import kotlin.math.pow
import kotlin.math.sqrt
import java.io.File

class WaveformExtractor(
    private val path: String,
    private val expectedPoints: Int,
    private val key: String,
    private val extractorCallBack: ExtractorCallBack,
) {
    private var decoder: MediaCodec? = null
    private var extractor: MediaExtractor? = null
    private var duration = 0L
    private var progress = 0F
    private var currentProgress = 0F

    @Volatile
    private var inProgress = false
    private var inputEof = false
    private var sampleRate = 0
    private var channels = 1
    private var pcmEncodingBit = 16
    private var totalSamples = 0L
    private var perSamplePoints = 0L

    var sampleData: MutableList<Float> = mutableListOf()
    private var sampleCount = 0L
    private var sampleSum = 0.0

    private fun getFormat(path: String): MediaFormat? {
        val mediaExtractor = MediaExtractor()
        this.extractor = mediaExtractor

        // Handle file:// URIs
        val filePath = if (path.startsWith("file://")) {
            path.substring(7)
        } else {
            path
        }

        mediaExtractor.setDataSource(filePath)
        val trackCount = mediaExtractor.trackCount
        repeat(trackCount) {
            val format = mediaExtractor.getTrackFormat(it)
            val mime = format.getString(MediaFormat.KEY_MIME) ?: ""
            if (mime.contains("audio")) {
                duration = format.getLong(MediaFormat.KEY_DURATION) / 1000000
                mediaExtractor.selectTrack(it)
                return format
            }
        }
        return null
    }

    fun startDecode() {
        try {
            val filePath = if (path.startsWith("file://")) {
                path.substring(7)
            } else {
                path
            }

            if (!File(filePath).exists()) {
                extractorCallBack.onReject("File Error", "File does not exist at the given path: $filePath")
                return
            }

            val format = getFormat(path) ?: error("No audio format found")
            val mime = format.getString(MediaFormat.KEY_MIME) ?: error("No MIME type found")
            decoder = MediaCodec.createDecoderByType(mime).also {
                it.configure(format, null, null, 0)
                it.setCallback(object : MediaCodec.Callback() {
                    override fun onInputBufferAvailable(codec: MediaCodec, index: Int) {
                        if (inputEof || !inProgress) return
                        val extractor = extractor ?: return
                        codec.getInputBuffer(index)?.let { buf ->
                            val size = extractor.readSampleData(buf, 0)
                            if (size > 0) {
                                codec.queueInputBuffer(index, 0, size, extractor.sampleTime, 0)
                                extractor.advance()
                            } else {
                                codec.queueInputBuffer(
                                    index,
                                    0,
                                    0,
                                    0,
                                    MediaCodec.BUFFER_FLAG_END_OF_STREAM
                                )
                                inputEof = true
                            }
                        }
                    }

                    override fun onOutputFormatChanged(codec: MediaCodec, format: MediaFormat) {
                        if (!inProgress) return
                        sampleRate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
                        channels = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
                        pcmEncodingBit = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                            if (format.containsKey(MediaFormat.KEY_PCM_ENCODING)) {
                                when (format.getInteger(MediaFormat.KEY_PCM_ENCODING)) {
                                    AudioFormat.ENCODING_PCM_16BIT -> 16
                                    AudioFormat.ENCODING_PCM_8BIT -> 8
                                    AudioFormat.ENCODING_PCM_FLOAT -> 32
                                    else -> 16
                                }
                            } else {
                                16
                            }
                        } else {
                            16
                        }
                        totalSamples = sampleRate.toLong() * duration
                        perSamplePoints = (totalSamples / expectedPoints)
                    }

                    override fun onError(codec: MediaCodec, e: MediaCodec.CodecException) {
                        extractorCallBack.onReject(
                            "MediaCodec Error: ${e.message}",
                            "An error is thrown while decoding the audio file"
                        )
                    }

                    override fun onOutputBufferAvailable(
                        codec: MediaCodec,
                        index: Int,
                        info: MediaCodec.BufferInfo
                    ) {
                        android.util.Log.d("WaveformExtractor", "🔄 onOutputBufferAvailable: size=${info.size}, flags=${info.flags}, isEof=${info.isEof()}")

                        if (inProgress && info.size > 0) {
                            codec.getOutputBuffer(index)?.let { buf ->
                                val size = info.size
                                buf.position(info.offset)
                                when (pcmEncodingBit) {
                                    8 -> handle8bit(size, buf)
                                    16 -> handle16bit(size, buf)
                                    32 -> handle32bit(size, buf)
                                }
                                if (inProgress) codec.releaseOutputBuffer(index, false)
                            }
                        }

                        if (info.isEof()) {
                            android.util.Log.d("WaveformExtractor", "🏁 EOF detected! Completing extraction with ${sampleData.size} samples")
                            stop()
                            val tempArrayForCommunication: MutableList<MutableList<Float>> = mutableListOf()
                            tempArrayForCommunication.add(sampleData)
                            extractorCallBack.onResolve(tempArrayForCommunication)
                        }
                    }
                })
                inProgress = true
                it.start()
            }

        } catch (e: Exception) {
            stop()
            extractorCallBack.onReject(
                e.message, "An error is thrown before decoding the audio file"
            )
        }
    }

    private fun rms(value: Float): Boolean {
        try {
            if (sampleCount == perSamplePoints) {
                currentProgress++
                progress = (currentProgress / expectedPoints)

                val rms = sqrt(sampleSum / perSamplePoints)
                sampleData.add(rms.toFloat())
                extractorCallBack.onProgress(progress)
                sampleCount = 0
                sampleSum = 0.0

                // TODO: Send progress events (requires eventEmitter setup)
                // context.eventEmitter?.emit("onCurrentExtractedWaveformData", ...)

                // Let MediaCodec finish naturally and signal EOF instead of stopping early
                // The onOutputBufferAvailable callback will call onResolve when info.isEof()
            }
        } catch (e: Exception) {
            stop()
            extractorCallBack.onReject("RMS ERROR", e.message)
            return true
        }
        sampleCount++
        sampleSum += value.toDouble().pow(2.0)
        return false
    }

    private fun handle8bit(size: Int, buf: ByteBuffer) {
        run blockRepeat@{
            repeat(size / if (channels == 2) 2 else 1) {
                val result = buf.get().toInt() / 128f
                if (channels == 2) {
                    buf.get()
                }
                if (rms(result)) return@blockRepeat
            }
        }
    }

    private fun handle16bit(size: Int, buf: ByteBuffer) {
        run blockRepeat@{
            repeat(size / if (channels == 2) 4 else 2) {
                val first = buf.get().toInt()
                val second = buf.get().toInt() shl 8
                val value = (first or second) / 32767f
                if (channels == 2) {
                    buf.get()
                    buf.get()
                }
                if (rms(value)) return@blockRepeat
            }
        }
    }

    private fun handle32bit(size: Int, buf: ByteBuffer) {
        run blockRepeat@{
            repeat(size / if (channels == 2) 8 else 4) {
                val first = buf.get().toLong()
                val second = buf.get().toLong() shl 8
                val third = buf.get().toLong() shl 16
                val forth = buf.get().toLong() shl 24
                val value = (first or second or third or forth) / 2147483648f
                if (channels == 2) {
                    buf.get()
                    buf.get()
                    buf.get()
                    buf.get()
                }
                if (rms(value)) return@blockRepeat
            }
        }
    }

    fun forceStop() {
        stop()
        extractorCallBack.onForceStop()
    }

    private fun stop() {
        if (!inProgress) return
        inProgress = false
        decoder?.stop()
        decoder?.release()
        extractor?.release()
    }
}

fun MediaCodec.BufferInfo.isEof() = flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0

interface ExtractorCallBack {
    fun onProgress(value: Float)
    fun onReject(error: String?, message: String?)
    fun onResolve(value: MutableList<MutableList<Float>>)
    fun onForceStop()
}
