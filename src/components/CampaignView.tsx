import Link from "next/link";
import { CampaignTabs, type MatcherRow, type TeamRow } from "./CampaignTabs";
import { Countdown } from "./Countdown";
import { DonateModal } from "./DonateModal";
import { DonateTrigger } from "./DonateTrigger";
import { GoalCard } from "./GoalCard";
import { HeroCarousel } from "./HeroCarousel";
import { ShareButton } from "./ShareButton";
import { Ticker } from "./Ticker";
import { captchaProvider } from "@/lib/captcha";
import { limits, paymentsMode } from "@/lib/config";
import { campaignOpen, getLeaderboard, getTotals } from "@/lib/donations";
import { rulesText } from "@/lib/leaderboard";
import { fmt, getDict } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { getStore } from "@/lib/store";
import type { Team } from "@/lib/types";

function videoEmbed(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.endsWith("vimeo.com")) return `https://player.vimeo.com/video/${u.pathname.split("/").filter(Boolean).pop()}`;
    if (u.hostname.includes("youtube.com")) return `https://www.youtube-nocookie.com/embed/${u.searchParams.get("v")}`;
    if (u.hostname === "youtu.be") return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
  } catch { /* ignore */ }
  return null;
}

const LEVELS = [18, 36, 100, 180, 360, 1000];

export async function CampaignView({ team }: { team: Team | null }) {
  const { t, lang } = await getDict();
  const locale = lang === "he" ? "he-IL" : "en-US";
  const store = getStore();
  const c = await store.getCampaign();
  const [totals, teams, board] = await Promise.all([getTotals(c), store.listTeams(), getLeaderboard(c)]);
  const fm = (x: number) => formatMoney(x, c.currency, locale, true);

  const scoped = team ? (totals.teamTotals[team.id] ?? { cashCents: 0, count: 0 }) : null;
  const initial = scoped
    ? { cashCents: scoped.cashCents, matchedCents: 0, donorCount: scoped.count }
    : { cashCents: totals.cashCents, matchedCents: totals.matchedCents, donorCount: totals.donorCount };

  const approved = teams.filter((x) => x.approved);
  const teamRows: TeamRow[] = board.map((r) => ({ id: r.teamId, name: r.name, goalCents: r.goalCents, cashCents: r.cashCents, gifts: r.gifts, donors: r.donors }));
  const matcherRows: MatcherRow[] = totals.matchers.map((m) => ({
    id: m.matcher.id, name: m.matcher.name, multiplier: m.matcher.multiplier, capCents: m.matcher.capCents,
    matchedCents: m.matchedCents, windowEnd: m.matcher.windowEnd,
  }));

  const now = new Date().toISOString();
  const liveMatchers = totals.matchers.filter((m) => m.remainingCents > 0 && m.matcher.windowStart <= now && m.matcher.windowEnd >= now);
  const matchMultiplier = liveMatchers.length ? Math.max(...liveMatchers.map((m) => m.matcher.multiplier)) : 0;
  const matchLeft = liveMatchers.reduce((s, m) => s + m.remainingCents, 0);

  const embed = videoEmbed(c.videoUrl);
  const goalCents = team?.goalCents ?? c.goalCents;
  const total = initial.cashCents + initial.matchedCents;
  const mode = paymentsMode();
  const open = campaignOpen(c);
  const blocked = mode === "disabled" || !open;
  const provider = captchaProvider();
  const images = c.heroMedia.length ? c.heroMedia : ["/hero.svg"];

  const donateLabel = !open ? t.campaignEnded : mode === "disabled" ? t.opensSoon : t.donate;

  return (
    <main>
      <section className="hero">
        <div className="hero-bg">
          {embed ? (
            <iframe src={embed} title="Campaign video" allow="fullscreen; picture-in-picture" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" style={{ width: "100%", height: "100%", border: 0 }} />
          ) : (
            <HeroCarousel images={images} />
          )}
        </div>
        <div className="wrap hero-in">
          <div>
            <span className="eyebrow">{team ? c.title : c.subtitle}</span>
            <h1>{team ? team.name : c.title}</h1>
            <p className="lede">{team?.message || c.description}</p>
            <div className="hero-cta">
              <DonateTrigger className="btn lg" disabled={blocked}>{blocked ? donateLabel : t.giveNow}</DonateTrigger>
              {!team && <Link href="/team-signup" className="btn ghost lg">{t.joinTeam}</Link>}
              {team && <Link href="/" className="btn ghost lg">← {t.backToCampaign}</Link>}
            </div>
            {c.endsAt && open && !team && <Countdown endsAt={c.endsAt} labels={[t.days, t.hours, t.mins, t.secs]} />}
          </div>
          <GoalCard t={t} locale={locale} currency={c.currency} goalCents={goalCents} bonusGoalCents={team ? null : c.bonusGoalCents} initial={initial} teamId={team?.id ?? null}>
            <div className="card-actions">
              <DonateTrigger className="btn lg block" disabled={blocked}>{donateLabel}</DonateTrigger>
              <div className="secure">🔒 {t.secure} · Stripe</div>
            </div>
          </GoalCard>
        </div>
        <Ticker t={t} locale={locale} />
      </section>

      <div className="wrap">
        {!team && (
          <div className="stats">
            <div className="stat"><b>{initial.donorCount.toLocaleString(locale)}</b><span>{t.statDonors}</span></div>
            <div className="stat"><b>{approved.length}</b><span>{t.statTeams}</span></div>
            <div className="stat"><b>{fm(Math.max(0, goalCents - total))}</b><span>{t.statToGo}</span></div>
            <div className="stat"><b>{matchLeft > 0 ? fm(matchLeft) : "—"}</b><span>{t.statMatchLeft}</span></div>
          </div>
        )}

        {!team && (
          <section className="section" id="give">
            <div className="section-h"><div><h2>{t.levelsTitle}</h2><p>{t.levelsSub}</p></div></div>
            <div className="levels">
              {LEVELS.map((a) => (
                <DonateTrigger key={a} amount={a} className="level" disabled={blocked}>
                  <b>{formatMoney(a * 100, c.currency, locale, true)}</b>
                  <span>{matchMultiplier > 0 ? fmt(t.becomes, { a: formatMoney(a * 100, c.currency, locale, true), b: formatMoney(Math.round(a * 100 * (1 + matchMultiplier)), c.currency, locale, true) }) : t.donate}</span>
                </DonateTrigger>
              ))}
            </div>
          </section>
        )}

        <section className="section" id="campaign-tabs">
          <CampaignTabs
            t={t}
            locale={locale}
            currency={c.currency}
            teamId={team?.id ?? null}
            donorCount={initial.donorCount}
            teams={teamRows}
            matchers={matcherRows}
            longDescription={c.longDescription}
            storyTitle={t.storyTitle}
            basis={c.leaderboardBasis}
            rules={rulesText(c, locale)}
          />
        </section>
      </div>

      <DonateModal
        t={t}
        locale={locale}
        mode={mode}
        open={open}
        currency={c.currency}
        fxRates={c.fxRates}
        presets={LEVELS}
        teamId={team?.id ?? null}
        teamName={team?.name ?? null}
        statementDescriptor={c.statementDescriptor}
        charityRegNo={c.charityRegNo}
        termsUrl={c.termsUrl}
        captcha={{ provider, siteKey: process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY ?? "" }}
        minCents={limits.minCents}
        matchMultiplier={matchMultiplier}
        heroImage={images[images.length > 1 ? 1 : 0]}
        title={c.title}
      />
      <ShareButton title={c.title} label={t.share} copied={t.copied} />
    </main>
  );
}
