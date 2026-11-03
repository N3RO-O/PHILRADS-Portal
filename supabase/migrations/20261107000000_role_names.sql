-- Role names lose the "(placeholder)" they were created with, and descriptions the trailing "TBC".
update public.roles
set name = trim(replace(name, '(placeholder)', '')),
    description = nullif(trim(regexp_replace(description, '\s*TBC\.?\s*$', '')), '')
where name like '%(placeholder)%' or description ~ 'TBC\.?\s*$';
