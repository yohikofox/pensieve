package expo.modules.litertlm

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.Message
import com.google.ai.edge.litertlm.Content

/**
 * ExpoLitertLmModule — Native LiteRT-LM inference for Expo (Android only)
 *
 * API mapping:
 *   Message.of(text: String) → user Message
 *   sendMessageAsync(Message) → Flow<Message>   (partial/delta tokens)
 *   Content.Text.text → extracted token text
 *   Conversation implements AutoCloseable (.use {} supported)
 */
class ExpoLitertLmModule : Module() {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
  private var engine: Engine? = null
  private var modelPath: String? = null

  override fun definition() = ModuleDefinition {
    Name("ExpoLitertLmModule")

    Events("onToken", "onGenerationComplete", "onGenerationError")

    /**
     * Load a LiteRT-LM model from the given path.
     * This is a long-running operation (~10s). Resolves when ready.
     */
    AsyncFunction("loadModel") { path: String, promise: Promise ->
      scope.launch {
        try {
          android.util.Log.d("ExpoLitertLm", "Loading model: $path")

          // Unload existing engine if any
          engine?.close()
          engine = null

          val config = EngineConfig(path)
          val newEngine = Engine(config)
          newEngine.initialize()

          engine = newEngine
          modelPath = path

          android.util.Log.d("ExpoLitertLm", "Model loaded successfully: $path")
          promise.resolve(null)
        } catch (e: Exception) {
          android.util.Log.e("ExpoLitertLm", "Failed to load model: ${e.message}")
          promise.reject("LOAD_ERROR", "Failed to load LiteRT-LM model: ${e.message}", e)
        }
      }
    }

    /**
     * Generate a response for the given prompt (blocking until complete).
     * Returns the full generated text.
     */
    AsyncFunction("generate") { prompt: String, promise: Promise ->
      scope.launch {
        val currentEngine = engine
        if (currentEngine == null) {
          promise.reject("NOT_LOADED", "No model loaded. Call loadModel() first.", null)
          return@launch
        }

        try {
          android.util.Log.d("ExpoLitertLm", "Generating response for prompt length: ${prompt.length}")
          val sb = StringBuilder()
          val userMessage = Message.of(prompt)

          currentEngine.createConversation().use { conversation ->
            conversation.sendMessageAsync(userMessage).collect { partialMessage ->
              val tokenText = partialMessage.contents
                .filterIsInstance<Content.Text>()
                .joinToString("") { it.text }
              sb.append(tokenText)
            }
          }

          val result = sb.toString()
          android.util.Log.d("ExpoLitertLm", "Generation complete. Output length: ${result.length}")
          promise.resolve(result)
        } catch (e: Exception) {
          android.util.Log.e("ExpoLitertLm", "Generation failed: ${e.message}")
          promise.reject("GENERATE_ERROR", "LiteRT-LM generation failed: ${e.message}", e)
        }
      }
    }

    /**
     * Generate a response with streaming.
     * Resolves immediately; tokens are emitted via 'onToken' events.
     * Signals completion via 'onGenerationComplete' or 'onGenerationError'.
     */
    AsyncFunction("generateStream") { requestId: String, prompt: String, promise: Promise ->
      val currentEngine = engine
      if (currentEngine == null) {
        promise.reject("NOT_LOADED", "No model loaded. Call loadModel() first.", null)
        return@AsyncFunction
      }

      // Resolve the promise immediately — streaming happens via events
      promise.resolve(null)

      scope.launch {
        try {
          android.util.Log.d("ExpoLitertLm", "Starting stream for requestId: $requestId")
          val sb = StringBuilder()
          val userMessage = Message.of(prompt)

          currentEngine.createConversation().use { conversation ->
            conversation.sendMessageAsync(userMessage).collect { partialMessage ->
              val tokenText = partialMessage.contents
                .filterIsInstance<Content.Text>()
                .joinToString("") { it.text }
              if (tokenText.isNotEmpty()) {
                sb.append(tokenText)
                sendEvent("onToken", mapOf(
                  "requestId" to requestId,
                  "token" to tokenText
                ))
              }
            }
          }

          val fullText = sb.toString()
          android.util.Log.d("ExpoLitertLm", "Stream complete for requestId: $requestId, chars: ${fullText.length}")
          sendEvent("onGenerationComplete", mapOf(
            "requestId" to requestId,
            "fullText" to fullText,
            "tokenCount" to fullText.length
          ))
        } catch (e: Exception) {
          android.util.Log.e("ExpoLitertLm", "Stream error for requestId: $requestId — ${e.message}")
          sendEvent("onGenerationError", mapOf(
            "requestId" to requestId,
            "error" to (e.message ?: "Unknown error")
          ))
        }
      }
    }

    /**
     * Unload the current model from memory
     */
    AsyncFunction("unloadModel") { promise: Promise ->
      scope.launch {
        try {
          engine?.close()
          engine = null
          modelPath = null
          android.util.Log.d("ExpoLitertLm", "Model unloaded")
          promise.resolve(null)
        } catch (e: Exception) {
          android.util.Log.e("ExpoLitertLm", "Unload error: ${e.message}")
          promise.reject("UNLOAD_ERROR", "Failed to unload model: ${e.message}", e)
        }
      }
    }

    /**
     * Check if a model is currently loaded (synchronous)
     */
    Function("isModelLoaded") {
      engine != null
    }

    OnDestroy {
      scope.cancel()
      engine?.close()
      engine = null
    }
  }
}
