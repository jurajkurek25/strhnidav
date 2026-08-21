-- Records the explicit checkout-time consent required to rely on the
-- digital-content withdrawal-right exception (zákon č. 102/2014 Z. z.,
-- § 7 ods. 6 písm. l)) — see čl. 6 Obchodných podmienok. Nullable because
-- payments created before this migration won't have it.
alter table payments add column withdrawal_consent_at timestamptz;
