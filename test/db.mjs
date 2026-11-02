import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
export async function nuovoDb() {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create table public.stato (id text primary key, dati jsonb, aggiornato timestamptz default now());
    create table public.chiavi (id text primary key, chiave text, chiave_gara text);
    grant select on public.stato to anon;
    insert into public.chiavi values ('2015','pwd-dirigente','cod-aiutante');
    insert into public.stato values ('2015', jsonb_build_object('roster', jsonb_build_array(
      jsonb_build_object('id','r1','name','Luca R.'), jsonb_build_object('id','r2','name','Marco B.'),
      jsonb_build_object('id','r3','name','Tommaso F.'), jsonb_build_object('id','r4','name','Ale C.'),
      jsonb_build_object('id','r5','name','Davide P.'), jsonb_build_object('id','r6','name','Nico S.'),
      jsonb_build_object('id','r7','name','Edo M.'))));
  `);
  await db.exec(fs.readFileSync(new URL('../sql/supabase-gioco.sql', import.meta.url),'utf8'));
  return db;
}
