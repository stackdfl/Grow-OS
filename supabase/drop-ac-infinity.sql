-- Drop AC Infinity columns from equipment_profiles
-- Run this before grow-os-schema.sql

alter table equipment_profiles
  drop column if exists ac_infinity_device_id,
  drop column if exists ac_infinity_email,
  drop column if exists ac_infinity_token,
  drop column if exists controller_type;
