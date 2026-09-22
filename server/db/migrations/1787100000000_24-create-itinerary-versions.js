/**
 * Migration 24 — itinerary_versions for AI-composed trip drafts.
 *
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createTable('itinerary_versions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    trip_id: {
      type: 'uuid',
      notNull: true,
      references: 'trips',
      onDelete: 'CASCADE',
    },
    version_number: {
      type: 'integer',
      notNull: true,
      default: 1,
    },
    version_type: {
      type: 'varchar(16)',
      notNull: true,
      default: 'draft',
      check: "version_type IN ('draft', 'confirmed')",
    },
    content: {
      type: 'jsonb',
      notNull: true,
    },
    pdf_path: {
      type: 'text',
    },
    status: {
      type: 'varchar(32)',
      notNull: true,
      default: 'composing',
      check:
        "status IN ('composing', 'composed', 'sent', 'revision_requested', 'superseded', 'confirmed', 'failed', 'failed_parsing')",
    },
    composition_metadata: {
      type: 'jsonb',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.createIndex('itinerary_versions', 'trip_id', {
    name: 'idx_itinerary_versions_trip_id',
  });
  pgm.createIndex('itinerary_versions', ['trip_id', 'version_number'], {
    name: 'idx_itinerary_versions_trip_version',
    unique: true,
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropTable('itinerary_versions');
};
