/**
 * Story 13.2: Tables référentielles pour les statuts backend
 *
 * BDD acceptance tests — ADR-026 R2 compliance.
 * Tests vérifient de manière structurelle que :
 * - ThoughtStatus possède tous les champs requis
 * - Thought utilise une FK status_id (plus de _status texte libre)
 * - CaptureState possède label, displayOrder, isActive
 * - Les constantes THOUGHT_STATUS_IDS sont définies et distinctes
 */

import { defineFeature, loadFeature } from 'jest-cucumber';
import * as fs from 'fs';
import * as path from 'path';
import { THOUGHT_STATUS_IDS } from '../../src/common/constants/reference-data.constants';

const feature = loadFeature(
  './test/acceptance/features/story-13-2-backend-statuts-referentiels.feature',
);

/** Regex UUID v4/v7 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Chemins des fichiers source relatifs à la racine backend
const BACKEND_ROOT = path.resolve(__dirname, '../../');
const THOUGHT_STATUS_ENTITY_PATH =
  'src/modules/knowledge/domain/entities/thought-status.entity.ts';
const THOUGHT_ENTITY_PATH =
  'src/modules/knowledge/domain/entities/thought.entity.ts';
const CAPTURE_STATE_ENTITY_PATH =
  'src/modules/capture/domain/entities/capture-state.entity.ts';
const REFERENCE_DATA_CONSTANTS_PATH =
  'src/common/constants/reference-data.constants.ts';

// =============================================================================
// Tests BDD
// =============================================================================

defineFeature(feature, (test) => {
  // ---------------------------------------------------------------------------
  // Scénario 1: ThoughtStatus entity fields
  // ---------------------------------------------------------------------------
  test('La table thought_statuses possède tous les champs requis', ({
    given,
    when,
    then,
    and,
  }) => {
    let thoughtStatusContent = '';

    given("le code source de l'entité ThoughtStatus", () => {
      thoughtStatusContent = fs.readFileSync(
        path.join(BACKEND_ROOT, THOUGHT_STATUS_ENTITY_PATH),
        'utf-8',
      );
    });

    when('on inspecte les colonnes de ThoughtStatus', () => {
      // Lecture déjà faite
    });

    then('elle possède le champ "code" de type varchar', () => {
      expect(thoughtStatusContent).toContain("'varchar'");
      expect(thoughtStatusContent).toContain('code!');
    });

    and('elle possède le champ "label" de type varchar', () => {
      expect(thoughtStatusContent).toContain('label!');
    });

    and('elle possède le champ "displayOrder" de type int', () => {
      expect(thoughtStatusContent).toContain("'int'");
      expect(thoughtStatusContent).toContain('displayOrder!');
    });

    and('elle possède le champ "isActive" de type boolean', () => {
      expect(thoughtStatusContent).toContain("'boolean'");
      expect(thoughtStatusContent).toContain('isActive!');
    });

    and(
      'elle hérite de BaseEntity avec id, createdAt, updatedAt, deletedAt',
      () => {
        expect(thoughtStatusContent).toContain('extends BaseEntity');
        // Les champs id, createdAt, updatedAt, deletedAt sont hérités — ne pas les redéclarer
        expect(thoughtStatusContent).not.toContain('@PrimaryGeneratedColumn');
      },
    );
  });

  // ---------------------------------------------------------------------------
  // Scénario 2: Thought entity uses FK status_id
  // ---------------------------------------------------------------------------
  test("L'entité Thought utilise une FK vers thought_statuses", ({
    given,
    when,
    then,
    and,
  }) => {
    let thoughtContent = '';

    given("le code source de l'entité Thought", () => {
      thoughtContent = fs.readFileSync(
        path.join(BACKEND_ROOT, THOUGHT_ENTITY_PATH),
        'utf-8',
      );
    });

    when('on inspecte les colonnes de Thought', () => {
      // Lecture déjà faite
    });

    then('elle possède un champ statusId de type UUID', () => {
      expect(thoughtContent).toContain('statusId');
      expect(thoughtContent).toContain("'uuid'");
      expect(thoughtContent).toContain("name: 'status_id'");
    });

    and('elle ne contient pas de colonne _status en texte libre', () => {
      expect(thoughtContent).not.toContain("'_status'");
      expect(thoughtContent).not.toContain('"_status"');
      expect(thoughtContent).not.toContain("default: 'active'");
    });

    and('elle référence ThoughtStatus via une relation ManyToOne', () => {
      expect(thoughtContent).toContain('ThoughtStatus');
      expect(thoughtContent).toContain('@ManyToOne');
      expect(thoughtContent).toContain('@JoinColumn');
    });
  });

  // ---------------------------------------------------------------------------
  // Scénario 3: THOUGHT_STATUS_IDS constants
  // ---------------------------------------------------------------------------
  test('Les constantes THOUGHT_STATUS_IDS contiennent les valeurs requises', ({
    given,
    when,
    then,
    and,
  }) => {
    let referenceDataContent = '';

    given('le fichier reference-data.constants.ts', () => {
      referenceDataContent = fs.readFileSync(
        path.join(BACKEND_ROOT, REFERENCE_DATA_CONSTANTS_PATH),
        'utf-8',
      );
    });

    when('on vérifie les constantes THOUGHT_STATUS_IDS', () => {
      // Vérification via import direct (module déjà chargé)
    });

    then(
      'la constante ACTIVE est définie avec un UUID déterministe au format "d0000000-"',
      () => {
        expect(THOUGHT_STATUS_IDS.ACTIVE).toBeDefined();
        expect(UUID_REGEX.test(THOUGHT_STATUS_IDS.ACTIVE)).toBe(true);
        expect(THOUGHT_STATUS_IDS.ACTIVE.startsWith('d0000000-')).toBe(true);
      },
    );

    and(
      'la constante ARCHIVED est définie avec un UUID déterministe au format "d0000000-"',
      () => {
        expect(THOUGHT_STATUS_IDS.ARCHIVED).toBeDefined();
        expect(UUID_REGEX.test(THOUGHT_STATUS_IDS.ARCHIVED)).toBe(true);
        expect(THOUGHT_STATUS_IDS.ARCHIVED.startsWith('d0000000-')).toBe(true);
      },
    );

    and('les deux UUIDs sont distincts', () => {
      expect(THOUGHT_STATUS_IDS.ACTIVE).not.toBe(THOUGHT_STATUS_IDS.ARCHIVED);
    });
  });

  // ---------------------------------------------------------------------------
  // Scénario 4: CaptureState has missing fields
  // ---------------------------------------------------------------------------
  test('La table capture_states est complète avec les champs manquants', ({
    given,
    when,
    then,
    and,
  }) => {
    let captureStateContent = '';

    given("le code source de l'entité CaptureState", () => {
      captureStateContent = fs.readFileSync(
        path.join(BACKEND_ROOT, CAPTURE_STATE_ENTITY_PATH),
        'utf-8',
      );
    });

    when('on inspecte les colonnes de CaptureState', () => {
      // Lecture déjà faite
    });

    then('elle possède le champ "label" de type varchar', () => {
      expect(captureStateContent).toContain('label!');
      expect(captureStateContent).toContain("'varchar'");
    });

    and('elle possède le champ "displayOrder" de type int', () => {
      expect(captureStateContent).toContain('displayOrder!');
      expect(captureStateContent).toContain("'int'");
    });

    and('elle possède le champ "isActive" de type boolean', () => {
      expect(captureStateContent).toContain('isActive!');
      expect(captureStateContent).toContain("'boolean'");
    });
  });
});
