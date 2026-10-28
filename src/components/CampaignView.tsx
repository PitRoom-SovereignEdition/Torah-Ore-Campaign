import Link from "next/link";
import { CampaignTabs, type MatcherRow, type TeamRow } from "./CampaignTabs";
import { DonateButton } from "./DonateModal";
import { GoalCard } from "./GoalCard";
import { HeroCarousel } from "./HeroCarousel";
import { ShareButton } from "./ShareButton";
import { captchaProvider } from "@/lib/captcha";
import { limits, paymentsMode } from "@/lib/config";
import { campaignOpen, getTotals } from "@/lib/donations";
import { getDict } from "@/lib/i18n";
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

export async function CampaignView({ team }: { team: Team | null }) {
  const { t, lang } = await getDict();
  const locale = lang === "he" ? "he-IL" : "en-US";
  const store = getStore();
  const c = await store.getCampaign();
  const [totals, teams] = await Promise.all([getTotals(c), store.listTeams()]);

  const scoped = team ? (totals.teamTotals[team.id] ?? { cashCents: 0, count: 0 }) : null;
  const initial = scoped
    ? { cashCents: scoped.cashCents, matchedCents: 0, donorCount: scoped.count }
    : { cashCents: totals.cashCents, matchedCents: totals.matchedCents, donorCount: totals.donorCount };

  const teamRows: TeamRow[] = teams
    .filter((x) => x.approved)
    .map((x) => ({ id: x.id, name: x.name, goalCents: x.goalCents, cashCents: totals.teamTotals[x.id]?.cashCents ?? 0, count: totals.teamTotals[x.id]?.count ?? 0 }))
    .sort((a, b) => b.cashCents - a.cashCents);
  const matcherRows: MatcherRow[] = totals.matchers.map((m) => ({
    id: m.matcher.id, name: m.matcher.name, multiplier: m.matcher.multiplier, capCents: m.matcher.capCents,
    matchedCents: m.matchedCents, windowEnd: m.matcher.windowEnd,
  }));

  const embed = videoEmbed(c.videoUrl);
  const short = c.description.length > 160 ? c.description.slice(0, 160).trimEnd() + "…" : c.description;
  const goalCents = team?.goalCents ?? c.goalCents;
  const mode = paymentsMode();
  const provider = captchaProvider();

  const donate = (
    <DonateButton
      t={t}
      locale={locale}
      mode={mode}
      open={campaignOpen(c)}
      currency={c.currency}
      fxRates={c.fxRates}
      presets={[18, 36, 100, 180, 360, 1000]}
      teamId={team?.id ?? null}
      teamName={team?.name ?? null}
      statementDescriptor={c.statementDescriptor}
      charityRegNo={c.charityRegNo}
      termsUrl={c.termsUrl}
      captcha={{ provider, siteKey: process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY ?? "" }}
      minCents={limits.minCents}
    />
  );

  return (
    <main className="wrap page">
      <div className="title">
        <h1>{team ? team.name : c.title}</h1>
        <p>{team ? c.title : c.subtitle}</p>
      </div>

      <div className="hero">
        <div className="hero-media">
          {embed ? (
            <iframe src={embed} title="Campaign video" allow="fullscreen; picture-in-picture" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
          ) : (
            <HeroCarousel images={c.heroMedia.length ? c.heroMedia : ["/hero.svg"]} />
          )}
        </div>
        <GoalCard
          t={t}
          locale={locale}
          currency={c.currency}
          goalCents={goalCents}
          bonusGoalCents={team ? null : c.bonusGoalCents}
          initial={initial}
          teamId={team?.id ?? null}
        >
          {donate}
          {team && <Link href="/" className="note center">← {t.backToCampaign}</Link>}
        </GoalCard>
      </div>

      <details className="desc">
        <summary style={{ listStyle: "none" }}>
          {team?.message || short} <span style={{ color: "var(--brand)", textDecoration: "underline", cursor: "pointer" }}>{t.more}</span>
        </summary>
        <p>{c.description}</p>
      </details>

      <CampaignTabs
        t={t}
        locale={locale}
        currency={c.currency}
        teamId={team?.id ?? null}
        donorCount={initial.donorCount}
        teams={teamRows}
        matchers={matcherRows}
        longDescription={c.longDescription}
      />
      <ShareButton title={c.title} label={t.share} copied={t.copied} />
    </main>
  );
}
