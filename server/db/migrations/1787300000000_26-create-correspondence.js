/**
 * Migration 26 — correspondence log for inbound/outbound trip email.
 *
 * trip_id is nullable so unmatched inbound mail can be stored for review.
 *
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createTable('correspondence', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    trip_id: {
      type: 'uuid',
      references: 'trips',
      onDelete: 'CASCADE',
    },
    direction: {
      type: 'varchar(8)',
      notNull: true,
      check: "direction IN ('inbound', 'outbound')",
    },
    from_email: { type: 'text', notNull: true },
    to_email: { type: 'text', notNull: true },
    subject: { type: 'text' },
    body_text: { type: 'text' },
    body_html: { type: 'text' },
    raw_payload: { type: 'jsonb' },
    classification: { type: 'varchar(32)' },
    classification_confidence: { type: 'real' },
    auto_response_sent: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    escalation_flag: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    escalation_reason: { type: 'text' },
    resend_message_id: { type: 'text' },
    in_reply_to: { type: 'text' },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.createIndex('correspondence', 'trip_id', {
    name: 'idx_correspondence_trip_id',
  });
  pgm.createIndex('correspondence', 'direction', {
    name: 'idx_correspondence_direction',
  });
  pgm.createIndex('correspondence', 'created_at', {
    name: 'idx_correspondence_created_at',
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropTable('correspondence');
};
