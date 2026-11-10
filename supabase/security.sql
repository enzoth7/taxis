-- La función de trigger sigue funcionando, pero no queda expuesta por la API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
