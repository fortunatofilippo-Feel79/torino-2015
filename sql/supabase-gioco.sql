-- =====================================================================
-- Torino Club MP — gioco NEVER GIVE UP (novembre 2026)
-- Supabase › SQL Editor › New query: incolla tutto e premi Run.
-- Si può rieseguire senza danni: non cancella i dati già salvati.
-- Nessuna password o codice va scritto qui dentro.
--
-- Le tabelle del gioco non si leggono e non si scrivono con la chiave
-- pubblica. L'app passa solo dalle sei funzioni in fondo (sezione 4), che
-- controllano ogni volta il link personale del ragazzo, il codice del
-- mister o la password del dirigente (la stessa dell'app partite).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. TABELLE
-- ---------------------------------------------------------------------

create table if not exists public.gioco_squadre (
  id            text primary key,              -- stessa annata di public.stato, es. '2015'
  codice_invito text not null,                 -- per iscriversi; poi l'iscrizione va approvata
  codice_mister text not null,
  impostazioni  jsonb not null default '{}'::jsonb,
  creato        timestamptz not null default now()
);

create table if not exists public.gioco_giocatori (
  id          uuid primary key default gen_random_uuid(),
  squadra     text not null references public.gioco_squadre(id) on delete cascade,
  rosa_id     text,                            -- id del ragazzo nella rosa dell'app partite
  nome        text not null,                   -- nome e iniziale, come nella rosa
  soprannome  text not null,
  numero      integer,
  avatar      jsonb not null default '{}'::jsonb,
  token_hash  text not null unique,            -- impronta del link personale, mai il link
  pin_hash    text not null,                   -- impronta del PIN del genitore
  pin_errori  integer not null default 0,
  stato       text not null default 'attesa' check (stato in ('attesa','attivo','sospeso')),
  creato      timestamptz not null default now(),
  approvato   timestamptz
);
create unique index if not exists gioco_giocatori_rosa on public.gioco_giocatori (squadra, rosa_id) where rosa_id is not null;
create index if not exists gioco_giocatori_squadra on public.gioco_giocatori (squadra);

create table if not exists public.gioco_eventi (
  id         bigint generated always as identity primary key,
  squadra    text not null references public.gioco_squadre(id) on delete cascade,
  giocatore  uuid not null references public.gioco_giocatori(id) on delete cascade,
  tipo       text not null,                    -- stella · mossa · sfida · obiettivo · autovalutazione · gg · combine · greencard
  dati       jsonb not null default '{}'::jsonb,
  autore     text not null,                    -- ragazzo · genitore · mister · dirigente
  settimana  text not null,                    -- '2026-W45', ora di Roma
  mese       text not null,                    -- '2026-11'
  creato     timestamptz not null default now()
);
create index if not exists gioco_eventi_mese      on public.gioco_eventi (squadra, mese);
create index if not exists gioco_eventi_settimana on public.gioco_eventi (squadra, settimana);
create index if not exists gioco_eventi_giocatore on public.gioco_eventi (giocatore, settimana);

create table if not exists public.gioco_trii (   -- la fantasquadra sorteggiata di ogni settimana
  squadra    text not null references public.gioco_squadre(id) on delete cascade,
  settimana  text not null,
  giocatore  uuid not null references public.gioco_giocatori(id) on delete cascade,
  gruppo     integer not null,
  primary key (squadra, settimana, giocatore)
);

create table if not exists public.gioco_boss (   -- i boss sconfitti, uno per mese
  squadra    text not null references public.gioco_squadre(id) on delete cascade,
  mese       text not null,
  hp         integer not null,
  sconfitto  timestamptz not null default now(),
  primary key (squadra, mese)
);

alter table public.gioco_squadre   enable row level security;
alter table public.gioco_giocatori enable row level security;
alter table public.gioco_eventi    enable row level security;
alter table public.gioco_trii      enable row level security;
alter table public.gioco_boss      enable row level security;

revoke all on table public.gioco_squadre, public.gioco_giocatori, public.gioco_eventi,
                    public.gioco_trii, public.gioco_boss
  from anon, authenticated;


-- ---------------------------------------------------------------------
-- 2. FUNZIONI DI SERVIZIO (non chiamabili dall'app)
-- ---------------------------------------------------------------------

create or replace function public.gioco_settimana(p_ts timestamptz default now())
returns text language sql stable set search_path = '' as $$
  select to_char(p_ts at time zone 'Europe/Rome', 'IYYY-"W"IW')
$$;

create or replace function public.gioco_mese(p_ts timestamptz default now())
returns text language sql stable set search_path = '' as $$
  select to_char(p_ts at time zone 'Europe/Rome', 'YYYY-MM')
$$;

create or replace function public.gioco_hash(p text)
returns text language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(coalesce(p, ''), 'UTF8')), 'hex')
$$;

-- codice leggibile: niente 0/O, 1/I
create or replace function public.gioco_codice(p_len integer)
returns text language plpgsql volatile set search_path = '' as $$
declare
  alfa text  := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b    bytea := sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text, 'UTF8'));
  r    text  := '';
  i    integer;
begin
  for i in 0 .. least(p_len, 32) - 1 loop
    r := r || substr(alfa, (get_byte(b, i) % 32) + 1, 1);
  end loop;
  return r;
end;
$$;

create or replace function public.gioco_token()
returns text language sql volatile set search_path = '' as $$
  select encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text || clock_timestamp()::text, 'UTF8')), 'hex')
$$;

-- missione della settimana: impegno, coraggio, rispetto, squadra a rotazione
create or replace function public.gioco_area_missione(p_settimana text)
returns text language sql immutable set search_path = '' as $$
  select (array['impegno','coraggio','rispetto','squadra'])[(substr(p_settimana, 7)::integer % 4) + 1]
$$;

-- 'dirigente' con la password dell'annata (app partite), 'mister' con il suo codice
create or replace function public.gioco_ruolo(p_squadra text, p_chiave text)
returns text language sql stable set search_path = '' as $$
  select case
    when coalesce(p_chiave, '') = '' then null
    when exists (select 1 from public.chiavi c
                 where c.id = p_squadra and c.chiave is not null and c.chiave = p_chiave) then 'dirigente'
    when exists (select 1 from public.gioco_squadre s
                 where s.id = p_squadra and s.codice_mister = p_chiave) then 'mister'
    else null end
$$;

create or replace function public.gioco_uuid_ok(p text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p, '') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
$$;

create or replace function public.gioco_testo_ok(p text, p_min integer, p_max integer)
returns boolean language sql immutable set search_path = '' as $$
  select char_length(btrim(coalesce(p, ''))) between p_min and p_max
     and btrim(coalesce(p, '')) !~ '[<>{}"\\/`$;=]'
$$;

-- rosa dell'app partite: [{id, nome}]
create or replace function public.gioco_rosa(p_squadra text)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', r->>'id', 'nome', r->>'name') order by r->>'name'), '[]'::jsonb)
  from public.stato s, jsonb_array_elements(coalesce(s.dati->'roster', '[]'::jsonb)) r
  where s.id = p_squadra and coalesce(r->>'id', '') <> '' and coalesce(r->>'name', '') <> ''
$$;

-- trofei del mese per ragazzo (danni al boss). Stessi valori dell'app.
create or replace function public.gioco_danni(p_squadra text, p_mese text)
returns table (giocatore uuid, trofei integer)
language sql stable set search_path = '' as $$
  with ev as (
    select e.giocatore, e.tipo, e.dati, e.settimana,
           row_number() over (partition by e.giocatore, e.settimana, e.tipo order by e.creato, e.id) as rn
    from public.gioco_eventi e
    where e.squadra = p_squadra and e.mese = p_mese
  ), punti as (
    select ev.giocatore,
           case ev.tipo
             when 'stella' then 10 + case when ev.dati->>'area' = public.gioco_area_missione(ev.settimana) then 5 else 0 end
             when 'mossa' then 30
             when 'sfida' then case when ev.rn <= 3 then 5 else 0 end
             when 'autovalutazione' then 5
             when 'gg' then 2
             when 'combine' then 5
             when 'greencard' then 50
             else 0 end as p
    from ev
    union all
    select (ev.dati->>'a')::uuid, 3 from ev where ev.tipo = 'gg'
  )
  select punti.giocatore, sum(punti.p)::integer from punti group by punti.giocatore
$$;

-- crea i trii della settimana al primo accesso; chi entra dopo va nel gruppo più piccolo
create or replace function public.gioco_assicura_trii(p_squadra text)
returns void language plpgsql volatile set search_path = '' as $$
declare
  w text := public.gioco_settimana();
  n integer;
  g integer;
  r record;
  grp integer;
begin
  if not exists (select 1 from public.gioco_trii t where t.squadra = p_squadra and t.settimana = w) then
    select count(*) into n from public.gioco_giocatori x where x.squadra = p_squadra and x.stato = 'attivo';
    if n = 0 then return; end if;
    g := greatest(1, n / 3);
    insert into public.gioco_trii (squadra, settimana, giocatore, gruppo)
    select p_squadra, w, q.id, (q.rn - 1) % g
    from (select x.id, row_number() over (order by md5(w || x.id::text)) as rn
          from public.gioco_giocatori x
          where x.squadra = p_squadra and x.stato = 'attivo') q
    on conflict do nothing;
  else
    for r in
      select x.id from public.gioco_giocatori x
      where x.squadra = p_squadra and x.stato = 'attivo'
        and not exists (select 1 from public.gioco_trii t
                        where t.squadra = p_squadra and t.settimana = w and t.giocatore = x.id)
      order by x.approvato nulls last, x.id
    loop
      select t.gruppo into grp
      from public.gioco_trii t join public.gioco_giocatori x on x.id = t.giocatore and x.stato = 'attivo'
      where t.squadra = p_squadra and t.settimana = w
      group by t.gruppo
      having count(*) < 3
      order by count(*), t.gruppo
      limit 1;
      if grp is null then
        select coalesce(max(t.gruppo), -1) + 1 into grp
        from public.gioco_trii t where t.squadra = p_squadra and t.settimana = w;
      end if;
      insert into public.gioco_trii (squadra, settimana, giocatore, gruppo)
      values (p_squadra, w, r.id, grp) on conflict do nothing;
      grp := null;
    end loop;
  end if;
end;
$$;

-- stato dei trii: bonus se tutti (almeno due) hanno fatto una sfida e preso una stella
create or replace function public.gioco_trii_stato(p_squadra text)
returns table (settimana text, gruppo integer, giocatore uuid, ha_sfida boolean, ha_stella boolean, bonus boolean)
language sql stable set search_path = '' as $$
  with t as (
    select t.settimana, t.gruppo, t.giocatore,
           exists (select 1 from public.gioco_eventi e
                   where e.giocatore = t.giocatore and e.settimana = t.settimana and e.tipo = 'sfida') as ha_sfida,
           exists (select 1 from public.gioco_eventi e
                   where e.giocatore = t.giocatore and e.settimana = t.settimana and e.tipo = 'stella') as ha_stella
    from public.gioco_trii t
    join public.gioco_giocatori x on x.id = t.giocatore and x.stato = 'attivo'
    where t.squadra = p_squadra
  )
  select t.settimana, t.gruppo, t.giocatore, t.ha_sfida, t.ha_stella,
         (bool_and(t.ha_sfida and t.ha_stella) over w) and (count(*) over w) >= 2
  from t
  window w as (partition by t.settimana, t.gruppo)
$$;

-- boss del mese: lo segna sconfitto quando danni >= energia e tutti hanno dato una mano
create or replace function public.gioco_boss_stato(p_squadra text, p_mese text)
returns jsonb language plpgsql volatile set search_path = '' as $$
declare
  v_per    integer;
  v_attivi integer;
  v_hp     integer;
  v_sconf  timestamptz;
  v_danni  integer;
  v_devono integer;
  v_hanno  integer;
  v_fine   timestamptz := ((to_date(p_mese, 'YYYY-MM') + interval '1 month')::timestamp at time zone 'Europe/Rome');
begin
  select coalesce((s.impostazioni->>'hp')::integer, 150) into v_per
  from public.gioco_squadre s where s.id = p_squadra;
  select count(*) into v_attivi
  from public.gioco_giocatori x where x.squadra = p_squadra and x.stato = 'attivo';
  select b.hp, b.sconfitto into v_hp, v_sconf
  from public.gioco_boss b where b.squadra = p_squadra and b.mese = p_mese;
  if v_hp is null then v_hp := greatest(300, coalesce(v_per, 150) * v_attivi); end if;

  select coalesce(sum(d.trofei), 0) into v_danni
  from public.gioco_danni(p_squadra, p_mese) d
  join public.gioco_giocatori x on x.id = d.giocatore and x.squadra = p_squadra and x.stato <> 'attesa';

  -- devono contribuire gli attivi entrati almeno 7 giorni prima della fine del mese
  select count(*),
         count(*) filter (where exists (select 1 from public.gioco_eventi e
                                        where e.giocatore = x.id and e.mese = p_mese))
    into v_devono, v_hanno
  from public.gioco_giocatori x
  where x.squadra = p_squadra and x.stato = 'attivo'
    and x.approvato <= least(now(), v_fine) - interval '7 days';

  if v_sconf is null and v_attivi > 0 and v_danni >= v_hp and v_hanno = v_devono then
    insert into public.gioco_boss (squadra, mese, hp) values (p_squadra, p_mese, v_hp)
    on conflict do nothing;
    v_sconf := now();
  end if;

  return jsonb_build_object('mese', p_mese, 'hp', v_hp, 'danni', v_danni,
                            'devono', v_devono, 'hanno', v_hanno, 'sconfitto', v_sconf);
end;
$$;

-- bacheca: mosse, green card, nuovi arrivi, trii con bonus, boss sconfitti
create or replace function public.gioco_bacheca(p_squadra text)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(z.x order by z.q desc), '[]'::jsonb)
  from (
    select u.x, u.q from (
      select jsonb_build_object('tipo', e.tipo, 'id', x.id, 'chi', x.soprannome,
                                'mossa', e.dati->>'mossa', 'quando', e.creato) as x, e.creato as q
      from public.gioco_eventi e join public.gioco_giocatori x on x.id = e.giocatore
      where e.squadra = p_squadra and e.tipo in ('mossa', 'greencard') and x.stato <> 'attesa'
      union all
      select jsonb_build_object('tipo', 'nuovo', 'id', x.id, 'chi', x.soprannome, 'quando', x.approvato), x.approvato
      from public.gioco_giocatori x
      where x.squadra = p_squadra and x.stato = 'attivo' and x.approvato is not null
      union all
      select jsonb_build_object('tipo', 'boss', 'mese', b.mese, 'quando', b.sconfitto), b.sconfitto
      from public.gioco_boss b where b.squadra = p_squadra
      union all
      select jsonb_build_object('tipo', 'trio', 'settimana', s.settimana,
                                'chi', jsonb_agg(x.soprannome order by x.soprannome), 'quando', max(m.ultimo)),
             max(m.ultimo)
      from public.gioco_trii_stato(p_squadra) s
      join public.gioco_giocatori x on x.id = s.giocatore
      cross join lateral (select max(e.creato) as ultimo from public.gioco_eventi e
                          where e.giocatore = s.giocatore and e.settimana = s.settimana
                            and e.tipo in ('sfida', 'stella')) m
      where s.bonus
      group by s.settimana, s.gruppo
    ) u
    where u.q is not null
    order by u.q desc
    limit 30
  ) z
$$;

-- compagni visibili ai ragazzi: solo soprannome, numero e avatar
create or replace function public.gioco_compagni(p_squadra text)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'soprannome', x.soprannome,
                                               'numero', x.numero, 'avatar', x.avatar)
                            order by x.soprannome), '[]'::jsonb)
  from public.gioco_giocatori x where x.squadra = p_squadra and x.stato = 'attivo'
$$;

-- boss sconfitti a cui il ragazzo ha contribuito (+20 trofei ciascuno)
create or replace function public.gioco_boss_vinti(p_giocatore uuid)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(b.mese order by b.mese), '[]'::jsonb)
  from public.gioco_boss b
  join public.gioco_giocatori x on x.id = p_giocatore and x.squadra = b.squadra
  where exists (select 1 from public.gioco_eventi e where e.giocatore = p_giocatore and e.mese = b.mese)
$$;

revoke all on function public.gioco_settimana(timestamptz), public.gioco_mese(timestamptz),
  public.gioco_hash(text), public.gioco_codice(integer), public.gioco_token(),
  public.gioco_area_missione(text), public.gioco_ruolo(text, text), public.gioco_uuid_ok(text),
  public.gioco_testo_ok(text, integer, integer), public.gioco_rosa(text),
  public.gioco_danni(text, text), public.gioco_assicura_trii(text), public.gioco_trii_stato(text),
  public.gioco_boss_stato(text, text), public.gioco_bacheca(text), public.gioco_compagni(text),
  public.gioco_boss_vinti(uuid)
  from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. VALORI AMMESSI (devono coincidere con quelli di gioco.html)
-- ---------------------------------------------------------------------

create or replace function public.gioco_ammessi(p_cosa text)
returns text[] language sql immutable set search_path = '' as $$
  select case p_cosa
    when 'aree'     then array['impegno','coraggio','rispetto','squadra']
    when 'mosse'    then array['finta','doppio','cruyff','suola','marsiglia','stop','esterno','collo','debole','v','uscita','rimessa']
    when 'sfide'    then array['palleggi','muro_f','muro_d','slalom','suola','equilibrio']
    when 'obiettivi' then array['debole','chiedi','rientra','incoraggia','unoveuno','borsa','ascolta','mossa']
    when 'esiti'    then array['fatto','quasi','non_ancora']
    when 'prove'    then array['sprint','navetta','slalom','palleggi']
    else array[]::text[] end
$$;
revoke all on function public.gioco_ammessi(text) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 4. LE SEI FUNZIONI CHE USA L'APP
--    Rispondono sempre con un oggetto: {ok: true, ...} oppure {errore: '...'}.
-- ---------------------------------------------------------------------

-- 4a. Prima dell'iscrizione: controlla il codice invito e dà i nomi liberi della rosa
create or replace function public.gioco_pubblico(p_squadra text, p_invito text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.gioco_squadre;
begin
  select * into s from public.gioco_squadre x where x.id = p_squadra;
  if not found or coalesce(p_invito, '') = '' or upper(btrim(p_invito)) <> s.codice_invito then
    return jsonb_build_object('errore', 'invito');
  end if;
  return jsonb_build_object(
    'ok', true,
    'nome_gioco', coalesce(s.impostazioni->>'nome_gioco', 'NEVER GIVE UP'),
    'rosa_libera', (select coalesce(jsonb_agg(r order by r->>'nome'), '[]'::jsonb)
                    from jsonb_array_elements(public.gioco_rosa(p_squadra)) r
                    where not exists (select 1 from public.gioco_giocatori x
                                      where x.squadra = p_squadra and x.rosa_id = r->>'id')));
end;
$$;

-- 4b. Iscrizione: restituisce il link personale (token). Resta in attesa finché il dirigente approva.
create or replace function public.gioco_iscrivi(p_squadra text, p_invito text, p_rosa_id text, p_nome text,
                                                p_soprannome text, p_numero integer, p_avatar jsonb, p_pin text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s    public.gioco_squadre;
  v_nome text;
  v_tok  text := public.gioco_token();
  v_id   uuid := gen_random_uuid();
begin
  select * into s from public.gioco_squadre x where x.id = p_squadra;
  if not found or coalesce(p_invito, '') = '' or upper(btrim(p_invito)) <> s.codice_invito then
    return jsonb_build_object('errore', 'invito');
  end if;
  if coalesce(p_pin, '') !~ '^[0-9]{4}$' then return jsonb_build_object('errore', 'pin'); end if;
  if not public.gioco_testo_ok(p_soprannome, 2, 14) then return jsonb_build_object('errore', 'soprannome'); end if;
  if p_numero is not null and (p_numero < 1 or p_numero > 99) then return jsonb_build_object('errore', 'numero'); end if;
  if p_avatar is null or jsonb_typeof(p_avatar) <> 'object' or pg_column_size(p_avatar) > 2000 then
    return jsonb_build_object('errore', 'avatar');
  end if;
  if (select count(*) from public.gioco_giocatori x where x.squadra = p_squadra and x.stato = 'attesa') >= 12
     or (select count(*) from public.gioco_giocatori x where x.squadra = p_squadra) >= 40 then
    return jsonb_build_object('errore', 'pieno');
  end if;

  if coalesce(p_rosa_id, '') <> '' then
    select r->>'nome' into v_nome from jsonb_array_elements(public.gioco_rosa(p_squadra)) r where r->>'id' = p_rosa_id;
    if v_nome is null then return jsonb_build_object('errore', 'nome'); end if;
    if exists (select 1 from public.gioco_giocatori x where x.squadra = p_squadra and x.rosa_id = p_rosa_id) then
      return jsonb_build_object('errore', 'preso');
    end if;
  else
    if not public.gioco_testo_ok(p_nome, 2, 30) then return jsonb_build_object('errore', 'nome'); end if;
    v_nome := btrim(p_nome);
  end if;

  insert into public.gioco_giocatori (id, squadra, rosa_id, nome, soprannome, numero, avatar, token_hash, pin_hash)
  values (v_id, p_squadra, nullif(p_rosa_id, ''), v_nome, btrim(p_soprannome), p_numero, p_avatar,
          public.gioco_hash(v_tok), public.gioco_hash(v_id::text || ':' || p_pin));
  return jsonb_build_object('ok', true, 'token', v_tok, 'id', v_id);
end;
$$;

-- 4c. Tutto quello che vede il ragazzo
create or replace function public.gioco_io(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  g public.gioco_giocatori;
  w text := public.gioco_settimana();
  m text := public.gioco_mese();
  v_grp integer;
  v_boss jsonb;
begin
  select * into g from public.gioco_giocatori x where x.token_hash = public.gioco_hash(p_token);
  if not found or coalesce(p_token, '') = '' then return jsonb_build_object('errore', 'link'); end if;

  perform public.gioco_assicura_trii(g.squadra);
  if g.stato = 'attivo' then
    perform public.gioco_boss_stato(g.squadra, public.gioco_mese(now() - interval '1 month'));
    v_boss := public.gioco_boss_stato(g.squadra, m);   -- prima di tutto: può segnare il boss sconfitto
  end if;
  select t.gruppo into v_grp from public.gioco_trii t
  where t.squadra = g.squadra and t.settimana = w and t.giocatore = g.id;

  return jsonb_build_object(
    'ok', true,
    'io', jsonb_build_object('id', g.id, 'nome', g.nome, 'soprannome', g.soprannome, 'numero', g.numero,
                             'avatar', g.avatar, 'stato', g.stato, 'approvato', g.approvato,
                             'pin_bloccato', g.pin_errori >= 8),
    'squadra', (select jsonb_build_object('id', s.id, 'impostazioni', s.impostazioni - 'figlio')
                from public.gioco_squadre s where s.id = g.squadra),
    'ora', jsonb_build_object('settimana', w, 'mese', m, 'adesso', now()),
    'eventi', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'tipo', e.tipo, 'dati', e.dati,
                                 'autore', e.autore, 'settimana', e.settimana, 'mese', e.mese, 'creato', e.creato)
                                 order by e.creato, e.id), '[]'::jsonb)
               from public.gioco_eventi e where e.giocatore = g.id),
    'gg_ricevuti', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'da', x.soprannome, 'dati', e.dati,
                                      'settimana', e.settimana, 'mese', e.mese, 'creato', e.creato)
                                      order by e.creato, e.id), '[]'::jsonb)
                    from public.gioco_eventi e join public.gioco_giocatori x on x.id = e.giocatore
                    where e.squadra = g.squadra and e.tipo = 'gg' and e.dati->>'a' = g.id::text),
    'bonus_trio', (select coalesce(jsonb_agg(distinct s.settimana), '[]'::jsonb)
                   from public.gioco_trii_stato(g.squadra) s where s.giocatore = g.id and s.bonus),
    'boss_vinti', public.gioco_boss_vinti(g.id),
    'compagni', case when g.stato = 'attivo' then public.gioco_compagni(g.squadra) else '[]'::jsonb end,
    'trio', case when v_grp is null then null else
              (select jsonb_agg(jsonb_build_object('id', s.giocatore, 'ha_sfida', s.ha_sfida, 'ha_stella', s.ha_stella,
                                                   'bonus', s.bonus,
                                                   'gg_inviato', exists (select 1 from public.gioco_eventi e
                                                       where e.giocatore = g.id and e.settimana = w and e.tipo = 'gg'
                                                         and e.dati->>'a' = s.giocatore::text)))
               from public.gioco_trii_stato(g.squadra) s where s.settimana = w and s.gruppo = v_grp) end,
    'boss', v_boss,
    'bacheca', case when g.stato = 'attivo' then public.gioco_bacheca(g.squadra) else '[]'::jsonb end
  );
end;
$$;

-- 4d. Le azioni del ragazzo
create or replace function public.gioco_ragazzo(p_token text, p_azione text, p_dati jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  g  public.gioco_giocatori;
  w  text := public.gioco_settimana();
  m  text := public.gioco_mese();
  d  jsonb := coalesce(p_dati, '{}'::jsonb);
  v  numeric;
  k  text;
  n  integer;
  a  uuid;
  nid bigint;
begin
  select * into g from public.gioco_giocatori x where x.token_hash = public.gioco_hash(p_token);
  if not found or coalesce(p_token, '') = '' then return jsonb_build_object('errore', 'link'); end if;

  if p_azione = 'avatar' then
    if jsonb_typeof(d->'avatar') <> 'object' or pg_column_size(d->'avatar') > 2000 then
      return jsonb_build_object('errore', 'avatar');
    end if;
    if d ? 'numero' and d->>'numero' is not null
       and (d->>'numero' !~ '^[0-9]{1,2}$' or (d->>'numero')::integer < 1) then
      return jsonb_build_object('errore', 'numero');
    end if;
    -- il soprannome si cambia solo prima dell'approvazione; dopo lo cambia il dirigente
    if g.stato = 'attesa' and d ? 'soprannome' then
      if not public.gioco_testo_ok(d->>'soprannome', 2, 14) then return jsonb_build_object('errore', 'soprannome'); end if;
      update public.gioco_giocatori set soprannome = btrim(d->>'soprannome') where id = g.id;
    end if;
    update public.gioco_giocatori
       set avatar = d->'avatar',
           numero = case when d ? 'numero' then (d->>'numero')::integer else numero end
     where id = g.id;
    return jsonb_build_object('ok', true);
  end if;

  if g.stato <> 'attivo' then return jsonb_build_object('errore', 'attesa'); end if;

  select count(*) into n from public.gioco_eventi e
  where e.giocatore = g.id and e.autore in ('ragazzo', 'genitore') and e.creato > now() - interval '1 day';
  if n >= 30 then return jsonb_build_object('errore', 'troppe'); end if;

  if p_azione = 'sfida' then
    k := d->>'sfida';
    if not (k = any (public.gioco_ammessi('sfide'))) then return jsonb_build_object('errore', 'sfida'); end if;
    if coalesce(d->>'valore', '') !~ '^[0-9]{1,4}(\.[0-9]{1,2})?$' then return jsonb_build_object('errore', 'valore'); end if;
    v := (d->>'valore')::numeric;
    if v <= 0 or v > 5000 then return jsonb_build_object('errore', 'valore'); end if;
    if g.pin_errori >= 8 then return jsonb_build_object('errore', 'pin_bloccato'); end if;
    if public.gioco_hash(g.id::text || ':' || coalesce(d->>'pin', '')) <> g.pin_hash then
      update public.gioco_giocatori set pin_errori = pin_errori + 1 where id = g.id;
      return jsonb_build_object('errore', 'pin', 'tentativi', 8 - (g.pin_errori + 1));
    end if;
    update public.gioco_giocatori set pin_errori = 0 where id = g.id;
    insert into public.gioco_eventi (squadra, giocatore, tipo, dati, autore, settimana, mese)
    values (g.squadra, g.id, 'sfida', jsonb_build_object('sfida', k, 'valore', v), 'genitore', w, m)
    returning id into nid;

  elsif p_azione = 'obiettivo' then
    k := d->>'obiettivo';
    if not (k = any (public.gioco_ammessi('obiettivi'))) then return jsonb_build_object('errore', 'obiettivo'); end if;
    if exists (select 1 from public.gioco_eventi e where e.giocatore = g.id and e.settimana = w and e.tipo = 'autovalutazione') then
      return jsonb_build_object('errore', 'gia_valutato');
    end if;
    delete from public.gioco_eventi e where e.giocatore = g.id and e.settimana = w and e.tipo = 'obiettivo';
    insert into public.gioco_eventi (squadra, giocatore, tipo, dati, autore, settimana, mese)
    values (g.squadra, g.id, 'obiettivo', jsonb_build_object('obiettivo', k), 'ragazzo', w, m)
    returning id into nid;

  elsif p_azione = 'autovalutazione' then
    k := d->>'esito';
    if not (k = any (public.gioco_ammessi('esiti'))) then return jsonb_build_object('errore', 'esito'); end if;
    if not exists (select 1 from public.gioco_eventi e where e.giocatore = g.id and e.settimana = w and e.tipo = 'obiettivo') then
      return jsonb_build_object('errore', 'senza_obiettivo');
    end if;
    if exists (select 1 from public.gioco_eventi e where e.giocatore = g.id and e.settimana = w and e.tipo = 'autovalutazione') then
      return jsonb_build_object('errore', 'gia_valutato');
    end if;
    insert into public.gioco_eventi (squadra, giocatore, tipo, dati, autore, settimana, mese)
    values (g.squadra, g.id, 'autovalutazione', jsonb_build_object('esito', k), 'ragazzo', w, m)
    returning id into nid;

  elsif p_azione = 'gg' then
    if not public.gioco_uuid_ok(d->>'a') then return jsonb_build_object('errore', 'compagno'); end if;
    a := (d->>'a')::uuid;
    if a = g.id or coalesce(d->>'frase', '') !~ '^[0-7]$' then return jsonb_build_object('errore', 'compagno'); end if;
    if not exists (select 1 from public.gioco_trii t1 join public.gioco_trii t2
                     on t2.squadra = t1.squadra and t2.settimana = t1.settimana and t2.gruppo = t1.gruppo
                   where t1.squadra = g.squadra and t1.settimana = w and t1.giocatore = g.id and t2.giocatore = a) then
      return jsonb_build_object('errore', 'compagno');
    end if;
    if exists (select 1 from public.gioco_eventi e where e.giocatore = g.id and e.settimana = w
                 and e.tipo = 'gg' and e.dati->>'a' = a::text) then
      return jsonb_build_object('errore', 'gia_inviato');
    end if;
    insert into public.gioco_eventi (squadra, giocatore, tipo, dati, autore, settimana, mese)
    values (g.squadra, g.id, 'gg', jsonb_build_object('a', a, 'frase', (d->>'frase')::integer), 'ragazzo', w, m)
    returning id into nid;

  else
    return jsonb_build_object('errore', 'azione');
  end if;

  return jsonb_build_object('ok', true, 'id', nid);
end;
$$;

-- 4e. Tutto quello che vedono mister e dirigente
create or replace function public.gioco_staff(p_squadra text, p_chiave text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r text := public.gioco_ruolo(p_squadra, p_chiave);
  s public.gioco_squadre;
  w text := public.gioco_settimana();
  m text := public.gioco_mese();
  mp text := public.gioco_mese(now() - interval '1 month');
  v_boss jsonb;
begin
  if r is null then return jsonb_build_object('errore', 'chiave'); end if;
  select * into s from public.gioco_squadre x where x.id = p_squadra;
  if not found then
    return jsonb_build_object('ok', true, 'ruolo', r, 'attivo', false);
  end if;

  perform public.gioco_assicura_trii(p_squadra);
  perform public.gioco_boss_stato(p_squadra, mp);   -- chiude il mese scorso se serve
  v_boss := public.gioco_boss_stato(p_squadra, m);

  return jsonb_build_object(
    'ok', true, 'ruolo', r, 'attivo', true,
    'squadra', jsonb_build_object('id', s.id, 'impostazioni', s.impostazioni,
                                  'codice_invito', case when r = 'dirigente' then s.codice_invito end,
                                  'codice_mister', case when r = 'dirigente' then s.codice_mister end),
    'ora', jsonb_build_object('settimana', w, 'mese', m, 'adesso', now()),
    'rosa', public.gioco_rosa(p_squadra),
    'giocatori', (select coalesce(jsonb_agg(jsonb_build_object(
                     'id', x.id, 'rosa_id', x.rosa_id, 'nome', x.nome, 'soprannome', x.soprannome,
                     'numero', x.numero, 'avatar', x.avatar, 'stato', x.stato, 'creato', x.creato,
                     'approvato', x.approvato, 'pin_bloccato', x.pin_errori >= 8) order by x.nome), '[]'::jsonb)
                  from public.gioco_giocatori x where x.squadra = p_squadra),
    'eventi', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'giocatore', e.giocatore, 'tipo', e.tipo,
                                 'dati', e.dati, 'autore', e.autore, 'settimana', e.settimana, 'mese', e.mese,
                                 'creato', e.creato) order by e.creato, e.id), '[]'::jsonb)
               from public.gioco_eventi e where e.squadra = p_squadra),
    'trii', (select coalesce(jsonb_agg(jsonb_build_object('settimana', t.settimana, 'gruppo', t.gruppo,
                               'giocatore', t.giocatore, 'ha_sfida', t.ha_sfida, 'ha_stella', t.ha_stella,
                               'bonus', t.bonus)), '[]'::jsonb)
             from public.gioco_trii_stato(p_squadra) t),
    'boss', v_boss,
    'boss_vinti', (select coalesce(jsonb_agg(b.mese order by b.mese), '[]'::jsonb)
                   from public.gioco_boss b where b.squadra = p_squadra),
    'bacheca', public.gioco_bacheca(p_squadra)
  );
end;
$$;

-- 4f. Le azioni di mister e dirigente
create or replace function public.gioco_staff_azione(p_squadra text, p_chiave text, p_azione text, p_dati jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r   text := public.gioco_ruolo(p_squadra, p_chiave);
  d   jsonb := coalesce(p_dati, '{}'::jsonb);
  w   text := public.gioco_settimana();
  m   text := public.gioco_mese();
  s   public.gioco_squadre;
  g   public.gioco_giocatori;
  k   text;
  v   numeric;
  tok text;
  nid bigint;
  imp jsonb;
begin
  if r is null then return jsonb_build_object('errore', 'chiave'); end if;

  if p_azione = 'attiva' then
    if r <> 'dirigente' then return jsonb_build_object('errore', 'solo_dirigente'); end if;
    if not exists (select 1 from public.stato x where x.id = p_squadra) then
      return jsonb_build_object('errore', 'annata');
    end if;
    insert into public.gioco_squadre (id, codice_invito, codice_mister)
    values (p_squadra, public.gioco_codice(6), public.gioco_codice(10))
    on conflict (id) do nothing;
    return jsonb_build_object('ok', true);
  end if;

  select * into s from public.gioco_squadre x where x.id = p_squadra;
  if not found then return jsonb_build_object('errore', 'non_attivo'); end if;

  -- azioni sulla squadra, solo dirigente
  if p_azione in ('nuovo_invito', 'nuovo_mister', 'impostazioni') then
    if r <> 'dirigente' then return jsonb_build_object('errore', 'solo_dirigente'); end if;
    if p_azione = 'nuovo_invito' then
      update public.gioco_squadre set codice_invito = public.gioco_codice(6) where id = p_squadra;
    elsif p_azione = 'nuovo_mister' then
      update public.gioco_squadre set codice_mister = public.gioco_codice(10) where id = p_squadra;
    else
      imp := s.impostazioni;
      if d ? 'nome_gioco' then
        if not public.gioco_testo_ok(d->>'nome_gioco', 2, 24) then return jsonb_build_object('errore', 'testo'); end if;
        imp := imp || jsonb_build_object('nome_gioco', btrim(d->>'nome_gioco'));
      end if;
      if d ? 'premio' then
        if not public.gioco_testo_ok(coalesce(d->>'premio', ''), 0, 60) then return jsonb_build_object('errore', 'testo'); end if;
        imp := jsonb_set(imp, '{premi}', coalesce(imp->'premi', '{}'::jsonb) || jsonb_build_object(m, btrim(coalesce(d->>'premio', ''))));
      end if;
      if d ? 'boss_nome' then
        if not public.gioco_testo_ok(coalesce(d->>'boss_nome', ''), 0, 24) then return jsonb_build_object('errore', 'testo'); end if;
        imp := jsonb_set(imp, '{boss_nomi}', coalesce(imp->'boss_nomi', '{}'::jsonb) || jsonb_build_object(m, btrim(coalesce(d->>'boss_nome', ''))));
      end if;
      if d ? 'hp' then
        if coalesce(d->>'hp', '') !~ '^[0-9]{2,4}$' or (d->>'hp')::integer not between 50 and 1000 then
          return jsonb_build_object('errore', 'testo');
        end if;
        imp := imp || jsonb_build_object('hp', (d->>'hp')::integer);
      end if;
      if d ? 'figlio' then
        if d->>'figlio' is null or d->>'figlio' = '' then
          imp := imp - 'figlio';
        elsif public.gioco_uuid_ok(d->>'figlio') then
          imp := imp || jsonb_build_object('figlio', d->>'figlio');
        else
          return jsonb_build_object('errore', 'testo');
        end if;
      end if;
      update public.gioco_squadre set impostazioni = imp where id = p_squadra;
    end if;
    return jsonb_build_object('ok', true);
  end if;

  -- annulla un evento (il mister solo i suoi)
  if p_azione = 'annulla' then
    if coalesce(d->>'evento', '') !~ '^[0-9]{1,15}$' then return jsonb_build_object('errore', 'evento'); end if;
    delete from public.gioco_eventi e
    where e.id = (d->>'evento')::bigint and e.squadra = p_squadra
      and e.tipo in ('stella', 'mossa', 'combine', 'greencard')
      and (r = 'dirigente' or e.autore = 'mister');
    if not found then return jsonb_build_object('errore', 'evento'); end if;
    return jsonb_build_object('ok', true);
  end if;

  -- da qui in poi serve un ragazzo della squadra
  if not public.gioco_uuid_ok(d->>'giocatore') then return jsonb_build_object('errore', 'giocatore'); end if;
  select * into g from public.gioco_giocatori x where x.id = (d->>'giocatore')::uuid and x.squadra = p_squadra;
  if not found then return jsonb_build_object('errore', 'giocatore'); end if;

  if p_azione in ('approva', 'rifiuta', 'sospendi', 'riattiva', 'nuovo_link', 'nuovo_pin', 'soprannome', 'elimina') then
    if r <> 'dirigente' then return jsonb_build_object('errore', 'solo_dirigente'); end if;
    if p_azione = 'approva' then
      update public.gioco_giocatori set stato = 'attivo', approvato = coalesce(approvato, now()) where id = g.id;
    elsif p_azione = 'riattiva' then
      update public.gioco_giocatori set stato = 'attivo' where id = g.id and stato = 'sospeso';
    elsif p_azione = 'sospendi' then
      update public.gioco_giocatori set stato = 'sospeso' where id = g.id;
    elsif p_azione in ('rifiuta', 'elimina') then
      if p_azione = 'rifiuta' and g.stato <> 'attesa' then return jsonb_build_object('errore', 'stato'); end if;
      delete from public.gioco_giocatori where id = g.id;   -- toglie anche tutti i suoi dati
      delete from public.gioco_eventi e where e.squadra = p_squadra and e.tipo = 'gg' and e.dati->>'a' = g.id::text;
    elsif p_azione = 'nuovo_link' then
      tok := public.gioco_token();
      update public.gioco_giocatori set token_hash = public.gioco_hash(tok) where id = g.id;
      return jsonb_build_object('ok', true, 'token', tok);
    elsif p_azione = 'nuovo_pin' then
      if coalesce(d->>'pin', '') !~ '^[0-9]{4}$' then return jsonb_build_object('errore', 'pin'); end if;
      update public.gioco_giocatori set pin_hash = public.gioco_hash(g.id::text || ':' || (d->>'pin')), pin_errori = 0 where id = g.id;
    elsif p_azione = 'soprannome' then
      if not public.gioco_testo_ok(d->>'soprannome', 2, 14) then return jsonb_build_object('errore', 'soprannome'); end if;
      update public.gioco_giocatori set soprannome = btrim(d->>'soprannome') where id = g.id;
    end if;
    return jsonb_build_object('ok', true);
  end if;

  if g.stato <> 'attivo' then return jsonb_build_object('errore', 'non_attivo'); end if;

  if p_azione = 'stella' then
    k := d->>'area';
    if not (k = any (public.gioco_ammessi('aree'))) or coalesce(d->>'frase', '') !~ '^[0-9]$' then
      return jsonb_build_object('errore', 'stella');
    end if;
    if r = 'dirigente' and s.impostazioni->>'figlio' = g.id::text then
      return jsonb_build_object('errore', 'figlio');
    end if;
    if exists (select 1 from public.gioco_eventi e where e.giocatore = g.id and e.settimana = w
                 and e.tipo = 'stella' and e.dati->>'area' = k) then
      return jsonb_build_object('errore', 'gia_data');
    end if;
    insert into public.gioco_eventi (squadra, giocatore, tipo, dati, autore, settimana, mese)
    values (p_squadra, g.id, 'stella', jsonb_build_object('area', k, 'frase', (d->>'frase')::integer), r, w, m)
    returning id into nid;

  elsif p_azione = 'mossa' then
    k := d->>'mossa';
    if not (k = any (public.gioco_ammessi('mosse'))) then return jsonb_build_object('errore', 'mossa'); end if;
    if exists (select 1 from public.gioco_eventi e where e.giocatore = g.id and e.tipo = 'mossa' and e.dati->>'mossa' = k) then
      return jsonb_build_object('errore', 'gia_data');
    end if;
    insert into public.gioco_eventi (squadra, giocatore, tipo, dati, autore, settimana, mese)
    values (p_squadra, g.id, 'mossa', jsonb_build_object('mossa', k), r, w, m)
    returning id into nid;

  elsif p_azione = 'combine' then
    k := d->>'prova';
    if not (k = any (public.gioco_ammessi('prove'))) then return jsonb_build_object('errore', 'prova'); end if;
    if coalesce(d->>'valore', '') !~ '^[0-9]{1,4}(\.[0-9]{1,2})?$' then return jsonb_build_object('errore', 'valore'); end if;
    v := (d->>'valore')::numeric;
    if v <= 0 or v > 5000 then return jsonb_build_object('errore', 'valore'); end if;
    insert into public.gioco_eventi (squadra, giocatore, tipo, dati, autore, settimana, mese)
    values (p_squadra, g.id, 'combine', jsonb_build_object('prova', k, 'valore', v), r, w, m)
    returning id into nid;

  elsif p_azione = 'greencard' then
    if r = 'dirigente' and s.impostazioni->>'figlio' = g.id::text then
      return jsonb_build_object('errore', 'figlio');
    end if;
    insert into public.gioco_eventi (squadra, giocatore, tipo, dati, autore, settimana, mese)
    values (p_squadra, g.id, 'greencard', '{}'::jsonb, r, w, m)
    returning id into nid;

  else
    return jsonb_build_object('errore', 'azione');
  end if;

  return jsonb_build_object('ok', true, 'id', nid);
end;
$$;

revoke all on function public.gioco_pubblico(text, text), public.gioco_iscrivi(text, text, text, text, text, integer, jsonb, text),
  public.gioco_io(text), public.gioco_ragazzo(text, text, jsonb), public.gioco_staff(text, text),
  public.gioco_staff_azione(text, text, text, jsonb)
  from public;
grant execute on function public.gioco_pubblico(text, text), public.gioco_iscrivi(text, text, text, text, text, integer, jsonb, text),
  public.gioco_io(text), public.gioco_ragazzo(text, text, jsonb), public.gioco_staff(text, text),
  public.gioco_staff_azione(text, text, text, jsonb)
  to anon, authenticated;

notify pgrst, 'reload schema';


-- ---------------------------------------------------------------------
-- 5. CONTROLLO FINALE (sola lettura)
--    Risultato giusto: le sei funzioni gioco_pubblico, gioco_iscrivi, gioco_io,
--    gioco_ragazzo, gioco_staff, gioco_staff_azione «si può chiamare»;
--    tutte le altre gioco_* e tutte le tabelle gioco_* «niente».
-- ---------------------------------------------------------------------
select tipo, nome, chi_ha_il_link from (
  select 'funzione' as tipo, p.proname as nome,
         case when has_function_privilege('anon', p.oid, 'execute') then 'si può chiamare' else 'niente' end as chi_ha_il_link
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'gioco\_%'
  union all
  select 'tabella', c.relname,
         case when has_table_privilege('anon', c.oid, 'SELECT') or has_table_privilege('anon', c.oid, 'INSERT')
                or has_table_privilege('anon', c.oid, 'UPDATE') or has_table_privilege('anon', c.oid, 'DELETE')
              then 'ACCESSO DIRETTO: fermati e dimmelo' else 'niente' end
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'gioco\_%'
) t
order by tipo, chi_ha_il_link desc, nome;
