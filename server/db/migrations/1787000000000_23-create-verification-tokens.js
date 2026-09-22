/**
 * Migration 23 — verification_tokens for intake email verification.
 *
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createTable('verification_tokens', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    client_profile_id: {
      type: 'uuid',
      notNull: true,
      references: 'client_profiles',
      onDelete: 'CASCADE',
    },
    token: {
      type: 'varchar(64)',
      notNull: true,
      unique: true,
    },
    type: {
      type: 'varchar(32)',
      notNull: true,
      default: 'email_verification',
    },
    expires_at: {
      type: 'timestamptz',
      notNull: true,
    },
    used_at: {
      type: 'timestamptz',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.createIndex('verification_tokens', 'token', {
    name: 'verification_tokens_token_idx',
  });
  pgm.createIndex('verification_tokens', 'client_profile_id', {
    name: 'verification_tokens_client_profile_id_idx',
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropTable('verification_tokens');
};
