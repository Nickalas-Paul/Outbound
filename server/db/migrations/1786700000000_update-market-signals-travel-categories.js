/**
 * Phase 1 Step 5: replace market_signals.signal_type CHECK with travel categories.
 *
 * Verified against outbound_dev:
 *   Constraint: market_signals_signal_type_check
 *   Table was empty after Step 3 truncate; UP still sanitizes defensively.
 *
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    -- Rename existing categories
    UPDATE market_signals SET signal_type = 'entry_policy_change' WHERE signal_type = 'regulatory_change';
    UPDATE market_signals SET signal_type = 'civil_unrest' WHERE signal_type = 'labor_unrest';

    -- Delete rows with dropped categories
    DELETE FROM market_signals WHERE signal_type IN ('tariff_risk', 'trade_agreement', 'economic_policy');

    ALTER TABLE market_signals
      DROP CONSTRAINT market_signals_signal_type_check;

    ALTER TABLE market_signals
      ADD CONSTRAINT market_signals_signal_type_check
      CHECK (signal_type = ANY (ARRAY[
        'political_instability'::text,
        'natural_disaster'::text,
        'currency_crisis'::text,
        'sanctions'::text,
        'entry_policy_change'::text,
        'civil_unrest'::text,
        'infrastructure_event'::text,
        'travel_advisory'::text,
        'health_emergency'::text,
        'extreme_weather'::text,
        'airline_disruption'::text
      ]));
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`
    -- Map new-only categories out before restoring the old CHECK
    UPDATE market_signals SET signal_type = 'regulatory_change' WHERE signal_type = 'entry_policy_change';
    UPDATE market_signals SET signal_type = 'labor_unrest' WHERE signal_type = 'civil_unrest';
    DELETE FROM market_signals
    WHERE signal_type IN (
      'travel_advisory',
      'health_emergency',
      'extreme_weather',
      'airline_disruption'
    );

    ALTER TABLE market_signals
      DROP CONSTRAINT market_signals_signal_type_check;

    ALTER TABLE market_signals
      ADD CONSTRAINT market_signals_signal_type_check
      CHECK (signal_type = ANY (ARRAY[
        'tariff_risk'::text,
        'sanctions'::text,
        'trade_agreement'::text,
        'regulatory_change'::text,
        'political_instability'::text,
        'currency_crisis'::text,
        'natural_disaster'::text,
        'economic_policy'::text,
        'labor_unrest'::text,
        'infrastructure_event'::text
      ]));
  `);
};
