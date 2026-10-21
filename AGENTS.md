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
- Portal and admin routes live under `src/routes/_authenticated/` (client-only gate, redirects to `/auth`); admin additionally checks `user_roles` in `beforeLoad`, but real enforcement is RLS + `has_role()`.
- Commitments are created ONLY through the `create_commitment` SECURITY DEFINER RPC, which recomputes prices server-side and snapshots them; clients have no INSERT/UPDATE grants on commitment, consent, share or plan tables.
- `verified_paid_amount` is reserved for the future verified-payment ledger; `payment_status` is a generated column derived from it. Never expose a client write path to either.
- Price history (`animal_prices`), consent records and audit logs are append-only (triggers block UPDATE/DELETE); add new rows instead of editing.
- Share price rule lives in two mirrored places: SQL `price_per_share()` and TS `sharePrice()` (tested) — change both together.
