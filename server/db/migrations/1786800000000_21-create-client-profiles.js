/**
 * Migration 21 — client_profiles for trip intake (guest + authenticated).
 *
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createTable('client_profiles', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      references: 'users',
      onDelete: 'SET NULL',
    },
    email: { type: 'text', notNull: true, unique: true },
    name: { type: 'text', notNull: true },
    phone: { type: 'text' },
    service_tier_preference: {
      type: 'text',
      check: "service_tier_preference IS NULL OR service_tier_preference IN ('full_service', 'itinerary_only')",
    },
    email_verified: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    communication_preferences: { type: 'jsonb' },
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

  pgm.createIndex('client_profiles', 'user_id', {
    name: 'client_profiles_user_id_idx',
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropTable('client_profiles');
};
