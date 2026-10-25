-- VoteLift (Lift Apps): live presentations on the shared Supabase project.
-- Only creates objects prefixed live_; other apps' tables are untouched. Safe to re-run.
--
-- Access model: every table is closed (RLS on, no grants). Presenters (signed in) and the
-- audience (anonymous, identified by a random voter uuid kept in their browser) go through the
-- security-definer functions below, which check ownership, the current slide and each vote.
--
-- Load: votes, questions and reactions are plain RPC inserts (no Realtime fan-out). The presenter
-- pulls only new rows once a second; the audience follows slide changes over a Realtime broadcast
-- with a slow poll as the fallback. That keeps 100 participants well inside the Free plan quotas.

create extension if not exists pgcrypto;

create table if not exists public.live_presentations (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users (id) on delete cascade,
  code text not null unique,
  title text not null default '',
  slides jsonb not null default '[]',
  settings jsonb not null default '{}',
  state jsonb not null default '{}',
  session int not null default 1,
  template text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists live_presentations_owner on public.live_presentations (owner, updated_at desc);

create table if not exists public.live_participants (
  presentation_id uuid not null references public.live_presentations (id) on delete cascade,
  session int not null,
  voter uuid not null,
  name text not null default '',
  joined_at timestamptz not null default now(),
  seen_at timestamptz not null default now(),
  primary key (presentation_id, session, voter)
);

create table if not exists public.live_responses (
  id bigint generated always as identity primary key,
  presentation_id uuid not null references public.live_presentations (id) on delete cascade,
  session int not null,
  slide_id text not null,
  voter uuid not null,
  entry smallint not null default 0,
  value jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  unique (presentation_id, session, slide_id, voter, entry)
);
create index if not exists live_responses_feed on public.live_responses (presentation_id, session, slide_id, id);

create table if not exists public.live_questions (
  id bigint generated always as identity primary key,
  presentation_id uuid not null references public.live_presentations (id) on delete cascade,
  session int not null,
  slide_id text not null,
  voter uuid not null,
  text text not null,
  upvotes int not null default 0,
  answered boolean not null default false,
  hidden boolean not null default false,
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists live_questions_slide on public.live_questions (presentation_id, session, slide_id);

create table if not exists public.live_question_votes (
  question_id bigint not null references public.live_questions (id) on delete cascade,
  voter uuid not null,
  primary key (question_id, voter)
);

create table if not exists public.live_reactions (
  id bigint generated always as identity primary key,
  presentation_id uuid not null references public.live_presentations (id) on delete cascade,
  session int not null,
  voter uuid not null,
  kind text not null,
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists live_reactions_feed on public.live_reactions (presentation_id, id);

alter table public.live_presentations enable row level security;
alter table public.live_participants enable row level security;
alter table public.live_responses enable row level security;
alter table public.live_questions enable row level security;
alter table public.live_question_votes enable row level security;
alter table public.live_reactions enable row level security;
revoke all on public.live_presentations, public.live_participants, public.live_responses,
  public.live_questions, public.live_question_votes, public.live_reactions from anon, authenticated;

-- ───────────────────────── helpers (not callable by clients) ─────────────────────────

create or replace function public.live_now_ms() returns bigint language sql stable as $$
  select (extract(epoch from clock_timestamp()) * 1000)::bigint
$$;

-- The presentation, if the signed-in user owns it.
create or replace function public.live_owned(p_id uuid) returns public.live_presentations
language plpgsql stable security definer set search_path = public as $$
declare p live_presentations;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into p from live_presentations where id = p_id and owner = auth.uid();
  if not found then raise exception 'presentation not found'; end if;
  return p;
end $$;

create or replace function public.live_new_code() returns text language plpgsql volatile as $$
declare c text;
begin
  loop
    c := (10000000 + floor(random() * 90000000))::bigint::text;
    exit when not exists (select 1 from live_presentations where code = c);
  end loop;
  return c;
end $$;

-- Slides as the audience may see them: no quiz answers or speaker notes.
create or replace function public.live_public_slides(p_slides jsonb) returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(s - 'correct' - 'notes' order by ord), '[]'::jsonb)
  from jsonb_array_elements(p_slides) with ordinality as t(s, ord)
$$;

create or replace function public.live_slide(p_slides jsonb, p_slide text) returns jsonb language sql immutable as $$
  select s from jsonb_array_elements(p_slides) s where s->>'id' = p_slide limit 1
$$;

-- Quiz points per participant for the current session. Speed scoring: a correct answer is worth
-- 1000 at once, falling linearly to 500 at the time limit, measured on the server clock.
create or replace function public.live_quiz_points(p_id uuid)
returns table (voter uuid, name text, score int, last_points int, last_correct boolean)
language sql stable security definer set search_path = public as $$
  with p as (select * from live_presentations where id = p_id),
  q as (
    select s->>'id' as sid, (s->>'correct')::int as correct, greatest(coalesce((s->>'time')::int, 20), 1) as secs,
           (p.state->'quiz'->>(s->>'id'))::bigint as started, ord
    from p, jsonb_array_elements(p.slides) with ordinality as t(s, ord)
    where s->>'type' = 'quiz' and p.state->'quiz' ? (s->>'id')
  ),
  pts as (
    select r.voter, q.ord,
      (r.value->>'choice')::int = q.correct as correct,
      case when (r.value->>'choice')::int = q.correct
        then round(1000 * (1 - least(greatest(extract(epoch from r.created_at) * 1000 - q.started, 0) / (q.secs * 1000.0), 1) / 2))::int
        else 0 end as points
    from live_responses r join q on q.sid = r.slide_id, p
    where r.presentation_id = p_id and r.session = p.session
  ),
  last_q as (select max(ord) as ord from q)
  select pa.voter, pa.name,
    coalesce((select sum(points) from pts where pts.voter = pa.voter), 0)::int,
    coalesce((select points from pts, last_q where pts.voter = pa.voter and pts.ord = last_q.ord), 0),
    coalesce((select correct from pts, last_q where pts.voter = pa.voter and pts.ord = last_q.ord), false)
  from live_participants pa, p
  where pa.presentation_id = p_id and pa.session = p.session
$$;

-- ───────────────────────── presenter (signed in) ─────────────────────────

create or replace function public.live_list() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'code', p.code, 'title', p.title, 'template', p.template,
    'slides', jsonb_array_length(p.slides),
    'types', (select coalesce(jsonb_agg(s->>'type'), '[]') from jsonb_array_elements(p.slides) s),
    'created_at', p.created_at, 'updated_at', p.updated_at, 'session', p.session,
    'participants', (select count(*) from live_participants a where a.presentation_id = p.id and a.session = p.session),
    'responses', (select count(*) from live_responses r where r.presentation_id = p.id)
  ) order by p.updated_at desc), '[]'::jsonb)
  from live_presentations p where p.owner = auth.uid()
$$;

create or replace function public.live_create(p_title text, p_slides jsonb, p_settings jsonb, p_template text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r live_presentations;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if jsonb_typeof(p_slides) <> 'array' or octet_length(p_slides::text) > 400000 then raise exception 'invalid slides'; end if;
  insert into live_presentations (owner, code, title, slides, settings, template, state)
  values (auth.uid(), live_new_code(), left(coalesce(p_title, ''), 120), p_slides, coalesce(p_settings, '{}'), left(coalesce(p_template, ''), 40),
          jsonb_build_object('slide', p_slides->0->>'id', 'results', true))
  returning * into r;
  return jsonb_build_object('id', r.id, 'code', r.code);
end $$;

create or replace function public.live_get(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p live_presentations;
begin
  p := live_owned(p_id);
  return to_jsonb(p) - 'owner';
end $$;

create or replace function public.live_save(p_id uuid, p_title text, p_slides jsonb, p_settings jsonb) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare p live_presentations;
begin
  p := live_owned(p_id);
  if jsonb_typeof(p_slides) <> 'array' or jsonb_array_length(p_slides) > 200 or octet_length(p_slides::text) > 400000 then
    raise exception 'invalid slides';
  end if;
  update live_presentations set title = left(coalesce(p_title, ''), 120), slides = p_slides,
    settings = coalesce(p_settings, settings), updated_at = now()
  where id = p_id returning updated_at into p.updated_at;
  return p.updated_at;
end $$;

create or replace function public.live_delete(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform live_owned(p_id);
  delete from live_presentations where id = p_id;
end $$;

create or replace function public.live_duplicate(p_id uuid, p_title text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p live_presentations; r live_presentations;
begin
  p := live_owned(p_id);
  insert into live_presentations (owner, code, title, slides, settings, template, state)
  values (auth.uid(), live_new_code(), left(coalesce(p_title, p.title), 120), p.slides, p.settings, p.template,
          jsonb_build_object('slide', p.slides->0->>'id', 'results', true))
  returning * into r;
  return jsonb_build_object('id', r.id, 'code', r.code);
end $$;

-- Patch the live state: { slide, results, locked, ... }. Special keys handled on the server clock:
--   startQuiz: slideId → records the start time for that quiz question
--   reveal: slideId    → reveals the correct answer to the audience
create or replace function public.live_set_state(p_id uuid, p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p live_presentations; s jsonb;
begin
  p := live_owned(p_id);
  s := p.state || (coalesce(p_patch, '{}') - 'startQuiz' - 'reveal' - 'quiz');
  if p_patch ? 'startQuiz' then
    s := jsonb_set(s, '{quiz}', coalesce(s->'quiz', '{}') || jsonb_build_object(p_patch->>'startQuiz', live_now_ms()));
    s := jsonb_set(s, '{reveal}', coalesce(s->'reveal', '{}') - (p_patch->>'startQuiz'));
    delete from live_responses where presentation_id = p_id and session = p.session and slide_id = p_patch->>'startQuiz';
  end if;
  if p_patch ? 'reveal' then
    s := jsonb_set(s, '{reveal}', coalesce(s->'reveal', '{}') || jsonb_build_object(p_patch->>'reveal', true));
  end if;
  update live_presentations set state = s where id = p_id;
  return s || jsonb_build_object('now', live_now_ms());
end $$;

-- Clear all results by starting a new session; old responses stay for the export.
create or replace function public.live_reset(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p live_presentations;
begin
  p := live_owned(p_id);
  update live_presentations set session = session + 1, state = (state - 'quiz' - 'reveal') || jsonb_build_object('locked', false)
  where id = p_id returning * into p;
  return jsonb_build_object('session', p.session, 'state', p.state);
end $$;

-- What the presenter screen needs, incrementally: new responses for one slide after p_after,
-- the slide's questions, new reactions after p_reaction_after and the participant count.
create or replace function public.live_results(p_id uuid, p_slide text, p_after bigint, p_reaction_after bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p live_presentations; slide jsonb;
begin
  p := live_owned(p_id);
  slide := live_slide(p.slides, p_slide);
  return jsonb_build_object(
    'session', p.session,
    'now', live_now_ms(),
    'participants', (select count(*) from live_participants where presentation_id = p_id and session = p.session),
    'responses', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'voter', voter, 'entry', entry, 'value', value,
                    'at', (extract(epoch from created_at) * 1000)::bigint) order by id), '[]')
                  from (select * from live_responses where presentation_id = p_id and session = p.session
                        and slide_id = p_slide and id > coalesce(p_after, 0) order by id limit 3000) r),
    'questions', case when slide->>'type' = 'qa' then
                   (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'text', text, 'upvotes', upvotes, 'answered', answered,
                      'hidden', hidden, 'at', (extract(epoch from created_at) * 1000)::bigint) order by id), '[]')
                    from live_questions where presentation_id = p_id and session = p.session and slide_id = p_slide)
                 else '[]'::jsonb end,
    'reactions', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'kind', kind) order by id), '[]')
                  from (select * from live_reactions where presentation_id = p_id and id > coalesce(p_reaction_after, 0)
                        and created_at > now() - interval '20 seconds' order by id limit 200) x),
    'reactionHead', (select coalesce(max(id), 0) from live_reactions where presentation_id = p_id),
    'leaderboard', case when slide->>'type' in ('quiz', 'leaderboard') then
                     (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'score', score, 'last', last_points) order by score desc, name), '[]')
                      from (select * from live_quiz_points(p_id) order by score desc, name limit 10) l)
                   else null end,
    'players', case when slide->>'type' in ('quiz', 'leaderboard') then
                 (select count(*) from live_participants where presentation_id = p_id and session = p.session) else null end
  );
end $$;

create or replace function public.live_moderate(p_id uuid, p_question bigint, p_action text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform live_owned(p_id);
  if p_action = 'answer' then update live_questions set answered = true where id = p_question and presentation_id = p_id;
  elsif p_action = 'unanswer' then update live_questions set answered = false where id = p_question and presentation_id = p_id;
  elsif p_action = 'hide' then update live_questions set hidden = true where id = p_question and presentation_id = p_id;
  elsif p_action = 'show' then update live_questions set hidden = false where id = p_question and presentation_id = p_id;
  elsif p_action = 'delete' then delete from live_questions where id = p_question and presentation_id = p_id;
  else raise exception 'unknown action'; end if;
end $$;

-- Everything from one session (default: the current one) for the results page and CSV export.
create or replace function public.live_export(p_id uuid, p_session int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p live_presentations; s int;
begin
  p := live_owned(p_id);
  s := coalesce(p_session, p.session);
  return jsonb_build_object(
    'session', s, 'sessions', p.session,
    'participants', (select coalesce(jsonb_agg(jsonb_build_object('voter', voter, 'name', name, 'joined', joined_at) order by joined_at), '[]')
                     from live_participants where presentation_id = p_id and session = s),
    'responses', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'slide', slide_id, 'voter', voter, 'entry', entry, 'value', value,
                    'at', (extract(epoch from created_at) * 1000)::bigint) order by id), '[]')
                  from live_responses where presentation_id = p_id and session = s),
    'questions', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'slide', slide_id, 'text', text, 'upvotes', upvotes,
                    'answered', answered, 'hidden', hidden) order by id), '[]')
                  from live_questions where presentation_id = p_id and session = s),
    'leaderboard', case when s = p.session then
                     (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'score', score) order by score desc), '[]') from live_quiz_points(p_id))
                   else '[]'::jsonb end
  );
end $$;

-- ───────────────────────── audience (anonymous) ─────────────────────────

create or replace function public.live_join(p_code text, p_voter uuid, p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p live_presentations;
begin
  select * into p from live_presentations where code = regexp_replace(coalesce(p_code, ''), '\D', '', 'g');
  if not found then raise exception 'code not found'; end if;
  insert into live_participants (presentation_id, session, voter, name)
  values (p.id, p.session, p_voter, left(coalesce(p_name, ''), 30))
  on conflict (presentation_id, session, voter) do update
    set seen_at = now(), name = case when coalesce(p_name, '') <> '' then left(p_name, 30) else live_participants.name end;
  return jsonb_build_object(
    'id', p.id, 'code', p.code, 'title', p.title, 'settings', p.settings, 'session', p.session,
    'slides', live_public_slides(p.slides), 'state', p.state, 'version', (extract(epoch from p.updated_at) * 1000)::bigint,
    'now', live_now_ms(),
    'name', (select name from live_participants where presentation_id = p.id and session = p.session and voter = p_voter),
    'mine', (select coalesce(jsonb_agg(jsonb_build_object('slide', slide_id, 'entry', entry, 'value', value)), '[]')
             from live_responses where presentation_id = p.id and session = p.session and voter = p_voter)
  );
end $$;

-- The fallback poll: current state and whether the slides changed since the audience loaded them.
create or replace function public.live_poll(p_id uuid, p_voter uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p live_presentations;
begin
  select * into p from live_presentations where id = p_id;
  if not found then raise exception 'presentation not found'; end if;
  update live_participants set seen_at = now() where presentation_id = p_id and session = p.session and voter = p_voter;
  return jsonb_build_object('state', p.state, 'session', p.session, 'version', (extract(epoch from p.updated_at) * 1000)::bigint, 'now', live_now_ms());
end $$;

create or replace function public.live_respond(p_id uuid, p_voter uuid, p_slide text, p_value jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p live_presentations; s jsonb; t text; n int; e int; mx int; v jsonb; i int; total int; started bigint; secs int;
begin
  select * into p from live_presentations where id = p_id;
  if not found then raise exception 'presentation not found'; end if;
  if p_voter is null then raise exception 'missing voter'; end if;
  if p.state->>'slide' is distinct from p_slide then raise exception 'This question is closed'; end if;
  if coalesce((p.state->>'locked')::boolean, false) then raise exception 'Voting is closed'; end if;
  s := live_slide(p.slides, p_slide);
  if s is null then raise exception 'slide not found'; end if;
  t := s->>'type';
  insert into live_participants (presentation_id, session, voter) values (p_id, p.session, p_voter)
  on conflict do nothing;
  e := 0;

  if t = 'mc' then
    n := jsonb_array_length(coalesce(s->'options', '[]'));
    v := p_value->'choices';
    if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) = 0 then raise exception 'Pick an option'; end if;
    if not coalesce((s->>'multiple')::boolean, false) and jsonb_array_length(v) <> 1 then raise exception 'Pick one option'; end if;
    if (select count(distinct x) from jsonb_array_elements_text(v) x) <> jsonb_array_length(v) then raise exception 'invalid choice'; end if;
    if exists (select 1 from jsonb_array_elements(v) x where jsonb_typeof(x) <> 'number' or (x::text)::int < 0 or (x::text)::int >= n) then
      raise exception 'invalid choice'; end if;
    p_value := jsonb_build_object('choices', v);

  elsif t = 'quiz' then
    n := jsonb_array_length(coalesce(s->'options', '[]'));
    started := (p.state->'quiz'->>p_slide)::bigint;
    secs := greatest(coalesce((s->>'time')::int, 20), 1);
    if started is null then raise exception 'The question has not started yet'; end if;
    if live_now_ms() > started + secs * 1000 + 1500 or coalesce((p.state->'reveal'->>p_slide)::boolean, false) then
      raise exception 'Time is up'; end if;
    i := (p_value->>'choice')::int;
    if i is null or i < 0 or i >= n then raise exception 'invalid choice'; end if;
    p_value := jsonb_build_object('choice', i);

  elsif t in ('wordcloud', 'open') then
    mx := least(greatest(coalesce((s->>'maxEntries')::int, case when t = 'wordcloud' then 3 else 1 end), 1), 10);
    v := to_jsonb(btrim(coalesce(p_value->>'text', '')));
    if v #>> '{}' = '' then raise exception 'Write something first'; end if;
    if char_length(v #>> '{}') > (case when t = 'wordcloud' then 25 else 250 end) then raise exception 'Too long'; end if;
    select count(*) into e from live_responses where presentation_id = p_id and session = p.session and slide_id = p_slide and voter = p_voter;
    if e >= mx then raise exception 'You have already answered'; end if;
    p_value := jsonb_build_object('text', v);

  elsif t = 'scales' then
    n := jsonb_array_length(coalesce(s->'statements', '[]'));
    v := p_value->'ratings';
    if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) <> n then raise exception 'invalid ratings'; end if;
    if exists (select 1 from jsonb_array_elements(v) x where jsonb_typeof(x) not in ('number', 'null')
               or (jsonb_typeof(x) = 'number' and ((x::text)::int < coalesce((s->>'min')::int, 1) or (x::text)::int > coalesce((s->>'max')::int, 5)))) then
      raise exception 'invalid ratings'; end if;
    if not exists (select 1 from jsonb_array_elements(v) x where jsonb_typeof(x) = 'number') then raise exception 'Rate at least one statement'; end if;
    p_value := jsonb_build_object('ratings', v);

  elsif t = 'ranking' then
    n := jsonb_array_length(coalesce(s->'items', '[]'));
    v := p_value->'order';
    if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) <> n
       or (select count(distinct x) from jsonb_array_elements_text(v) x) <> n
       or exists (select 1 from jsonb_array_elements(v) x where jsonb_typeof(x) <> 'number' or (x::text)::int < 0 or (x::text)::int >= n) then
      raise exception 'invalid ranking'; end if;
    p_value := jsonb_build_object('order', v);

  elsif t = 'points' then
    n := jsonb_array_length(coalesce(s->'items', '[]'));
    v := p_value->'points';
    if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) <> n
       or exists (select 1 from jsonb_array_elements(v) x where jsonb_typeof(x) <> 'number' or (x::text)::int < 0) then
      raise exception 'invalid points'; end if;
    select sum((x::text)::int) into total from jsonb_array_elements(v) x;
    if total = 0 or total > coalesce((s->>'total')::int, 100) then raise exception 'Distribute up to % points', coalesce((s->>'total')::int, 100); end if;
    p_value := jsonb_build_object('points', v);

  else
    raise exception 'This slide takes no answers';
  end if;

  begin
    insert into live_responses (presentation_id, session, slide_id, voter, entry, value)
    values (p_id, p.session, p_slide, p_voter, e, p_value);
  exception when unique_violation then
    raise exception 'You have already answered';
  end;
  return jsonb_build_object('ok', true, 'entry', e, 'value', p_value);
end $$;

create or replace function public.live_ask(p_id uuid, p_voter uuid, p_slide text, p_text text) returns bigint
language plpgsql security definer set search_path = public as $$
declare p live_presentations; s jsonb; qid bigint; recent int;
begin
  select * into p from live_presentations where id = p_id;
  if not found then raise exception 'presentation not found'; end if;
  s := live_slide(p.slides, p_slide);
  if s is null or s->>'type' <> 'qa' then raise exception 'Questions are closed'; end if;
  if coalesce((p.state->>'locked')::boolean, false) and p.state->>'slide' = p_slide then raise exception 'Questions are closed'; end if;
  if char_length(btrim(coalesce(p_text, ''))) = 0 or char_length(p_text) > 280 then raise exception 'Write a question (up to 280 characters)'; end if;
  select count(*) into recent from live_questions where presentation_id = p_id and voter = p_voter and created_at > now() - interval '10 seconds';
  if recent > 0 then raise exception 'Please wait a few seconds before asking again'; end if;
  insert into live_participants (presentation_id, session, voter) values (p_id, p.session, p_voter) on conflict do nothing;
  insert into live_questions (presentation_id, session, slide_id, voter, text)
  values (p_id, p.session, p_slide, p_voter, btrim(p_text)) returning id into qid;
  return qid;
end $$;

create or replace function public.live_upvote(p_id uuid, p_voter uuid, p_question bigint) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not exists (select 1 from live_questions where id = p_question and presentation_id = p_id) then raise exception 'question not found'; end if;
  begin
    insert into live_question_votes (question_id, voter) values (p_question, p_voter);
    update live_questions set upvotes = upvotes + 1 where id = p_question returning upvotes into n;
  exception when unique_violation then
    delete from live_question_votes where question_id = p_question and voter = p_voter;
    update live_questions set upvotes = greatest(upvotes - 1, 0) where id = p_question returning upvotes into n;
  end;
  return n;
end $$;

create or replace function public.live_questions_public(p_id uuid, p_slide text, p_voter uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'text', q.text, 'upvotes', q.upvotes, 'answered', q.answered,
           'mine', q.voter = p_voter,
           'voted', exists (select 1 from live_question_votes v where v.question_id = q.id and v.voter = p_voter))
         order by q.upvotes desc, q.id desc), '[]')
  from live_questions q join live_presentations p on p.id = q.presentation_id and p.session = q.session
  where q.presentation_id = p_id and q.slide_id = p_slide and not q.hidden
$$;

-- Results shown on phones after voting, when the presenter allows it.
create or replace function public.live_audience_results(p_id uuid, p_slide text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p live_presentations; s jsonb; n int;
begin
  select * into p from live_presentations where id = p_id;
  if not found then raise exception 'presentation not found'; end if;
  s := live_slide(p.slides, p_slide);
  if s is null then return null; end if;
  if s->>'type' = 'mc' then
    if coalesce((p.settings->>'phoneResults')::boolean, true) = false or coalesce((p.state->>'results')::boolean, true) = false then return null; end if;
    n := jsonb_array_length(coalesce(s->'options', '[]'));
    return jsonb_build_object('counts', (
      select jsonb_agg((select count(*) from live_responses r, jsonb_array_elements(r.value->'choices') c
                        where r.presentation_id = p_id and r.session = p.session and r.slide_id = p_slide and (c::text)::int = i) order by i)
      from generate_series(0, n - 1) i));
  elsif s->>'type' = 'quiz' and coalesce((p.state->'reveal'->>p_slide)::boolean, false) then
    n := jsonb_array_length(coalesce(s->'options', '[]'));
    return jsonb_build_object('correct', (s->>'correct')::int, 'counts', (
      select jsonb_agg((select count(*) from live_responses r where r.presentation_id = p_id and r.session = p.session
                        and r.slide_id = p_slide and (r.value->>'choice')::int = i) order by i)
      from generate_series(0, n - 1) i));
  end if;
  return null;
end $$;

-- One participant's quiz standing: total score, rank and the last question's result.
create or replace function public.live_my_quiz(p_id uuid, p_voter uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  with s as (select * from live_quiz_points(p_id)),
  me as (select * from s where voter = p_voter)
  select jsonb_build_object(
    'score', coalesce((select score from me), 0),
    'last', coalesce((select last_points from me), 0),
    'correct', coalesce((select last_correct from me), false),
    'rank', (select count(*) + 1 from s where s.score > coalesce((select score from me), 0)),
    'players', (select count(*) from s))
$$;

create or replace function public.live_react(p_id uuid, p_voter uuid, p_kind text) returns void
language plpgsql security definer set search_path = public as $$
declare p live_presentations;
begin
  if p_kind not in ('heart', 'like', 'laugh', 'wow', 'clap') then raise exception 'unknown reaction'; end if;
  select * into p from live_presentations where id = p_id;
  if not found then raise exception 'presentation not found'; end if;
  if exists (select 1 from live_reactions where presentation_id = p_id and voter = p_voter and created_at > now() - interval '700 milliseconds') then
    return;
  end if;
  insert into live_reactions (presentation_id, session, voter, kind) values (p_id, p.session, p_voter, p_kind);
end $$;

-- ───────────────────────── permissions ─────────────────────────

-- Only live_ functions are touched here; other apps' functions keep their existing grants.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'live\_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

grant execute on function public.live_list(), public.live_create(text, jsonb, jsonb, text), public.live_get(uuid),
  public.live_save(uuid, text, jsonb, jsonb), public.live_delete(uuid), public.live_duplicate(uuid, text),
  public.live_set_state(uuid, jsonb), public.live_reset(uuid), public.live_results(uuid, text, bigint, bigint),
  public.live_moderate(uuid, bigint, text), public.live_export(uuid, int)
  to authenticated;

grant execute on function public.live_join(text, uuid, text), public.live_poll(uuid, uuid),
  public.live_respond(uuid, uuid, text, jsonb), public.live_ask(uuid, uuid, text, text), public.live_upvote(uuid, uuid, bigint),
  public.live_questions_public(uuid, text, uuid), public.live_audience_results(uuid, text), public.live_my_quiz(uuid, uuid),
  public.live_react(uuid, uuid, text)
  to anon, authenticated;
