/**
 * Phase 1 Step 4: rename destination_scores.industry_vertical → profile,
 * remap default all_industries → balanced, rename related indexes.
 *
 * Verified against outbound_dev:
 *   Indexes: destination_scores_geography_id_industry_vertical_uidx,
 *            destination_scores_industry_vertical_idx
 *   (unique index on (geography_id, industry_vertical) — not a table constraint)
 *
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE destination_scores
      RENAME COLUMN industry_vertical TO profile;

    ALTER INDEX destination_scores_geography_id_industry_vertical_uidx
      RENAME TO destination_scores_geography_id_profile_uidx;
    ALTER INDEX destination_scores_industry_vertical_idx
      RENAME TO destination_scores_profile_idx;

    ALTER TABLE destination_scores
      ALTER COLUMN profile SET DEFAULT 'balanced';

    UPDATE destination_scores
    SET profile = 'balanced'
    WHERE profile IN ('all_industries', 'all');
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`
    UPDATE destination_scores
    SET profile = 'all_industries'
    WHERE profile = 'balanced';

    ALTER TABLE destination_scores
      ALTER COLUMN profile SET DEFAULT 'all';

    ALTER INDEX destination_scores_profile_idx
      RENAME TO destination_scores_industry_vertical_idx;
    ALTER INDEX destination_scores_geography_id_profile_uidx
      RENAME TO destination_scores_geography_id_industry_vertical_uidx;

    ALTER TABLE destination_scores
      RENAME COLUMN profile TO industry_vertical;
  `);
};
