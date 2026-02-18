/**
 * Migration: Migrate Entity PKs to Domain-Generated UUIDs
 *
 * Story 12.2: Remplacer @PrimaryGeneratedColumn par UUID Généré dans le Domaine (ADR-026 R1)
 *
 * Changements:
 *
 * 1. thoughts, ideas, todos : Supprimer le DEFAULT PostgreSQL uuid_generate_v4()
 *    Les données existantes sont préservées. L'UUID sera désormais fourni
 *    par la couche applicative (crypto.randomUUID()) avant la persistance.
 *
 * 2. capture_types, capture_states, capture_sync_statuses :
 *    Migration des PKs entières (serial) vers UUID
 *    - UUIDs déterministes assignés (voir reference-data.constants.ts)
 *    - FKs dans captures migrées de int vers uuid
 *
 * BACKUP OBLIGATOIRE avant toute migration en production.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrateEntityPKsToUUIDDomainGenerated1771400000000 implements MigrationInterface {
  name = 'MigrateEntityPKsToUUIDDomainGenerated1771400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================================
    // 0. Pre-flight validations (M5, H3)
    //    Vérifie que les tables référentielles n'ont que des valeurs connues
    //    et que les FKs des captures sont toutes mappables.
    // ============================================================

    // M5: capture_types — valeurs attendues uniquement
    const unknownTypes: { name: string }[] = await queryRunner.query(`
      SELECT name FROM capture_types WHERE name NOT IN ('audio', 'text')
    `);
    if (unknownTypes.length > 0) {
      throw new Error(
        `Migration pre-flight failed: capture_types contient des valeurs inattendues: ${unknownTypes.map((r) => r.name).join(', ')}. Nettoyez les données avant de relancer.`,
      );
    }

    // M5: capture_states — valeurs attendues uniquement
    const unknownStates: { name: string }[] = await queryRunner.query(`
      SELECT name FROM capture_states WHERE name NOT IN ('recording', 'captured', 'failed')
    `);
    if (unknownStates.length > 0) {
      throw new Error(
        `Migration pre-flight failed: capture_states contient des valeurs inattendues: ${unknownStates.map((r) => r.name).join(', ')}. Nettoyez les données avant de relancer.`,
      );
    }

    // M5: capture_sync_statuses — valeurs attendues uniquement
    const unknownSyncStatuses: { name: string }[] = await queryRunner.query(`
      SELECT name FROM capture_sync_statuses WHERE name NOT IN ('active', 'deleted')
    `);
    if (unknownSyncStatuses.length > 0) {
      throw new Error(
        `Migration pre-flight failed: capture_sync_statuses contient des valeurs inattendues: ${unknownSyncStatuses.map((r) => r.name).join(', ')}. Nettoyez les données avant de relancer.`,
      );
    }

    // H3: captures avec typeId orphelin (nullable — avertissement)
    const orphanedTypeIds: { count: string }[] = await queryRunner.query(`
      SELECT COUNT(*)::text AS count FROM captures c
      LEFT JOIN capture_types ct ON c."typeId" = ct.id
      WHERE c."typeId" IS NOT NULL AND ct.id IS NULL
    `);
    if (parseInt(orphanedTypeIds[0]?.count ?? '0') > 0) {
      console.warn(
        `[Migration Warning] ${orphanedTypeIds[0].count} captures ont un typeId orphelin (référence inexistante). Ces typeId seront mis à NULL après migration.`,
      );
    }

    // H3: captures avec stateId orphelin (nullable — avertissement)
    const orphanedStateIds: { count: string }[] = await queryRunner.query(`
      SELECT COUNT(*)::text AS count FROM captures c
      LEFT JOIN capture_states cs ON c."stateId" = cs.id
      WHERE c."stateId" IS NOT NULL AND cs.id IS NULL
    `);
    if (parseInt(orphanedStateIds[0]?.count ?? '0') > 0) {
      console.warn(
        `[Migration Warning] ${orphanedStateIds[0].count} captures ont un stateId orphelin (référence inexistante). Ces stateId seront mis à NULL après migration.`,
      );
    }

    // H2: captures avec syncStatusId orphelin (NOT NULL — erreur bloquante)
    const orphanedSyncStatusIds: { count: string }[] = await queryRunner.query(`
      SELECT COUNT(*)::text AS count FROM captures c
      LEFT JOIN capture_sync_statuses css ON c."syncStatusId" = css.id
      WHERE css.id IS NULL
    `);
    if (parseInt(orphanedSyncStatusIds[0]?.count ?? '0') > 0) {
      throw new Error(
        `Migration pre-flight failed: ${orphanedSyncStatusIds[0].count} captures ont un syncStatusId orphelin. La contrainte NOT NULL échouerait. Corrigez les données (ex: SET syncStatusId=1 pour les captures orphelines).`,
      );
    }

    // ============================================================
    // 1. thoughts, ideas, todos : Supprimer le DEFAULT PostgreSQL
    //    Les UUIDs existants sont préservés — on retire juste la génération auto DB
    // ============================================================

    await queryRunner.query(`
      ALTER TABLE thoughts ALTER COLUMN id DROP DEFAULT
    `);

    await queryRunner.query(`
      ALTER TABLE ideas ALTER COLUMN id DROP DEFAULT
    `);

    await queryRunner.query(`
      ALTER TABLE todos ALTER COLUMN id DROP DEFAULT
    `);

    // ============================================================
    // 2. capture_types : integer → UUID (avec données)
    //    UUID déterministe: audio=a0000000-...-001, text=a0000000-...-002
    // ============================================================

    // 2a. Ajouter colonne UUID temporaire dans capture_types
    await queryRunner.query(`
      ALTER TABLE capture_types ADD COLUMN id_new uuid
    `);

    // 2b. Assigner UUIDs déterministes selon le nom
    await queryRunner.query(`
      UPDATE capture_types
      SET id_new = 'a0000000-0000-7000-8000-000000000001'::uuid
      WHERE name = 'audio'
    `);
    await queryRunner.query(`
      UPDATE capture_types
      SET id_new = 'a0000000-0000-7000-8000-000000000002'::uuid
      WHERE name = 'text'
    `);

    // 2c. Ajouter colonne UUID dans captures pour la nouvelle FK typeId
    await queryRunner.query(`
      ALTER TABLE captures ADD COLUMN "typeId_new" uuid
    `);

    // 2d. Mapper les données captures.typeId (int) → captures.typeId_new (uuid)
    await queryRunner.query(`
      UPDATE captures c
      SET "typeId_new" = ct.id_new
      FROM capture_types ct
      WHERE c."typeId" = ct.id
    `);

    // 2e. Supprimer l'ancienne colonne typeId (CASCADE supprime les FKs liées)
    await queryRunner.query(`
      ALTER TABLE captures DROP COLUMN "typeId" CASCADE
    `);

    // 2f. Renommer la nouvelle colonne
    await queryRunner.query(`
      ALTER TABLE captures RENAME COLUMN "typeId_new" TO "typeId"
    `);

    // 2g. Remplacer PK integer de capture_types
    await queryRunner.query(`
      ALTER TABLE capture_types DROP CONSTRAINT capture_types_pkey
    `);
    await queryRunner.query(`
      ALTER TABLE capture_types DROP COLUMN id
    `);
    await queryRunner.query(`
      ALTER TABLE capture_types RENAME COLUMN id_new TO id
    `);
    await queryRunner.query(`
      ALTER TABLE capture_types ADD CONSTRAINT capture_types_pkey PRIMARY KEY (id)
    `);

    // 2h. Recréer FK typeId → capture_types
    await queryRunner.query(`
      ALTER TABLE captures
      ADD CONSTRAINT "FK_captures_typeId"
      FOREIGN KEY ("typeId") REFERENCES capture_types(id) ON DELETE SET NULL
    `);

    // M6: Recréer l'index sur la FK UUID (perdu avec DROP COLUMN CASCADE)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_captures_typeId" ON captures ("typeId")
    `);

    // ============================================================
    // 3. capture_states : integer → UUID (avec données)
    //    UUIDs déterministes: recording=b001, captured=b002, failed=b003
    // ============================================================

    await queryRunner.query(`
      ALTER TABLE capture_states ADD COLUMN id_new uuid
    `);

    await queryRunner.query(`
      UPDATE capture_states
      SET id_new = 'b0000000-0000-7000-8000-000000000001'::uuid
      WHERE name = 'recording'
    `);
    await queryRunner.query(`
      UPDATE capture_states
      SET id_new = 'b0000000-0000-7000-8000-000000000002'::uuid
      WHERE name = 'captured'
    `);
    await queryRunner.query(`
      UPDATE capture_states
      SET id_new = 'b0000000-0000-7000-8000-000000000003'::uuid
      WHERE name = 'failed'
    `);

    await queryRunner.query(`
      ALTER TABLE captures ADD COLUMN "stateId_new" uuid
    `);

    await queryRunner.query(`
      UPDATE captures c
      SET "stateId_new" = cs.id_new
      FROM capture_states cs
      WHERE c."stateId" = cs.id
    `);

    await queryRunner.query(`
      ALTER TABLE captures DROP COLUMN "stateId" CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE captures RENAME COLUMN "stateId_new" TO "stateId"
    `);

    await queryRunner.query(`
      ALTER TABLE capture_states DROP CONSTRAINT capture_states_pkey
    `);
    await queryRunner.query(`
      ALTER TABLE capture_states DROP COLUMN id
    `);
    await queryRunner.query(`
      ALTER TABLE capture_states RENAME COLUMN id_new TO id
    `);
    await queryRunner.query(`
      ALTER TABLE capture_states ADD CONSTRAINT capture_states_pkey PRIMARY KEY (id)
    `);

    await queryRunner.query(`
      ALTER TABLE captures
      ADD CONSTRAINT "FK_captures_stateId"
      FOREIGN KEY ("stateId") REFERENCES capture_states(id) ON DELETE SET NULL
    `);

    // M6: Recréer l'index sur la FK UUID (perdu avec DROP COLUMN CASCADE)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_captures_stateId" ON captures ("stateId")
    `);

    // ============================================================
    // 4. capture_sync_statuses : integer → UUID (avec données)
    //    UUIDs déterministes: active=c001, deleted=c002
    // ============================================================

    await queryRunner.query(`
      ALTER TABLE capture_sync_statuses ADD COLUMN id_new uuid
    `);

    await queryRunner.query(`
      UPDATE capture_sync_statuses
      SET id_new = 'c0000000-0000-7000-8000-000000000001'::uuid
      WHERE name = 'active'
    `);
    await queryRunner.query(`
      UPDATE capture_sync_statuses
      SET id_new = 'c0000000-0000-7000-8000-000000000002'::uuid
      WHERE name = 'deleted'
    `);

    await queryRunner.query(`
      ALTER TABLE captures ADD COLUMN "syncStatusId_new" uuid
    `);

    await queryRunner.query(`
      UPDATE captures c
      SET "syncStatusId_new" = css.id_new
      FROM capture_sync_statuses css
      WHERE c."syncStatusId" = css.id
    `);

    // Supprimer l'ancienne colonne syncStatusId (avec default=1 et FK CASCADE)
    await queryRunner.query(`
      ALTER TABLE captures DROP COLUMN "syncStatusId" CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE captures RENAME COLUMN "syncStatusId_new" TO "syncStatusId"
    `);

    // syncStatusId est NOT NULL (toute capture doit avoir un statut de sync)
    await queryRunner.query(`
      ALTER TABLE captures ALTER COLUMN "syncStatusId" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE capture_sync_statuses DROP CONSTRAINT capture_sync_statuses_pkey
    `);
    await queryRunner.query(`
      ALTER TABLE capture_sync_statuses DROP COLUMN id
    `);
    await queryRunner.query(`
      ALTER TABLE capture_sync_statuses RENAME COLUMN id_new TO id
    `);
    await queryRunner.query(`
      ALTER TABLE capture_sync_statuses ADD CONSTRAINT capture_sync_statuses_pkey PRIMARY KEY (id)
    `);

    await queryRunner.query(`
      ALTER TABLE captures
      ADD CONSTRAINT "FK_captures_syncStatusId"
      FOREIGN KEY ("syncStatusId") REFERENCES capture_sync_statuses(id) ON DELETE RESTRICT
    `);

    // M6: Recréer l'index sur la FK UUID (perdu avec DROP COLUMN CASCADE)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_captures_syncStatusId" ON captures ("syncStatusId")
    `);

    // ============================================================
    // 5. Ajouter les colonnes BaseEntity manquantes sur thoughts, ideas, todos
    //    (createdAt TIMESTAMPTZ, updatedAt TIMESTAMPTZ, deletedAt TIMESTAMPTZ NULL)
    //    Si ces tables n'ont pas encore les colonnes TIMESTAMPTZ, les migrer.
    // ============================================================

    // Pour thoughts:
    await queryRunner.query(`
      ALTER TABLE thoughts
        ALTER COLUMN "createdAt" TYPE timestamptz
        USING "createdAt" AT TIME ZONE 'UTC'
    `);
    await queryRunner.query(`
      ALTER TABLE thoughts
        ALTER COLUMN "updatedAt" TYPE timestamptz
        USING "updatedAt" AT TIME ZONE 'UTC'
    `);
    await queryRunner.query(`
      ALTER TABLE thoughts ADD COLUMN IF NOT EXISTS "deletedAt" timestamptz NULL
    `);

    // Pour ideas:
    await queryRunner.query(`
      ALTER TABLE ideas
        ALTER COLUMN "createdAt" TYPE timestamptz
        USING "createdAt" AT TIME ZONE 'UTC'
    `);
    await queryRunner.query(`
      ALTER TABLE ideas
        ALTER COLUMN "updatedAt" TYPE timestamptz
        USING "updatedAt" AT TIME ZONE 'UTC'
    `);
    await queryRunner.query(`
      ALTER TABLE ideas ADD COLUMN IF NOT EXISTS "deletedAt" timestamptz NULL
    `);

    // Pour todos:
    await queryRunner.query(`
      ALTER TABLE todos
        ALTER COLUMN "createdAt" TYPE timestamptz
        USING "createdAt" AT TIME ZONE 'UTC'
    `);
    await queryRunner.query(`
      ALTER TABLE todos
        ALTER COLUMN "updatedAt" TYPE timestamptz
        USING "updatedAt" AT TIME ZONE 'UTC'
    `);
    await queryRunner.query(`
      ALTER TABLE todos ADD COLUMN IF NOT EXISTS "deletedAt" timestamptz NULL
    `);

    // Pour capture_types:
    await queryRunner.query(`
      ALTER TABLE capture_types ADD COLUMN IF NOT EXISTS "createdAt" timestamptz NOT NULL DEFAULT NOW()
    `);
    await queryRunner.query(`
      ALTER TABLE capture_types ADD COLUMN IF NOT EXISTS "updatedAt" timestamptz NOT NULL DEFAULT NOW()
    `);
    await queryRunner.query(`
      ALTER TABLE capture_types ADD COLUMN IF NOT EXISTS "deletedAt" timestamptz NULL
    `);

    // Pour capture_states:
    await queryRunner.query(`
      ALTER TABLE capture_states ADD COLUMN IF NOT EXISTS "createdAt" timestamptz NOT NULL DEFAULT NOW()
    `);
    await queryRunner.query(`
      ALTER TABLE capture_states ADD COLUMN IF NOT EXISTS "updatedAt" timestamptz NOT NULL DEFAULT NOW()
    `);
    await queryRunner.query(`
      ALTER TABLE capture_states ADD COLUMN IF NOT EXISTS "deletedAt" timestamptz NULL
    `);

    // Pour capture_sync_statuses:
    await queryRunner.query(`
      ALTER TABLE capture_sync_statuses ADD COLUMN IF NOT EXISTS "createdAt" timestamptz NOT NULL DEFAULT NOW()
    `);
    await queryRunner.query(`
      ALTER TABLE capture_sync_statuses ADD COLUMN IF NOT EXISTS "updatedAt" timestamptz NOT NULL DEFAULT NOW()
    `);
    await queryRunner.query(`
      ALTER TABLE capture_sync_statuses ADD COLUMN IF NOT EXISTS "deletedAt" timestamptz NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ============================================================
    // 0. Supprimer les index FK UUID créés dans up()
    // ============================================================

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_captures_typeId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_captures_stateId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_captures_syncStatusId"`);

    // ============================================================
    // 1. Remettre le DEFAULT PostgreSQL sur thoughts, ideas, todos
    // ============================================================

    await queryRunner.query(`
      ALTER TABLE thoughts ALTER COLUMN id SET DEFAULT uuid_generate_v4()
    `);
    await queryRunner.query(`
      ALTER TABLE ideas ALTER COLUMN id SET DEFAULT uuid_generate_v4()
    `);
    await queryRunner.query(`
      ALTER TABLE todos ALTER COLUMN id SET DEFAULT uuid_generate_v4()
    `);

    // ============================================================
    // 2. Rollback capture_sync_statuses : UUID → integer
    // ============================================================

    await queryRunner.query(`
      ALTER TABLE captures DROP CONSTRAINT IF EXISTS "FK_captures_syncStatusId"
    `);
    await queryRunner.query(`
      ALTER TABLE captures ADD COLUMN "syncStatusId_old" int
    `);
    await queryRunner.query(`
      UPDATE captures c SET "syncStatusId_old" = CASE
        WHEN c."syncStatusId" = 'c0000000-0000-7000-8000-000000000001'::uuid THEN 1
        WHEN c."syncStatusId" = 'c0000000-0000-7000-8000-000000000002'::uuid THEN 2
        ELSE 1
      END
    `);
    await queryRunner.query(`
      ALTER TABLE captures DROP COLUMN "syncStatusId"
    `);
    await queryRunner.query(`
      ALTER TABLE captures RENAME COLUMN "syncStatusId_old" TO "syncStatusId"
    `);
    await queryRunner.query(`
      ALTER TABLE captures ALTER COLUMN "syncStatusId" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE captures ALTER COLUMN "syncStatusId" SET DEFAULT 1
    `);

    await queryRunner.query(`
      ALTER TABLE capture_sync_statuses DROP CONSTRAINT capture_sync_statuses_pkey
    `);
    await queryRunner.query(`
      ALTER TABLE capture_sync_statuses RENAME COLUMN id TO id_old
    `);
    await queryRunner.query(`
      ALTER TABLE capture_sync_statuses ADD COLUMN id serial
    `);
    await queryRunner.query(`
      UPDATE capture_sync_statuses
      SET id = CASE
        WHEN id_old = 'c0000000-0000-7000-8000-000000000001'::uuid THEN 1
        WHEN id_old = 'c0000000-0000-7000-8000-000000000002'::uuid THEN 2
        ELSE 1
      END
    `);
    await queryRunner.query(`
      ALTER TABLE capture_sync_statuses DROP COLUMN id_old
    `);
    await queryRunner.query(`
      ALTER TABLE capture_sync_statuses ADD CONSTRAINT capture_sync_statuses_pkey PRIMARY KEY (id)
    `);
    await queryRunner.query(`
      ALTER TABLE captures
      ADD CONSTRAINT "FK_captures_syncStatusId"
      FOREIGN KEY ("syncStatusId") REFERENCES capture_sync_statuses(id) ON DELETE RESTRICT
    `);

    // ============================================================
    // 3. Rollback capture_states : UUID → integer
    // ============================================================

    await queryRunner.query(`
      ALTER TABLE captures DROP CONSTRAINT IF EXISTS "FK_captures_stateId"
    `);
    await queryRunner.query(`
      ALTER TABLE captures ADD COLUMN "stateId_old" int
    `);
    await queryRunner.query(`
      UPDATE captures c SET "stateId_old" = CASE
        WHEN c."stateId" = 'b0000000-0000-7000-8000-000000000001'::uuid THEN 1
        WHEN c."stateId" = 'b0000000-0000-7000-8000-000000000002'::uuid THEN 2
        WHEN c."stateId" = 'b0000000-0000-7000-8000-000000000003'::uuid THEN 3
        ELSE NULL
      END
    `);
    await queryRunner.query(`
      ALTER TABLE captures DROP COLUMN "stateId"
    `);
    await queryRunner.query(`
      ALTER TABLE captures RENAME COLUMN "stateId_old" TO "stateId"
    `);

    await queryRunner.query(`
      ALTER TABLE capture_states DROP CONSTRAINT capture_states_pkey
    `);
    await queryRunner.query(`
      ALTER TABLE capture_states RENAME COLUMN id TO id_old
    `);
    await queryRunner.query(`
      ALTER TABLE capture_states ADD COLUMN id serial
    `);
    await queryRunner.query(`
      UPDATE capture_states
      SET id = CASE
        WHEN id_old = 'b0000000-0000-7000-8000-000000000001'::uuid THEN 1
        WHEN id_old = 'b0000000-0000-7000-8000-000000000002'::uuid THEN 2
        WHEN id_old = 'b0000000-0000-7000-8000-000000000003'::uuid THEN 3
        ELSE 1
      END
    `);
    await queryRunner.query(`
      ALTER TABLE capture_states DROP COLUMN id_old
    `);
    await queryRunner.query(`
      ALTER TABLE capture_states ADD CONSTRAINT capture_states_pkey PRIMARY KEY (id)
    `);
    await queryRunner.query(`
      ALTER TABLE captures
      ADD CONSTRAINT "FK_captures_stateId"
      FOREIGN KEY ("stateId") REFERENCES capture_states(id) ON DELETE SET NULL
    `);

    // ============================================================
    // 4. Rollback capture_types : UUID → integer
    // ============================================================

    await queryRunner.query(`
      ALTER TABLE captures DROP CONSTRAINT IF EXISTS "FK_captures_typeId"
    `);
    await queryRunner.query(`
      ALTER TABLE captures ADD COLUMN "typeId_old" int
    `);
    await queryRunner.query(`
      UPDATE captures c SET "typeId_old" = CASE
        WHEN c."typeId" = 'a0000000-0000-7000-8000-000000000001'::uuid THEN 1
        WHEN c."typeId" = 'a0000000-0000-7000-8000-000000000002'::uuid THEN 2
        ELSE NULL
      END
    `);
    await queryRunner.query(`
      ALTER TABLE captures DROP COLUMN "typeId"
    `);
    await queryRunner.query(`
      ALTER TABLE captures RENAME COLUMN "typeId_old" TO "typeId"
    `);

    await queryRunner.query(`
      ALTER TABLE capture_types DROP CONSTRAINT capture_types_pkey
    `);
    await queryRunner.query(`
      ALTER TABLE capture_types RENAME COLUMN id TO id_old
    `);
    await queryRunner.query(`
      ALTER TABLE capture_types ADD COLUMN id serial
    `);
    await queryRunner.query(`
      UPDATE capture_types
      SET id = CASE
        WHEN id_old = 'a0000000-0000-7000-8000-000000000001'::uuid THEN 1
        WHEN id_old = 'a0000000-0000-7000-8000-000000000002'::uuid THEN 2
        ELSE 1
      END
    `);
    await queryRunner.query(`
      ALTER TABLE capture_types DROP COLUMN id_old
    `);
    await queryRunner.query(`
      ALTER TABLE capture_types ADD CONSTRAINT capture_types_pkey PRIMARY KEY (id)
    `);
    await queryRunner.query(`
      ALTER TABLE captures
      ADD CONSTRAINT "FK_captures_typeId"
      FOREIGN KEY ("typeId") REFERENCES capture_types(id) ON DELETE SET NULL
    `);

    // ============================================================
    // 5. Retirer les colonnes BaseEntity ajoutées sur les tables référentielles
    // ============================================================

    await queryRunner.query(`
      ALTER TABLE capture_types
        DROP COLUMN IF EXISTS "deletedAt",
        DROP COLUMN IF EXISTS "updatedAt",
        DROP COLUMN IF EXISTS "createdAt"
    `);
    await queryRunner.query(`
      ALTER TABLE capture_states
        DROP COLUMN IF EXISTS "deletedAt",
        DROP COLUMN IF EXISTS "updatedAt",
        DROP COLUMN IF EXISTS "createdAt"
    `);
    await queryRunner.query(`
      ALTER TABLE capture_sync_statuses
        DROP COLUMN IF EXISTS "deletedAt",
        DROP COLUMN IF EXISTS "updatedAt",
        DROP COLUMN IF EXISTS "createdAt"
    `);

    // Remettre thoughts, ideas, todos en timestamp (retirer TIMESTAMPTZ conversion)
    await queryRunner.query(`
      ALTER TABLE thoughts
        ALTER COLUMN "createdAt" TYPE timestamp
        USING "createdAt" AT TIME ZONE 'UTC'
    `);
    await queryRunner.query(`
      ALTER TABLE thoughts
        ALTER COLUMN "updatedAt" TYPE timestamp
        USING "updatedAt" AT TIME ZONE 'UTC'
    `);
    await queryRunner.query(`
      ALTER TABLE thoughts DROP COLUMN IF EXISTS "deletedAt"
    `);

    await queryRunner.query(`
      ALTER TABLE ideas
        ALTER COLUMN "createdAt" TYPE timestamp
        USING "createdAt" AT TIME ZONE 'UTC'
    `);
    await queryRunner.query(`
      ALTER TABLE ideas
        ALTER COLUMN "updatedAt" TYPE timestamp
        USING "updatedAt" AT TIME ZONE 'UTC'
    `);
    await queryRunner.query(`
      ALTER TABLE ideas DROP COLUMN IF EXISTS "deletedAt"
    `);

    await queryRunner.query(`
      ALTER TABLE todos
        ALTER COLUMN "createdAt" TYPE timestamp
        USING "createdAt" AT TIME ZONE 'UTC'
    `);
    await queryRunner.query(`
      ALTER TABLE todos
        ALTER COLUMN "updatedAt" TYPE timestamp
        USING "updatedAt" AT TIME ZONE 'UTC'
    `);
    await queryRunner.query(`
      ALTER TABLE todos DROP COLUMN IF EXISTS "deletedAt"
    `);
  }
}
