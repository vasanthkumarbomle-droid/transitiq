# First administrator
1. Register an account from TRANSITIQ Admin sign in and verify the email if requested.
2. In the Supabase SQL Editor, replace the email below with the registered account email and run:
```sql
insert into public.admin_users(user_id)
select id from auth.users where lower(email)=lower('YOUR_EMAIL_ADDRESS')
on conflict(user_id) do nothing;
```
3. Sign in again or refresh. The allowlist is controlled by the project owner, not by browser metadata.
