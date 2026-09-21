/**
 * Migration 22 — trips linked to client_profiles (intake storage only).
 *
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createTable('trips', {
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
    service_tier: {
      type: 'text',
      notNull: true,
      check: "service_tier IN ('full_service', 'itinerary_only')",
    },
    status: {
      type: 'text',
      notNull: true,
      default: 'intake_received',
      check:
        "status IN ('intake_received', 'composing', 'draft_delivered', 'in_revision', 'confirmed', 'booking_in_progress', 'booked', 'active', 'completed', 'cancelled')",
    },
    destinations: { type: 'jsonb', notNull: true },
    trip_type: {
      type: 'text',
      notNull: true,
      check: "trip_type IN ('solo', 'couple', 'family', 'group')",
    },
    travel_dates: { type: 'jsonb', notNull: true },
    group_size: {
      type: 'integer',
      notNull: true,
      default: 1,
    },
    budget_range: { type: 'jsonb' },
    accommodation_style: { type: 'text' },
    interests: { type: 'text[]' },
    special_requirements: { type: 'jsonb' },
    already_booked: { type: 'text' },
    notes: { type: 'text' },
    point_of_contact: { type: 'jsonb' },
    escalation_flag: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    escalation_reason: { type: 'text' },
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

  pgm.createIndex('trips', 'client_profile_id', {
    name: 'trips_client_profile_id_idx',
  });
  pgm.createIndex('trips', 'status', { name: 'trips_status_idx' });
  pgm.createIndex('trips', 'created_at', { name: 'trips_created_at_idx' });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropTable('trips');
};
