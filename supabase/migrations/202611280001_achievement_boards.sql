-- 成就排行榜：只公开昵称、已解锁成就 ID 和数量，不包含任何成绩明细。
create table if not exists public.achievement_boards (
  player_id text primary key,
  nickname text not null default '',
  achievement_ids jsonb not null default '[]'::jsonb,
  achievement_count integer not null default 0
    check (achievement_count between 0 and 54),
  updated_at timestamptz not null default now()
);

create index if not exists achievement_boards_rank_idx
  on public.achievement_boards (achievement_count desc, updated_at asc);

alter table public.achievement_boards enable row level security;

drop policy if exists "achievement boards read" on public.achievement_boards;
create policy "achievement boards read"
  on public.achievement_boards for select
  using (true);

drop policy if exists "achievement boards insert" on public.achievement_boards;
create policy "achievement boards insert"
  on public.achievement_boards for insert
  with check (true);

drop policy if exists "achievement boards update" on public.achievement_boards;
create policy "achievement boards update"
  on public.achievement_boards for update
  using (true)
  with check (true);

revoke delete on public.achievement_boards from anon, authenticated;
grant select, insert, update on public.achievement_boards to anon, authenticated;

-- 一次性重置：移除两个旧成就，保留其余成就并重算数量。
-- 对尚未写入成就榜的玩家，客户端会在首次打开新版本时完成本机重置并重新发布。
with cleaned as (
  select
    b.player_id,
    coalesce(
      jsonb_agg(t.value) filter (
        where t.value not in ('localTop10', 'noStomp1000m')
      ),
      '[]'::jsonb
    ) as ids
  from public.achievement_boards b
  left join lateral jsonb_array_elements_text(b.achievement_ids) as t(value) on true
  group by b.player_id
)
update public.achievement_boards b
set achievement_ids = cleaned.ids,
    achievement_count = jsonb_array_length(cleaned.ids),
    updated_at = now()
from cleaned
where b.player_id = cleaned.player_id;
