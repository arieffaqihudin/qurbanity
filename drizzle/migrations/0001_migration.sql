revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.current_price(uuid) from public, anon, authenticated;
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
drop policy "public read contracts" on public.contract_versions;
create policy "public read contracts" on public.contract_versions for select to anon, authenticated using (status <> 'retired');