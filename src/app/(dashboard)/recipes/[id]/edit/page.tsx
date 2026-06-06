import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RecipeEditor } from '@/components/recipes/recipe-editor'
import type { Recipe } from '@/types/database'

export default async function RecipeEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params
  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', id)
    .eq('author_id', user.id) // only owner can edit
    .single()

  if (error || !data) notFound()

  return <RecipeEditor recipe={data as unknown as Recipe} />
}
