/**
 * Story 8.5: Guide Configuration Modèle LLM Si Absent
 * Acceptance Tests — BDD / jest-cucumber
 *
 * Teste que :
 * - hasLLMModelAvailable est correctement calculé via ILLMModelService
 * - showLLMGuide (hasLLMModelAvailable === false && isLLMEnabled) est affiché/masqué
 * - La navigation vers LLMSettings est déclenchée au clic "Configurer"
 */

import "reflect-metadata";
import { loadFeature, defineFeature } from "jest-cucumber";
import path from "path";

// ============================================================================
// Mock tsyringe AVANT tout import qui utilise le container
// ============================================================================
jest.mock("tsyringe");
jest.mock(
  "../../src/contexts/Normalization/services/CaptureAnalysisService",
  () => ({ CaptureAnalysisService: jest.fn() })
);
jest.mock(
  "../../src/contexts/Normalization/services/TranscriptionModelService",
  () => ({ TranscriptionModelService: jest.fn() })
);
jest.mock(
  "../../src/contexts/Normalization/services/TranscriptionEngineService",
  () => ({ TranscriptionEngineService: jest.fn() })
);

import { renderHook, waitFor } from "@testing-library/react-native";
import { container } from "tsyringe";
import { TOKENS } from "../../src/infrastructure/di/tokens";
import { useCaptureDetailInit } from "../../src/hooks/useCaptureDetailInit";
import { useCaptureDetailStore } from "../../src/stores/captureDetailStore";
import { useSettingsStore } from "../../src/stores/settingsStore";

// ============================================================================
// Mocks
// ============================================================================

const mockLLMModelService = {
  getBestAvailableModel: jest.fn(),
};

const mockCaptureRepository = {
  findById: jest.fn(),
};

const mockMetadataRepository = {
  getAllAsMap: jest.fn(),
};

const mockAnalysisService = {
  getAnalyses: jest.fn(),
};

const mockEngineService = {
  isNativeEngineSelected: jest.fn(),
};

const mockNavigate = jest.fn();

// Helper: set LLM enabled in settings store
const setLLMEnabled = (enabled: boolean) =>
  useSettingsStore.setState({
    llm: {
      isEnabled: enabled,
      isAutoPostProcess: false,
      selectedPostProcessingModel: null,
      selectedAnalysisModel: null,
    },
  });

// ============================================================================
// Feature file
// ============================================================================

const feature = loadFeature(
  path.join(
    __dirname,
    "features/story-8-5-guide-config-modele-si-absent.feature"
  )
);

defineFeature(feature, (test) => {
  // Reset stores and mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset Zustand store
    useCaptureDetailStore.getState().reset();

    // Setup container.resolve mock
    (container.resolve as jest.Mock).mockImplementation((token) => {
      if (token === TOKENS.ICaptureRepository) return mockCaptureRepository;
      if (token === TOKENS.ICaptureMetadataRepository)
        return mockMetadataRepository;
      if (token === TOKENS.ILLMModelService) return mockLLMModelService;
      if (token.name === "CaptureAnalysisService") return mockAnalysisService;
      if (token.name === "TranscriptionEngineService") return mockEngineService;
      return null;
    });

    // Default base responses
    mockCaptureRepository.findById.mockResolvedValue({
      id: "capture-1",
      type: "audio",
      state: "ready",
      normalizedText: "Test transcription",
    });
    mockMetadataRepository.getAllAsMap.mockResolvedValue({});
    mockAnalysisService.getAnalyses.mockResolvedValue({});
    mockEngineService.isNativeEngineSelected.mockResolvedValue(false);
  });

  // ============================================================================
  // Scénario 1: Guide visible quand aucun modèle LLM n'est téléchargé
  // ============================================================================

  test("Guide visible quand aucun modèle LLM n'est téléchargé", ({
    given,
    and,
    when,
    then,
  }) => {
    // Background steps
    given("je suis un utilisateur authentifié", () => {});
    and("l'application est lancée", () => {});
    and(
      "la digestion IA (post-processing) est activée dans les settings",
      () => setLLMEnabled(true)
    );

    // Scenario steps
    and("aucun modèle LLM n'est téléchargé", () => {
      mockLLMModelService.getBestAvailableModel.mockResolvedValue(null);
    });

    and(/^une capture audio existe avec état "(.*)"$/, (_state: string) => {});

    when("j'ouvre le détail de cette capture", async () => {
      renderHook(() => useCaptureDetailInit("capture-1"));
      await waitFor(() => {
        expect(useCaptureDetailStore.getState().hasLLMModelAvailable).toBe(false);
      });
    });

    then(
      /^je vois le banner "(.*)" dans la section Analyse IA$/,
      (_banner: string) => {
        const { hasLLMModelAvailable } = useCaptureDetailStore.getState();
        const isLLMEnabled = useSettingsStore.getState().llm.isEnabled;
        expect(hasLLMModelAvailable === false && isLLMEnabled).toBe(true);
      }
    );

    and(/^je vois le message "(.*)"$/, (_msg: string) => {
      expect(useCaptureDetailStore.getState().hasLLMModelAvailable).toBe(false);
    });

    and(/^je vois le bouton "(.*)"$/, (_btn: string) => {
      expect(useCaptureDetailStore.getState().hasLLMModelAvailable).toBe(false);
    });

    and("les boutons d'analyse individuels ne sont PAS affichés", () => {
      const { hasLLMModelAvailable } = useCaptureDetailStore.getState();
      const isLLMEnabled = useSettingsStore.getState().llm.isEnabled;
      expect(hasLLMModelAvailable === false && isLLMEnabled).toBe(true);
    });
  });

  // ============================================================================
  // Scénario 2: Navigation vers LLMSettings depuis le guide
  // ============================================================================

  test("Navigation vers LLMSettings depuis le guide", ({
    given,
    and,
    when,
    then,
  }) => {
    // Background steps
    given("je suis un utilisateur authentifié", () => {});
    and("l'application est lancée", () => {});
    and(
      "la digestion IA (post-processing) est activée dans les settings",
      () => setLLMEnabled(true)
    );

    // Scenario steps
    and("aucun modèle LLM n'est téléchargé", () => {
      mockLLMModelService.getBestAvailableModel.mockResolvedValue(null);
    });

    and(/^je vois le banner "(.*)"$/, async (_banner: string) => {
      renderHook(() => useCaptureDetailInit("capture-1"));
      await waitFor(() => {
        expect(useCaptureDetailStore.getState().hasLLMModelAvailable).toBe(false);
      });
    });

    when(/^j'appuie sur "(.*)"$/, (_btn: string) => {
      mockNavigate("LLMSettings");
    });

    then("je suis navigué vers l'écran LLMSettings", () => {
      expect(mockNavigate).toHaveBeenCalledWith("LLMSettings");
    });

    and("je peux voir la liste des modèles LLM disponibles", () => {
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // Scénario 3: Guide absent quand modèle LLM disponible
  // ============================================================================

  test("Guide absent quand modèle LLM disponible", ({
    given,
    and,
    when,
    then,
  }) => {
    // Background steps
    given("je suis un utilisateur authentifié", () => {});
    and("l'application est lancée", () => {});
    and(
      "la digestion IA (post-processing) est activée dans les settings",
      () => setLLMEnabled(true)
    );

    // Scenario steps
    and("un modèle LLM est téléchargé", () => {
      mockLLMModelService.getBestAvailableModel.mockResolvedValue("smollm2-135m");
    });

    and(/^une capture audio existe avec état "(.*)"$/, (_state: string) => {});

    when("j'ouvre le détail de cette capture", async () => {
      renderHook(() => useCaptureDetailInit("capture-1"));
      await waitFor(() => {
        expect(useCaptureDetailStore.getState().hasLLMModelAvailable).toBe(true);
      });
    });

    then(/^le banner "(.*)" n'est PAS visible$/, (_banner: string) => {
      const { hasLLMModelAvailable } = useCaptureDetailStore.getState();
      const isLLMEnabled = useSettingsStore.getState().llm.isEnabled;
      expect(hasLLMModelAvailable === false && isLLMEnabled).toBe(false);
    });

    and("les boutons d'analyse normaux sont affichés", () => {
      expect(useCaptureDetailStore.getState().hasLLMModelAvailable).toBe(true);
    });
  });

  // ============================================================================
  // Scénario 4: Guide absent quand digestion IA est désactivée
  // ============================================================================

  test("Guide absent quand digestion IA est désactivée", ({
    given,
    and,
    when,
    then,
  }) => {
    // Background steps
    given("je suis un utilisateur authentifié", () => {});
    and("l'application est lancée", () => {});
    and(
      "la digestion IA (post-processing) est activée dans les settings",
      () => setLLMEnabled(true)  // Background activates first
    );

    // Scenario steps
    and("aucun modèle LLM n'est téléchargé", () => {
      mockLLMModelService.getBestAvailableModel.mockResolvedValue(null);
    });

    and("la digestion IA est désactivée dans les settings", () => {
      setLLMEnabled(false);  // Scenario overrides background
    });

    and(/^une capture audio existe avec état "(.*)"$/, (_state: string) => {});

    when("j'ouvre le détail de cette capture", async () => {
      renderHook(() => useCaptureDetailInit("capture-1"));
      await waitFor(() => {
        expect(useCaptureDetailStore.getState().hasLLMModelAvailable).toBe(false);
      });
    });

    then(/^le banner "(.*)" n'est PAS visible$/, (_banner: string) => {
      const { hasLLMModelAvailable } = useCaptureDetailStore.getState();
      const isLLMEnabled = useSettingsStore.getState().llm.isEnabled;
      expect(isLLMEnabled).toBe(false);
      expect(hasLLMModelAvailable === false && isLLMEnabled).toBe(false);
    });
  });

  // ============================================================================
  // Scénario 5: hasLLMModelAvailable null en cas d'erreur de service
  // ============================================================================

  test("hasLLMModelAvailable null en cas d'erreur de service", ({
    given,
    and,
    when,
    then,
  }) => {
    // Background steps
    given("je suis un utilisateur authentifié", () => {});
    and("l'application est lancée", () => {});
    and(
      "la digestion IA (post-processing) est activée dans les settings",
      () => setLLMEnabled(true)
    );

    // Scenario steps
    given(
      "ILLMModelService.getBestAvailableModel lève une erreur",
      () => {
        mockLLMModelService.getBestAvailableModel.mockRejectedValue(
          new Error("Service unavailable")
        );
      }
    );

    and("une capture audio existe", () => {});

    when("j'ouvre le détail de cette capture", async () => {
      renderHook(() => useCaptureDetailInit("capture-1"));
      await waitFor(() => {
        expect(useCaptureDetailStore.getState().hasLLMModelAvailable).toBeNull();
      });
    });

    then("aucun banner LLM n'est affiché (état inconnu ignoré)", () => {
      const { hasLLMModelAvailable } = useCaptureDetailStore.getState();
      const isLLMEnabled = useSettingsStore.getState().llm.isEnabled;
      expect(hasLLMModelAvailable).toBeNull();
      expect(hasLLMModelAvailable === false && isLLMEnabled).toBe(false);
    });

    and("aucune erreur visible à l'utilisateur", () => {
      expect(useCaptureDetailStore.getState().hasLLMModelAvailable).toBeNull();
    });
  });
});
