/**
 * Phase 1 Step 2: rename mvi_scores → destination_scores (table, indexes, constraints).
 *
 * Verified against outbound_dev before write:
 *   Indexes: mvi_scores_pkey, mvi_scores_geography_id_industry_vertical_uidx,
 *            mvi_scores_industry_vertical_idx, mvi_scores_overall_score_idx
 *   Constraints: mvi_scores_pkey (PK), mvi_scores_confidence_check,
 *                mvi_scores_overall_score_check, mvi_scores_geography_id_fkey
 *   No views / materialized views / inbound FKs reference mvi_scores.
 *
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE mvi_scores RENAME TO destination_scores;

    ALTER INDEX mvi_scores_pkey RENAME TO destination_scores_pkey;
    ALTER INDEX mvi_scores_geography_id_industry_vertical_uidx
      RENAME TO destination_scores_geography_id_industry_vertical_uidx;
    ALTER INDEX mvi_scores_industry_vertical_idx
      RENAME TO destination_scores_industry_vertical_idx;
    ALTER INDEX mvi_scores_overall_score_idx
      RENAME TO destination_scores_overall_score_idx;

    ALTER TABLE destination_scores
      RENAME CONSTRAINT mvi_scores_confidence_check
      TO destination_scores_confidence_check;
    ALTER TABLE destination_scores
      RENAME CONSTRAINT mvi_scores_overall_score_check
      TO destination_scores_overall_score_check;
    ALTER TABLE destination_scores
      RENAME CONSTRAINT mvi_scores_geography_id_fkey
      TO destination_scores_geography_id_fkey;
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE destination_scores
      RENAME CONSTRAINT destination_scores_geography_id_fkey
      TO mvi_scores_geography_id_fkey;
    ALTER TABLE destination_scores
      RENAME CONSTRAINT destination_scores_overall_score_check
      TO mvi_scores_overall_score_check;
    ALTER TABLE destination_scores
      RENAME CONSTRAINT destination_scores_confidence_check
      TO mvi_scores_confidence_check;

    ALTER INDEX destination_scores_overall_score_idx
      RENAME TO mvi_scores_overall_score_idx;
    ALTER INDEX destination_scores_industry_vertical_idx
      RENAME TO mvi_scores_industry_vertical_idx;
    ALTER INDEX destination_scores_geography_id_industry_vertical_uidx
      RENAME TO mvi_scores_geography_id_industry_vertical_uidx;
    ALTER INDEX destination_scores_pkey RENAME TO mvi_scores_pkey;

    ALTER TABLE destination_scores RENAME TO mvi_scores;
  `);
};
