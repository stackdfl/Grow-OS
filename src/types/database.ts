// ============================================================
// Enums
// ============================================================
export type ExperienceLevel = 'hobbyist' | 'caregiver' | 'commercial' | 'breeder'
export type GeneticsType = 'indica' | 'sativa' | 'hybrid' | 'auto'
export type GrowStatus = 'planned' | 'seedling' | 'clone' | 'veg' | 'flower' | 'flush' | 'harvest' | 'drying' | 'curing' | 'complete' | 'failed'
export type CalendarEventType = 'water' | 'feed' | 'top_dress' | 'transplant' | 'top' | 'lst' | 'hst' | 'defoliate' | 'trellis' | 'flip' | 'flush_start' | 'harvest' | 'cure_start' | 'clone_take' | 'clone_transplant' | 'observation' | 'environmental_change' | 'custom'
export type EventPriority = 'low' | 'medium' | 'high' | 'critical'
export type EnvSource = 'manual' | 'ac_infinity' | 'aroya' | 'pulse' | 'grow_os'
export type RecipeDifficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert'
export type TentRole = 'veg' | 'flower' | 'both'

// ============================================================
// Profiles
// ============================================================
export interface Profile {
  id: string
  username: string
  display_name: string | null
  experience_level: ExperienceLevel | null
  location: string | null
  bio: string | null
  avatar_url: string | null
  equipment_profile: Record<string, unknown>
  email_digest_enabled: boolean
  onboarding_completed: boolean
  created_at: string
}

export interface Follow {
  id: string
  follower_id: string
  following_id: string
  created_at: string
}

// ============================================================
// Equipment Profiles
// ============================================================
export interface EquipmentProfile {
  id: string
  user_id: string
  name: string
  tent_width_ft: number | null
  tent_length_ft: number | null
  tent_height_ft: number | null
  usable_sqft: number | null
  light_type: string | null
  light_wattage: number | null
  light_brand: string | null
  medium_type: string | null
  pot_size_gal: number | null
  max_plants: number | null
  role: TentRole
  notes: string | null
  is_default: boolean
  created_at: string
}

// ============================================================
// Genetics
// ============================================================
export interface Genetics {
  id: string
  user_id: string | null
  strain_name: string
  breeder: string | null
  type: GeneticsType | null
  is_clone_only: boolean
  cut_id: string | null
  mother_id: string | null
  source: string | null
  lineage: string | null
  phenotype_notes: string | null
  thc_percentage: number | null
  terpene_profile: TerpeneEntry[]
  is_public: boolean
  created_at: string
}

export interface TerpeneEntry {
  name: string
  percentage?: number
}

// ============================================================
// Grows
// ============================================================
export interface Grow {
  id: string
  user_id: string
  name: string
  genetics_id: string | null
  equipment_profile_id: string | null
  veg_tent_id: string | null
  status: GrowStatus
  medium_type: string | null
  medium_ingredients: MediumIngredient[]
  container_size_gal: number | null
  plant_count: number
  space_label: string | null
  clone_date: string | null
  veg_start_date: string | null
  flip_date: string | null
  harvest_date: string | null
  actual_harvest_date: string | null
  env_targets: EnvTargets
  notes: string | null
  cover_photo_url: string | null
  recipe_id: string | null
  is_following_recipe: boolean
  created_at: string
  // joined
  genetics?: Genetics | null
  equipment_profile?: EquipmentProfile | null
}

export interface MediumIngredient {
  name: string
  percentage?: number
  notes?: string
}

export interface EnvTargets {
  seedling?: EnvStageTarget
  veg?: EnvStageTarget
  flower?: EnvStageTarget
  late_flower?: EnvStageTarget
  flush?: EnvStageTarget
}

export interface EnvStageTarget {
  temp_day_f?: number
  temp_night_f?: number
  rh_percent?: number
  vpd_kpa?: number
  co2_ppm?: number
  ppfd?: number
  light_hours?: number
}

// ============================================================
// Journal Entries
// ============================================================
export interface JournalEntry {
  id: string
  grow_id: string
  user_id: string
  entry_date: string
  raw_notes: string | null
  structured_data: StructuredJournalData
  photos: string[]
  watering_logged: boolean
  feeding_logged: boolean
  training_logged: boolean
  created_at: string
}

export interface StructuredJournalData {
  actions_taken?: string[]
  watering?: { logged: boolean; volume_ml?: number; ph?: number; additives?: string[] } | null
  feeding?: { logged: boolean; products?: string[] } | null
  environmental?: { temp_f?: number; rh?: number; vpd?: number; co2?: number } | null
  training?: string[]
  observations?: string[]
  concerns?: string[]
  flags?: string[]
}

// ============================================================
// Watering Logs
// ============================================================
export interface WateringLog {
  id: string
  grow_id: string
  user_id: string
  log_date: string
  volume_per_plant_ml: number | null
  ph_in: number | null
  ec_in: number | null
  additives: WateringAdditive[]
  runoff_ph: number | null
  runoff_ec: number | null
  notes: string | null
  source: 'manual' | 'ac_infinity' | 'sensor'
  created_at: string
}

export interface WateringAdditive {
  name: string
  amount?: number
  unit?: string
}

// ============================================================
// Feeding Logs
// ============================================================
export interface FeedingLog {
  id: string
  grow_id: string
  user_id: string
  log_date: string
  products: FeedingProduct[]
  total_volume_ml: number | null
  ph_in: number | null
  ec_in: number | null
  notes: string | null
  created_at: string
}

export interface FeedingProduct {
  name: string
  amount: number
  unit: string
  notes?: string
}

// ============================================================
// Calendar Events
// ============================================================
export interface CalendarEvent {
  id: string
  grow_id: string
  user_id: string
  event_date: string
  event_type: CalendarEventType
  title: string
  description: string | null
  completed: boolean
  skipped: boolean
  completion_notes: string | null
  completed_at: string | null
  is_auto_generated: boolean
  priority: EventPriority
  created_at: string
  // joined
  grow?: Pick<Grow, 'id' | 'name' | 'status'> | null
}

// ============================================================
// Environmental Readings
// ============================================================
export interface EnvReading {
  id: string
  grow_id: string | null
  tent_id: string | null
  user_id: string
  reading_time: string
  temp_f: number | null
  temp_c: number | null
  rh_percent: number | null
  vpd_kpa: number | null
  co2_ppm: number | null
  ppfd: number | null
  soil_moisture: number | null
  ph: number | null
  ec: number | null
  source: EnvSource
  raw_data: Record<string, unknown>
}

// ============================================================
// Grow OS — Tents, Device States, Schedules
// ============================================================
export interface Tent {
  id: string
  user_id: string
  grow_id: string | null
  name: string
  api_key: string
  is_online: boolean
  last_seen: string | null
  created_at: string
  // joined
  grow?: Pick<Grow, 'id' | 'name' | 'status' | 'flip_date'> | null
}

export interface DeviceState {
  id: string
  tent_id: string
  fan_speed: number
  light_level: number
  humidifier_on: boolean
  clip_fan_1_on: boolean
  clip_fan_2_on: boolean
  auto_mode: boolean
  updated_at: string
}

export interface TentSchedule {
  id: string
  tent_id: string
  lights_on: string
  lights_off: string
  sunrise_minutes: number
  sunset_minutes: number
  flower_week: number
  vpd_targets: Record<string, { min: number; max: number }>
  updated_at: string
}

// ============================================================
// Recipes
// ============================================================
export interface Recipe {
  id: string
  author_id: string
  parent_recipe_id: string | null
  fork_notes: string | null
  title: string
  description: string | null
  version: string
  genetics: RecipeGenetics
  medium: RecipeMedium
  equipment_requirements: RecipeEquipmentRequirements
  veg_weeks: number | null
  flower_weeks: number | null
  total_weeks: number | null
  difficulty: RecipeDifficulty | null
  feeding_schedule: RecipeFeedingWeek[]
  env_schedule: RecipeEnvWeek[]
  training_schedule: RecipeTrainingEvent[]
  watering_schedule: RecipeWateringWeek[]
  amendment_schedule: RecipeAmendmentWeek[]
  harvest_data: RecipeHarvestData
  ai_summary: string | null
  key_success_factors: string[] | null
  common_failure_points: string[] | null
  estimated_yield_oz_per_plant: number | null
  is_public: boolean
  is_verified: boolean
  is_lab_tested: boolean
  downloads: number
  rating_avg: number
  rating_count: number
  cover_photo_url: string | null
  tags: string[]
  created_at: string
  updated_at: string
  // joined
  author?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>
}

export interface RecipeGenetics {
  strain?: string
  breeder?: string
  cut_id?: string
  source?: 'clone' | 'seed'
  is_clone_only?: boolean
  phenotype_notes?: string
}

export interface RecipeMedium {
  type?: string
  ingredients?: Array<{ name: string; percentage?: number }>
  cook_time_days?: number
  amendment_notes?: string
}

export interface RecipeEquipmentRequirements {
  min_sqft?: number
  recommended_sqft?: number
  light_type?: string
  min_ppfd?: number
  container_size_gal?: number
  fans?: string
  dehumidifier?: boolean
  ac?: boolean
  controller?: string
}

export interface RecipeFeedingWeek {
  week: number
  stage: string
  products: Array<{ name: string; amount: number; unit: string; frequency: string; notes?: string }>
}

export interface RecipeEnvWeek {
  week: number
  stage: string
  temp_day_f?: number
  temp_night_f?: number
  rh_percent?: number
  vpd_kpa?: number
  ppfd?: number
  light_hours?: number
}

export interface RecipeTrainingEvent {
  day_from_flip: number
  event_type: string
  description: string
  photos_recommended?: boolean
}

export interface RecipeWateringWeek {
  week: number
  frequency_days: number
  volume_per_plant_ml?: number
  ph_target?: number
  ec_target?: number
  notes?: string
}

export interface RecipeAmendmentWeek {
  flower_week: number
  type: string
  products: Array<{ name: string; amount: number; unit: string }>
  notes?: string
}

export interface RecipeHarvestData {
  flower_days?: number
  flush_days?: number
  trichome_target?: string
  final_yield_oz?: number
  thc_pct?: number
  dry_temp_f?: number
  dry_rh_percent?: number
  cure_duration_days?: number
}

// ============================================================
// Recipe Reviews
// ============================================================
export interface RecipeReview {
  id: string
  recipe_id: string
  user_id: string
  rating: number | null
  review_text: string | null
  yield_achieved_oz: number | null
  verified_grow: boolean
  created_at: string
  // joined
  profile?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>
}

// ============================================================
// Recipe Saves (personal library)
// ============================================================
export interface RecipeSave {
  id: string
  user_id: string
  recipe_id: string
  saved_at: string
  recipe?: Recipe
}

// ============================================================
// Harvest Reports
// ============================================================
export interface HarvestReport {
  id: string
  grow_id: string
  user_id: string
  harvest_date: string | null
  wet_weight_g: number | null
  dry_weight_g: number | null
  trim_weight_g: number | null
  what_worked: string | null
  what_to_change: string | null
  cure_start_date: string | null
  cure_end_date: string | null
  thc_percentage: number | null
  cbd_percentage: number | null
  terpene_percentages: Record<string, number>
  lab_results_url: string | null
  aroma_notes: string | null
  effect_notes: string | null
  overall_rating: number | null
  would_grow_again: boolean | null
  notes: string | null
  photos: string[]
  created_at: string
}

// ============================================================
// Supabase Database type map
// ============================================================
export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Omit<Profile, 'created_at'>; Update: Partial<Omit<Profile, 'id' | 'created_at'>> }
      equipment_profiles: { Row: EquipmentProfile; Insert: Omit<EquipmentProfile, 'id' | 'created_at'>; Update: Partial<Omit<EquipmentProfile, 'id' | 'user_id' | 'created_at'>> }
      genetics: { Row: Genetics; Insert: Omit<Genetics, 'id' | 'created_at'>; Update: Partial<Omit<Genetics, 'id' | 'created_at'>> }
      grows: { Row: Grow; Insert: Omit<Grow, 'id' | 'created_at' | 'genetics' | 'equipment_profile'>; Update: Partial<Omit<Grow, 'id' | 'user_id' | 'created_at' | 'genetics' | 'equipment_profile'>> }
      journal_entries: { Row: JournalEntry; Insert: Omit<JournalEntry, 'id' | 'created_at'>; Update: Partial<Omit<JournalEntry, 'id' | 'grow_id' | 'user_id' | 'created_at'>> }
      watering_logs: { Row: WateringLog; Insert: Omit<WateringLog, 'id' | 'created_at'>; Update: Partial<Omit<WateringLog, 'id' | 'grow_id' | 'user_id' | 'created_at'>> }
      feeding_logs: { Row: FeedingLog; Insert: Omit<FeedingLog, 'id' | 'created_at'>; Update: Partial<Omit<FeedingLog, 'id' | 'grow_id' | 'user_id' | 'created_at'>> }
      calendar_events: { Row: CalendarEvent; Insert: Omit<CalendarEvent, 'id' | 'created_at' | 'grow'>; Update: Partial<Omit<CalendarEvent, 'id' | 'grow_id' | 'user_id' | 'created_at' | 'grow'>> }
      env_readings: { Row: EnvReading; Insert: Omit<EnvReading, 'id'>; Update: Partial<Omit<EnvReading, 'id' | 'grow_id' | 'user_id'>> }
      recipes: { Row: Recipe; Insert: Omit<Recipe, 'id' | 'created_at' | 'updated_at' | 'author' | 'downloads' | 'rating_avg' | 'rating_count'>; Update: Partial<Omit<Recipe, 'id' | 'author_id' | 'created_at' | 'updated_at' | 'author'>> }
      recipe_reviews: { Row: RecipeReview; Insert: Omit<RecipeReview, 'id' | 'created_at' | 'profile'>; Update: Partial<Omit<RecipeReview, 'id' | 'recipe_id' | 'user_id' | 'created_at' | 'profile'>> }
      recipe_saves: { Row: RecipeSave; Insert: Omit<RecipeSave, 'id' | 'saved_at' | 'recipe'>; Update: never }
      harvest_reports: { Row: HarvestReport; Insert: Omit<HarvestReport, 'id' | 'created_at'>; Update: Partial<Omit<HarvestReport, 'id' | 'grow_id' | 'user_id' | 'created_at'>> }
      tents: { Row: Tent; Insert: Omit<Tent, 'id' | 'created_at' | 'grow'>; Update: Partial<Omit<Tent, 'id' | 'user_id' | 'created_at' | 'grow'>> }
      device_states: { Row: DeviceState; Insert: Omit<DeviceState, 'id' | 'updated_at'>; Update: Partial<Omit<DeviceState, 'id' | 'tent_id'>> }
      tent_schedules: { Row: TentSchedule; Insert: Omit<TentSchedule, 'id' | 'updated_at'>; Update: Partial<Omit<TentSchedule, 'id' | 'tent_id'>> }
    }
  }
}
