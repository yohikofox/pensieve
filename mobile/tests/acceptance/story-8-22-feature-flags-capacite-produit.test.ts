/**
 * Story 8.22: Refactoring Feature Flags — Orientation Capacité Produit
 * Acceptance Tests — BDD / jest-cucumber
 *
 * Vérifie que chaque outil de capture est contrôlé par son propre feature flag
 * (granularité capacité produit, vs flag bloc capture_media_buttons de Story 24.3).
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
  CAPTURE_TOOLS_URL,
  CAPTURE_TOOLS_PHOTO,
  CAPTURE_TOOLS_DOCUMENT,
  CAPTURE_TOOLS_CLIPBOARD,
  computeCaptureTools,
} from "../../src/screens/capture/capture-tools";
// Note: tabScreens n'est pas importé ici — registry.ts tire des composants RN
// incompatibles avec ts-jest.
// Les tests registry AC3/AC4/AC6 (vérification featureKey dans tabScreens) sont dans :
// src/screens/__tests__/story-8-22-registry.test.ts (babel-jest, npm run test:unit)

// ============================================================================
// Tests unitaires inline (Task 7)
// ============================================================================
describe("Story 8.22 — Unit: FEATURE_KEYS nouvelles constantes", () => {
  it("FEATURE_KEYS.NEWS vaut 'news'", () => {
    expect(FEATURE_KEYS.NEWS).toBe("news");
  });

  it("FEATURE_KEYS.PROJECTS vaut 'projects'", () => {
    expect(FEATURE_KEYS.PROJECTS).toBe("projects");
  });

  it("FEATURE_KEYS.URL_CAPTURE vaut 'url_capture'", () => {
    expect(FEATURE_KEYS.URL_CAPTURE).toBe("url_capture");
  });

  it("FEATURE_KEYS.PHOTO_CAPTURE vaut 'photo_capture'", () => {
    expect(FEATURE_KEYS.PHOTO_CAPTURE).toBe("photo_capture");
  });

  it("FEATURE_KEYS.DOCUMENT_CAPTURE vaut 'document_capture'", () => {
    expect(FEATURE_KEYS.DOCUMENT_CAPTURE).toBe("document_capture");
  });

  it("FEATURE_KEYS.CLIPBOARD_CAPTURE vaut 'clipboard_capture'", () => {
    expect(FEATURE_KEYS.CLIPBOARD_CAPTURE).toBe("clipboard_capture");
  });

  it("Les anciens flags dépréciés conservent leurs valeurs string (rollback possible)", () => {
    expect(FEATURE_KEYS.NEWS_TAB).toBe("news_tab");
    expect(FEATURE_KEYS.PROJECTS_TAB).toBe("projects_tab");
    expect(FEATURE_KEYS.CAPTURE_MEDIA_BUTTONS).toBe("capture_media_buttons");
  });
});

describe("Story 8.22 — Unit: computeCaptureTools composition granulaire", () => {
  it("Tous à false → [voice, text] uniquement", () => {
    const tools = computeCaptureTools(false, false, false, false, false);
    expect(tools).toHaveLength(2);
    expect(tools.find((t) => t.id === "voice")).toBeDefined();
    expect(tools.find((t) => t.id === "text")).toBeDefined();
  });

  it("Uniquement url_capture=true → [voice, text, url]", () => {
    const tools = computeCaptureTools(false, true, false, false, false);
    expect(tools).toHaveLength(3);
    expect(tools.find((t) => t.id === "url")).toBeDefined();
    expect(tools.find((t) => t.id === "photo")).toBeUndefined();
    expect(tools.find((t) => t.id === "document")).toBeUndefined();
    expect(tools.find((t) => t.id === "clipboard")).toBeUndefined();
  });

  it("photo_capture=true + document_capture=true → [voice, text, photo, document]", () => {
    const tools = computeCaptureTools(false, false, true, true, false);
    expect(tools).toHaveLength(4);
    expect(tools.find((t) => t.id === "photo")).toBeDefined();
    expect(tools.find((t) => t.id === "document")).toBeDefined();
    expect(tools.find((t) => t.id === "url")).toBeUndefined();
    expect(tools.find((t) => t.id === "clipboard")).toBeUndefined();
  });

  it("Tous à true → [voice, text, live, url, photo, document, clipboard]", () => {
    const tools = computeCaptureTools(true, true, true, true, true);
    expect(tools).toHaveLength(7);
    const ids = tools.map((t) => t.id);
    expect(ids).toContain("voice");
    expect(ids).toContain("text");
    expect(ids).toContain("live");
    expect(ids).toContain("url");
    expect(ids).toContain("photo");
    expect(ids).toContain("document");
    expect(ids).toContain("clipboard");
  });

  it("Aucun flag → comportement identique à avant (voice + text seulement)", () => {
    const toolsUndefined = computeCaptureTools(undefined);
    expect(toolsUndefined).toHaveLength(2);
    expect(toolsUndefined.find((t) => t.id === "voice")).toBeDefined();
    expect(toolsUndefined.find((t) => t.id === "text")).toBeDefined();
  });

  it("Rétrocompatibilité: computeCaptureTools(liveValue, undefined) — tests story 8.21 non cassés", () => {
    // L'ancien appel avec 2 params doit toujours fonctionner
    const tools = computeCaptureTools(true, undefined);
    expect(tools.find((t) => t.id === "live")).toBeDefined();
    expect(tools.find((t) => t.id === "url")).toBeUndefined();
  });

  it("CAPTURE_TOOLS_URL a le bon id et la bonne icône", () => {
    const tool = CAPTURE_TOOLS_URL[0];
    expect(tool?.id).toBe("url");
    expect(tool?.iconName).toBe("globe");
  });

  it("CAPTURE_TOOLS_PHOTO a le bon id et la bonne icône", () => {
    const tool = CAPTURE_TOOLS_PHOTO[0];
    expect(tool?.id).toBe("photo");
    expect(tool?.iconName).toBe("aperture");
  });

  it("CAPTURE_TOOLS_DOCUMENT a le bon id et la bonne icône", () => {
    const tool = CAPTURE_TOOLS_DOCUMENT[0];
    expect(tool?.id).toBe("document");
    expect(tool?.iconName).toBe("file");
  });

  it("CAPTURE_TOOLS_CLIPBOARD a le bon id et la bonne icône", () => {
    const tool = CAPTURE_TOOLS_CLIPBOARD[0];
    expect(tool?.id).toBe("clipboard");
    expect(tool?.iconName).toBe("copy");
  });
});

// ============================================================================
// BDD Step Definitions
// ============================================================================
const feature = loadFeature(
  "./tests/acceptance/features/story-8-22-feature-flags-capacite-produit.feature"
);

defineFeature(feature, (test) => {
  let captureTools: CaptureTool[];
  let urlEnabled: boolean | undefined;
  let photoEnabled: boolean | undefined;
  let documentEnabled: boolean | undefined;
  let clipboardEnabled: boolean | undefined;

  beforeEach(() => {
    captureTools = [];
    urlEnabled = undefined;
    photoEnabled = undefined;
    documentEnabled = undefined;
    clipboardEnabled = undefined;
  });

  // --------------------------------------------------------------------------
  // AC6 — Aucun flag → comportement identique à avant
  // --------------------------------------------------------------------------
  test("Aucun flag activé — comportement identique à avant la migration", ({
    given,
    when,
    then,
    and,
  }) => {
    given("aucune feature n'est activée pour l'utilisateur", () => {
      urlEnabled = false;
      photoEnabled = false;
      documentEnabled = false;
      clipboardEnabled = false;
    });

    when("l'utilisateur ouvre CaptureScreen", () => {
      captureTools = computeCaptureTools(false, urlEnabled, photoEnabled, documentEnabled, clipboardEnabled);
    });

    then(/^seuls les boutons "Voice" et "Text" sont affichés$/, () => {
      expect(captureTools).toHaveLength(2);
      expect(captureTools.find((t) => t.id === "voice")).toBeDefined();
      expect(captureTools.find((t) => t.id === "text")).toBeDefined();
    });

    and(/^les boutons "URL", "Photo", "Document" et "Presse-papier" ne sont pas visibles$/, () => {
      expect(captureTools.find((t) => t.id === "url")).toBeUndefined();
      expect(captureTools.find((t) => t.id === "photo")).toBeUndefined();
      expect(captureTools.find((t) => t.id === "document")).toBeUndefined();
      expect(captureTools.find((t) => t.id === "clipboard")).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // AC3 — Tab Actualités via feature "news"
  // La liaison registry↔FEATURE_KEYS est testée dans story-8-22-registry.test.ts
  // --------------------------------------------------------------------------
  test("Tab Actualités contrôlée par \"news\"", ({ given, when, then }) => {
    let newsFeatureKey: string;

    given(/^la feature "news" est activée pour l'utilisateur$/, () => {
      // Simule la résolution de la feature key utilisée par le registry
      newsFeatureKey = FEATURE_KEYS.NEWS;
    });

    when("l'utilisateur consulte la liste des tabs", () => {
      // La clé est déjà résolue via FEATURE_KEYS
    });

    then(/^la clé de feature du tab News vaut "news"$/, () => {
      expect(newsFeatureKey).toBe("news");
    });
  });

  // --------------------------------------------------------------------------
  // AC4 — Tab Projets via feature "projects"
  // --------------------------------------------------------------------------
  test("Tab Projets contrôlée par \"projects\"", ({ given, when, then }) => {
    let projectsFeatureKey: string;

    given(/^la feature "projects" est activée pour l'utilisateur$/, () => {
      projectsFeatureKey = FEATURE_KEYS.PROJECTS;
    });

    when("l'utilisateur consulte la liste des tabs", () => {
      // La clé est déjà résolue via FEATURE_KEYS
    });

    then(/^la clé de feature du tab Projects vaut "projects"$/, () => {
      expect(projectsFeatureKey).toBe("projects");
    });
  });

  // --------------------------------------------------------------------------
  // AC5 — Activation granulaire : URL uniquement
  // --------------------------------------------------------------------------
  test("Activation granulaire — URL capture uniquement", ({
    given,
    when,
    then,
    and,
  }) => {
    given(/^seule la feature "url_capture" est activée$/, () => {
      urlEnabled = true;
      photoEnabled = false;
      documentEnabled = false;
      clipboardEnabled = false;
    });

    when("l'utilisateur ouvre CaptureScreen", () => {
      captureTools = computeCaptureTools(false, urlEnabled, photoEnabled, documentEnabled, clipboardEnabled);
    });

    then(/^le bouton "URL" est visible$/, () => {
      expect(captureTools.find((t) => t.id === "url")).toBeDefined();
    });

    and(/^les boutons "Photo", "Document" et "Presse-papier" ne sont pas visibles$/, () => {
      expect(captureTools.find((t) => t.id === "photo")).toBeUndefined();
      expect(captureTools.find((t) => t.id === "document")).toBeUndefined();
      expect(captureTools.find((t) => t.id === "clipboard")).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // AC5 — Activation granulaire : Photo + Document sans URL
  // --------------------------------------------------------------------------
  test("Activation granulaire — Photo et Document sans URL", ({
    given,
    when,
    then,
    and,
  }) => {
    given(/^les features "photo_capture" et "document_capture" sont activées$/, () => {
      photoEnabled = true;
      documentEnabled = true;
    });

    and(/^"url_capture" et "clipboard_capture" sont désactivées$/, () => {
      urlEnabled = false;
      clipboardEnabled = false;
    });

    when("l'utilisateur ouvre CaptureScreen", () => {
      captureTools = computeCaptureTools(false, urlEnabled, photoEnabled, documentEnabled, clipboardEnabled);
    });

    then(/^les boutons "Photo" et "Document" sont visibles$/, () => {
      expect(captureTools.find((t) => t.id === "photo")).toBeDefined();
      expect(captureTools.find((t) => t.id === "document")).toBeDefined();
    });

    and(/^les boutons "URL" et "Presse-papier" ne sont pas visibles$/, () => {
      expect(captureTools.find((t) => t.id === "url")).toBeUndefined();
      expect(captureTools.find((t) => t.id === "clipboard")).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // AC5 — Tous les flags média activés
  // --------------------------------------------------------------------------
  test("Tous les flags capture média activés — hors live transcription", ({ given, when, then }) => {
    given(
      /^les features "url_capture", "photo_capture", "document_capture" et "clipboard_capture" sont toutes activées$/,
      () => {
        urlEnabled = true;
        photoEnabled = true;
        documentEnabled = true;
        clipboardEnabled = true;
      }
    );

    when("l'utilisateur ouvre CaptureScreen", () => {
      captureTools = computeCaptureTools(false, urlEnabled, photoEnabled, documentEnabled, clipboardEnabled);
    });

    then(
      /^les boutons "Voice", "Text", "URL", "Photo", "Document" et "Presse-papier" sont tous visibles$/,
      () => {
        const ids = captureTools.map((t) => t.id);
        expect(ids).toContain("voice");
        expect(ids).toContain("text");
        expect(ids).toContain("url");
        expect(ids).toContain("photo");
        expect(ids).toContain("document");
        expect(ids).toContain("clipboard");
      }
    );
  });
});
