-- 1. Access groups (maps to existing admin_role model)
CREATE TABLE public.access_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  role admin_role,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.access_groups TO authenticated;
GRANT ALL ON public.access_groups TO service_role;
ALTER TABLE public.access_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY access_groups_read ON public.access_groups FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE TABLE public.access_group_permissions (
  group_id uuid NOT NULL REFERENCES public.access_groups(id) ON DELETE CASCADE,
  permission text NOT NULL,
  PRIMARY KEY (group_id, permission)
);
GRANT SELECT ON public.access_group_permissions TO authenticated;
GRANT ALL ON public.access_group_permissions TO service_role;
ALTER TABLE public.access_group_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY access_group_permissions_read ON public.access_group_permissions FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

ALTER TABLE public.admin_members ADD COLUMN group_id uuid REFERENCES public.access_groups(id);

-- Backfill: system groups mirror the six existing roles, members keep their role mapping
INSERT INTO public.access_groups (slug, name, description, role, is_system)
VALUES
  ('superadmin', 'Superadmin', 'Akses penuh ke seluruh modul, termasuk pengelolaan pengguna dan hak akses.', 'superadmin', true),
  ('keuangan', 'Keuangan', 'Transaksi, verifikasi pembayaran, rekonsiliasi, dan laporan keuangan.', 'finance', true),
  ('program', 'Program', 'Katalog hewan, harga, program, alokasi, pengumuman, dan pelaksanaan.', 'program', true),
  ('petugas-lapangan', 'Petugas Lapangan', 'Unggah dokumentasi pelaksanaan di lapangan.', 'field_officer', true),
  ('auditor', 'Auditor', 'Akses baca laporan, keuangan, dan audit.', 'auditor', true),
  ('konten', 'Konten', 'Konten website, dokumentasi, dan notifikasi.', 'content', true);

INSERT INTO public.access_group_permissions (group_id, permission)
SELECT g.id, rp.permission FROM public.access_groups g JOIN public.role_permissions rp ON rp.role = g.role;

UPDATE public.admin_members m SET group_id = g.id FROM public.access_groups g WHERE g.role = m.role AND m.group_id IS NULL;

-- 2. Permission resolution: role permissions UNION active group permissions
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (
    select 1 from public.admin_members m
    left join public.access_groups g on g.id = m.group_id
    where m.user_id = _user_id and m.is_active and (
      exists (select 1 from public.role_permissions rp where rp.role = m.role and (rp.permission = _perm or rp.permission = '*'))
      or (g.is_active and exists (select 1 from public.access_group_permissions gp where gp.group_id = g.id and (gp.permission = _perm or gp.permission = '*')))
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.my_admin_access()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select coalesce((
    select jsonb_build_object(
      'role', m.role,
      'group', case when g.id is null then null else jsonb_build_object('slug', g.slug, 'name', g.name) end,
      'permissions', (
        select coalesce(jsonb_agg(distinct perms.p), '[]'::jsonb) from (
          select rp.permission as p from public.role_permissions rp where rp.role = m.role
          union
          select gp.permission from public.access_group_permissions gp join public.access_groups g2 on g2.id = gp.group_id
          where g2.id = m.group_id and g2.is_active
        ) perms
      ))
    from public.admin_members m
    left join public.access_groups g on g.id = m.group_id
    where m.user_id = auth.uid() and m.is_active), 'null'::jsonb)
$$;