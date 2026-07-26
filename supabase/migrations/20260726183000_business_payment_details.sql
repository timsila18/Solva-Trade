alter table public.businesses
  add column if not exists payment_details jsonb not null default '{}'::jsonb;

update public.businesses
set payment_details = payment_details || jsonb_build_object(
  'payment_display_name', 'Matteliana Fish Supply',
  'paybill_number', '111999',
  'paybill_account_number', '881520',
  'contact_phone', '0725769101',
  'whatsapp_number', '0725769101'
)
where lower(coalesce(trading_name, legal_name, '')) like '%matteliana%fish%supply%';
