/**
 * Story 8.21: Feature Flag — Transcription Live (OFF par défaut)
 * Acceptance Tests — BDD / jest-cucumber
 *
 * Vérifie que le bouton "Live" dans CaptureScreen est contrôlé par le
 * feature flag `live_transcription` via le settingsStore (secure-by-default).
 *
 * Stratégie de test : on teste la logique de composition de captureTools
 * (calcul pur) sans rendre le composant React — les dépendances natives
 * de CaptureScreen (expo-audio, tsyringe, react-navigation…) sont évitées.
 */

import "reflect-metadata";
import { loadFeature, defineFeature } from "jest-cucumber";
import { FEATURE_KEYS } from "../../src/contexts/identity/domain/feature-keys";
import {
  type CaptureTool,
  CAPTURE_TOOLS_LIVE,
  computeCaptureTools,
} from "../../src/screens/capture/capture-tools";

// ============================================================================
// Tests unitaires inline (AC5 — Task 5)
// ============================================================================
describe("Story 8.21 — Unit: FEATURE_KEYS & captureTools", () => {
  it("FEATURE_KEYS.LIVE_TRANSCRIPTION vaut 'live_transcription'", () => {
    expect(FEATURE_KEYS.LIVE_TRANSCRIPTION).toBe("live_transcription");
  });

  it("captureTools sans feature → ne contient pas le bouton Live", () => {
    const tools = computeCaptureTools(false, undefined);
    expect(tools.find((t) => t.id === "live")).toBeUndefined();
  });

  it("captureTools avec feature ON → contient le bouton Live", () => {
    const tools = computeCaptureTools(true, undefined);
    const liveButton = tools.find((t) => t.id === "live");
    expect(liveButton).toBeDefined();
    expect(liveButton?.id).toBe("live");
  });

  it("captureTools avec feature ON → Live est en 3e position (index 2)", () => {
    const tools = computeCaptureTools(true, undefined);
    expect(tools[2]?.id).toBe("live");
  });

  it("captureTools avec getFeature retournant undefined → même comportement que false", () => {
    const toolsUndefined = computeCaptureTools(undefined, undefined);
    const toolsFalse = computeCaptureTools(false, undefined);
    expect(toolsUndefined.find((t) => t.id === "live")).toBeUndefined();
    expect(toolsFalse.find((t) => t.id === "live")).toBeUndefined();
    expect(toolsUndefined).toHaveLength(toolsFalse.length);
  });

  it("captureTools toujours Voice et Text quelle que soit la feature", () => {
    const toolsOff = computeCaptureTools(false, undefined);
    const toolsOn = computeCaptureTools(true, undefined);

    for (const tools of [toolsOff, toolsOn]) {
      expect(tools.find((t) => t.id === "voice")).toBeDefined();
      expect(tools.find((t) => t.id === "text")).toBeDefined();
    }
  });
});

// ============================================================================
// BDD Step Definitions
// ============================================================================
const feature = loadFeature(
  "./tests/acceptance/features/story-8-21-feature-flag-live-transcription.feature"
);

defineFeature(feature, (test) => {
  let featureValue: boolean | undefined;
  let captureTools: CaptureTool[];
  let errorThrown: boolean;

  beforeEach(() => {
    featureValue = undefined;
    captureTools = [];
    errorThrown = false;
  });

  // --------------------------------------------------------------------------
  // AC2 — Bouton Live masqué si feature désactivée
  // --------------------------------------------------------------------------
  test("Bouton Live masqué si feature désactivée", ({
    given,
    when,
    then,
    and,
  }) => {
    given(
      /^la feature "live_transcription" est désactivée pour l'utilisateur$/,
      () => {
        featureValue = false;
      }
    );

    when("l'utilisateur ouvre CaptureScreen", () => {
      try {
        captureTools = computeCaptureTools(featureValue, undefined);
      } catch {
        errorThrown = true;
      }
    });

    then(/^seuls les boutons "Voice" et "Text" sont affichés$/, () => {
      expect(captureTools).toHaveLength(2);
      expect(captureTools.find((t) => t.id === "voice")).toBeDefined();
      expect(captureTools.find((t) => t.id === "text")).toBeDefined();
    });

    and(/^le bouton "Live" n'est pas visible$/, () => {
      expect(captureTools.find((t) => t.id === "live")).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // AC3 — Bouton Live visible si feature activée
  // --------------------------------------------------------------------------
  test("Bouton Live visible si feature activée", ({
    given,
    when,
    then,
    and,
  }) => {
    given(
      /^la feature "live_transcription" est activée pour l'utilisateur$/,
      () => {
        featureValue = true;
      }
    );

    when("l'utilisateur ouvre CaptureScreen", () => {
      try {
        captureTools = computeCaptureTools(featureValue, undefined);
      } catch {
        errorThrown = true;
      }
    });

    then(/^les boutons "Voice" "Text" et "Live" sont tous affichés$/, () => {
      expect(captureTools).toHaveLength(3);
      expect(captureTools.find((t) => t.id === "voice")).toBeDefined();
      expect(captureTools.find((t) => t.id === "text")).toBeDefined();
      expect(captureTools.find((t) => t.id === "live")).toBeDefined();
    });

    and(/^le bouton "Live" est fonctionnel$/, () => {
      const liveTool = captureTools.find((t) => t.id === "live");
      const expectedLive = CAPTURE_TOOLS_LIVE[0];
      // Vérifie que le tool présent dans captureTools est bien le vrai CAPTURE_TOOLS_LIVE[0]
      // et non une copie ou constante locale — protège contre les régressions de configuration
      expect(liveTool?.available).toBe(true);
      expect(liveTool?.iconName).toBe(expectedLive?.iconName); // "zap"
      expect(liveTool?.color).toBe(expectedLive?.color);       // colors.warning[500]
      expect(liveTool?.labelKey).toBe(expectedLive?.labelKey); // "capture.tools.live"
    });
  });

  // --------------------------------------------------------------------------
  // AC4 — Secure-by-default : feature absente → bouton masqué
  // --------------------------------------------------------------------------
  test("Comportement offline — feature absente protège par défaut", ({
    given,
    when,
    then,
    and,
  }) => {
    given("l'utilisateur est hors ligne avec un cache expiré", () => {
      featureValue = undefined;
    });

    and(
      /^getFeature retourne undefined pour "live_transcription"$/,
      () => {
        featureValue = undefined;
      }
    );

    when("l'utilisateur ouvre CaptureScreen", () => {
      try {
        captureTools = computeCaptureTools(featureValue, undefined);
      } catch {
        errorThrown = true;
      }
    });

    then(/^le bouton "Live" n'est pas affiché$/, () => {
      expect(captureTools.find((t) => t.id === "live")).toBeUndefined();
    });

    and(/^aucune erreur n'est propagée à l'UI$/, () => {
      expect(errorThrown).toBe(false);
    });
  });
});
