-- Migration 007 — harvest reflection fields (Phase 3: End-Grow Report)
-- Run in Supabase SQL Editor
alter table harvest_reports
  add column if not exists trim_weight_g  numeric,
  add column if not exists what_worked    text,
  add column if not exists what_to_change text;
