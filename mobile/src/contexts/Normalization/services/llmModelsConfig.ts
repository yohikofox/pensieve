/**
 * LLM Models Configuration
 *
 * Centralized configuration for all supported LLM models
 *
 * Model categories:
 * - GENERAL MODELS: Compatible with all devices (Qwen, SmolLM, Phi)
 * - GOOGLE PIXEL OPTIMIZED: Gemma models for Tensor TPU
 * - APPLE OPTIMIZED: Llama models for Neural Engine
 * - MEDIAPIPE MODELS: GPU-accelerated models (requires HF auth)
 *
 * All URLs point to publicly accessible models unless marked as requiresAuth
 */

export type LLMModelId =
  | "qwen2.5-0.5b"
  | "qwen2.5-1.5b"
  | "qwen2.5-3b"
  | "qwen2.5-7b"
  | "qwen3-8b"
  | "qwen2.5-vl-7b"
  | "gemma3-1b"
  | "gemma3-1b-q4"
  | "gemma3-1b-q3"
  | "gemma3-1b-q2"
  | "llama3.1-8b"
  | "llama3.2-1b"
  | "llama3.2-3b"
  | "phi3-mini"
  | "gemma3-1b-mediapipe"
  | "gemma3n-2b";

export type PromptTemplate = "chatml" | "gemma" | "phi" | "llama";

/** Device compatibility for model recommendations */
export type DeviceCompatibility = "all" | "google" | "apple";

export type LLMBackendType = "llamarn" | "mediapipe";

/** Model categories for better navigation */
export type LLMModelCategory = "qwen" | "llama" | "gemma" | "other";

export interface LLMModelConfig {
  id: LLMModelId;
  name: string;
  filename: string;
  downloadUrl: string;
  expectedSize: number; // bytes
  backend: LLMBackendType;
  description: string;
  /** Category for grouping models in UI */
  category: LLMModelCategory;
  recommended?: boolean;
  /** Chat template format for the model */
  promptTemplate: PromptTemplate;
  /** Device compatibility - which devices can run this model */
  deviceCompatibility: DeviceCompatibility;
  /** Optional optimization indicator - shown only if current device matches */
  optimizedFor?: "apple" | "google";
  /** Whether this model requires HuggingFace authentication (gated model) */
  requiresAuth?: boolean;
  /** Languages this model is optimized for */
  languages?: string[];
  /** Specialized tasks this model excels at */
  specializations?: string[];
  /** Key strengths of this model */
  strengths?: string[];
  /** Known limitations or weaknesses */
  weaknesses?: string[];
}

/**
 * Model configurations
 *
 * Note: All URLs point to publicly accessible models (no authentication required)
 * Using community quantizations from bartowski and official public releases
 *
 * MediaPipe models use expo-llm-mediapipe (SDK 0.10.22) with GPU acceleration.
 */
export const MODEL_CONFIGS: Record<LLMModelId, LLMModelConfig> = {
  // ==========================================
  // QWEN (Alibaba) - Modèles généralistes performants
  // ==========================================
  "qwen2.5-0.5b": {
    id: "qwen2.5-0.5b",
    name: "Qwen 2.5 0.5B",
    filename: "qwen2.5-0.5b-instruct-q4_k_m.gguf",
    // Official Qwen GGUF - public, no auth required
    downloadUrl:
      "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf",
    expectedSize: 400 * 1024 * 1024, // ~400MB
    backend: "llamarn",
    description: "Modèle léger et rapide, idéal pour les corrections basiques",
    category: "qwen",
    recommended: true,
    promptTemplate: "chatml",
    deviceCompatibility: "all",
    languages: ["Français", "Anglais", "Chinois", "Multilingue (29 langues)"],
    specializations: ["Correction grammaticale", "Résumé simple", "Reformulation"],
    strengths: ["Très rapide", "Faible consommation mémoire", "Bon sur mobile"],
    weaknesses: ["Limité sur tâches complexes", "Raisonnement moins profond"],
  },
  "qwen2.5-1.5b": {
    id: "qwen2.5-1.5b",
    name: "Qwen 2.5 1.5B",
    filename: "qwen2.5-1.5b-instruct-q4_k_m.gguf",
    // Official Qwen GGUF - public, no auth required
    downloadUrl:
      "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf",
    expectedSize: 1100 * 1024 * 1024, // ~1.1GB
    backend: "llamarn",
    description: "Meilleure qualité pour l'analyse et les résumés",
    category: "qwen",
    promptTemplate: "chatml",
    deviceCompatibility: "all",
    languages: ["Français", "Anglais", "Chinois", "Multilingue (29 langues)"],
    specializations: ["Résumé", "Analyse de texte", "Génération structurée"],
    strengths: ["Bon équilibre vitesse/qualité", "Excellent multilingue", "Raisonnement cohérent"],
    weaknesses: ["Moins créatif que modèles plus grands", "Limité sur code complexe"],
  },
  "qwen2.5-3b": {
    id: "qwen2.5-3b",
    name: "Qwen 2.5 3B",
    filename: "qwen2.5-3b-instruct-q4_k_m.gguf",
    // Official Qwen GGUF - public, no auth required
    downloadUrl:
      "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf",
    expectedSize: 2000 * 1024 * 1024, // ~2GB
    backend: "llamarn",
    description: "Modèle plus puissant pour des tâches complexes",
    category: "qwen",
    promptTemplate: "chatml",
    deviceCompatibility: "all",
    languages: ["Français", "Anglais", "Chinois", "Espagnol", "Allemand", "29 langues"],
    specializations: ["Analyse approfondie", "Génération de code", "Raisonnement logique"],
    strengths: ["Excellent rapport qualité/taille", "Très bon en code", "Raisonnement complexe"],
    weaknesses: ["Consommation mémoire moyenne", "Peut être lent sur petits devices"],
  },
  "qwen2.5-7b": {
    id: "qwen2.5-7b",
    name: "Qwen 2.5 7B",
    filename: "qwen2.5-7b-instruct-q4_k_m.gguf",
    // Official Qwen GGUF - public, no auth required
    downloadUrl:
      "https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q4_k_m.gguf",
    expectedSize: 4700 * 1024 * 1024, // ~4.7GB
    backend: "llamarn",
    description: "Modèle le plus puissant, nécessite beaucoup d'espace",
    category: "qwen",
    promptTemplate: "chatml",
    deviceCompatibility: "all",
    languages: ["Français", "Anglais", "Chinois", "Multilingue expert (29 langues)"],
    specializations: ["Programmation avancée", "Analyse complexe", "Créativité", "Mathématiques"],
    strengths: ["Qualité proche des grands modèles", "Excellent en code", "Multimodal possible"],
    weaknesses: ["Très lourd (4.7GB)", "Lent sur appareils moyens", "Forte consommation batterie"],
  },
  "qwen3-8b": {
    id: "qwen3-8b",
    name: "Qwen3 8B",
    filename: "qwen3-8b-instruct-q4_k_m.gguf",
    // Qwen3 from bartowski - public, no auth required
    downloadUrl:
      "https://huggingface.co/bartowski/Qwen3-8B-Instruct-GGUF/resolve/main/Qwen3-8B-Instruct-Q4_K_M.gguf",
    expectedSize: 5200 * 1024 * 1024, // ~5.2GB
    backend: "llamarn",
    description: "Bon équilibre puissance/vitesse (dernière génération Qwen)",
    category: "qwen",
    promptTemplate: "chatml",
    deviceCompatibility: "all",
    languages: ["Français", "Anglais", "Chinois", "Multilingue avancé (29+ langues)"],
    specializations: ["Tâches longues", "Raisonnement multi-étapes", "Code production", "Analyse fine"],
    strengths: ["Dernière génération", "Meilleure cohérence", "Excellent follow-up", "Instructions complexes"],
    weaknesses: ["Très lourd (5.2GB)", "Nécessite device puissant", "Consommation élevée"],
  },
  "qwen2.5-vl-7b": {
    id: "qwen2.5-vl-7b",
    name: "Qwen2.5-VL 7B",
    filename: "qwen2.5-vl-7b-instruct-q4_k_m.gguf",
    // Qwen2.5-VL from bartowski - public, no auth required
    downloadUrl:
      "https://huggingface.co/bartowski/Qwen2.5-VL-7B-Instruct-GGUF/resolve/main/Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf",
    expectedSize: 4600 * 1024 * 1024, // ~4.6GB
    backend: "llamarn",
    description: "Modèle multimodal avec vision (images + texte)",
    category: "qwen",
    promptTemplate: "chatml",
    deviceCompatibility: "all",
    languages: ["Français", "Anglais", "Chinois", "Multilingue (29 langues)"],
    specializations: ["Vision par ordinateur", "Description d'images", "OCR", "Analyse visuelle"],
    strengths: ["Multimodal texte+image", "OCR excellent", "Compréhension visuelle", "Versatile"],
    weaknesses: ["Très lourd", "Vision limitée par rapport aux spécialisés", "Consommation élevée"],
  },

  // ==========================================
  // AUTRES - Modèles variés
  // ==========================================
  "gemma3-1b": {
    id: "gemma3-1b",
    name: "SmolLM2 1.7B",
    filename: "smollm2-1.7b-instruct-q4_k_m.gguf",
    // SmolLM2 from HuggingFace - public, good quality, no auth required
    downloadUrl:
      "https://huggingface.co/bartowski/SmolLM2-1.7B-Instruct-GGUF/resolve/main/SmolLM2-1.7B-Instruct-Q4_K_M.gguf",
    expectedSize: 1000 * 1024 * 1024, // ~1GB
    backend: "llamarn",
    description: "Bon équilibre qualité/performance (HuggingFace)",
    category: "other",
    promptTemplate: "chatml",
    deviceCompatibility: "all",
    languages: ["Anglais", "Français", "Espagnol", "Allemand"],
    specializations: ["Écriture", "Résumé", "Traduction", "Questions-réponses"],
    strengths: ["Compact et rapide", "Open-source HuggingFace", "Bon multilingue", "Léger en RAM"],
    weaknesses: ["Moins bon que Qwen sur tâches complexes", "Limité sur code avancé"],
  },
  "phi3-mini": {
    id: "phi3-mini",
    name: "Phi-3.5 Mini",
    filename: "phi-3.5-mini-instruct-q4_k_m.gguf",
    // Phi-3.5 from bartowski - public, no auth required
    downloadUrl:
      "https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF/resolve/main/Phi-3.5-mini-instruct-Q4_K_M.gguf",
    expectedSize: 2300 * 1024 * 1024, // ~2.3GB
    backend: "llamarn",
    description: "Raisonnement robuste multilingue (Microsoft)",
    category: "other",
    promptTemplate: "phi",
    deviceCompatibility: "all",
    languages: ["Anglais", "Français", "Espagnol", "Allemand", "Italien", "Portugais"],
    specializations: ["Raisonnement logique", "Mathématiques", "Code Python", "Analyse structurée"],
    strengths: ["Excellent raisonnement", "Bon en maths", "Qualité Microsoft", "Multilingue robuste"],
    weaknesses: ["Moins créatif", "Taille moyenne (2.3GB)", "Parfois verbeux"],
  },

  // ==========================================
  // GEMMA (Google) - Optimisés pour Google Pixel
  // ==========================================
  "gemma3-1b-q4": {
    id: "gemma3-1b-q4",
    name: "Gemma 3 1B (Q4)",
    filename: "gemma-3-1b-it-Q4_K_M.gguf",
    // Gemma 3 1B Q4 from unsloth - public, no auth required
    downloadUrl:
      "https://huggingface.co/unsloth/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q4_K_M.gguf",
    expectedSize: 766 * 1024 * 1024, // ~766MB
    backend: "llamarn",
    description: "Gemma 3 1B - Optimisé Google Pixel",
    category: "gemma",
    promptTemplate: "gemma",
    deviceCompatibility: "google",
    optimizedFor: "google",
    recommended: true,
    languages: ["Anglais", "Français", "Espagnol", "Allemand", "Italien"],
    specializations: ["Résumé", "Instructions", "Chat conversationnel", "Q&A"],
    strengths: ["Optimisé Tensor G3/G4", "Rapide sur Pixel", "Compact", "Bon équilibre"],
    weaknesses: ["Pixel uniquement", "Moins multilingue que Qwen", "Limité sur code"],
  },
  "gemma3-1b-q3": {
    id: "gemma3-1b-q3",
    name: "Gemma 3 1B (Q3)",
    filename: "gemma-3-1b-it-Q3_K_M.gguf",
    // Gemma 3 1B Q3 from unsloth - public, no auth required
    downloadUrl:
      "https://huggingface.co/unsloth/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q3_K_M.gguf",
    expectedSize: 600 * 1024 * 1024, // ~600MB
    backend: "llamarn",
    description: "Gemma 3 1B léger - Optimisé Google Pixel",
    category: "gemma",
    promptTemplate: "gemma",
    deviceCompatibility: "google",
    optimizedFor: "google",
    languages: ["Anglais", "Français", "Espagnol", "Allemand"],
    specializations: ["Tâches rapides", "Résumé court", "Reformulation"],
    strengths: ["Très léger (600MB)", "Ultra-rapide sur Pixel", "Faible batterie"],
    weaknesses: ["Qualité réduite vs Q4", "Moins précis", "Limité multilingue"],
  },
  "gemma3-1b-q2": {
    id: "gemma3-1b-q2",
    name: "Gemma 3 1B (Q2)",
    filename: "gemma-3-1b-it-Q2_K.gguf",
    // Gemma 3 1B Q2 from unsloth - public, no auth required
    downloadUrl:
      "https://huggingface.co/unsloth/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q2_K.gguf",
    expectedSize: 450 * 1024 * 1024, // ~450MB
    backend: "llamarn",
    description: "Gemma 3 1B ultra-léger - Optimisé Google Pixel",
    category: "gemma",
    promptTemplate: "gemma",
    deviceCompatibility: "google",
    optimizedFor: "google",
    languages: ["Anglais", "Français (basique)", "Espagnol (basique)"],
    specializations: ["Tâches simples", "Correction orthographe", "Chat basique"],
    strengths: ["Ultra-compact (450MB)", "Instantané", "Économie batterie maximale"],
    weaknesses: ["Qualité limitée", "Erreurs fréquentes sur complexe", "Moins cohérent"],
  },
  "gemma3-1b-mediapipe": {
    id: "gemma3-1b-mediapipe",
    name: "Gemma 3 1B (MediaPipe)",
    filename: "gemma3-1b-mediapipe.task",
    // LiteRT Community - requires HuggingFace auth (gated)
    downloadUrl:
      "https://huggingface.co/litert-community/Gemma3-1B-IT/resolve/main/Gemma3-1B-IT_multi-prefill-seq_q4_ekv2048.task",
    expectedSize: 555 * 1024 * 1024, // ~555MB
    backend: "mediapipe",
    description: "Gemma 3 1B MediaPipe - Optimisé TPU Tensor",
    category: "gemma",
    promptTemplate: "gemma",
    deviceCompatibility: "google",
    optimizedFor: "google",
    requiresAuth: true,
    languages: ["Anglais", "Français", "Espagnol", "Multilingue"],
    specializations: ["Accélération TPU", "Inférence GPU", "Tâches temps-réel"],
    strengths: ["Accélération matérielle TPU", "Très rapide sur Pixel 6+", "Économe en CPU"],
    weaknesses: ["Nécessite HF auth", "Pixel 6+ uniquement", "Format propriétaire MediaPipe"],
  },
  "gemma3n-2b": {
    id: "gemma3n-2b",
    name: "Gemma 3n 2B (TPU)",
    filename: "gemma3n-2b-tpu.litertlm",
    // Google official - requires HuggingFace auth (gated)
    downloadUrl:
      "https://huggingface.co/google/gemma-3n-E2B-it-litert-lm/resolve/main/gemma-3n-E2B-it-int4.litertlm",
    expectedSize: 3660 * 1024 * 1024, // ~3.66GB
    backend: "mediapipe",
    description: "Gemma 3n 2B - Optimisé TPU Tensor (Pixel 6+)",
    category: "gemma",
    promptTemplate: "gemma",
    deviceCompatibility: "google",
    optimizedFor: "google",
    requiresAuth: true,
    recommended: true,
    languages: ["Anglais", "Français", "Espagnol", "Allemand", "Italien", "Multilingue"],
    specializations: ["Accélération TPU", "Code", "Analyse", "Raisonnement"],
    strengths: ["Maximum performance TPU", "Qualité élevée", "Officiel Google", "Excellent sur Pixel"],
    weaknesses: ["Très lourd (3.66GB)", "Nécessite HF auth", "Pixel 6+ uniquement", "Consommation élevée"],
  },

  // ==========================================
  // LLAMA (Meta) - Compatible tous appareils, optimisé Apple
  // ==========================================
  "llama3.1-8b": {
    id: "llama3.1-8b",
    name: "Llama 3.1 8B Instruct",
    filename: "llama-3.1-8b-instruct-q4_k_m.gguf",
    // Llama 3.1 8B from bartowski - public
    downloadUrl:
      "https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf",
    expectedSize: 4900 * 1024 * 1024, // ~4.9GB
    backend: "llamarn",
    description: "Meilleure qualité linguistique sur mobile",
    category: "llama",
    promptTemplate: "llama",
    deviceCompatibility: "all",
    optimizedFor: "apple",
    recommended: true,
    languages: ["Anglais", "Français", "Espagnol", "Allemand", "Italien", "Portugais", "Hindi", "Thaï"],
    specializations: ["Écriture créative", "Code avancé", "Raisonnement", "Conversation", "Traduction"],
    strengths: ["Qualité état de l'art", "Très créatif", "Excellent multilingue", "Optimisé Neural Engine"],
    weaknesses: ["Très lourd (4.9GB)", "Lent sur Android", "Forte consommation", "Nécessite 6GB+ RAM"],
  },
  "llama3.2-1b": {
    id: "llama3.2-1b",
    name: "Llama 3.2 1B",
    filename: "llama-3.2-1b-instruct-q4_k_m.gguf",
    // Llama 3.2 1B from hugging-quants - public
    downloadUrl:
      "https://huggingface.co/hugging-quants/Llama-3.2-1B-Instruct-Q4_K_M-GGUF/resolve/main/llama-3.2-1b-instruct-q4_k_m.gguf",
    expectedSize: 750 * 1024 * 1024, // ~750MB
    backend: "llamarn",
    description: "Léger et rapide pour tous les appareils",
    category: "llama",
    promptTemplate: "llama",
    deviceCompatibility: "all",
    optimizedFor: "apple",
    languages: ["Anglais", "Français", "Espagnol", "Allemand", "Italien", "Portugais"],
    specializations: ["Chat", "Questions-réponses", "Résumé", "Instructions simples"],
    strengths: ["Compact (750MB)", "Rapide", "Bon sur iPhone", "Multilingue correct"],
    weaknesses: ["Moins bon que Qwen taille équivalente", "Limité sur tâches complexes", "Créativité réduite"],
  },
  "llama3.2-3b": {
    id: "llama3.2-3b",
    name: "Llama 3.2 3B",
    filename: "llama-3.2-3b-instruct-q4_k_m.gguf",
    // Llama 3.2 3B from hugging-quants - public
    downloadUrl:
      "https://huggingface.co/hugging-quants/Llama-3.2-3B-Instruct-Q4_K_M-GGUF/resolve/main/llama-3.2-3b-instruct-q4_k_m.gguf",
    expectedSize: 2000 * 1024 * 1024, // ~2GB
    backend: "llamarn",
    description: "Mobile performant mais taille moindre",
    category: "llama",
    promptTemplate: "llama",
    deviceCompatibility: "all",
    optimizedFor: "apple",
    recommended: true,
    languages: ["Anglais", "Français", "Espagnol", "Allemand", "Italien", "Portugais", "Hindi"],
    specializations: ["Écriture", "Code Python/JS", "Analyse", "Conversation naturelle"],
    strengths: ["Bon équilibre taille/qualité", "Rapide sur iPhone", "Bonne créativité", "Code correct"],
    weaknesses: ["Moins versatile que 8B", "Moyen sur langues rares", "Limité sur code complexe"],
  },
};
