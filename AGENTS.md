<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Public pages live under the `_site` pathless layout; participant portal under `/portal`, admin under `/admin`, each driven by nav config in `src/lib/navigation.ts` — one source of truth for menus.
- Pricing/installment math lives only in `src/lib/pricing.ts` (covered by `src/test/pricing.test.ts`); public values are sample data until replaced by DB prices locked per commitment.
- Clearly label sample, demo and pending-approval content with the shared `Notice`/`StatusPill`/`Placeholder` components — never present drafts as final.
