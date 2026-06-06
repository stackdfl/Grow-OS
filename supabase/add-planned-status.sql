-- Add 'planned' status to grows table
-- Run in Supabase SQL Editor

ALTER TABLE grows DROP CONSTRAINT IF EXISTS grows_status_check;

ALTER TABLE grows
ADD CONSTRAINT grows_status_check CHECK (status IN (
  'planned','seedling','clone','veg','flower',
  'flush','harvest','drying','curing','complete','failed'
));
