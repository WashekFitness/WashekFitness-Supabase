/*
 * WASHEK FITNESS
 * Migration 014 — Fix automatic program calendar-week calculation
 *
 * Problem:
 * get_current_program_week() previously capped the calendar week by
 * workout_programs.current_week. That makes the function return the
 * already-generated week instead of the actual calendar week, so the
 * frontend never sees that a new week is due.
 *
 * Example:
 *   current_week = 1
 *   program created in week 1
 *   current calendar week = 3
 *
 * The old function could return 1, so automatic Week 2 generation
 * never started.
 *
 * Fix:
 * Return the calendar week based on the program's created_at timestamp.
 * current_week remains the "highest successfully generated/available"
 * week and is NOT used to calculate the calendar target.
 */

create or replace function public.get_current_program_week(
  p_program_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  program_row public.workout_programs%rowtype;
  calendar_week integer;
begin
  /*
   * Only the owner of the program may ask for its calendar week.
   */
  select *
  into program_row
  from public.workout_programs
  where id = p_program_id
    and user_id = auth.uid()
  limit 1;

  if not found then
    raise exception 'Program not found or access denied.';
  end if;

  /*
   * Week 1 begins in the calendar week containing the program's
   * creation timestamp. Each following Monday starts the next week.
   *
   * date_trunc('week', ...) uses PostgreSQL's Monday-based week
   * boundary, which matches the app's weekly program model.
   */
  calendar_week :=
    greatest(
      1,
      (
        extract(
          epoch from (
            date_trunc('week', now())
            - date_trunc('week', program_row.created_at)
          )
        ) / 604800
      )::integer + 1
    );

  /*
   * Do not allow the calendar target to exceed the program duration.
   * This prevents generation requests beyond the end of the program.
   */
  calendar_week :=
    least(
      calendar_week,
      greatest(
        1,
        coalesce(program_row.duration_weeks, 12)
      )
    );

  return calendar_week;
end;
$$;

revoke all on function public.get_current_program_week(uuid)
  from public, anon;

grant execute on function public.get_current_program_week(uuid)
  to authenticated;
