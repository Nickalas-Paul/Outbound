/**
 * Migration 25 — bookings table for Duffel (and future) booking segments.
 *
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createTable('bookings', {
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
    itinerary_version_id: {
      type: 'uuid',
      notNull: true,
      references: 'itinerary_versions',
    },
    segment_reference: {
      type: 'jsonb',
      notNull: true,
    },
    booking_type: {
      type: 'varchar(32)',
      notNull: true,
      check:
        "booking_type IN ('flight', 'hotel', 'tour', 'experience', 'transfer')",
    },
    provider: {
      type: 'varchar(32)',
      notNull: true,
      default: 'duffel',
    },
    provider_booking_ref: {
      type: 'text',
    },
    status: {
      type: 'varchar(32)',
      notNull: true,
      default: 'pending',
      check:
        "status IN ('pending', 'processing', 'confirmed', 'modified', 'cancelled', 'failed')",
    },
    passenger_details: {
      type: 'jsonb',
    },
    pricing: {
      type: 'jsonb',
    },
    confirmation_details: {
      type: 'jsonb',
    },
    cancellation_policy: {
      type: 'jsonb',
    },
    failure_reason: {
      type: 'text',
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

  pgm.createIndex('bookings', 'trip_id', { name: 'idx_bookings_trip_id' });
  pgm.createIndex('bookings', 'status', { name: 'idx_bookings_status' });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropTable('bookings');
};
