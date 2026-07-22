import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PipelineClient } from '@/components/pipeline/pipeline-client'
import type { CalibrationData, GeneticsOutcome } from '@/lib/calibration/engine'
import type { EquipmentProfile, Grow, Genetics } from '@/types/database'

export default async function PipelinePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [equipResult, growsResult, geneticsResult, calibrationResult] = await Promise.all([
    supabase
      .from('equipment_profiles')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at'),
    supabase
      .from('grows')
      .select('*, genetics(*)')
      .eq('user_id', user.id)
      .neq('status', 'failed')
      .order('clone_date', { ascending: true, nullsFirst: false }),
    supabase
      .from('genetics')
      .select('*')
      .or(`user_id.eq.${user.id},is_public.eq.true`)
      .order('strain_name'),
    supabase
      .from('user_calibrations')
      .select('calibration_data')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  const calData = (calibrationResult.data as { calibration_data: CalibrationData } | null)?.calibration_data
  const geneticsHistory: GeneticsOutcome[] = calData?.genetics_history ?? []

  return (
    <PipelineClient
      equipment={(equipResult.data ?? []) as EquipmentProfile[]}
      grows={(growsResult.data ?? []) as Grow[]}
      allGenetics={(geneticsResult.data ?? []) as Genetics[]}
      geneticsHistory={geneticsHistory}
    />
  )
}
