-- ============================================================
-- Sakkokassa — kauden nimi kysytään arkistointihetkellä ja
-- tallennetaan jokaiselle arkistoidulle sakolle
-- ============================================================
-- Aiemmin "Kauden nimi" oli pelkkä vapaa tekstikenttä joukkueen
-- asetuksissa (teams.season_name), joka ei ollut mitenkään kytköksissä
-- yksittäisiin sakkoihin eikä itse arkistointiin — archive_season
-- vain vaihtoi kaikkien aktiivisten sakkojen statuksen 'archived'iksi.
-- Lopputulos: kaikki koskaan arkistoidut sakot näyttivät samalta
-- yhdeltä kasalta, eikä kauden nimeä tallennettu minnekään pysyvästi.
--
-- Muutos: fees-tauluun kaksi uutta saraketta, jotka täytetään VAIN
-- archive_season-kutsun yhteydessä (eivät koske suoraan lisättyjä/
-- poistettuja/maksettuja sakkoja):
--   - season_label: arkistointihetkellä annettu kauden nimi
--   - archived_at:  arkistointihetken aikaleima
-- archive_season vaatii nyt p_season_label-parametrin (ei tyhjä),
-- kysytään käyttäjältä juuri arkistointihetkellä — ei enää oletetta
-- että asetuksissa oleva "Kauden nimi" on ajan tasalla. Arkistoinnin
-- jälkeen teams.season_name nollataan, koska uusi (nimeämätön) kausi
-- alkaa juuri silloin — vanha, jo arkistoitu nimi jäisi muuten
-- harhaanjohtavasti näkyviin asetuslomakkeeseen.
-- ============================================================

alter table public.fees add column if not exists season_label text;
alter table public.fees add column if not exists archived_at timestamptz;

-- Uusi parametrilista (p_season_label lisätty) = eri funktio-overload
-- Postgresille, ei sama kuin CREATE OR REPLACE vanhalle yksiparametriselle
-- versiolle — pudotetaan se ensin ettei jää kutsuttavaksi kahta versiota.
drop function if exists public.archive_season(uuid);

create or replace function public.archive_season(p_team_id uuid, p_season_label text)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
  v_label text := trim(p_season_label);
begin
  if not public.has_team_role(auth.uid(), p_team_id, 'teamadmin') then
    raise exception 'unauthorized';
  end if;
  if v_label = '' then
    raise exception 'season_label_required';
  end if;

  with updated as (
    update public.fees set status = 'archived', season_label = v_label, archived_at = now()
    where team_id = p_team_id and status = 'active'
    returning 1
  )
  select count(*) into v_count from updated;

  update public.teams set season_name = '' where id = p_team_id;

  perform public.log_audit(p_team_id, 'ARCHIVE_SEASON',
    jsonb_build_object('teamId', p_team_id, 'feesArchived', v_count, 'seasonLabel', v_label));
  return v_count;
end;
$$;

grant execute on function public.archive_season(uuid, text) to authenticated;
